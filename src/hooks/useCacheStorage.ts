import { useCallback } from 'react';
import { OptimizationCache, OptimizedParameters, saveCacheToStorage } from '@/utils/cacheStorageUtils';

export const useCacheStorage = (
  setCache: React.Dispatch<React.SetStateAction<OptimizationCache>>,
  setCacheVersion: React.Dispatch<React.SetStateAction<number>>
) => {
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
    console.log(`💾 CacheStorage: Setting parameters for ${sku}:${modelId}, method: ${method}`);
    
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

    const cacheMethod: 'ai' | 'grid' | 'manual' = 
      method === 'grid_search' ? 'grid' :
      method?.startsWith('ai_') ? 'ai' :
      method === 'manual' ? 'manual' :
      'ai';

    setCache(prev => {
      const newCache = JSON.parse(JSON.stringify(prev));
      
      if (!newCache[sku]) newCache[sku] = {};
      if (!newCache[sku][modelId]) newCache[sku][modelId] = {};
      
      // Store the parameters
      newCache[sku][modelId][cacheMethod] = optimizedParams;
      
      // If this is a manual update, ensure the selected method is set to manual
      if (cacheMethod === 'manual') {
        console.log(`💾 CacheStorage: Setting selected method to manual for ${sku}:${modelId}`);
        newCache[sku][modelId].selected = 'manual';
      }
      
      // Save to storage immediately
      saveCacheToStorage(newCache);
      console.log(`💾 CacheStorage: Saved to storage for ${sku}:${modelId}`);
      
      return newCache;
    });

    // Increment cache version to trigger updates
    setCacheVersion(prev => {
      const newVersion = prev + 1;
      console.log(`💾 CacheStorage: Cache version updated to ${newVersion}`);
      return newVersion;
    });
  }, [setCache, setCacheVersion]);

  return { setCachedParameters };
};
