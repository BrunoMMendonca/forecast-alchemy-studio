
import { useCallback } from 'react';
import { OptimizationCache, saveCacheToStorage } from '@/utils/cacheStorageUtils';

export const useCacheMethodSelection = (
  setCache: React.Dispatch<React.SetStateAction<OptimizationCache>>,
  setCacheVersion: React.Dispatch<React.SetStateAction<number>>
) => {
  const setSelectedMethod = useCallback((
    sku: string,
    modelId: string,
    method: 'ai' | 'grid' | 'manual'
  ) => {
    console.log(`💾 Cache: Setting method for ${sku}:${modelId} to ${method}`);
    
    setCache(prev => {
      const newCache = JSON.parse(JSON.stringify(prev));
      
      if (!newCache[sku]) newCache[sku] = {};
      if (!newCache[sku][modelId]) newCache[sku][modelId] = {};
      
      // Always update the selected method
      newCache[sku][modelId].selected = method;
      
      // If switching to manual mode, ensure we keep the manual cache entry
      if (method === 'manual' && newCache[sku][modelId].manual) {
        console.log(`💾 Cache: Preserving manual cache for ${sku}:${modelId}`);
      }
      
      // Save to storage immediately
      saveCacheToStorage(newCache);
      console.log(`💾 Cache: Saved to storage for ${sku}:${modelId}`);
      
      return newCache;
    });

    // Increment cache version to trigger updates
    setCacheVersion(prev => {
      const newVersion = prev + 1;
      console.log(`💾 Cache: Version updated to ${newVersion}`);
      return newVersion;
    });
  }, [setCache, setCacheVersion]);

  return { setSelectedMethod };
};
