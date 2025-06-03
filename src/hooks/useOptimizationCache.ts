
import { useState, useCallback, useEffect } from 'react';
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

const CACHE_KEY = 'forecast_optimization_cache';
const CACHE_EXPIRY_HOURS = 24;

export const useOptimizationCache = () => {
  const [cache, setCache] = useState<OptimizationCache>({});
  const [cacheStats, setCacheStats] = useState({ hits: 0, misses: 0 });

  // Load cache from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (stored) {
        const parsedCache = JSON.parse(stored);
        // Filter out expired entries
        const now = Date.now();
        const filteredCache: OptimizationCache = {};
        
        Object.keys(parsedCache).forEach(sku => {
          Object.keys(parsedCache[sku]).forEach(modelId => {
            const entry = parsedCache[sku][modelId];
            if (now - entry.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000) {
              if (!filteredCache[sku]) filteredCache[sku] = {};
              filteredCache[sku][modelId] = entry;
            }
          });
        });
        
        setCache(filteredCache);
        console.log('Loaded optimization cache from storage');
      }
    } catch (error) {
      console.error('Failed to load cache from localStorage:', error);
    }
  }, []);

  // Save cache to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.error('Failed to save cache to localStorage:', error);
    }
  }, [cache]);

  const generateDataHash = useCallback((skuData: SalesData[]): string => {
    // More robust hash including recent values and data characteristics
    const recent = skuData.slice(-20);
    const sum = recent.reduce((acc, d) => acc + d.sales, 0);
    const avg = sum / recent.length;
    const values = recent.map(d => Math.round(d.sales)).join('-');
    return `${skuData.length}-${Math.round(avg)}-${values}`;
  }, []);

  const getCachedParameters = useCallback((sku: string, modelId: string): OptimizedParameters | null => {
    const cached = cache[sku]?.[modelId];
    if (cached) {
      setCacheStats(prev => ({ ...prev, hits: prev.hits + 1 }));
      console.log(`Cache HIT for ${sku}:${modelId}`);
      return cached;
    } else {
      setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
      console.log(`Cache MISS for ${sku}:${modelId}`);
      return null;
    }
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
    console.log(`Cached parameters for ${sku}:${modelId}`);
  }, []);

  const isCacheValid = useCallback((sku: string, modelId: string, currentDataHash: string): boolean => {
    const cached = getCachedParameters(sku, modelId);
    if (!cached) return false;
    
    const isValid = cached.dataHash === currentDataHash;
    console.log(`Cache validation for ${sku}:${modelId}: ${isValid ? 'VALID' : 'INVALID'}`);
    return isValid;
  }, [getCachedParameters]);

  const getSKUsNeedingOptimization = useCallback((
    data: SalesData[], 
    models: ModelConfig[]
  ): { sku: string; models: string[] }[] => {
    const skus = Array.from(new Set(data.map(d => d.sku))).sort();
    const result: { sku: string; models: string[] }[] = [];
    
    skus.forEach(sku => {
      const skuData = data.filter(d => d.sku === sku);
      if (skuData.length < 3) return;
      
      const dataHash = generateDataHash(skuData);
      const modelsNeedingOptimization = models
        .filter(m => m.enabled && m.parameters && Object.keys(m.parameters).length > 0)
        .filter(m => !isCacheValid(sku, m.id, dataHash))
        .map(m => m.id);
      
      if (modelsNeedingOptimization.length > 0) {
        result.push({ sku, models: modelsNeedingOptimization });
      }
    });
    
    return result;
  }, [generateDataHash, isCacheValid]);

  const clearCacheForSKU = useCallback((sku: string) => {
    setCache(prev => {
      const newCache = { ...prev };
      delete newCache[sku];
      return newCache;
    });
  }, []);

  return {
    cache,
    cacheStats,
    generateDataHash,
    getCachedParameters,
    setCachedParameters,
    isCacheValid,
    getSKUsNeedingOptimization,
    clearCacheForSKU
  };
};
