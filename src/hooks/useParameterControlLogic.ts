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

  const effectiveSelectedMethod = useMemo(() => {
    console.log(`🔍 Computing effective method for ${selectedSKU}/${model.id}:`, {
      cacheEntry,
      userSelected: cacheEntry?.selected,
      currentDataHash,
      cacheVersion
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

  // Use effectiveSelectedMethod directly instead of local state
  const localSelectedMethod = effectiveSelectedMethod;
  
  // Keep setLocalSelectedMethod for API compatibility but accept argument even though we don't use it
  const setLocalSelectedMethod = useCallback((_method?: 'ai' | 'grid' | 'manual') => {
    // This is kept for API compatibility but we rely on cache state
    console.log('setLocalSelectedMethod called but ignored, relying on cache state');
  }, []);

  const optimizationData = useMemo(() => {
    if (!cacheEntry || localSelectedMethod === 'manual') return null;
    
    if (localSelectedMethod === 'ai' && cacheEntry.ai) {
      return cacheEntry.ai;
    } else if (localSelectedMethod === 'grid' && cacheEntry.grid) {
      return cacheEntry.grid;
    }
    
    return cacheEntry.ai || cacheEntry.grid || null;
  }, [cacheEntry, localSelectedMethod, cacheVersion]);

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
