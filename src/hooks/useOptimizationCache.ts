
import { useState, useRef } from 'react';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/types/sales';

interface OptimizationCache {
  [sku: string]: {
    [modelId: string]: {
      dataHash: string;
      parameters: Record<string, number>;
      confidence?: number;
      timestamp: number;
    };
  };
}

interface CacheStats {
  hits: number;
  misses: number;
}

const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export const useOptimizationCache = () => {
  const [optimizationCache, setOptimizationCache] = useState<OptimizationCache>({});
  const [cacheStats, setCacheStats] = useState<CacheStats>({ hits: 0, misses: 0 });
  const dataHashRef = useRef<string | null>(null);

  const generateDataHash = (data: SalesData[]): string => {
    const dataString = JSON.stringify(data.map(item => ({
      date: item.date,
      sales: item.sales
    })));
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  };

  const cacheParameters = (
    sku: string,
    modelId: string,
    dataHash: string,
    parameters: Record<string, number>,
    confidence?: number
  ) => {
    setOptimizationCache(prevCache => {
      const updatedCache = { ...prevCache };
      if (!updatedCache[sku]) {
        updatedCache[sku] = {};
      }
      updatedCache[sku][modelId] = {
        dataHash,
        parameters,
        confidence,
        timestamp: Date.now()
      };
      return updatedCache;
    });
    dataHashRef.current = dataHash;
  };

  const getCachedParameters = (sku: string, modelId: string): { parameters: Record<string, number>; confidence?: number } | undefined => {
    const skuCache = optimizationCache[sku];
    if (skuCache && skuCache[modelId]) {
      setCacheStats(prev => ({ ...prev, hits: prev.hits + 1 }));
      return { 
        parameters: skuCache[modelId].parameters,
        confidence: skuCache[modelId].confidence
      };
    }
    setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
    return undefined;
  };

  const isCacheValid = (sku: string, modelId: string, currentDataHash: string): boolean => {
    const skuCache = optimizationCache[sku];
    if (skuCache && skuCache[modelId]) {
      const cachedItem = skuCache[modelId];
      const isWithinExpiry = Date.now() - cachedItem.timestamp <= CACHE_EXPIRY_MS;
      return cachedItem.dataHash === currentDataHash && isWithinExpiry;
    }
    return false;
  };

  const getSKUsNeedingOptimization = (data: SalesData[]): string[] => {
    const skus = Array.from(new Set(data.map(d => d.sku)));
    return skus.filter(sku => {
      const skuData = data.filter(d => d.sku === sku);
      const dataHash = generateDataHash(skuData);
      return !isCacheValid(sku, 'any', dataHash);
    });
  };

  const setCachedParameters = cacheParameters;

  return {
    cache: optimizationCache,
    cacheStats,
    generateDataHash,
    cacheParameters,
    setCachedParameters,
    getCachedParameters,
    isCacheValid,
    getSKUsNeedingOptimization
  };
};
