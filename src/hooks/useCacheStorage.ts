
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
      
      newCache[sku][modelId][cacheMethod] = optimizedParams;
      
      // Only auto-select if no existing selection and method is manual
      const currentSelected = newCache[sku][modelId].selected;
      
      if (cacheMethod === 'manual') {
        newCache[sku][modelId].selected = 'manual';
      } else if (!currentSelected) {
        // Only auto-select when there's no existing user selection
        const hasAI = newCache[sku][modelId].ai;
        const hasGrid = newCache[sku][modelId].grid;
        
        const bestMethod = hasAI ? 'ai' : hasGrid ? 'grid' : 'manual';
        newCache[sku][modelId].selected = bestMethod;
      }
      // If currentSelected exists, preserve it (don't override user's choice)
      
      saveCacheToStorage(newCache);
      return newCache;
    });

    setCacheVersion(prev => prev + 1);
  }, [setCache, setCacheVersion]);

  return { setCachedParameters };
};
