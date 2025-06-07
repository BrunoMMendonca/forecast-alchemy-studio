
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
    const selected = cacheEntry?.selected;
    console.log(`🎯 USER SELECTED METHOD for ${selectedSKU}-${model.id}:`, selected);
    return selected;
  }, [cacheEntry, cacheVersion, selectedSKU, model.id]);

  const effectiveSelectedMethod = useMemo(() => {
    let result;
    if (userSelectedMethod) {
      result = userSelectedMethod;
      console.log(`🎯 USING USER SELECTION for ${selectedSKU}-${model.id}:`, result);
    } else {
      result = getBestAvailableMethod(selectedSKU, model.id, currentDataHash, cache);
      console.log(`🎯 USING BEST AVAILABLE for ${selectedSKU}-${model.id}:`, result);
    }
    
    console.log(`🎯 EFFECTIVE METHOD for ${selectedSKU}-${model.id}:`, result, {
      userSelected: userSelectedMethod,
      cacheEntry: cacheEntry,
      hasAI: !!cacheEntry?.ai,
      hasGrid: !!cacheEntry?.grid,
      hasManual: !!cacheEntry?.manual,
      cacheVersion
    });
    
    return result;
  }, [userSelectedMethod, selectedSKU, model.id, getBestAvailableMethod, currentDataHash, cache, cacheVersion, cacheEntry]);

  const [localSelectedMethod, setLocalSelectedMethod] = useState<'ai' | 'grid' | 'manual' | undefined>(effectiveSelectedMethod);

  // Force sync local state with effective method whenever it changes
  useEffect(() => {
    console.log(`🎯 EFFECT UPDATE for ${selectedSKU}-${model.id}: ${localSelectedMethod} -> ${effectiveSelectedMethod} (version: ${cacheVersion})`);
    if (localSelectedMethod !== effectiveSelectedMethod) {
      console.log(`🎯 FORCING STATE SYNC for ${selectedSKU}-${model.id}: ${effectiveSelectedMethod}`);
      setLocalSelectedMethod(effectiveSelectedMethod);
    }
  }, [effectiveSelectedMethod, selectedSKU, model.id, cacheVersion, localSelectedMethod]);

  const optimizationData = useMemo(() => {
    if (!cacheEntry || localSelectedMethod === 'manual') return null;
    
    if (localSelectedMethod === 'ai' && cacheEntry.ai) {
      return cacheEntry.ai;
    } else if (localSelectedMethod === 'grid' && cacheEntry.grid) {
      return cacheEntry.grid;
    }
    
    return cacheEntry.ai || cacheEntry.grid || null;
  }, [cacheEntry, localSelectedMethod]);

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
