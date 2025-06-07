
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

  return {
    setCachedParameters
  };
};
