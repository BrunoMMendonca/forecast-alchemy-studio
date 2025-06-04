
import { useOptimizationState } from './useOptimizationState';
import { useParameterCache } from './useParameterCache';
import { useDatasetFingerprint } from './useDatasetFingerprint';

export const useOptimizationCache = () => {
  const {
    optimizationState,
    cacheStats,
    setCacheStats,
    isOptimizationComplete,
    markOptimizationComplete,
    getDatasetFingerprintString
  } = useOptimizationState();

  const {
    cache,
    getCachedParameters: getParameters,
    setCachedParameters: setParameters,
    isCacheValid,
    clearCacheForSKU,
    getSKUsNeedingOptimization
  } = useParameterCache();

  const { generateDataHash } = useDatasetFingerprint();

  // Wrapper functions to maintain API compatibility
  const getCachedParameters = (sku: string, modelId: string) => {
    const result = getParameters(sku, modelId);
    if (result) {
      setCacheStats(prev => ({ ...prev, hits: prev.hits + 1 }));
    } else {
      setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
    }
    return result;
  };

  const setCachedParameters = (
    sku: string, 
    modelId: string, 
    parameters: Record<string, number>,
    dataHash: string,
    confidence?: number
  ) => {
    setParameters(sku, modelId, parameters, dataHash, confidence);
  };

  // Legacy compatibility functions (minimal implementations)
  const startOptimizationSession = () => {
    console.log('Legacy startOptimizationSession called');
  };

  const markSKUOptimized = () => {
    console.log('Legacy markSKUOptimized called');
  };

  const completeOptimizationSession = () => {
    console.log('Legacy completeOptimizationSession called');
  };

  const hasOptimizationStarted = () => false;
  const markOptimizationStarted = () => {};
  const batchValidateCache = () => ({});

  return {
    cache,
    cacheStats,
    generateDataHash,
    getCachedParameters,
    setCachedParameters,
    isCacheValid,
    getSKUsNeedingOptimization,
    clearCacheForSKU,
    batchValidateCache,
    isOptimizationComplete,
    markOptimizationComplete,
    startOptimizationSession,
    markSKUOptimized,
    completeOptimizationSession,
    getDatasetFingerprintString,
    hasOptimizationStarted,
    markOptimizationStarted
  };
};
