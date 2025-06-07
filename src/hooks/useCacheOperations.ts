import { useCacheRetrieval } from '@/hooks/useCacheRetrieval';
import { useCacheStorage } from '@/hooks/useCacheStorage';
import { useCacheMethodSelection } from '@/hooks/useCacheMethodSelection';
import { useCacheActions } from '@/hooks/useCacheActions';
import { OptimizationCache } from '@/utils/cacheStorageUtils';

export const useCacheOperations = (
  cache: OptimizationCache,
  setCache: React.Dispatch<React.SetStateAction<OptimizationCache>>,
  setCacheStats: React.Dispatch<React.SetStateAction<{ hits: number; misses: number; skipped: number }>>,
  setCacheVersion: React.Dispatch<React.SetStateAction<number>>
) => {
  const { getCachedParameters } = useCacheRetrieval(cache, setCacheStats);
  const { setCachedParameters } = useCacheStorage(setCache, setCacheVersion);
  const { setSelectedMethod } = useCacheMethodSelection(setCache, setCacheVersion);
  const { clearCacheForSKU } = useCacheActions(setCache, setCacheVersion);

  // Wrap setSelectedMethod to ensure proper cache updates
  const wrappedSetSelectedMethod = (sku: string, modelId: string, method: 'ai' | 'grid' | 'manual') => {
    console.log(`💾 CacheOps: Setting method for ${sku}:${modelId} to ${method}`);
    
    // Get current cache entry
    const currentEntry = cache[sku]?.[modelId];
    console.log(`💾 CacheOps: Current cache entry:`, currentEntry);
    
    // Set the selected method
    setSelectedMethod(sku, modelId, method);
    
    // Increment cache version to trigger updates
    setCacheVersion(prev => {
      const newVersion = prev + 1;
      console.log(`💾 CacheOps: Cache version updated to ${newVersion}`);
      return newVersion;
    });
  };

  return {
    getCachedParameters,
    setCachedParameters,
    setSelectedMethod: wrappedSetSelectedMethod,
    clearCacheForSKU
  };
};
