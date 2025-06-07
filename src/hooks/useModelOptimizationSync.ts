
import { useEffect, useCallback, useMemo } from 'react';
import { SalesData } from '@/pages/Index';
import { ModelConfig } from '@/types/forecast';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { generateDataHash, getBestAvailableMethod } from '@/utils/cacheUtils';

export const useModelOptimizationSync = (
  selectedSKU: string,
  data: SalesData[],
  setModels: React.Dispatch<React.SetStateAction<ModelConfig[]>>,
  lastForecastGenerationHashRef: React.MutableRefObject<string>
) => {
  const { cache } = useOptimizationCache();

  const currentDataHash = useMemo(() => {
    const skuData = data.filter(d => d.sku === selectedSKU);
    return generateDataHash(skuData);
  }, [data, selectedSKU]);

  const syncModelWithCache = useCallback((model: ModelConfig) => {
    const cacheEntry = cache[selectedSKU]?.[model.id];
    const userSelectedMethod = cacheEntry?.selected;
    const effectiveMethod = userSelectedMethod || getBestAvailableMethod(selectedSKU, model.id, currentDataHash, cache);

    console.log(`🔄 SYNC_MODEL: ${model.id} effectiveMethod=${effectiveMethod}, userSelected=${userSelectedMethod}`);

    if (effectiveMethod === 'manual') {
      const manualCache = cacheEntry?.manual;
      if (manualCache && manualCache.dataHash === currentDataHash) {
        console.log(`🔄 SYNC_MANUAL_RESTORE: ${model.id} restoring manual parameters to model.parameters:`, manualCache.parameters);
        return {
          ...model,
          parameters: manualCache.parameters, // THIS IS THE KEY FIX - update the base parameters
          optimizedParameters: undefined,
          optimizationConfidence: undefined,
          optimizationReasoning: undefined,
          optimizationFactors: undefined,
          expectedAccuracy: undefined,
          optimizationMethod: undefined
        };
      } else {
        console.log(`🔄 SYNC_MANUAL_NO_CACHE: ${model.id} no valid manual cache, keeping current parameters`);
        return {
          ...model,
          optimizedParameters: undefined,
          optimizationConfidence: undefined,
          optimizationReasoning: undefined,
          optimizationFactors: undefined,
          expectedAccuracy: undefined,
          optimizationMethod: undefined
        };
      }
    } else {
      // For AI/Grid methods, restore optimized parameters
      let selectedCache = null;
      if (effectiveMethod === 'ai' && cacheEntry?.ai && cacheEntry.ai.dataHash === currentDataHash) {
        selectedCache = cacheEntry.ai;
      } else if (effectiveMethod === 'grid' && cacheEntry?.grid && cacheEntry.grid.dataHash === currentDataHash) {
        selectedCache = cacheEntry.grid;
      }

      if (selectedCache) {
        console.log(`🔄 SYNC_OPTIMIZED: ${model.id} restoring ${effectiveMethod} parameters:`, selectedCache.parameters);
        return {
          ...model,
          optimizedParameters: selectedCache.parameters,
          optimizationConfidence: selectedCache.confidence,
          optimizationReasoning: selectedCache.reasoning,
          optimizationFactors: selectedCache.factors,
          expectedAccuracy: selectedCache.expectedAccuracy,
          optimizationMethod: selectedCache.method
        };
      }
    }

    return model;
  }, [selectedSKU, cache, currentDataHash]);

  useEffect(() => {
    if (!selectedSKU || !data.length) return;

    console.log(`🔄 MODEL_SYNC: Syncing models for SKU ${selectedSKU}`);
    
    setModels(prevModels => {
      const updatedModels = prevModels.map(syncModelWithCache);
      
      // Reset forecast generation hash to force regeneration with new parameters
      lastForecastGenerationHashRef.current = '';
      
      return updatedModels;
    });
  }, [selectedSKU, cache, syncModelWithCache, setModels, lastForecastGenerationHashRef]);
};
