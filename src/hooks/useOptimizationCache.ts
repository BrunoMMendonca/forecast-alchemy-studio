
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
  [sku: string]: {
    [modelId: string]: {
      ai?: OptimizedParameters;
      grid?: OptimizedParameters;
      selected?: 'ai' | 'grid' | 'manual';
    };
  };
}

const CACHE_KEY = 'forecast_optimization_cache';
const CACHE_EXPIRY_HOURS = 24;

export const useOptimizationCache = () => {
  const [cache, setCache] = useState<OptimizationCache>({});
  const [cacheStats, setCacheStats] = useState({ hits: 0, misses: 0, skipped: 0 });
  const [cacheVersion, setCacheVersion] = useState(0);
  
  const {
    generateDatasetFingerprint,
    isOptimizationComplete,
    markOptimizationComplete
  } = useDatasetOptimization();

  // Helper function to detect old hash format
  const isOldHashFormat = useCallback((hash: string): boolean => {
    return hash.includes('len:') || hash.includes('dates:') || hash.includes('sales:');
  }, []);

  // Load state from localStorage on mount
  useEffect(() => {
    console.log('🗄️ CACHE: Loading from localStorage...');
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (stored) {
        const parsedCache = JSON.parse(stored);
        console.log('🗄️ CACHE: Found stored cache with', Object.keys(parsedCache).length, 'SKUs');
        const now = Date.now();
        const filteredCache: OptimizationCache = {};
        
        Object.keys(parsedCache).forEach(sku => {
          Object.keys(parsedCache[sku]).forEach(modelId => {
            const entry = parsedCache[sku][modelId];
            
            if (entry.parameters) {
              const method = entry.method?.startsWith('ai_') ? 'ai' : 
                           entry.method === 'grid_search' ? 'grid' : 'ai';
              
              // Skip entries with old hash format
              if (entry.dataHash && isOldHashFormat(entry.dataHash)) {
                console.log(`🗄️ CACHE: Skipping old format entry ${sku}:${modelId}:${method}`);
                return;
              }
              
              if (now - entry.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000) {
                if (!filteredCache[sku]) filteredCache[sku] = {};
                if (!filteredCache[sku][modelId]) filteredCache[sku][modelId] = {};
                
                filteredCache[sku][modelId][method] = entry;
                filteredCache[sku][modelId].selected = method;
                console.log(`🗄️ CACHE: Loaded ${sku}:${modelId}:${method}`);
              } else {
                console.log(`🗄️ CACHE: Expired ${sku}:${modelId}:${method}`);
              }
            } else {
              // Handle new cache structure
              const hasValidAI = entry.ai && 
                                !isOldHashFormat(entry.ai.dataHash) &&
                                now - entry.ai.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
              const hasValidGrid = entry.grid && 
                                  !isOldHashFormat(entry.grid.dataHash) &&
                                  now - entry.grid.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
              
              if (hasValidAI || hasValidGrid) {
                if (!filteredCache[sku]) filteredCache[sku] = {};
                filteredCache[sku][modelId] = {};
                
                if (hasValidAI) {
                  filteredCache[sku][modelId].ai = entry.ai;
                }
                if (hasValidGrid) {
                  filteredCache[sku][modelId].grid = entry.grid;
                }
                filteredCache[sku][modelId].selected = entry.selected;
                console.log(`🗄️ CACHE: Loaded ${sku}:${modelId} with multiple methods`);
              }
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
    }
  }, [isOldHashFormat]);

  // Save cache to localStorage when it changes
  useEffect(() => {
    if (Object.keys(cache).length > 0) {
      console.log('🗄️ CACHE: Saving to localStorage with', Object.keys(cache).length, 'SKUs');
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        console.log('🗄️ CACHE: Successfully saved to localStorage');
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
                            (Date.now() - cached.ai.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000);
          const hasValidGrid = cached.grid && 
                              cached.grid.dataHash === currentDataHash && 
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
  }, [cache, generateDataHash]);

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
    
    const isValidEntry = (entry: OptimizedParameters) => 
      entry && entry.dataHash && !isExpired(entry) && !isOldHashFormat(entry.dataHash);

    if (method) {
      const result = cached[method];
      if (!result) {
        console.log(`🗄️ CACHE: MISS - No ${method} method for ${sku}:${modelId}`);
        setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
        return null;
      }

      if (!isValidEntry(result)) {
        const reason = !result.dataHash ? 'missing dataHash' : 
                     isExpired(result) ? 'expired' : 
                     isOldHashFormat(result.dataHash) ? 'old hash format' : 'invalid';
        console.log(`🗄️ CACHE: MISS - ${method} method invalid for ${sku}:${modelId} (${reason})`);
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
    
    // If selected method doesn't exist or is invalid, try alternatives
    if (!isValidEntry(result)) {
      result = cached.ai || cached.grid;
      
      // Check if the fallback is also invalid
      if (!isValidEntry(result)) {
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
  }, []);

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
    
    const isValid = cached.dataHash === currentDataHash;
    console.log(`🗄️ CACHE: Hash validation for ${sku}:${modelId}:${method || 'any'}: ${isValid} (cached: ${cached.dataHash.substring(0, 30)}... vs current: ${currentDataHash.substring(0, 30)}...)`);
    return isValid;
  }, [getCachedParameters]);

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
