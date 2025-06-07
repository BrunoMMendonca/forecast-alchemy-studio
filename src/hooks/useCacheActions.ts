
import { useCallback } from 'react';
import { OptimizationCache, saveCacheToStorage } from '@/utils/cacheStorageUtils';

export const useCacheActions = (
  setCache: React.Dispatch<React.SetStateAction<OptimizationCache>>,
  setCacheVersion: React.Dispatch<React.SetStateAction<number>>
) => {
  const clearCacheForSKU = useCallback((sku: string) => {
    setCache(prev => {
      const newCache = JSON.parse(JSON.stringify(prev));
      delete newCache[sku];
      saveCacheToStorage(newCache);
      return newCache;
    });
    setCacheVersion(prev => prev + 1);
  }, [setCache, setCacheVersion]);

  return { clearCacheForSKU };
};
