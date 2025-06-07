
import { useCallback } from 'react';
import { useOptimizationCache } from './useOptimizationCache';
import { useCacheStorage } from './useCacheStorage';
import { useCacheActions } from './useCacheActions';
import { generateDataHash } from '@/utils/cacheUtils';

export const useCacheMethodSelection = () => {
  const { cache, generateDataHash } = useOptimizationCache();
  const { setCachedParameters } = useCacheStorage();
  const { clearCacheForSKU, incrementCacheVersion } = useCacheActions();

  const setSelectedMethod = useCallback((
    sku: string,
    modelId: string,
    method: 'ai' | 'grid' | 'manual',
    data: any[]
  ) => {
    console.log(`🔄 Setting selected method for ${sku}:${modelId} to ${method}`);
    const skuData = data.filter(d => d.sku === sku);
    const dataHash = generateDataHash(skuData);
    
    // Get current cache entry
    const currentCache = cache[sku]?.[modelId];
    console.log('Current cache entry:', currentCache);
    
    // If switching to manual, preserve the current parameters
    if (method === 'manual' && currentCache) {
      const currentParams = currentCache.manual?.parameters || currentCache.grid?.parameters || currentCache.ai?.parameters;
      if (currentParams) {
        console.log('Preserving current parameters for manual mode:', currentParams);
        setCachedParameters(sku, modelId, currentParams, dataHash, 1, 'Manual mode selected', {
          stability: 1,
          interpretability: 1,
          complexity: 1,
          businessImpact: 'user_selection'
        }, undefined, 'manual');
      }
    } else {
      // For AI or Grid, use the existing cache if available
      const existingCache = currentCache?.[method];
      if (existingCache && existingCache.dataHash === dataHash) {
        console.log(`Using existing ${method} cache`);
        setCachedParameters(sku, modelId, existingCache.parameters, dataHash, existingCache.confidence, existingCache.reasoning, existingCache.factors, existingCache.expectedAccuracy, method);
      } else {
        // If no existing cache, set default parameters
        console.log(`No existing ${method} cache, using default parameters`);
        setCachedParameters(sku, modelId, {}, dataHash, 1, `${method.toUpperCase()} mode selected`, {
          stability: 1,
          interpretability: 1,
          complexity: 1,
          businessImpact: 'user_selection'
        }, undefined, method);
      }
    }
    
    // Increment cache version to trigger UI updates
    incrementCacheVersion();
  }, [cache, generateDataHash, setCachedParameters, incrementCacheVersion]);

  return { setSelectedMethod };
};
