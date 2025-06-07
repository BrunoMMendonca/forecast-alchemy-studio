
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
      
      // Only auto-select if user hasn't explicitly chosen a method
      if (cacheMethod === 'manual') {
        // Manual changes are always user-explicit
        newCache[sku][modelId].selected = 'manual';
        newCache[sku][modelId].userExplicitlySelected = true;
      } else {
        // Only auto-select optimization methods if user hasn't made an explicit choice
        const userExplicitlySelected = newCache[sku][modelId].userExplicitlySelected;
        
        if (!userExplicitlySelected) {
          const hasAI = newCache[sku][modelId].ai;
          const hasGrid = newCache[sku][modelId].grid;
          const bestMethod = hasAI ? 'ai' : hasGrid ? 'grid' : 'manual';
          newCache[sku][modelId].selected = bestMethod;
        }
      }
      
      saveCacheToStorage(newCache);
      return newCache;
    });

    setCacheVersion(prev => prev + 1);
  }, [setCache, setCacheVersion]);

  return { setCachedParameters };
};
