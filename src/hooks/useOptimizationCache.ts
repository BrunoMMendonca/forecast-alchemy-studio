
import { useState, useCallback } from 'react';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';

interface OptimizedParameters {
  parameters: Record<string, number>;
  timestamp: number;
  dataHash: string;
  confidence?: number;
}

interface OptimizationCache {
  [sku: string]: {
    [modelId: string]: OptimizedParameters;
  };
}

export const useOptimizationCache = () => {
  const [cache, setCache] = useState<OptimizationCache>({});

  const generateDataHash = useCallback((skuData: SalesData[]): string => {
    // Simple hash based on data length and last few values
    const values = skuData.map(d => d.sales).slice(-10);
    return `${skuData.length}-${values.join('-')}`;
  }, []);

  const getCachedParameters = useCallback((sku: string, modelId: string): OptimizedParameters | null => {
    return cache[sku]?.[modelId] || null;
  }, [cache]);

  const setCachedParameters = useCallback((
    sku: string, 
    modelId: string, 
    parameters: Record<string, number>,
    dataHash: string,
    confidence?: number
  ) => {
    setCache(prev => ({
      ...prev,
      [sku]: {
        ...prev[sku],
        [modelId]: {
          parameters,
          timestamp: Date.now(),
          dataHash,
          confidence
        }
      }
    }));
  }, []);

  const isCacheValid = useCallback((sku: string, modelId: string, currentDataHash: string): boolean => {
    const cached = getCachedParameters(sku, modelId);
    return cached ? cached.dataHash === currentDataHash : false;
  }, [getCachedParameters]);

  const clearCacheForSKU = useCallback((sku: string) => {
    setCache(prev => {
      const newCache = { ...prev };
      delete newCache[sku];
      return newCache;
    });
  }, []);

  return {
    cache,
    generateDataHash,
    getCachedParameters,
    setCachedParameters,
    isCacheValid,
    clearCacheForSKU
  };
};
