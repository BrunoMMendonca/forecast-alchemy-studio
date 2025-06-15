import { useCallback } from 'react';
import { OptimizationCache, OptimizedParameters, saveCacheToStorage, loadCacheFromStorage } from '@/utils/cacheStorageUtils';

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
      method === 'manual' ? 'manual' :
      method === 'grid' ? 'grid' :
      method?.startsWith('ai_') ? 'ai' :
      'ai';

    setCache(prev => {
      const newCache = JSON.parse(JSON.stringify(prev));
      
      if (!newCache[sku]) newCache[sku] = {};
      if (!newCache[sku][modelId]) newCache[sku][modelId] = {};
      
      // Store parameters for the current method
      newCache[sku][modelId][cacheMethod] = optimizedParams;
      
      // Only update selected method if:
      // 1. It's a manual update (user explicitly chose manual)
      // 2. There's no explicit selection and we're not in manual mode
      const currentSelected = newCache[sku][modelId].selected;
      if (cacheMethod === 'manual') {
        newCache[sku][modelId].selected = 'manual';
      } else if (!currentSelected || currentSelected !== 'manual') {
        const hasAI = newCache[sku][modelId].ai;
        const hasGrid = newCache[sku][modelId].grid;
        
        const bestMethod = hasAI ? 'ai' : hasGrid ? 'grid' : 'manual';
        const shouldAutoSelect = !currentSelected || 
          (currentSelected !== 'manual' && 
           (cacheMethod === 'ai' || cacheMethod === 'grid'));
        
        if (shouldAutoSelect) {
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
