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
  }, [cache, selectedSKU, model.id]);

  const effectiveSelectedMethod = useMemo(() => {
    console.log(`🔍 Computing effective method for ${selectedSKU}/${model.id}:`, {
      cacheEntry,
      userSelected: cacheEntry?.selected,
      currentDataHash
    });

    // If user has explicitly selected a method, use it
    if (cacheEntry?.selected) {
      console.log(`👤 User selected: ${cacheEntry.selected}`);
      return cacheEntry.selected;
    }

    // Otherwise, get the best available method
    const bestMethod = getBestAvailableMethod(selectedSKU, model.id, currentDataHash, cache);
    console.log(`🎯 Best available method: ${bestMethod}`);
    return bestMethod;
  }, [cacheEntry, selectedSKU, model.id, currentDataHash, cache, cacheVersion]);

  const [localSelectedMethod, setLocalSelectedMethod] = useState<'ai' | 'grid' | 'manual' | undefined>(effectiveSelectedMethod);

  // Sync local state whenever effective method changes
  useEffect(() => {
    console.log(`🔄 Syncing local state: ${localSelectedMethod} -> ${effectiveSelectedMethod} for ${selectedSKU}/${model.id}`);
    setLocalSelectedMethod(effectiveSelectedMethod);
  }, [effectiveSelectedMethod, selectedSKU, model.id]);

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
