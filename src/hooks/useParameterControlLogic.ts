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
    if (userSelectedMethod) {
      return userSelectedMethod;
    }
    return getBestAvailableMethod(selectedSKU, model.id, currentDataHash, cache);
  }, [userSelectedMethod, selectedSKU, model.id, getBestAvailableMethod, currentDataHash, cache, cacheVersion]);

  const [localSelectedMethod, setLocalSelectedMethod] = useState<'ai' | 'grid' | 'manual' | undefined>(effectiveSelectedMethod);

  // Update local state when cache or SKU changes
  useEffect(() => {
    console.log(`🔄 ParameterControl: Updating local state for SKU ${selectedSKU}, model ${model.id}`);
    console.log(`   Cache entry:`, cacheEntry);
    console.log(`   User selected method:`, userSelectedMethod);
    console.log(`   Effective method:`, effectiveSelectedMethod);
    
    setLocalSelectedMethod(effectiveSelectedMethod);
  }, [effectiveSelectedMethod, selectedSKU, model.id, cacheVersion, cacheEntry, userSelectedMethod]);

  const optimizationData = useMemo(() => {
    if (!cacheEntry) return null;
    
    if (localSelectedMethod === 'manual') {
      // When in manual mode, use the manual cache entry if available
      return cacheEntry.manual || null;
    }
    
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