import { useState, useCallback, useEffect } from 'react';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';

interface OptimizedParameters {
  parameters: Record<string, number>;
  timestamp: number;
  dataHash: string;
  confidence?: number;
}

interface OptimizationCache {
  [sku: string]: {
    [modelId: string]: OptimizedParameters;
  };
}

interface DatasetFingerprint {
  globalHash: string;
  skuCount: number;
  totalRecords: number;
  dateRange: string;
  cleaningHash: string; // Include cleaning state
  timestamp: number;
}

interface OptimizationSession {
  sessionId: string;
  datasetFingerprint: DatasetFingerprint;
  completedSKUs: Set<string>;
  optimizationComplete: boolean;
  timestamp: number;
}

interface CacheManifest {
  datasetFingerprint: DatasetFingerprint;
  validEntries: Set<string>;
  lastValidated: number;
  optimizationSession?: OptimizationSession;
}

const CACHE_KEY = 'forecast_optimization_cache';
const MANIFEST_KEY = 'forecast_cache_manifest';
const SESSION_KEY = 'forecast_optimization_session';
const CACHE_EXPIRY_HOURS = 24;
const MANIFEST_EXPIRY_HOURS = 24; // Increased from 1 hour
const SESSION_EXPIRY_HOURS = 24;

export const useOptimizationCache = () => {
  const [cache, setCache] = useState<OptimizationCache>({});
  const [cacheStats, setCacheStats] = useState({ hits: 0, misses: 0, skipped: 0 });
  const [manifest, setManifest] = useState<CacheManifest | null>(null);
  const [currentSession, setCurrentSession] = useState<OptimizationSession | null>(null);

  // Generate a unique session ID
  const generateSessionId = useCallback(() => {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }, []);

  // Load cache, manifest, and session from localStorage on mount
  useEffect(() => {
    try {
      // Load cache
      const stored = localStorage.getItem(CACHE_KEY);
      if (stored) {
        const parsedCache = JSON.parse(stored);
        const now = Date.now();
        const filteredCache: OptimizationCache = {};
        
        Object.keys(parsedCache).forEach(sku => {
          Object.keys(parsedCache[sku]).forEach(modelId => {
            const entry = parsedCache[sku][modelId];
            if (now - entry.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000) {
              if (!filteredCache[sku]) filteredCache[sku] = {};
              filteredCache[sku][modelId] = entry;
            }
          });
        });
        
        setCache(filteredCache);
        console.log('Loaded optimization cache from storage');
      }

      // Load manifest
      const storedManifest = localStorage.getItem(MANIFEST_KEY);
      if (storedManifest) {
        const parsedManifest = JSON.parse(storedManifest);
        const now = Date.now();
        if (now - parsedManifest.lastValidated < MANIFEST_EXPIRY_HOURS * 60 * 60 * 1000) {
          parsedManifest.validEntries = new Set(parsedManifest.validEntries);
          if (parsedManifest.optimizationSession) {
            parsedManifest.optimizationSession.completedSKUs = new Set(parsedManifest.optimizationSession.completedSKUs);
          }
          setManifest(parsedManifest);
          console.log('Loaded cache manifest from storage');
        }
      }

      // Load session
      const storedSession = localStorage.getItem(SESSION_KEY);
      if (storedSession) {
        const parsedSession = JSON.parse(storedSession);
        const now = Date.now();
        if (now - parsedSession.timestamp < SESSION_EXPIRY_HOURS * 60 * 60 * 1000) {
          parsedSession.completedSKUs = new Set(parsedSession.completedSKUs);
          setCurrentSession(parsedSession);
          console.log('Loaded optimization session from storage');
        }
      }
    } catch (error) {
      console.error('Failed to load cache from localStorage:', error);
    }
  }, []);

  // Save cache to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.error('Failed to save cache to localStorage:', error);
    }
  }, [cache]);

  // Save manifest to localStorage whenever it changes
  useEffect(() => {
    if (manifest) {
      try {
        const manifestToStore = {
          ...manifest,
          validEntries: Array.from(manifest.validEntries),
          optimizationSession: manifest.optimizationSession ? {
            ...manifest.optimizationSession,
            completedSKUs: Array.from(manifest.optimizationSession.completedSKUs)
          } : undefined
        };
        localStorage.setItem(MANIFEST_KEY, JSON.stringify(manifestToStore));
      } catch (error) {
        console.error('Failed to save manifest to localStorage:', error);
      }
    }
  }, [manifest]);

  // Save session to localStorage whenever it changes
  useEffect(() => {
    if (currentSession) {
      try {
        const sessionToStore = {
          ...currentSession,
          completedSKUs: Array.from(currentSession.completedSKUs)
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(sessionToStore));
      } catch (error) {
        console.error('Failed to save session to localStorage:', error);
      }
    }
  }, [currentSession]);

  const generateDatasetFingerprint = useCallback((data: SalesData[]): DatasetFingerprint => {
    const skus = Array.from(new Set(data.map(d => d.sku))).sort();
    const dates = data.map(d => d.date).sort();
    const totalSales = data.reduce((sum, d) => sum + d.sales, 0);
    
    // Include outlier/cleaning state in fingerprint
    const outlierCount = data.filter(d => d.isOutlier).length;
    const notesCount = data.filter(d => d.note).length;
    
    const fingerprintData = {
      skus: skus.join(','),
      skuCount: skus.length,
      totalRecords: data.length,
      totalSales: Math.round(totalSales),
      dateRange: `${dates[0]}-${dates[dates.length - 1]}`,
      avgSales: Math.round(totalSales / data.length),
      outlierCount,
      notesCount
    };
    
    const globalHash = btoa(JSON.stringify(fingerprintData)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
    const cleaningHash = btoa(`${outlierCount}-${notesCount}`).replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
    
    return {
      globalHash,
      skuCount: skus.length,
      totalRecords: data.length,
      dateRange: fingerprintData.dateRange,
      cleaningHash,
      timestamp: Date.now()
    };
  }, []);

  const generateDataHash = useCallback((skuData: SalesData[]): string => {
    const recent = skuData.slice(-20);
    const sum = recent.reduce((acc, d) => acc + d.sales, 0);
    const avg = sum / recent.length;
    const values = recent.map(d => Math.round(d.sales)).join('-');
    const outlierFlags = recent.map(d => d.isOutlier ? '1' : '0').join('');
    return `${skuData.length}-${Math.round(avg)}-${values.substring(0, 50)}-${outlierFlags}`;
  }, []);

  const isDatasetUnchanged = useCallback((data: SalesData[]): boolean => {
    const currentFingerprint = generateDatasetFingerprint(data);
    
    // Check session first
    if (currentSession && currentSession.datasetFingerprint.globalHash === currentFingerprint.globalHash) {
      console.log('Session fingerprint check: UNCHANGED');
      return true;
    }
    
    // Check manifest
    if (manifest && manifest.datasetFingerprint.globalHash === currentFingerprint.globalHash) {
      console.log('Manifest fingerprint check: UNCHANGED');
      return true;
    }
    
    console.log('Dataset fingerprint check: CHANGED');
    console.log(`Current: ${currentFingerprint.globalHash}, Session: ${currentSession?.datasetFingerprint.globalHash}, Manifest: ${manifest?.datasetFingerprint.globalHash}`);
    
    return false;
  }, [currentSession, manifest, generateDatasetFingerprint]);

  const isOptimizationCompleteForSession = useCallback((data: SalesData[], models: ModelConfig[]): boolean => {
    if (!currentSession || !currentSession.optimizationComplete) {
      return false;
    }
    
    const currentFingerprint = generateDatasetFingerprint(data);
    if (currentSession.datasetFingerprint.globalHash !== currentFingerprint.globalHash) {
      console.log('Session dataset changed, optimization not complete');
      return false;
    }
    
    const enabledModels = models.filter(m => m.enabled && m.parameters && Object.keys(m.parameters).length > 0);
    const allSKUs = Array.from(new Set(data.map(d => d.sku))).sort();
    
    // Check if all SKUs with sufficient data are covered
    const skusWithSufficientData = allSKUs.filter(sku => {
      const skuData = data.filter(d => d.sku === sku);
      return skuData.length >= 3;
    });
    
    const allCovered = skusWithSufficientData.every(sku => 
      currentSession.completedSKUs.has(sku)
    );
    
    console.log(`Session optimization check: ${allCovered ? 'COMPLETE' : 'INCOMPLETE'} (${currentSession.completedSKUs.size}/${skusWithSufficientData.length} SKUs)`);
    return allCovered;
  }, [currentSession, generateDatasetFingerprint]);

  const startOptimizationSession = useCallback((data: SalesData[]) => {
    const fingerprint = generateDatasetFingerprint(data);
    const sessionId = generateSessionId();
    
    const newSession: OptimizationSession = {
      sessionId,
      datasetFingerprint: fingerprint,
      completedSKUs: new Set(),
      optimizationComplete: false,
      timestamp: Date.now()
    };
    
    setCurrentSession(newSession);
    console.log(`Started new optimization session: ${sessionId}`);
  }, [generateDatasetFingerprint, generateSessionId]);

  const markSKUOptimized = useCallback((sku: string) => {
    setCurrentSession(prev => {
      if (!prev) return prev;
      const newCompletedSKUs = new Set(prev.completedSKUs);
      newCompletedSKUs.add(sku);
      return {
        ...prev,
        completedSKUs: newCompletedSKUs
      };
    });
  }, []);

  const completeOptimizationSession = useCallback(() => {
    setCurrentSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        optimizationComplete: true
      };
    });
    console.log('Optimization session marked as complete');
  }, []);

  const batchValidateCache = useCallback((data: SalesData[], models: ModelConfig[]): CacheManifest => {
    const fingerprint = generateDatasetFingerprint(data);
    const validEntries = new Set<string>();
    
    // If dataset is unchanged, use existing valid entries
    if (manifest && fingerprint.globalHash === manifest.datasetFingerprint.globalHash) {
      console.log('Dataset unchanged, using existing cache manifest');
      return {
        ...manifest,
        lastValidated: Date.now()
      };
    }
    
    console.log('Dataset changed or no manifest, rebuilding cache validity');
    
    // Rebuild cache validity
    const skus = Array.from(new Set(data.map(d => d.sku))).sort();
    
    skus.forEach(sku => {
      const skuData = data.filter(d => d.sku === sku);
      if (skuData.length < 3) return;
      
      const dataHash = generateDataHash(skuData);
      
      models.forEach(model => {
        if (!model.enabled || !model.parameters || Object.keys(model.parameters).length === 0) return;
        
        const cached = cache[sku]?.[model.id];
        if (cached && cached.dataHash === dataHash) {
          validEntries.add(`${sku}:${model.id}`);
        }
      });
    });
    
    const newManifest: CacheManifest = {
      datasetFingerprint: fingerprint,
      validEntries,
      lastValidated: Date.now(),
      optimizationSession: currentSession
    };
    
    setManifest(newManifest);
    console.log(`Cache manifest updated: ${validEntries.size} valid entries`);
    
    return newManifest;
  }, [cache, manifest, currentSession, generateDatasetFingerprint, generateDataHash]);

  const getCachedParameters = useCallback((sku: string, modelId: string): OptimizedParameters | null => {
    const cached = cache[sku]?.[modelId];
    if (cached) {
      setCacheStats(prev => ({ ...prev, hits: prev.hits + 1 }));
      console.log(`Cache HIT for ${sku}:${modelId}`);
      return cached;
    } else {
      setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
      console.log(`Cache MISS for ${sku}:${modelId}`);
      return null;
    }
  }, [cache]);

  const setCachedParameters = useCallback((
    sku: string, 
    modelId: string, 
    parameters: Record<string, number>,
    dataHash: string,
    confidence?: number
  ) => {
    setCache(prev => ({
      ...prev,
      [sku]: {
        ...prev[sku],
        [modelId]: {
          parameters,
          timestamp: Date.now(),
          dataHash,
          confidence
        }
      }
    }));
    
    // Update manifest to mark this entry as valid
    setManifest(prev => {
      if (!prev) return prev;
      const newValidEntries = new Set(prev.validEntries);
      newValidEntries.add(`${sku}:${modelId}`);
      return {
        ...prev,
        validEntries: newValidEntries
      };
    });
    
    console.log(`Cached parameters for ${sku}:${modelId}`);
  }, []);

  const isCacheValid = useCallback((sku: string, modelId: string, currentDataHash: string): boolean => {
    const cached = getCachedParameters(sku, modelId);
    if (!cached) return false;
    
    const isValid = cached.dataHash === currentDataHash;
    return isValid;
  }, [getCachedParameters]);

  const getSKUsNeedingOptimization = useCallback((
    data: SalesData[], 
    models: ModelConfig[]
  ): { sku: string; models: string[] }[] => {
    // First check if optimization is already complete for this session
    if (isOptimizationCompleteForSession(data, models)) {
      console.log('Session optimization complete, no SKUs need optimization');
      setCacheStats(prev => ({ ...prev, skipped: prev.skipped + 1 }));
      return [];
    }
    
    // Check if we can skip entirely due to unchanged dataset
    if (isDatasetUnchanged(data)) {
      console.log('Dataset unchanged, checking manifest for optimization needs');
      
      const currentManifest = manifest!;
      const enabledModelsWithParams = models.filter(m => 
        m.enabled && m.parameters && Object.keys(m.parameters).length > 0
      );
      
      const skus = Array.from(new Set(data.map(d => d.sku))).sort();
      const result: { sku: string; models: string[] }[] = [];
      
      skus.forEach(sku => {
        const skuData = data.filter(d => d.sku === sku);
        if (skuData.length < 3) return;
        
        const modelsNeedingOptimization = enabledModelsWithParams
          .filter(m => !currentManifest.validEntries.has(`${sku}:${m.id}`))
          .map(m => m.id);
        
        if (modelsNeedingOptimization.length > 0) {
          result.push({ sku, models: modelsNeedingOptimization });
        }
      });
      
      console.log(`Using manifest: ${result.length} SKUs need optimization`);
      setCacheStats(prev => ({ ...prev, skipped: prev.skipped + 1 }));
      return result;
    }
    
    // Dataset changed, do full validation
    console.log('Dataset changed, performing full cache validation');
    const updatedManifest = batchValidateCache(data, models);
    
    const enabledModelsWithParams = models.filter(m => 
      m.enabled && m.parameters && Object.keys(m.parameters).length > 0
    );
    
    const skus = Array.from(new Set(data.map(d => d.sku))).sort();
    const result: { sku: string; models: string[] }[] = [];
    
    skus.forEach(sku => {
      const skuData = data.filter(d => d.sku === sku);
      if (skuData.length < 3) return;
      
      const modelsNeedingOptimization = enabledModelsWithParams
        .filter(m => !updatedManifest.validEntries.has(`${sku}:${m.id}`))
        .map(m => m.id);
      
      if (modelsNeedingOptimization.length > 0) {
        result.push({ sku, models: modelsNeedingOptimization });
      }
    });
    
    return result;
  }, [isOptimizationCompleteForSession, isDatasetUnchanged, manifest, batchValidateCache]);

  const clearCacheForSKU = useCallback((sku: string) => {
    setCache(prev => {
      const newCache = { ...prev };
      delete newCache[sku];
      return newCache;
    });
    
    // Remove from manifest
    setManifest(prev => {
      if (!prev) return prev;
      const newValidEntries = new Set(prev.validEntries);
      Array.from(newValidEntries).forEach(entry => {
        if (entry.startsWith(`${sku}:`)) {
          newValidEntries.delete(entry);
        }
      });
      return {
        ...prev,
        validEntries: newValidEntries
      };
    });
  }, []);

  return {
    cache,
    cacheStats,
    generateDataHash,
    getCachedParameters,
    setCachedParameters,
    isCacheValid,
    getSKUsNeedingOptimization,
    clearCacheForSKU,
    isDatasetUnchanged,
    batchValidateCache,
    isOptimizationCompleteForSession,
    startOptimizationSession,
    markSKUOptimized,
    completeOptimizationSession
  };
};
