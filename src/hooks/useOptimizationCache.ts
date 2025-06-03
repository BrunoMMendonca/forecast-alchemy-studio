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
  timestamp: number;
}

interface CacheManifest {
  datasetFingerprint: DatasetFingerprint;
  validEntries: Set<string>; // SKU:modelId combinations that are valid
  lastValidated: number;
}

const CACHE_KEY = 'forecast_optimization_cache';
const MANIFEST_KEY = 'forecast_cache_manifest';
const CACHE_EXPIRY_HOURS = 24;
const MANIFEST_EXPIRY_HOURS = 1; // Revalidate manifest every hour

export const useOptimizationCache = () => {
  const [cache, setCache] = useState<OptimizationCache>({});
  const [cacheStats, setCacheStats] = useState({ hits: 0, misses: 0, skipped: 0 });
  const [manifest, setManifest] = useState<CacheManifest | null>(null);

  // Load cache and manifest from localStorage on mount
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
          setManifest(parsedManifest);
          console.log('Loaded cache manifest from storage');
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
          validEntries: Array.from(manifest.validEntries)
        };
        localStorage.setItem(MANIFEST_KEY, JSON.stringify(manifestToStore));
      } catch (error) {
        console.error('Failed to save manifest to localStorage:', error);
      }
    }
  }, [manifest]);

  const generateDatasetFingerprint = useCallback((data: SalesData[]): DatasetFingerprint => {
    const skus = Array.from(new Set(data.map(d => d.sku))).sort();
    const dates = data.map(d => d.date).sort();
    const totalSales = data.reduce((sum, d) => sum + d.sales, 0);
    
    // Create a more robust fingerprint
    const fingerprintData = {
      skus: skus.join(','),
      skuCount: skus.length,
      totalRecords: data.length,
      totalSales: Math.round(totalSales),
      dateRange: `${dates[0]}-${dates[dates.length - 1]}`,
      avgSales: Math.round(totalSales / data.length)
    };
    
    const globalHash = btoa(JSON.stringify(fingerprintData)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
    
    return {
      globalHash,
      skuCount: skus.length,
      totalRecords: data.length,
      dateRange: fingerprintData.dateRange,
      timestamp: Date.now()
    };
  }, []);

  const generateDataHash = useCallback((skuData: SalesData[]): string => {
    // Simplified hash for individual SKU data
    const recent = skuData.slice(-20);
    const sum = recent.reduce((acc, d) => acc + d.sales, 0);
    const avg = sum / recent.length;
    const values = recent.map(d => Math.round(d.sales)).join('-');
    return `${skuData.length}-${Math.round(avg)}-${values.substring(0, 50)}`;
  }, []);

  const isDatasetUnchanged = useCallback((data: SalesData[]): boolean => {
    if (!manifest) return false;
    
    const currentFingerprint = generateDatasetFingerprint(data);
    const unchanged = currentFingerprint.globalHash === manifest.datasetFingerprint.globalHash;
    
    console.log(`Dataset fingerprint check: ${unchanged ? 'UNCHANGED' : 'CHANGED'}`);
    console.log(`Current: ${currentFingerprint.globalHash}, Cached: ${manifest.datasetFingerprint.globalHash}`);
    
    return unchanged;
  }, [manifest, generateDatasetFingerprint]);

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
      lastValidated: Date.now()
    };
    
    setManifest(newManifest);
    console.log(`Cache manifest updated: ${validEntries.size} valid entries`);
    
    return newManifest;
  }, [cache, manifest, generateDatasetFingerprint, generateDataHash]);

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
    // First check if we can skip entirely due to unchanged dataset
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
  }, [isDatasetUnchanged, manifest, batchValidateCache]);

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
    batchValidateCache
  };
};
