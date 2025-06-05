
import { useState, useCallback, useEffect } from 'react';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { useDatasetOptimization } from '@/hooks/useDatasetOptimization';

interface OptimizedParameters {
  parameters: Record<string, number>;
  timestamp: number;
  dataHash: string;
  confidence?: number;
  reasoning?: string;
  factors?: {
    stability: number;
    interpretability: number;
    complexity: number;
    businessImpact: string;
  };
  expectedAccuracy?: number;
  method?: string;
}

interface OptimizationCache {
  version: number; // NEW: Cache version for format changes
  data: {
    [sku: string]: {
      [modelId: string]: {
        ai?: OptimizedParameters;
        grid?: OptimizedParameters;
        selected?: 'ai' | 'grid' | 'manual';
      };
    };
  };
}

const CACHE_KEY = 'forecast_optimization_cache';
const CACHE_EXPIRY_HOURS = 24;
const CURRENT_CACHE_VERSION = 2; // NEW: Increment when hash format changes

export const useOptimizationCache = () => {
  const [cache, setCache] = useState<OptimizationCache['data']>({});
  const [cacheStats, setCacheStats] = useState({ hits: 0, misses: 0, skipped: 0 });
  const [cacheVersion, setCacheVersion] = useState(0);
  
  const {
    generateDatasetFingerprint,
    isOptimizationComplete,
    markOptimizationComplete
  } = useDatasetOptimization();

  // Helper function to detect old hash format
  const isOldHashFormat = useCallback((hash: string): boolean => {
    if (!hash) return false;
    return hash.includes('len:') || hash.includes('dates:') || hash.includes('sales:') || hash.length > 100;
  }, []);

  // Helper function to check if cache has ANY old format entries
  const hasOldFormatEntries = useCallback((cacheData: any): boolean => {
    if (!cacheData || typeof cacheData !== 'object') return false;
    
    // Check if it's the old structure without version
    if (!cacheData.version) return true;
    
    // Check if version is outdated
    if (cacheData.version < CURRENT_CACHE_VERSION) return true;
    
    // Deep check for old hash formats in the data
    const data = cacheData.data || cacheData;
    for (const sku in data) {
      for (const modelId in data[sku]) {
        const entry = data[sku][modelId];
        
        // Check old structure (parameters directly on entry)
        if (entry.parameters && entry.dataHash && isOldHashFormat(entry.dataHash)) {
          return true;
        }
        
        // Check new structure (ai/grid methods)
        if (entry.ai && entry.ai.dataHash && isOldHashFormat(entry.ai.dataHash)) {
          return true;
        }
        if (entry.grid && entry.grid.dataHash && isOldHashFormat(entry.grid.dataHash)) {
          return true;
        }
      }
    }
    
    return false;
  }, [isOldHashFormat]);

  // Load state from localStorage on mount
  useEffect(() => {
    console.log('🗄️ CACHE: Loading from localStorage...');
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (stored) {
        const parsedCache = JSON.parse(stored);
        
        // Check if cache has old format entries - if so, clear everything
        if (hasOldFormatEntries(parsedCache)) {
          console.log('🗄️ CACHE: ⚠️ DETECTED OLD FORMAT ENTRIES - CLEARING ALL CACHE');
          localStorage.removeItem(CACHE_KEY);
          setCache({});
          setCacheStats({ hits: 0, misses: 0, skipped: 0 });
          return;
        }
        
        // Load valid new format cache
        const cacheData = parsedCache.data || {};
        const now = Date.now();
        const filteredCache: OptimizationCache['data'] = {};
        
        Object.keys(cacheData).forEach(sku => {
          Object.keys(cacheData[sku]).forEach(modelId => {
            const entry = cacheData[sku][modelId];
            
            const hasValidAI = entry.ai && 
                              entry.ai.dataHash &&
                              !isOldHashFormat(entry.ai.dataHash) &&
                              now - entry.ai.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
            const hasValidGrid = entry.grid && 
                                entry.grid.dataHash &&
                                !isOldHashFormat(entry.grid.dataHash) &&
                                now - entry.grid.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
            
            if (hasValidAI || hasValidGrid) {
              if (!filteredCache[sku]) filteredCache[sku] = {};
              filteredCache[sku][modelId] = {};
              
              if (hasValidAI) {
                filteredCache[sku][modelId].ai = entry.ai;
                console.log(`🗄️ CACHE: Loaded ${sku}:${modelId}:ai`);
              }
              if (hasValidGrid) {
                filteredCache[sku][modelId].grid = entry.grid;
                console.log(`🗄️ CACHE: Loaded ${sku}:${modelId}:grid`);
              }
              filteredCache[sku][modelId].selected = entry.selected;
            }
          });
        });
        
        setCache(filteredCache);
        console.log('🗄️ CACHE: Final loaded cache has', Object.keys(filteredCache).length, 'SKUs');
      } else {
        console.log('🗄️ CACHE: No stored cache found');
      }
    } catch (error) {
      console.error('🗄️ CACHE: Error loading from localStorage:', error);
      // Clear corrupted cache
      localStorage.removeItem(CACHE_KEY);
      setCache({});
    }
  }, [hasOldFormatEntries, isOldHashFormat]);

  // Save cache to localStorage when it changes
  useEffect(() => {
    if (Object.keys(cache).length > 0) {
      console.log('🗄️ CACHE: Saving to localStorage with', Object.keys(cache).length, 'SKUs');
      try {
        const cacheWithVersion: OptimizationCache = {
          version: CURRENT_CACHE_VERSION,
          data: cache
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheWithVersion));
        console.log('🗄️ CACHE: Successfully saved to localStorage with version', CURRENT_CACHE_VERSION);
      } catch (error) {
        console.error('🗄️ CACHE: Error saving to localStorage:', error);
      }
    }
  }, [cache]);

  const generateDataHash = useCallback((skuData: SalesData[]): string => {
    if (!skuData || skuData.length === 0) {
      console.log('🗄️ CACHE: Empty SKU data, returning empty hash');
      return 'empty';
    }

    // Sort by date to ensure consistent ordering
    const sorted = [...skuData].sort((a, b) => a.date.localeCompare(b.date));
    
    // Create a simple, consistent hash format
    const salesValues = sorted.map(d => Math.round(d.sales * 1000) / 1000);
    const outlierFlags = sorted.map(d => d.isOutlier ? '1' : '0').join('');
    const noteFlags = sorted.map(d => d.note ? '1' : '0').join('');
    
    // Use a simple format that's consistent between calls
    const hash = `${sorted.length}-${salesValues.join('-')}-${outlierFlags}-${noteFlags}`;
    
    console.log('🗄️ CACHE: Generated data hash:', hash.substring(0, 100), '...');
    return hash;
  }, []);

  const getSKUsNeedingOptimization = useCallback((
    data: SalesData[], 
    models: ModelConfig[]
  ): { sku: string; models: string[] }[] => {
    const enabledModelsWithParams = models.filter(m => 
      m.enabled && m.parameters && Object.keys(m.parameters).length > 0
    );
    
    const skus = Array.from(new Set(data.map(d => d.sku))).sort();
    const result: { sku: string; models: string[] }[] = [];
    
    skus.forEach(sku => {
      const skuData = data.filter(d => d.sku === sku);
      if (skuData.length < 3) return;
      
      const currentDataHash = generateDataHash(skuData);
      
      const modelsNeedingOptimization = enabledModelsWithParams
        .filter(m => {
          const cached = cache[sku]?.[m.id];
          if (!cached) {
            console.log(`🗄️ CACHE: ${sku}:${m.id} - No cache entry found`);
            return true;
          }

          const hasValidAI = cached.ai && 
                            cached.ai.dataHash === currentDataHash && 
                            !isOldHashFormat(cached.ai.dataHash) &&
                            (Date.now() - cached.ai.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000);
          const hasValidGrid = cached.grid && 
                              cached.grid.dataHash === currentDataHash && 
                              !isOldHashFormat(cached.grid.dataHash) &&
                              (Date.now() - cached.grid.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000);
          
          if (!hasValidAI) {
            console.log(`🗄️ CACHE: ${sku}:${m.id} - No valid AI cache (hash: ${cached.ai?.dataHash?.substring(0, 30)} vs ${currentDataHash.substring(0, 30)})`);
          }
          if (!hasValidGrid) {
            console.log(`🗄️ CACHE: ${sku}:${m.id} - No valid Grid cache (hash: ${cached.grid?.dataHash?.substring(0, 30)} vs ${currentDataHash.substring(0, 30)})`);
          }
          
          return !hasValidAI || !hasValidGrid;
        })
        .map(m => m.id);
      
      if (modelsNeedingOptimization.length > 0) {
        result.push({ sku, models: modelsNeedingOptimization });
      }
    });
    
    return result;
  }, [cache, generateDataHash, isOldHashFormat]);

  const getCachedParameters = useCallback((
    sku: string, 
    modelId: string, 
    method?: 'ai' | 'grid'
  ): OptimizedParameters | null => {
    console.log(`🗄️ CACHE: Looking for ${sku}:${modelId}:${method || 'any'}`);
    
    const cached = cache[sku]?.[modelId];
    if (!cached) {
      console.log(`🗄️ CACHE: MISS - No cache entry for ${sku}:${modelId}`);
      setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
      return null;
    }

    console.log(`🗄️ CACHE: Cache entry exists for ${sku}:${modelId}:`, {
      hasAI: !!cached.ai,
      hasGrid: !!cached.grid,
      selected: cached.selected,
      aiTimestamp: cached.ai?.timestamp,
      gridTimestamp: cached.grid?.timestamp,
      aiHash: cached.ai?.dataHash?.substring(0, 50),
      gridHash: cached.grid?.dataHash?.substring(0, 50)
    });

    const now = Date.now();
    const isExpired = (entry: OptimizedParameters) => 
      now - entry.timestamp > CACHE_EXPIRY_HOURS * 60 * 60 * 1000;

    if (method) {
      const result = cached[method];
      if (!result) {
        console.log(`🗄️ CACHE: MISS - No ${method} method for ${sku}:${modelId}`);
        setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
        return null;
      }

      // Check for old hash format and reject
      if (isOldHashFormat(result.dataHash)) {
        console.log(`🗄️ CACHE: MISS - ${method} method has old hash format for ${sku}:${modelId}`);
        setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
        return null;
      }

      if (isExpired(result)) {
        console.log(`🗄️ CACHE: MISS - ${method} method expired for ${sku}:${modelId}`);
        setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
        return null;
      }

      console.log(`🗄️ CACHE: HIT - Found valid ${sku}:${modelId}:${method}`);
      setCacheStats(prev => ({ ...prev, hits: prev.hits + 1 }));
      return result;
    }

    // If no specific method requested, use selected or fallback to available
    const selectedMethod = cached.selected || 'ai';
    let result = cached[selectedMethod];
    
    // If selected method doesn't exist or is expired or has old hash, try alternatives
    if (!result || isExpired(result) || isOldHashFormat(result.dataHash)) {
      result = cached.ai || cached.grid;
      
      // Check if the fallback also has issues
      if (result && (isExpired(result) || isOldHashFormat(result.dataHash))) {
        result = undefined;
      }
    }
    
    if (!result) {
      console.log(`🗄️ CACHE: MISS - No valid method for ${sku}:${modelId}`);
      setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
      return null;
    }

    console.log(`🗄️ CACHE: HIT - Found valid ${sku}:${modelId} with method ${result.method}`);
    setCacheStats(prev => ({ ...prev, hits: prev.hits + 1 }));
    return result;
  }, [cache, isOldHashFormat]);

  const setCachedParameters = useCallback((
    sku: string, 
    modelId: string, 
    parameters: Record<string, number>,
    dataHash: string,
    confidence?: number,
    reasoning?: string,
    factors?: {
      stability: number;
      interpretability: number;
      complexity: number;
      businessImpact: string;
    },
    expectedAccuracy?: number,
    method?: string
  ) => {
    // Validate that we're not storing old format hash
    if (isOldHashFormat(dataHash)) {
      console.error(`🗄️ CACHE: ❌ REFUSING to store old format hash for ${sku}:${modelId}:${method}`);
      return;
    }

    console.log(`🗄️ CACHE: Setting ${sku}:${modelId} with method ${method} and hash ${dataHash.substring(0, 50)}...`);
    
    const optimizedParams: OptimizedParameters = {
      parameters,
      timestamp: Date.now(),
      dataHash,
      confidence,
      reasoning,
      factors,
      expectedAccuracy,
      method
    };

    let cacheMethod: 'ai' | 'grid';
    if (method === 'grid_search') {
      cacheMethod = 'grid';
    } else if (method?.startsWith('ai_')) {
      cacheMethod = 'ai';
    } else {
      cacheMethod = method === 'grid_search' ? 'grid' : 'ai';
    }

    console.log(`🗄️ CACHE: Storing as ${cacheMethod} method`);

    setCache(prev => {
      const newCache = JSON.parse(JSON.stringify(prev));
      
      if (!newCache[sku]) newCache[sku] = {};
      if (!newCache[sku][modelId]) newCache[sku][modelId] = {};
      
      newCache[sku][modelId][cacheMethod] = optimizedParams;
      if (!newCache[sku][modelId].selected) {
        newCache[sku][modelId].selected = cacheMethod;
      }
      
      console.log(`🗄️ CACHE: Successfully stored ${sku}:${modelId}:${cacheMethod}`);
      return newCache;
    });

    console.log('🗄️ CACHE: Cache updated, triggering save');
  }, [isOldHashFormat]);

  const setSelectedMethod = useCallback((
    sku: string,
    modelId: string,
    method: 'ai' | 'grid' | 'manual'
  ) => {
    console.log(`🗄️ CACHE: Setting selected method ${sku}:${modelId} to ${method}`);
    setCache(prev => {
      const newCache = JSON.parse(JSON.stringify(prev));
      
      if (!newCache[sku]) newCache[sku] = {};
      if (!newCache[sku][modelId]) newCache[sku][modelId] = {};
      
      newCache[sku][modelId].selected = method;
      
      return newCache;
    });

    setCacheVersion(prev => prev + 1);
  }, []);

  const isCacheValid = useCallback((sku: string, modelId: string, currentDataHash: string, method?: 'ai' | 'grid'): boolean => {
    const cached = getCachedParameters(sku, modelId, method);
    if (!cached) {
      console.log(`🗄️ CACHE: Invalid - no cached parameters for ${sku}:${modelId}:${method || 'any'}`);
      return false;
    }
    
    const isValid = cached.dataHash === currentDataHash && !isOldHashFormat(cached.dataHash);
    console.log(`🗄️ CACHE: Hash validation for ${sku}:${modelId}:${method || 'any'}: ${isValid} (cached: ${cached.dataHash.substring(0, 30)}... vs current: ${currentDataHash.substring(0, 30)}...)`);
    return isValid;
  }, [getCachedParameters, isOldHashFormat]);

  const clearCacheForSKU = useCallback((sku: string) => {
    setCache(prev => {
      const newCache = JSON.parse(JSON.stringify(prev));
      delete newCache[sku];
      return newCache;
    });
    setCacheVersion(prev => prev + 1);
  }, []);

  const clearAllCache = useCallback(() => {
    setCache({});
    setCacheStats({ hits: 0, misses: 0, skipped: 0 });
    setCacheVersion(0);
    
    try {
      localStorage.removeItem(CACHE_KEY);
      console.log('🗄️ CACHE: ✅ CLEARED ALL CACHE');
    } catch (error) {
      // Silent error handling
    }
  }, []);

  return {
    cache,
    cacheStats,
    cacheVersion,
    generateDataHash,
    getCachedParameters,
    setCachedParameters,
    setSelectedMethod,
    isCacheValid,
    getSKUsNeedingOptimization,
    clearCacheForSKU,
    clearAllCache,
    isOptimizationComplete,
    markOptimizationComplete,
    generateDatasetFingerprint,
    startOptimizationSession: () => {},
    markSKUOptimized: () => {},
    completeOptimizationSession: () => {},
    getDatasetFingerprintString: generateDatasetFingerprint,
    hasOptimizationStarted: () => false,
    markOptimizationStarted: () => {},
    batchValidateCache: () => ({})
  };
};
