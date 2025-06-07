
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

  return {
    setSelectedMethod
  };
};
