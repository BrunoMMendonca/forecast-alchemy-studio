
import { useCallback } from 'react';
import { flushSync } from 'react-dom';
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

    flushSync(() => {
      setCache(prev => {
        const newCache = JSON.parse(JSON.stringify(prev));
        
        if (!newCache[sku]) newCache[sku] = {};
        if (!newCache[sku][modelId]) newCache[sku][modelId] = {};
        
        newCache[sku][modelId][cacheMethod] = optimizedParams;
        
        // Auto-select best method
        if (cacheMethod === 'manual') {
          newCache[sku][modelId].selected = 'manual';
        } else {
          const hasAI = newCache[sku][modelId].ai;
          const hasGrid = newCache[sku][modelId].grid;
          const currentSelected = newCache[sku][modelId].selected;
          
          const bestMethod = hasAI ? 'ai' : hasGrid ? 'grid' : 'manual';
          const shouldAutoSelect = !currentSelected || 
            (currentSelected === 'manual' && bestMethod !== 'manual') || 
            (currentSelected === 'grid' && bestMethod === 'ai');
          
          if (shouldAutoSelect) {
            newCache[sku][modelId].selected = bestMethod;
          }
        }
        
        saveCacheToStorage(newCache);
        return newCache;
      });

      setCacheVersion(prev => prev + 1);
    });
  }, [setCache, setCacheVersion]);

  return { setCachedParameters };
};
