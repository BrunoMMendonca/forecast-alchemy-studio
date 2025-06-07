
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

  return {
    getCachedParameters,
    setCachedParameters,
    setSelectedMethod,
    clearCacheForSKU
  };
};
