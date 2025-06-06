
import { useCallback } from 'react';
import { OptimizationCache, OptimizedParameters } from '@/utils/cacheStorageUtils';
import { CACHE_EXPIRY_HOURS } from '@/utils/cacheStorageUtils';

export const useCacheOperations = (
  cache: OptimizationCache,
  setCache: React.Dispatch<React.SetStateAction<OptimizationCache>>,
  setCacheStats: React.Dispatch<React.SetStateAction<{ hits: number; misses: number; skipped: number }>>,
  setCacheVersion: React.Dispatch<React.SetStateAction<number>>
) => {
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

    const now = Date.now();
    const isExpired = (entry: OptimizedParameters) => 
      now - entry.timestamp > CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
    
    const isValidEntry = (entry: OptimizedParameters) => 
      entry && entry.dataHash?.startsWith('v2-') && !isExpired(entry);

    if (method) {
      const result = cached[method];
      if (!result || !isValidEntry(result)) {
        console.log(`🗄️ CACHE: MISS - No valid ${method} method for ${sku}:${modelId}`);
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
  }, [cache, setCacheStats]);

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
  }, [setCache]);

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
  }, [setCache, setCacheVersion]);

  const clearCacheForSKU = useCallback((sku: string) => {
    setCache(prev => {
      const newCache = JSON.parse(JSON.stringify(prev));
      delete newCache[sku];
      return newCache;
    });
    setCacheVersion(prev => prev + 1);
  }, [setCache, setCacheVersion]);

  return {
    getCachedParameters,
    setCachedParameters,
    setSelectedMethod,
    clearCacheForSKU
  };
};
