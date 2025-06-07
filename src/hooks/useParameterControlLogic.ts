import { useState, useCallback, useMemo, useEffect } from 'react';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { hasOptimizableParameters } from '@/utils/modelConfig';
import { generateDataHash, getBestAvailableMethod, getParameterValue } from '@/utils/cacheUtils';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';

export const useParameterControlLogic = (
  model: ModelConfig,
  selectedSKU: string,
  data: SalesData[]
) => {
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);
  const { cache, cacheVersion } = useOptimizationCache();

  const currentDataHash = useMemo(() => {
    const skuData = data.filter(d => d.sku === selectedSKU);
    return generateDataHash(skuData);
  }, [data, selectedSKU]);

  const cacheEntry = useMemo(() => {
    return cache[selectedSKU]?.[model.id];
  }, [cache, selectedSKU, model.id, cacheVersion]);

  const userSelectedMethod = useMemo(() => {
    return cacheEntry?.selected;
  }, [cacheEntry, cacheVersion]);

  const effectiveSelectedMethod = useMemo(() => {
    // Always prioritize the user's explicit selection
    if (userSelectedMethod) {
      console.log(`🔄 ParameterControl: Using user selected method: ${userSelectedMethod}`);
      return userSelectedMethod;
    }
    
    // If no user selection, get the best available method
    const bestMethod = getBestAvailableMethod(selectedSKU, model.id, currentDataHash, cache);
    console.log(`🔄 ParameterControl: Using best available method: ${bestMethod}`);
    return bestMethod;
  }, [userSelectedMethod, selectedSKU, model.id, currentDataHash, cache, cacheVersion]);

  const [localSelectedMethod, setLocalSelectedMethod] = useState<'ai' | 'grid' | 'manual' | undefined>(effectiveSelectedMethod);

  // Update local state when cache or SKU changes
  useEffect(() => {
    console.log(`🔄 ParameterControl: Updating local state for SKU ${selectedSKU}, model ${model.id}`);
    console.log(`   Cache entry:`, cacheEntry);
    console.log(`   User selected method:`, userSelectedMethod);
    console.log(`   Effective method:`, effectiveSelectedMethod);
    
    // Always sync with the effective method from cache
    setLocalSelectedMethod(effectiveSelectedMethod);
  }, [effectiveSelectedMethod, selectedSKU, model.id, cacheVersion, cacheEntry, userSelectedMethod]);

  const optimizationData = useMemo(() => {
    if (!cacheEntry) return null;
    
    // When in manual mode, use the manual cache entry if available
    if (localSelectedMethod === 'manual') {
      const manualCache = cacheEntry.manual;
      if (manualCache && manualCache.dataHash === currentDataHash) {
        console.log(`🔄 ParameterControl: Using manual cache for ${selectedSKU}:${model.id}`);
        return manualCache;
      }
      return null;
    }
    
    // For AI and Grid modes, use their respective cache entries
    if (localSelectedMethod === 'ai' && cacheEntry.ai) {
      console.log(`🔄 ParameterControl: Using AI cache for ${selectedSKU}:${model.id}`);
      return cacheEntry.ai;
    } else if (localSelectedMethod === 'grid' && cacheEntry.grid) {
      console.log(`🔄 ParameterControl: Using Grid cache for ${selectedSKU}:${model.id}`);
      return cacheEntry.grid;
    }
    
    return null;
  }, [cacheEntry, localSelectedMethod, selectedSKU, model.id, currentDataHash]);

  const isManual = localSelectedMethod === 'manual';

  const getParameterValueCallback = useCallback((parameter: string) => {
    return getParameterValue(parameter, model, isManual);
  }, [model, isManual]);

  const canOptimize = hasOptimizableParameters(model);
  const hasParameters = model.parameters && Object.keys(model.parameters).length > 0;
  const hasOptimizationResults = canOptimize && optimizationData && !isManual;

  return {
    isReasoningExpanded,
    setIsReasoningExpanded,
    localSelectedMethod,
    setLocalSelectedMethod,
    optimizationData,
    isManual,
    getParameterValue: getParameterValueCallback,
    canOptimize,
    hasParameters,
    hasOptimizationResults,
    cacheVersion
  };
};
