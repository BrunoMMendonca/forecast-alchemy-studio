
import React, { useState, useMemo, useCallback } from 'react';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { generateDataHash, getBestAvailableMethod } from '@/utils/cacheUtils';

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

  const bestAvailableMethod = useMemo(() => {
    return getBestAvailableMethod(selectedSKU, model.id, currentDataHash, cache);
  }, [selectedSKU, model.id, currentDataHash, cache, cacheVersion]);

  const cachedEntry = cache[selectedSKU]?.[model.id];
  const userSelectedMethod = cachedEntry?.selected;
  
  const [localSelectedMethod, setLocalSelectedMethod] = useState<'manual' | 'ai' | 'grid'>(() => {
    return userSelectedMethod || bestAvailableMethod;
  });

  // Update local state when cache changes
  React.useEffect(() => {
    const newMethod = userSelectedMethod || bestAvailableMethod;
    if (newMethod !== localSelectedMethod) {
      console.log(`🎯 LOGIC: Updating local method from ${localSelectedMethod} to ${newMethod} for ${model.id}`);
      setLocalSelectedMethod(newMethod);
    }
  }, [userSelectedMethod, bestAvailableMethod, localSelectedMethod, model.id]);

  const optimizationData = useMemo(() => {
    const methodToUse = localSelectedMethod === 'manual' ? 'manual' : localSelectedMethod;
    const cached = cachedEntry?.[methodToUse];
    
    if (!cached || cached.dataHash !== currentDataHash) {
      return null;
    }
    
    return cached;
  }, [cachedEntry, localSelectedMethod, currentDataHash]);

  const isManual = localSelectedMethod === 'manual';
  
  // Get parameter value from model state (not cache) for UI display
  const getParameterValue = useCallback((parameter: string): number | undefined => {
    // Always read from model.parameters for manual mode to reflect UI changes immediately
    if (isManual) {
      const value = model.parameters?.[parameter];
      console.log(`🎯 LOGIC: Getting manual parameter ${parameter} = ${value} from model state`);
      return value;
    } else {
      // For optimized modes, use optimized parameters if available
      const optimizedValue = model.optimizedParameters?.[parameter];
      const modelValue = model.parameters?.[parameter];
      const value = optimizedValue !== undefined ? optimizedValue : modelValue;
      console.log(`🎯 LOGIC: Getting optimized parameter ${parameter} = ${value} (optimized: ${optimizedValue}, model: ${modelValue})`);
      return value;
    }
  }, [model.parameters, model.optimizedParameters, isManual]);

  const canOptimize = useMemo(() => {
    const skuData = data.filter(d => d.sku === selectedSKU);
    return skuData.length >= 10;
  }, [data, selectedSKU]);

  const hasParameters = model.parameters && Object.keys(model.parameters).length > 0;
  const hasOptimizationResults = !!optimizationData;

  return {
    isReasoningExpanded,
    setIsReasoningExpanded,
    localSelectedMethod,
    setLocalSelectedMethod,
    optimizationData,
    isManual,
    getParameterValue,
    canOptimize,
    hasParameters,
    hasOptimizationResults,
    cacheVersion
  };
};
