import { useState, useCallback, useEffect } from 'react';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';

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

interface DatasetOptimizationState {
  fingerprint: string;
  completed: boolean;
  timestamp: number;
}

const CACHE_KEY = 'forecast_optimization_cache';
const OPTIMIZATION_STATE_KEY = 'dataset_optimization_state';
const CACHE_EXPIRY_HOURS = 24;

export const useOptimizationCache = () => {
  const [cache, setCache] = useState<OptimizationCache>({});
  const [cacheStats, setCacheStats] = useState({ hits: 0, misses: 0, skipped: 0 });
  const [optimizationState, setOptimizationState] = useState<DatasetOptimizationState | null>(null);

  // Load state from localStorage on mount
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
            
            // Handle legacy format
            if (entry.parameters) {
              // Convert old format to new format
              const method = entry.method?.startsWith('ai_') ? 'ai' : 
                           entry.method === 'grid_search' ? 'grid' : 'ai';
              
              if (now - entry.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000) {
                if (!filteredCache[sku]) filteredCache[sku] = {};
                if (!filteredCache[sku][modelId]) filteredCache[sku][modelId] = {};
                
                filteredCache[sku][modelId][method] = entry;
                filteredCache[sku][modelId].selected = method;
              }
            } else {
              // New format
              const hasValidEntries = (entry.ai && now - entry.ai.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000) ||
                                    (entry.grid && now - entry.grid.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000);
              
              if (hasValidEntries) {
                if (!filteredCache[sku]) filteredCache[sku] = {};
                filteredCache[sku][modelId] = entry;
              }
            }
          });
        });
        
        setCache(filteredCache);
        console.log('MULTI-CACHE: Loaded optimization cache from storage');
      }

      // Load optimization state
      const storedState = localStorage.getItem(OPTIMIZATION_STATE_KEY);
      if (storedState) {
        const parsedState = JSON.parse(storedState);
        const now = Date.now();
        if (now - parsedState.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000) {
          setOptimizationState(parsedState);
          console.log(`MULTI-CACHE: Loaded optimization state - fingerprint: ${parsedState.fingerprint}, completed: ${parsedState.completed}`);
        }
      }
    } catch (error) {
      console.error('MULTI-CACHE: Failed to load from localStorage:', error);
    }
  }, []);

  // Save cache to localStorage when it changes
  useEffect(() => {
    if (Object.keys(cache).length > 0) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      } catch (error) {
        console.error('MULTI-CACHE: Failed to save cache to localStorage:', error);
      }
    }
  }, [cache]);

  // Save optimization state to localStorage when it changes
  useEffect(() => {
    if (optimizationState) {
      try {
        localStorage.setItem(OPTIMIZATION_STATE_KEY, JSON.stringify(optimizationState));
        console.log(`MULTI-CACHE: Saved optimization state - fingerprint: ${optimizationState.fingerprint}, completed: ${optimizationState.completed}`);
      } catch (error) {
        console.error('MULTI-CACHE: Failed to save optimization state to localStorage:', error);
      }
    }
  }, [optimizationState]);

  const generateDatasetFingerprint = useCallback((data: SalesData[]): string => {
    // Sort data to ensure consistent ordering
    const sortedData = [...data].sort((a, b) => {
      const skuCompare = a.sku.localeCompare(b.sku);
      if (skuCompare !== 0) return skuCompare;
      return a.date.localeCompare(b.date);
    });
    
    const skus = Array.from(new Set(sortedData.map(d => d.sku))).sort();
    const totalSales = Math.round(sortedData.reduce((sum, d) => sum + d.sales, 0));
    const outliersCount = sortedData.filter(d => d.isOutlier).length;
    const notesCount = sortedData.filter(d => d.note && d.note.trim()).length;
    
    const fingerprint = `${skus.length}-${sortedData.length}-${totalSales}-${outliersCount}-${notesCount}`;
    return btoa(fingerprint).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  }, []);

  const generateDataHash = useCallback((skuData: SalesData[]): string => {
    const sorted = [...skuData].sort((a, b) => a.date.localeCompare(b.date));
    const salesValues = sorted.map(d => Math.round(d.sales * 100) / 100).join('-');
    const outlierFlags = sorted.map(d => d.isOutlier ? '1' : '0').join('');
    const noteFlags = sorted.map(d => d.note ? '1' : '0').join('');
    
    return `${sorted.length}-${salesValues.substring(0, 50)}-${outlierFlags}-${noteFlags}`.substring(0, 100);
  }, []);

  // PRIORITY 1: Check if optimization is complete for this dataset
  const isOptimizationComplete = useCallback((data: SalesData[]): boolean => {
    const currentFingerprint = generateDatasetFingerprint(data);
    
    console.log(`MULTI-CACHE: Checking optimization completion - current: ${currentFingerprint}, stored: ${optimizationState?.fingerprint}, completed: ${optimizationState?.completed}`);
    
    if (optimizationState && 
        optimizationState.fingerprint === currentFingerprint && 
        optimizationState.completed) {
      console.log('MULTI-CACHE: ✅ OPTIMIZATION ALREADY COMPLETE - SKIPPING');
      setCacheStats(prev => ({ ...prev, skipped: prev.skipped + 1 }));
      return true;
    }
    
    console.log('MULTI-CACHE: ❌ Optimization needed');
    return false;
  }, [optimizationState, generateDatasetFingerprint]);

  // Mark optimization as complete
  const markOptimizationComplete = useCallback((data: SalesData[]) => {
    const fingerprint = generateDatasetFingerprint(data);
    const newState: DatasetOptimizationState = {
      fingerprint,
      completed: true,
      timestamp: Date.now()
    };
    
    setOptimizationState(newState);
    console.log(`MULTI-CACHE: ✅ MARKED OPTIMIZATION COMPLETE for fingerprint: ${fingerprint}`);
  }, [generateDatasetFingerprint]);

  // Get SKUs needing optimization (only call if optimization is not complete)
  const getSKUsNeedingOptimization = useCallback((
    data: SalesData[], 
    models: ModelConfig[]
  ): { sku: string; models: string[] }[] => {
    console.log('MULTI-CACHE: Checking which SKUs need optimization...');
    
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
          return !cached || 
                 !cached.ai || 
                 !cached.grid || 
                 cached.ai.dataHash !== currentDataHash ||
                 cached.grid.dataHash !== currentDataHash;
        })
        .map(m => m.id);
      
      if (modelsNeedingOptimization.length > 0) {
        result.push({ sku, models: modelsNeedingOptimization });
      }
    });
    
    console.log(`MULTI-CACHE: ${result.length} SKUs need optimization`);
    return result;
  }, [cache, generateDataHash]);

  const getCachedParameters = useCallback((
    sku: string, 
    modelId: string, 
    method?: 'ai' | 'grid'
  ): OptimizedParameters | null => {
    const cached = cache[sku]?.[modelId];
    if (!cached) {
      setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
      console.log(`🔍 CACHE DEBUG: Cache MISS for ${sku}:${modelId}${method ? `:${method}` : ''}`);
      return null;
    }

    // If method is specified, return that specific method
    if (method) {
      const result = cached[method];
      if (result) {
        setCacheStats(prev => ({ ...prev, hits: prev.hits + 1 }));
        console.log(`🔍 CACHE DEBUG: Cache HIT for ${sku}:${modelId}:${method} - method in cache: ${result.method}`);
        return result;
      } else {
        setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
        console.log(`🔍 CACHE DEBUG: Cache MISS for ${sku}:${modelId}:${method} - slot empty`);
        return null;
      }
    }

    // Return selected method or AI if available, otherwise grid
    const selectedMethod = cached.selected || 'ai';
    const result = cached[selectedMethod] || cached.ai || cached.grid;
    
    if (result) {
      setCacheStats(prev => ({ ...prev, hits: prev.hits + 1 }));
      console.log(`🔍 CACHE DEBUG: Cache HIT for ${sku}:${modelId} (selected: ${selectedMethod}, method in result: ${result.method})`);
      return result;
    } else {
      setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
      console.log(`🔍 CACHE DEBUG: Cache MISS for ${sku}:${modelId} - no results found`);
      return null;
    }
  }, [cache]);

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
    console.log(`🔍 CACHE DEBUG: Setting cached parameters for ${sku}:${modelId} with method: ${method}`);
    
    const optimizedParams: OptimizedParameters = {
      parameters,
      timestamp: Date.now(),
      dataHash,
      confidence,
      reasoning,
      factors,
      expectedAccuracy,
      method // CRITICAL: Preserve the method exactly as passed
    };

    // Determine which cache slot to use - FIXED mapping
    let cacheMethod: 'ai' | 'grid';
    if (method === 'grid_search') {
      cacheMethod = 'grid';
      console.log(`🔍 CACHE DEBUG: Mapping method 'grid_search' to cache slot 'grid'`);
    } else if (method?.startsWith('ai_')) {
      cacheMethod = 'ai';
      console.log(`🔍 CACHE DEBUG: Mapping method '${method}' to cache slot 'ai'`);
    } else {
      // Default fallback - prefer 'grid' for grid_search method
      cacheMethod = method === 'grid_search' ? 'grid' : 'ai';
      console.log(`🔍 CACHE DEBUG: Default mapping for method '${method}' to cache slot '${cacheMethod}'`);
    }

    setCache(prev => {
      const newCache = {
        ...prev,
        [sku]: {
          ...prev[sku],
          [modelId]: {
            ...prev[sku]?.[modelId],
            [cacheMethod]: optimizedParams,
            selected: cacheMethod
          }
        }
      };
      
      console.log(`🔍 CACHE DEBUG: Cache updated for ${sku}:${modelId} in slot '${cacheMethod}' with method '${method}'`);
      console.log(`🔍 CACHE DEBUG: Cache state:`, newCache[sku]?.[modelId]);
      
      return newCache;
    });
  }, []);

  const setSelectedMethod = useCallback((
    sku: string,
    modelId: string,
    method: 'ai' | 'grid' | 'manual'
  ) => {
    console.log(`🔍 CACHE DEBUG: Setting selected method to ${method} for ${sku}:${modelId}`);
    
    setCache(prev => ({
      ...prev,
      [sku]: {
        ...prev[sku],
        [modelId]: {
          ...prev[sku]?.[modelId],
          selected: method
        }
      }
    }));
  }, []);

  const isCacheValid = useCallback((sku: string, modelId: string, currentDataHash: string): boolean => {
    const cached = getCachedParameters(sku, modelId);
    if (!cached) return false;
    
    const isValid = cached.dataHash === currentDataHash;
    return isValid;
  }, [getCachedParameters]);

  // Legacy compatibility functions (minimal implementations)
  const startOptimizationSession = useCallback(() => {
    console.log('MULTI-CACHE: Legacy startOptimizationSession called');
  }, []);

  const markSKUOptimized = useCallback(() => {
    console.log('MULTI-CACHE: Legacy markSKUOptimized called');
  }, []);

  const completeOptimizationSession = useCallback(() => {
    console.log('MULTI-CACHE: Legacy completeOptimizationSession called');
  }, []);

  const getDatasetFingerprintString = useCallback((data: SalesData[]): string => {
    return generateDatasetFingerprint(data);
  }, [generateDatasetFingerprint]);

  const hasOptimizationStarted = useCallback(() => false, []);
  const markOptimizationStarted = useCallback(() => {}, []);

  const clearCacheForSKU = useCallback((sku: string) => {
    setCache(prev => {
      const newCache = { ...prev };
      delete newCache[sku];
      return newCache;
    });
  }, []);

  const batchValidateCache = useCallback(() => ({}), []);

  // Clear all cache and reset state
  const clearAllCache = useCallback(() => {
    console.log('🗑️ MULTI-CACHE CLEAR: Clearing all optimization cache and state');
    
    setCache({});
    setCacheStats({ hits: 0, misses: 0, skipped: 0 });
    setOptimizationState(null);
    
    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(OPTIMIZATION_STATE_KEY);
      console.log('🗑️ MULTI-CACHE CLEAR: Cleared localStorage');
    } catch (error) {
      console.error('🗑️ MULTI-CACHE CLEAR: Failed to clear localStorage:', error);
    }
  }, []);

  return {
    cache,
    cacheStats,
    generateDataHash,
    getCachedParameters,
    setCachedParameters,
    setSelectedMethod,
    isCacheValid,
    getSKUsNeedingOptimization,
    clearCacheForSKU: useCallback((sku: string) => {
      setCache(prev => {
        const newCache = { ...prev };
        delete newCache[sku];
        return newCache;
      });
    }, []),
    clearAllCache: useCallback(() => {
      console.log('🗑️ MULTI-CACHE CLEAR: Clearing all optimization cache and state');
      
      setCache({});
      setCacheStats({ hits: 0, misses: 0, skipped: 0 });
      setOptimizationState(null);
      
      try {
        localStorage.removeItem(CACHE_KEY);
        localStorage.removeItem(OPTIMIZATION_STATE_KEY);
        console.log('🗑️ MULTI-CACHE CLEAR: Cleared localStorage');
      } catch (error) {
        console.error('🗑️ MULTI-CACHE CLEAR: Failed to clear localStorage:', error);
      }
    }, []),
    batchValidateCache: useCallback(() => ({}), []),
    isOptimizationComplete,
    markOptimizationComplete,
    startOptimizationSession,
    markSKUOptimized,
    completeOptimizationSession,
    getDatasetFingerprintString,
    hasOptimizationStarted,
    markOptimizationStarted
  };
};
