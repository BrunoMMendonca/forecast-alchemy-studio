
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
    const entry = cache[selectedSKU]?.[model.id];
    console.log(`📊 PARAM_LOGIC: Cache entry for ${selectedSKU}:${model.id}:`, JSON.stringify(entry, null, 2));
    return entry;
  }, [cache, selectedSKU, model.id, cacheVersion]);

  const userSelectedMethod = useMemo(() => {
    const selected = cacheEntry?.selected;
    console.log(`📊 PARAM_LOGIC: User selected method for ${model.id}: ${selected}`);
    return selected;
  }, [cacheEntry, cacheVersion]);

  const effectiveSelectedMethod = useMemo(() => {
    if (userSelectedMethod) {
      console.log(`📊 PARAM_LOGIC: Using user selected method for ${model.id}: ${userSelectedMethod}`);
      return userSelectedMethod;
    }
    const bestMethod = getBestAvailableMethod(selectedSKU, model.id, currentDataHash, cache);
    console.log(`📊 PARAM_LOGIC: Using best available method for ${model.id}: ${bestMethod}`);
    return bestMethod;
  }, [userSelectedMethod, selectedSKU, model.id, getBestAvailableMethod, currentDataHash, cache, cacheVersion]);

  const [localSelectedMethod, setLocalSelectedMethod] = useState<'ai' | 'grid' | 'manual' | undefined>(effectiveSelectedMethod);

  useEffect(() => {
    console.log(`📊 PARAM_LOGIC: Updating local method for ${model.id} from ${localSelectedMethod} to ${effectiveSelectedMethod}`);
    setLocalSelectedMethod(effectiveSelectedMethod);
  }, [effectiveSelectedMethod, selectedSKU, model.id]);

  const optimizationData = useMemo(() => {
    if (!cacheEntry || localSelectedMethod === 'manual') return null;
    
    if (localSelectedMethod === 'ai' && cacheEntry.ai) {
      console.log(`📊 PARAM_LOGIC: Using AI optimization data for ${model.id}`);
      return cacheEntry.ai;
    } else if (localSelectedMethod === 'grid' && cacheEntry.grid) {
      console.log(`📊 PARAM_LOGIC: Using Grid optimization data for ${model.id}`);
      return cacheEntry.grid;
    }
    
    const fallback = cacheEntry.ai || cacheEntry.grid || null;
    console.log(`📊 PARAM_LOGIC: Using fallback optimization data for ${model.id}:`, fallback ? 'found' : 'none');
    return fallback;
  }, [cacheEntry, localSelectedMethod]);

  const isManual = localSelectedMethod === 'manual';

  const getParameterValueCallback = useCallback((parameter: string) => {
    // Always use the current model parameter value - don't override with cache during UI interactions
    const value = getParameterValue(parameter, model, isManual);
    console.log(`📊 PARAM_LOGIC: Getting parameter ${parameter} for ${model.id} (manual: ${isManual}): ${value}`);
    return value;
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
