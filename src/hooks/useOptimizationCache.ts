
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
  // All useState hooks must be called first and in the same order
  const [cache, setCache] = useState<OptimizationCache>({});
  const [cacheStats, setCacheStats] = useState({ hits: 0, misses: 0, skipped: 0 });
  const [cacheVersion, setCacheVersion] = useState(0);
  
  // All custom hooks must be called after useState hooks and in the same order
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

  // All useEffect hooks must come after other hooks
  useEffect(() => {
    const loadedCache = loadCacheFromStorage();
    setCache(loadedCache);
    console.log('🗄️ CACHE: Initial load from localStorage completed');
  }, []);

  // All useCallback hooks must come after useEffect hooks
  const setSelectedMethod = useCallback((
    sku: string,
    modelId: string,
    method: 'ai' | 'grid' | 'manual'
  ) => {
    console.log(`🎯 METHOD: Setting method for ${sku}:${modelId} to ${method}`);
    _setSelectedMethod(sku, modelId, method);
  }, [_setSelectedMethod]);

  // New function to cache manual parameters
  const cacheManualParameters = useCallback((
    sku: string,
    modelId: string,
    parameters: Record<string, number>,
    dataHash: string
  ) => {
    console.log(`🗄️ CACHE: Caching manual parameters for ${sku}:${modelId}`);
    setCachedParameters(
      sku,
      modelId,
      parameters,
      dataHash,
      undefined, // no confidence for manual
      undefined, // no reasoning for manual
      undefined, // no factors for manual
      undefined, // no expected accuracy for manual
      'manual'   // method identifier
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
  ) => {
    // Handle manual method separately since it's not supported by the original isCacheValid function
    if (method === 'manual') {
      const cached = cache[sku]?.[modelId]?.manual;
      return cached && cached.dataHash === currentDataHash;
    }
    
    // For ai and grid methods, use the original function
    return isCacheValid(sku, modelId, currentDataHash, cache, method as 'ai' | 'grid');
  }, [cache]);

  const clearAllCache = useCallback(() => {
    console.log('🗄️ CACHE: Clearing all cache and saving to localStorage');
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
