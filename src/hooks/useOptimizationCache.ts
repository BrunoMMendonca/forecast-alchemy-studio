
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

  // Force reload cache from localStorage
  const forceReloadCache = useCallback(() => {
    console.log('🔄 CACHE: Force reloading from localStorage');
    const loadedCache = loadCacheFromStorage();
    setCache(loadedCache);
    setCacheVersion(prev => prev + 1);
  }, []);

  // Load cache on mount and set up localStorage listener
  useEffect(() => {
    const loadedCache = loadCacheFromStorage();
    setCache(loadedCache);

    // Listen for localStorage changes from other tabs/components
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'forecast_optimization_cache') {
        console.log('🔄 CACHE: localStorage changed, reloading cache');
        forceReloadCache();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [forceReloadCache]);

  // Sync cache with localStorage before any major operation
  const syncCacheWithStorage = useCallback(() => {
    const currentCache = loadCacheFromStorage();
    const currentCacheString = JSON.stringify(currentCache);
    const reactCacheString = JSON.stringify(cache);
    
    if (currentCacheString !== reactCacheString) {
      console.log('🔄 CACHE: React state out of sync with localStorage, syncing...');
      setCache(currentCache);
      setCacheVersion(prev => prev + 1);
      return currentCache;
    }
    
    return cache;
  }, [cache]);

  const setSelectedMethod = useCallback((
    sku: string,
    modelId: string,
    method: 'ai' | 'grid' | 'manual'
  ) => {
    // Sync before making changes
    syncCacheWithStorage();
    _setSelectedMethod(sku, modelId, method);
  }, [_setSelectedMethod, syncCacheWithStorage]);

  const cacheManualParameters = useCallback((
    sku: string,
    modelId: string,
    parameters: Record<string, number>,
    dataHash: string
  ) => {
    // Sync before making changes
    syncCacheWithStorage();
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
  }, [setCachedParameters, syncCacheWithStorage]);

  const getSKUsNeedingOptimizationCallback = useCallback((
    data: SalesData[], 
    models: ModelConfig[]
  ) => {
    const syncedCache = syncCacheWithStorage();
    return getSKUsNeedingOptimization(data, models, syncedCache);
  }, [syncCacheWithStorage]);

  const isCacheValidCallback = useCallback((
    sku: string, 
    modelId: string, 
    currentDataHash: string, 
    method?: 'ai' | 'grid' | 'manual'
  ) => {
    const syncedCache = syncCacheWithStorage();
    return isCacheValid(sku, modelId, currentDataHash, syncedCache, method);
  }, [syncCacheWithStorage]);

  const clearAllCache = useCallback(() => {
    setCache({});
    setCacheStats({ hits: 0, misses: 0, skipped: 0 });
    setCacheVersion(0);
    clearCacheStorage();
  }, []);

  // Get fresh cache data for current access
  const getFreshCache = useCallback(() => {
    return syncCacheWithStorage();
  }, [syncCacheWithStorage]);

  return {
    cache: cache, // Keep returning the React state for consistency
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
    forceReloadCache,
    syncCacheWithStorage,
    getFreshCache
  };
};
