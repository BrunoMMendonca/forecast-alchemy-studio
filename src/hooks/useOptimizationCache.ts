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
  cleaningHash: string;
  timestamp: number;
}

interface OptimizationSession {
  sessionId: string;
  datasetFingerprint: DatasetFingerprint;
  completedSKUs: Set<string>;
  optimizationComplete: boolean;
  startedOptimization: boolean;
  timestamp: number;
}

interface CacheManifest {
  datasetFingerprint: DatasetFingerprint;
  validEntries: Set<string>;
  lastValidated: number;
  optimizationSession?: OptimizationSession;
}

interface NavigationState {
  datasetFingerprint: string;
  optimizationCompleted: boolean;
  timestamp: number;
}

const CACHE_KEY = 'forecast_optimization_cache';
const MANIFEST_KEY = 'forecast_cache_manifest';
const SESSION_KEY = 'forecast_optimization_session';
const NAVIGATION_STATE_KEY = 'forecast_navigation_state';
const CACHE_EXPIRY_HOURS = 24;
const MANIFEST_EXPIRY_HOURS = 24;
const SESSION_EXPIRY_HOURS = 24;
const NAVIGATION_STATE_EXPIRY_HOURS = 24;

export const useOptimizationCache = () => {
  const [cache, setCache] = useState<OptimizationCache>({});
  const [cacheStats, setCacheStats] = useState({ hits: 0, misses: 0, skipped: 0 });
  const [manifest, setManifest] = useState<CacheManifest | null>(null);
  const [currentSession, setCurrentSession] = useState<OptimizationSession | null>(null);
  const [navigationState, setNavigationState] = useState<NavigationState | null>(null);

  // Generate a unique session ID
  const generateSessionId = useCallback(() => {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }, []);

  // Load all state from localStorage on mount
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
        console.log('Enhanced cache: Loaded optimization cache from storage');
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
          console.log('Enhanced cache: Loaded cache manifest from storage');
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
          console.log('Enhanced cache: Loaded optimization session from storage');
        }
      }

      // Load navigation state
      const storedNavState = localStorage.getItem(NAVIGATION_STATE_KEY);
      if (storedNavState) {
        const parsedNavState = JSON.parse(storedNavState);
        const now = Date.now();
        if (now - parsedNavState.timestamp < NAVIGATION_STATE_EXPIRY_HOURS * 60 * 60 * 1000) {
          setNavigationState(parsedNavState);
          console.log('Enhanced cache: Loaded navigation state from storage');
        }
      }
    } catch (error) {
      console.error('Enhanced cache: Failed to load from localStorage:', error);
    }
  }, []);

  // Save states to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.error('Enhanced cache: Failed to save cache to localStorage:', error);
    }
  }, [cache]);

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
        console.error('Enhanced cache: Failed to save manifest to localStorage:', error);
      }
    }
  }, [manifest]);

  useEffect(() => {
    if (currentSession) {
      try {
        const sessionToStore = {
          ...currentSession,
          completedSKUs: Array.from(currentSession.completedSKUs)
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(sessionToStore));
      } catch (error) {
        console.error('Enhanced cache: Failed to save session to localStorage:', error);
      }
    }
  }, [currentSession]);

  useEffect(() => {
    if (navigationState) {
      try {
        localStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(navigationState));
      } catch (error) {
        console.error('Enhanced cache: Failed to save navigation state to localStorage:', error);
      }
    }
  }, [navigationState]);

  // Fixed dataset fingerprinting to be stable across navigation
  const generateDatasetFingerprint = useCallback((data: SalesData[]): DatasetFingerprint => {
    // Sort data to ensure consistent ordering
    const sortedData = [...data].sort((a, b) => {
      const skuCompare = a.sku.localeCompare(b.sku);
      if (skuCompare !== 0) return skuCompare;
      return a.date.localeCompare(b.date);
    });
    
    const skus = Array.from(new Set(sortedData.map(d => d.sku))).sort();
    const dates = sortedData.map(d => d.date);
    
    // Create stable data signature
    const dataSignature = {
      skuCount: skus.length,
      totalRecords: sortedData.length,
      firstDate: dates[0],
      lastDate: dates[dates.length - 1],
      totalSales: Math.round(sortedData.reduce((sum, d) => sum + d.sales, 0)),
      avgSales: Math.round(sortedData.reduce((sum, d) => sum + d.sales, 0) / sortedData.length)
    };
    
    // Include cleaning state in fingerprint - this tracks outlier detection/cleaning
    const cleaningSignature = {
      outliersMarked: sortedData.filter(d => d.isOutlier).length,
      notesCount: sortedData.filter(d => d.note && d.note.trim()).length,
      // Create a signature of all sales values to detect modifications
      salesSignature: sortedData.map(d => Math.round(d.sales * 100) / 100).join(',').substring(0, 100)
    };
    
    const globalHash = btoa(JSON.stringify(dataSignature)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
    const cleaningHash = btoa(JSON.stringify(cleaningSignature)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
    
    return {
      globalHash,
      skuCount: skus.length,
      totalRecords: sortedData.length,
      dateRange: `${dataSignature.firstDate}-${dataSignature.lastDate}`,
      cleaningHash,
      timestamp: Date.now()
    };
  }, []);

  const generateDataHash = useCallback((skuData: SalesData[]): string => {
    // Sort to ensure consistent ordering
    const sorted = [...skuData].sort((a, b) => a.date.localeCompare(b.date));
    const salesValues = sorted.map(d => Math.round(d.sales * 100) / 100).join('-');
    const outlierFlags = sorted.map(d => d.isOutlier ? '1' : '0').join('');
    const noteFlags = sorted.map(d => d.note ? '1' : '0').join('');
    
    return `${sorted.length}-${salesValues.substring(0, 50)}-${outlierFlags}-${noteFlags}`.substring(0, 100);
  }, []);

  // Get stable dataset fingerprint for dependency tracking
  const getDatasetFingerprintString = useCallback((data: SalesData[]): string => {
    const fingerprint = generateDatasetFingerprint(data);
    return `${fingerprint.globalHash}:${fingerprint.cleaningHash}`;
  }, [generateDatasetFingerprint]);

  // PRIORITY 1: Check navigation state - highest priority
  const isOptimizationCompleteByNavigation = useCallback((data: SalesData[]): boolean => {
    if (!navigationState) {
      console.log('Enhanced cache: No navigation state found');
      return false;
    }
    
    const currentFingerprint = getDatasetFingerprintString(data);
    const isComplete = navigationState.datasetFingerprint === currentFingerprint && navigationState.optimizationCompleted;
    
    console.log(`Enhanced cache: Navigation check - fingerprint match: ${navigationState.datasetFingerprint === currentFingerprint}, complete: ${navigationState.optimizationCompleted}, result: ${isComplete}`);
    
    return isComplete;
  }, [navigationState, getDatasetFingerprintString]);

  // PRIORITY 2: Check session state
  const isOptimizationCompleteBySession = useCallback((data: SalesData[], models: ModelConfig[]): boolean => {
    if (!currentSession || !currentSession.optimizationComplete) {
      console.log('Enhanced cache: No session or session not complete');
      return false;
    }
    
    const currentFingerprint = generateDatasetFingerprint(data);
    
    if (currentSession.datasetFingerprint.globalHash !== currentFingerprint.globalHash ||
        currentSession.datasetFingerprint.cleaningHash !== currentFingerprint.cleaningHash) {
      console.log('Enhanced cache: Session dataset fingerprint mismatch');
      return false;
    }
    
    const allSKUs = Array.from(new Set(data.map(d => d.sku))).sort();
    const skusWithSufficientData = allSKUs.filter(sku => {
      const skuData = data.filter(d => d.sku === sku);
      return skuData.length >= 3;
    });
    
    const allCovered = skusWithSufficientData.every(sku => 
      currentSession.completedSKUs.has(sku)
    );
    
    console.log(`Enhanced cache: Session check - ${allCovered ? 'COMPLETE' : 'INCOMPLETE'} (${currentSession.completedSKUs.size}/${skusWithSufficientData.length} SKUs)`);
    
    return allCovered;
  }, [currentSession, generateDatasetFingerprint]);

  // NEW: Main optimization completion check with proper priority
  const isOptimizationComplete = useCallback((data: SalesData[], models: ModelConfig[]): boolean => {
    // PRIORITY 1: Navigation state (persistent across navigation)
    if (isOptimizationCompleteByNavigation(data)) {
      console.log('Enhanced cache: ✅ Optimization complete via NAVIGATION STATE');
      setCacheStats(prev => ({ ...prev, skipped: prev.skipped + 1 }));
      return true;
    }
    
    // PRIORITY 2: Session state (current session)
    if (isOptimizationCompleteBySession(data, models)) {
      console.log('Enhanced cache: ✅ Optimization complete via SESSION STATE');
      
      // Update navigation state to persist this completion
      const currentFingerprint = getDatasetFingerprintString(data);
      setNavigationState({
        datasetFingerprint: currentFingerprint,
        optimizationCompleted: true,
        timestamp: Date.now()
      });
      
      setCacheStats(prev => ({ ...prev, skipped: prev.skipped + 1 }));
      return true;
    }
    
    console.log('Enhanced cache: ❌ Optimization NOT complete - needs optimization');
    return false;
  }, [isOptimizationCompleteByNavigation, isOptimizationCompleteBySession, getDatasetFingerprintString]);

  // Check if optimization has been started for this dataset
  const hasOptimizationStarted = useCallback((data: SalesData[]): boolean => {
    const currentFingerprint = getDatasetFingerprintString(data);
    
    // Check navigation state first
    if (navigationState && navigationState.datasetFingerprint === currentFingerprint) {
      console.log('Enhanced cache: Navigation state indicates optimization completed');
      return navigationState.optimizationCompleted;
    }
    
    // Check session state
    if (currentSession && currentSession.startedOptimization) {
      const sessionFingerprint = `${currentSession.datasetFingerprint.globalHash}:${currentSession.datasetFingerprint.cleaningHash}`;
      if (sessionFingerprint === currentFingerprint) {
        console.log('Enhanced cache: Session indicates optimization started');
        return true;
      }
    }
    
    console.log('Enhanced cache: No optimization started for this dataset');
    return false;
  }, [navigationState, currentSession, getDatasetFingerprintString]);

  // Mark optimization as started for this dataset
  const markOptimizationStarted = useCallback((data: SalesData[]) => {
    const fingerprint = generateDatasetFingerprint(data);
    
    // Update session to mark optimization as started
    setCurrentSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        startedOptimization: true
      };
    });
    
    console.log('Enhanced cache: Marked optimization as started');
  }, [generateDatasetFingerprint]);

  const startOptimizationSession = useCallback((data: SalesData[]) => {
    const fingerprint = generateDatasetFingerprint(data);
    const sessionId = generateSessionId();
    
    const newSession: OptimizationSession = {
      sessionId,
      datasetFingerprint: fingerprint,
      completedSKUs: new Set(),
      optimizationComplete: false,
      startedOptimization: true,
      timestamp: Date.now()
    };
    
    setCurrentSession(newSession);
    console.log(`Enhanced cache: Started new optimization session: ${sessionId}`);
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
    
    // Update navigation state to mark optimization as complete
    if (currentSession) {
      const fingerprint = `${currentSession.datasetFingerprint.globalHash}:${currentSession.datasetFingerprint.cleaningHash}`;
      setNavigationState({
        datasetFingerprint: fingerprint,
        optimizationCompleted: true,
        timestamp: Date.now()
      });
    }
    
    console.log('Enhanced cache: Optimization session marked as complete');
  }, [currentSession]);

  const batchValidateCache = useCallback((data: SalesData[], models: ModelConfig[]): CacheManifest => {
    const fingerprint = generateDatasetFingerprint(data);
    const validEntries = new Set<string>();
    
    // If dataset is unchanged (including cleaning state), use existing valid entries
    if (manifest && 
        fingerprint.globalHash === manifest.datasetFingerprint.globalHash &&
        fingerprint.cleaningHash === manifest.datasetFingerprint.cleaningHash) {
      console.log('Enhanced cache: Dataset completely unchanged, using existing cache manifest');
      return {
        ...manifest,
        lastValidated: Date.now()
      };
    }
    
    console.log('Enhanced cache: Dataset or cleaning state changed, rebuilding cache validity');
    
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
    console.log(`Enhanced cache: Cache manifest updated - ${validEntries.size} valid entries`);
    
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

  // SIMPLIFIED: Get SKUs needing optimization without circular dependency
  const getSKUsNeedingOptimization = useCallback((
    data: SalesData[], 
    models: ModelConfig[]
  ): { sku: string; models: string[] }[] => {
    console.log('Enhanced cache: Checking SKUs needing optimization...');
    
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
    
    console.log(`Enhanced cache: ${result.length} SKUs need optimization`);
    return result;
  }, [batchValidateCache]);

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
    batchValidateCache,
    isOptimizationComplete,
    startOptimizationSession,
    markSKUOptimized,
    completeOptimizationSession,
    getDatasetFingerprintString,
    hasOptimizationStarted,
    markOptimizationStarted
  };
};
