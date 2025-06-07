
import { useCallback } from 'react';
import { OptimizationCache, OptimizedParameters, CACHE_EXPIRY_HOURS } from '@/utils/cacheStorageUtils';

export const useCacheRetrieval = (
  cache: OptimizationCache,
  setCacheStats: React.Dispatch<React.SetStateAction<{ hits: number; misses: number; skipped: number }>>
) => {
  const getCachedParameters = useCallback((
    sku: string, 
    modelId: string, 
    method?: 'ai' | 'grid' | 'manual'
  ): OptimizedParameters | null => {
    const cached = cache[sku]?.[modelId];
    if (!cached) {
      setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
      return null;
    }

    const now = Date.now();
    const isExpired = (entry: OptimizedParameters) => 
      now - entry.timestamp > CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
    
    const isValidEntry = (entry: OptimizedParameters) => 
      entry && entry.dataHash?.startsWith('v2-') && !isExpired(entry);

    if (method) {
      const result = cached[method];
      if (!result || !isValidEntry(result)) {
        setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
        return null;
      }
      setCacheStats(prev => ({ ...prev, hits: prev.hits + 1 }));
      return result;
    }

    const selectedMethod = cached.selected || 'manual';
    let result = cached[selectedMethod];
    
    if (!isValidEntry(result)) {
      result = cached.ai || cached.grid || cached.manual;
      if (!isValidEntry(result)) {
        result = undefined;
      }
    }
    
    if (!result) {
      setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
      return null;
    }

    setCacheStats(prev => ({ ...prev, hits: prev.hits + 1 }));
    return result;
  }, [cache, setCacheStats]);

  return { getCachedParameters };
};
