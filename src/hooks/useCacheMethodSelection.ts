import { useCallback } from 'react';
import { useOptimizationCache } from './useOptimizationCache';
import { useCacheStorage } from './useCacheStorage';
import { useCacheActions } from './useCacheActions';
import { generateDataHash } from '@/utils/cacheUtils';

export const useCacheMethodSelection = () => {
  const { cache, generateDataHash } = useOptimizationCache();
  const { setCachedParameters } = useCacheStorage();
  const { incrementCacheVersion } = useCacheActions();

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
        setCachedParameters(sku, modelId, currentParams, 'manual', dataHash, {
          confidence: 1,
          reasoning: 'Manual mode selected',
          factors: ['user_selection']
        });
      }
    } else {
      // For AI or Grid, use the existing cache if available
      const existingCache = currentCache?.[method];
      if (existingCache && existingCache.dataHash === dataHash) {
        console.log(`Using existing ${method} cache`);
        setCachedParameters(sku, modelId, existingCache.parameters, method, dataHash, {
          confidence: existingCache.confidence,
          reasoning: existingCache.reasoning,
          factors: existingCache.factors
        });
      } else {
        // If no existing cache, set default parameters
        console.log(`No existing ${method} cache, using default parameters`);
        setCachedParameters(sku, modelId, {}, method, dataHash, {
          confidence: 1,
          reasoning: `${method.toUpperCase()} mode selected`,
          factors: ['user_selection']
        });
      }
    }
    
    // Increment cache version to trigger UI updates
    incrementCacheVersion();
  }, [cache, generateDataHash, setCachedParameters, incrementCacheVersion]);

  return { setSelectedMethod };
};
