import { useCallback } from 'react';
import { OptimizationCache, OptimizedParameters, saveCacheToStorage } from '@/utils/cacheStorageUtils';
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
    method?: 'ai' | 'grid' | 'manual'
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

    const selectedMethod = cached.selected || 'manual';
    let result = cached[selectedMethod];
    
    if (!isValidEntry(result)) {
      result = cached.ai || cached.grid || cached.manual;
      
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

    let cacheMethod: 'ai' | 'grid' | 'manual';
    if (method === 'grid_search') {
      cacheMethod = 'grid';
    } else if (method?.startsWith('ai_')) {
      cacheMethod = 'ai';
    } else if (method === 'manual') {
      cacheMethod = 'manual';
    } else {
      cacheMethod = method === 'grid_search' ? 'grid' : 'ai';
    }

    console.log(`🗄️ CACHE: Storing as ${cacheMethod} method`);

    setCache(prev => {
      const newCache = JSON.parse(JSON.stringify(prev));
      
      if (!newCache[sku]) newCache[sku] = {};
      if (!newCache[sku][modelId]) newCache[sku][modelId] = {};
      
      newCache[sku][modelId][cacheMethod] = optimizedParams;
      
      // Auto-select logic - prioritize manual when explicitly set
      if (cacheMethod === 'manual') {
        newCache[sku][modelId].selected = 'manual';
        console.log(`🎯 CACHE: Auto-selected manual method for ${sku}:${modelId}`);
      } else {
        // Auto-select the best available method when storing optimization results
        // Priority: AI > Grid > Manual
        const hasAI = newCache[sku][modelId].ai;
        const hasGrid = newCache[sku][modelId].grid;
        const hasManual = newCache[sku][modelId].manual;
        
        let bestMethod: 'ai' | 'grid' | 'manual' = 'manual';
        if (hasAI && hasGrid) {
          bestMethod = 'ai';
        } else if (hasAI) {
          bestMethod = 'ai';
        } else if (hasGrid) {
          bestMethod = 'grid';
        } else if (hasManual) {
          bestMethod = 'manual';
        }
        
        const currentSelected = newCache[sku][modelId].selected;
        const shouldAutoSelect = (
          !currentSelected || 
          (currentSelected === 'manual' && bestMethod !== 'manual') || 
          (currentSelected === 'grid' && bestMethod === 'ai')
        );
        
        if (shouldAutoSelect) {
          newCache[sku][modelId].selected = bestMethod;
          console.log(`🎯 CACHE: Auto-selected best method ${bestMethod} for ${sku}:${modelId}`);
        } else {
          console.log(`🎯 CACHE: Keeping existing selection ${currentSelected} for ${sku}:${modelId}`);
        }
      }
      
      console.log(`🗄️ CACHE: Successfully stored ${sku}:${modelId}:${cacheMethod}`);
      saveCacheToStorage(newCache);
      
      return newCache;
    });

    setCacheVersion(prev => prev + 1);
  }, [setCache, setCacheVersion]);

  const setSelectedMethod = useCallback((
    sku: string,
    modelId: string,
    method: 'ai' | 'grid' | 'manual'
  ) => {
    console.log(`🗄️ CACHE: Setting user selected method ${sku}:${modelId} to ${method}`);
    
    setCache(prev => {
      const newCache = JSON.parse(JSON.stringify(prev));
      
      if (!newCache[sku]) newCache[sku] = {};
      if (!newCache[sku][modelId]) newCache[sku][modelId] = {};
      
      // Store the user's explicit choice and save to localStorage immediately
      newCache[sku][modelId].selected = method;
      
      console.log(`🗄️ CACHE: User selected method stored: ${sku}:${modelId} = ${method}`);
      console.log(`🗄️ CACHE: Saving method selection to localStorage`);
      saveCacheToStorage(newCache);
      
      return newCache;
    });

    // Force a cache version update to trigger UI re-renders
    setCacheVersion(prev => {
      const newVersion = prev + 1;
      console.log(`🗄️ CACHE: Method selection triggered cache version update: ${prev} -> ${newVersion}`);
      return newVersion;
    });
  }, [setCache, setCacheVersion]);

  const clearCacheForSKU = useCallback((sku: string) => {
    setCache(prev => {
      const newCache = JSON.parse(JSON.stringify(prev));
      delete newCache[sku];
      
      // SAVE TO LOCALSTORAGE: Only when cache is cleared
      console.log('🗄️ CACHE: Saving after clearing SKU cache to localStorage');
      saveCacheToStorage(newCache);
      
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
