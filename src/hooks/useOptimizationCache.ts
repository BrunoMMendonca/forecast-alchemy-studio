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

const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export const useOptimizationCache = () => {
  const [optimizationCache, setOptimizationCache] = useState<OptimizationCache>({});
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
      return { 
        parameters: skuCache[modelId].parameters,
        confidence: skuCache[modelId].confidence
      };
    }
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

  return {
    generateDataHash,
    cacheParameters,
    getCachedParameters,
    isCacheValid
  };
};
