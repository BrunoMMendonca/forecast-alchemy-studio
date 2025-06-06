
import { useCallback } from 'react';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useAutoBestMethod } from '@/hooks/useAutoBestMethod';

export const useOptimizationMethodManagement = () => {
  const { cache } = useOptimizationCache();
  const { loadAutoBestMethod, saveAutoBestMethod } = useAutoBestMethod();

  // Helper function to get the best available method for automatic selection
  const getBestAvailableMethod = useCallback((sku: string, modelId: string, currentDataHash: string) => {
    const cached = cache[sku]?.[modelId];
    if (!cached) return 'manual';

    const hasValidAI = cached.ai && cached.ai.dataHash === currentDataHash;
    const hasValidGrid = cached.grid && cached.grid.dataHash === currentDataHash;

    // Priority: AI > Grid > Manual
    if (hasValidAI) return 'ai';
    if (hasValidGrid) return 'grid';
    return 'manual';
  }, [cache]);

  // Function to update automatic best method selections
  const updateAutoBestMethods = useCallback((sku: string, currentDataHash: string) => {
    const autoMethods = loadAutoBestMethod();
    let methodsUpdated = false;

    // Get all models that have cache entries for this SKU
    const skuCache = cache[sku];
    if (!skuCache) return;

    Object.keys(skuCache).forEach(modelId => {
      const autoKey = `${sku}:${modelId}`;
      const currentAutoMethod = autoMethods[autoKey];
      const bestAvailableMethod = getBestAvailableMethod(sku, modelId, currentDataHash);

      // Only update if we have a better method available than current auto method
      const shouldUpdate = (
        !currentAutoMethod || // No auto method set
        (currentAutoMethod === 'manual' && bestAvailableMethod !== 'manual') || // Manual -> Better method
        (currentAutoMethod === 'grid' && bestAvailableMethod === 'ai') // Grid -> AI
      );

      if (shouldUpdate && bestAvailableMethod !== currentAutoMethod) {
        autoMethods[autoKey] = bestAvailableMethod;
        methodsUpdated = true;
        console.log(`🎯 AUTO-METHOD UPDATE: ${autoKey} -> ${bestAvailableMethod} (was: ${currentAutoMethod || 'none'})`);
      }
    });

    if (methodsUpdated) {
      saveAutoBestMethod(autoMethods);
      console.log(`💾 AUTO-METHODS: Updated to best available methods for ${sku}`);
    }

    return methodsUpdated;
  }, [cache, loadAutoBestMethod, saveAutoBestMethod, getBestAvailableMethod]);

  return {
    getBestAvailableMethod,
    updateAutoBestMethods
  };
};
