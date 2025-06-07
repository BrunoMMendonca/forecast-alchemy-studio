
import { useState, useCallback, useEffect } from 'react';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { useDatasetOptimization } from '@/hooks/useDatasetOptimization';
import { 
  OptimizationCache, 
  loadCacheFromStorage, 
  clearCacheStorage 
} from '@/utils/cacheStorageUtils';
import { generateDataHash } from '@/utils/cacheUtils';
import { getSKUsNeedingOptimization, isCacheValid } from '@/utils/cacheValidationUtils';
import { useCacheOperations } from '@/hooks/useCacheOperations';

export const useOptimizationCache = () => {
  const [cache, setCache] = useState<OptimizationCache>({});
  const [cacheStats, setCacheStats] = useState({ hits: 0, misses: 0, skipped: 0 });
  const [cacheVersion, setCacheVersion] = useState(0);
  
  const {
    generateDatasetFingerprint,
    isOptimizationComplete,
    markOptimizationComplete
  } = useDatasetOptimization();

  const {
    getCachedParameters,
    setCachedParameters,
    setSelectedMethod: _setSelectedMethod,
    clearCacheForSKU
  } = useCacheOperations(cache, setCache, setCacheStats, setCacheVersion);

  useEffect(() => {
    const loadedCache = loadCacheFromStorage();
    setCache(loadedCache);
  }, []);

  const setSelectedMethod = useCallback((
    sku: string,
    modelId: string,
    method: 'ai' | 'grid' | 'manual'
  ) => {
    _setSelectedMethod(sku, modelId, method);
  }, [_setSelectedMethod]);

  const cacheManualParameters = useCallback((
    sku: string,
    modelId: string,
    parameters: Record<string, number>,
    dataHash: string
  ) => {
    setCachedParameters(
      sku,
      modelId,
      parameters,
      dataHash,
      undefined,
      undefined,
      undefined,
      undefined,
      'manual'
    );
  }, [setCachedParameters]);

  const getSKUsNeedingOptimizationCallback = useCallback((
    data: SalesData[], 
    models: ModelConfig[]
  ) => getSKUsNeedingOptimization(data, models, cache), [cache]);

  const isCacheValidCallback = useCallback((
    sku: string, 
    modelId: string, 
    currentDataHash: string, 
    method?: 'ai' | 'grid' | 'manual'
  ) => isCacheValid(sku, modelId, currentDataHash, cache, method), [cache]);

  const clearAllCache = useCallback(() => {
    setCache({});
    setCacheStats({ hits: 0, misses: 0, skipped: 0 });
    setCacheVersion(0);
    clearCacheStorage();
  }, []);

  return {
    cache,
    cacheStats,
    cacheVersion,
    generateDataHash,
    getCachedParameters,
    setCachedParameters,
    cacheManualParameters,
    setSelectedMethod,
    isCacheValid: isCacheValidCallback,
    getSKUsNeedingOptimization: getSKUsNeedingOptimizationCallback,
    clearCacheForSKU,
    clearAllCache,
    isOptimizationComplete,
    markOptimizationComplete,
    generateDatasetFingerprint
  };
};
