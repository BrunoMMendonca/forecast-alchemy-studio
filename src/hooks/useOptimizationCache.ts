
import { useState, useCallback, useEffect } from 'react';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { useDatasetOptimization } from '@/hooks/useDatasetOptimization';
import { 
  OptimizationCache, 
  loadCacheFromStorage, 
  saveCacheToStorage, 
  clearCacheStorage 
} from '@/utils/cacheStorageUtils';
import { generateDataHash } from '@/utils/cacheHashUtils';
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
    setSelectedMethod,
    clearCacheForSKU
  } = useCacheOperations(cache, setCache, setCacheStats, setCacheVersion);

  // Load state from localStorage on mount
  useEffect(() => {
    const loadedCache = loadCacheFromStorage();
    setCache(loadedCache);
  }, []);

  // Save cache to localStorage when it changes
  useEffect(() => {
    saveCacheToStorage(cache);
  }, [cache]);

  const getSKUsNeedingOptimizationCallback = useCallback((
    data: SalesData[], 
    models: ModelConfig[]
  ) => getSKUsNeedingOptimization(data, models, cache), [cache]);

  const isCacheValidCallback = useCallback((
    sku: string, 
    modelId: string, 
    currentDataHash: string, 
    method?: 'ai' | 'grid'
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
    setSelectedMethod,
    isCacheValid: isCacheValidCallback,
    getSKUsNeedingOptimization: getSKUsNeedingOptimizationCallback,
    clearCacheForSKU,
    clearAllCache,
    isOptimizationComplete,
    markOptimizationComplete,
    generateDatasetFingerprint,
    startOptimizationSession: () => {},
    markSKUOptimized: () => {},
    completeOptimizationSession: () => {},
    getDatasetFingerprintString: generateDatasetFingerprint,
    hasOptimizationStarted: () => false,
    markOptimizationStarted: () => {},
    batchValidateCache: () => ({})
  };
};
