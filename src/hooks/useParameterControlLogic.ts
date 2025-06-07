import { useState, useCallback, useMemo, useEffect } from 'react';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { hasOptimizableParameters } from '@/utils/modelConfig';
import { generateDataHash } from '@/utils/cacheHashUtils';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useOptimizationMethodManagement } from '@/hooks/useOptimizationMethodManagement';

export const useParameterControlLogic = (
  model: ModelConfig,
  selectedSKU: string,
  data: SalesData[]
) => {
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);
  const { cache, cacheVersion } = useOptimizationCache();
  const { getBestAvailableMethod } = useOptimizationMethodManagement();

  // Get the actual data hash for the current SKU
  const currentDataHash = useMemo(() => {
    const skuData = data.filter(d => d.sku === selectedSKU);
    const hash = generateDataHash(skuData);
    console.log(`🔄 PARAM_CONTROL: Generated data hash for ${selectedSKU}: ${hash.substring(0, 50)}...`);
    return hash;
  }, [data, selectedSKU]);

  // Get current user selection from cache
  const cacheEntry = useMemo(() => {
    console.log(`🔄 PARAM_CONTROL: Cache lookup for ${selectedSKU}:${model.id} (version: ${cacheVersion})`);
    const entry = cache[selectedSKU]?.[model.id];
    console.log(`🔄 PARAM_CONTROL: Found cache entry:`, entry);
    return entry;
  }, [cache, selectedSKU, model.id, cacheVersion]);

  const userSelectedMethod = useMemo(() => {
    const method = cacheEntry?.selected;
    console.log(`🔄 PARAM_CONTROL: User selected method for ${selectedSKU}:${model.id} = ${method} (cache version: ${cacheVersion})`);
    return method;
  }, [cacheEntry, selectedSKU, model.id, cacheVersion]);

  // Compute the effective selected method - combines user choice with best available
  const effectiveSelectedMethod = useMemo(() => {
    // If user has made an explicit choice, use that
    if (userSelectedMethod) {
      console.log(`🎯 PARAM_CONTROL: Using explicit user choice: ${userSelectedMethod} for ${selectedSKU}:${model.id}`);
      return userSelectedMethod;
    }

    // Otherwise, use the best available method based on current cache state
    const bestMethod = getBestAvailableMethod(selectedSKU, model.id, currentDataHash);
    console.log(`🎯 PARAM_CONTROL: Using best available method: ${bestMethod} for ${selectedSKU}:${model.id} (hash: ${currentDataHash.substring(0, 20)}...)`);
    return bestMethod;
  }, [userSelectedMethod, selectedSKU, model.id, getBestAvailableMethod, currentDataHash, cacheVersion]);

  // Local state for immediate visual feedback on user clicks
  const [localSelectedMethod, setLocalSelectedMethod] = useState<'ai' | 'grid' | 'manual' | undefined>(effectiveSelectedMethod);

  // Sync local state with effective method when it changes (due to optimization completion)
  useEffect(() => {
    setLocalSelectedMethod(effectiveSelectedMethod);
    console.log(`🎯 PARAM_CONTROL: Local state synced to effective method ${effectiveSelectedMethod} for ${selectedSKU}:${model.id}`);
  }, [effectiveSelectedMethod, selectedSKU, model.id]);

  // Load optimization data from cache based on effective selected method
  const optimizationData = useMemo(() => {
    if (!cacheEntry || localSelectedMethod === 'manual') {
      console.log(`🔄 PARAM_CONTROL: No optimization data - manual mode or no cache entry`);
      return null;
    }

    if (localSelectedMethod === 'ai' && cacheEntry.ai) {
      console.log(`🔄 PARAM_CONTROL: Using AI optimization data`);
      return cacheEntry.ai;
    } else if (localSelectedMethod === 'grid' && cacheEntry.grid) {
      console.log(`🔄 PARAM_CONTROL: Using Grid optimization data`);
      return cacheEntry.grid;
    }

    const fallback = cacheEntry.ai || cacheEntry.grid || null;
    console.log(`🔄 PARAM_CONTROL: Using fallback optimization data:`, fallback ? 'found' : 'none');
    return fallback;
  }, [cacheEntry, localSelectedMethod]);

  // Determine which method is currently active
  const isManual = localSelectedMethod === 'manual';
  const isAI = localSelectedMethod === 'ai';
  const isGrid = localSelectedMethod === 'grid';

  // Log current state for debugging
  useEffect(() => {
    console.log(`🎯 PARAM_CONTROL: Badge states for ${selectedSKU}:${model.id}:`, {
      effectiveSelectedMethod,
      localSelectedMethod,
      isManual,
      isAI,
      isGrid,
      cacheVersion,
      currentDataHash: currentDataHash.substring(0, 20) + '...'
    });
  }, [selectedSKU, model.id, effectiveSelectedMethod, localSelectedMethod, isManual, isAI, isGrid, cacheVersion, currentDataHash]);

  // FIXED: Use model parameters as source of truth, not cache
  const getParameterValue = useCallback((parameter: string) => {
    if (isManual) {
      // For manual mode, always use the current model parameters (which get updated by the slider)
      const modelValue = model.parameters?.[parameter];
      console.log(`🔄 PARAM_CONTROL: Using current model value for ${parameter}: ${modelValue}`);
      return modelValue;
    } else {
      // For optimization modes, use optimized parameters if available, otherwise fall back to model
      const optimizedValue = model.optimizedParameters?.[parameter];
      const modelValue = model.parameters?.[parameter];
      const result = optimizedValue !== undefined ? optimizedValue : modelValue;
      console.log(`🔄 PARAM_CONTROL: Using optimized value for ${parameter}: ${result} (optimized: ${optimizedValue}, model: ${modelValue})`);
      return result;
    }
  }, [isManual, model.parameters, model.optimizedParameters]);

  const canOptimize = hasOptimizableParameters(model);

  // Only show parameters section if model actually has parameters
  const hasParameters = model.parameters && Object.keys(model.parameters).length > 0;

  // Check if optimization results exist for display
  const hasOptimizationResults = canOptimize && optimizationData && !isManual;

  return {
    isReasoningExpanded,
    setIsReasoningExpanded,
    localSelectedMethod,
    setLocalSelectedMethod,
    optimizationData,
    isManual,
    isAI,
    isGrid,
    getParameterValue,
    canOptimize,
    hasParameters,
    hasOptimizationResults,
    cacheVersion
  };
};
