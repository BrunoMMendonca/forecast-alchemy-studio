
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
  }, [cacheEntry]);

  const effectiveSelectedMethod = useMemo(() => {
    if (userSelectedMethod) {
      return userSelectedMethod;
    }
    return getBestAvailableMethod(selectedSKU, model.id, currentDataHash, cache);
  }, [userSelectedMethod, selectedSKU, model.id, currentDataHash, cache, cacheVersion]);

  const [localSelectedMethod, setLocalSelectedMethod] = useState<'ai' | 'grid' | 'manual' | undefined>(effectiveSelectedMethod);

  // Update local method when effective method changes
  useEffect(() => {
    console.log(`🔄 EFFECT: Setting localSelectedMethod to ${effectiveSelectedMethod} for ${model.id}`);
    setLocalSelectedMethod(effectiveSelectedMethod);
  }, [effectiveSelectedMethod, selectedSKU, model.id, cacheVersion]);

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

  // Simplified parameter values - just get the current state
  const parameterValues = useMemo(() => {
    if (!model.parameters) return {};
    
    console.log(`🎯 COMPUTING parameterValues for ${model.id}, isManual: ${isManual}, selectedSKU: ${selectedSKU}`);
    
    const values: Record<string, number> = {};
    Object.keys(model.parameters).forEach(parameter => {
      if (isManual) {
        // Manual mode: check cache for saved manual values first
        const cachedValue = cacheEntry?.manual?.parameters?.[parameter];
        if (cachedValue !== undefined && cacheEntry?.manual?.dataHash === currentDataHash) {
          values[parameter] = cachedValue;
          console.log(`📊 MANUAL CACHE: ${parameter} = ${cachedValue}`);
        } else {
          values[parameter] = model.parameters![parameter];
          console.log(`📊 MANUAL DEFAULT: ${parameter} = ${model.parameters![parameter]}`);
        }
      } else {
        // AI/Grid mode: use optimized parameters from model
        const optimizedValue = model.optimizedParameters?.[parameter];
        values[parameter] = optimizedValue !== undefined ? optimizedValue : model.parameters![parameter];
        console.log(`📊 OPTIMIZED: ${parameter} = ${values[parameter]}`);
      }
    });
    
    console.log(`🎯 FINAL parameterValues for ${model.id}:`, values);
    return values;
  }, [model, isManual, cacheEntry, currentDataHash, selectedSKU, cacheVersion]);

  const getParameterValueCallback = useCallback((parameter: string) => {
    const value = parameterValues[parameter];
    console.log(`🎚️ GET PARAM: ${parameter} = ${value}`);
    return value;
  }, [parameterValues]);

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
    cacheVersion,
    parameterValues
  };
};
