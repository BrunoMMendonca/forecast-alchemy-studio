
import { useEffect, useRef } from 'react';
import { SalesData } from '@/pages/Index';
import { ModelConfig } from '@/types/forecast';
import { getDefaultModels } from '@/utils/modelConfig';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useAutoBestMethod } from '@/hooks/useAutoBestMethod';
import { getBestAvailableMethod } from '@/utils/cacheUtils';

export const useModelOptimizationSync = (
  selectedSKU: string,
  data: SalesData[],
  setModels: React.Dispatch<React.SetStateAction<ModelConfig[]>>,
  lastForecastGenerationHashRef: React.MutableRefObject<string>
) => {
  const lastProcessedCacheVersionRef = useRef<number>(-1);
  const lastProcessedSKURef = useRef<string>('');
  const currentDataHashRef = useRef<string>('');

  const { 
    cache,
    generateDataHash, 
    cacheVersion
  } = useOptimizationCache();
  
  const { loadAutoBestMethod, updateAutoBestMethods } = useAutoBestMethod();

  // CONTROLLED cache version updates - only process when optimization data actually changes
  useEffect(() => {
    if (!selectedSKU) return;

    // Only process cache version changes (when optimization data changes)
    const shouldProcessCacheVersion = (
      cacheVersion !== lastProcessedCacheVersionRef.current || 
      selectedSKU !== lastProcessedSKURef.current
    );

    if (!shouldProcessCacheVersion) {
      return;
    }
    
    lastProcessedCacheVersionRef.current = cacheVersion;
    lastProcessedSKURef.current = selectedSKU;
    
    const skuData = data.filter(d => d.sku === selectedSKU);
    const currentDataHash = generateDataHash(skuData);
    currentDataHashRef.current = currentDataHash;
    
    // First, update automatic best method selections
    updateAutoBestMethods(selectedSKU, currentDataHash);
    
    // Load automatic best methods
    const autoMethods = loadAutoBestMethod();

    const updatedModels = getDefaultModels().map(model => {
      const autoKey = `${selectedSKU}:${model.id}`;
      const cached = cache[selectedSKU]?.[model.id];
      
      // Priority: Use user's explicit "selected" choice, fallback to automatic best method
      let effectiveMethod = cached?.selected;
      if (!effectiveMethod) {
        effectiveMethod = autoMethods[autoKey] || getBestAvailableMethod(selectedSKU, model.id, currentDataHash, cache);
      }

      let selectedCache = null;
      if (effectiveMethod === 'ai' && cached?.ai) {
        selectedCache = cached.ai;
      } else if (effectiveMethod === 'grid' && cached?.grid) {
        selectedCache = cached.grid;
      }

      if (selectedCache && selectedCache.dataHash === currentDataHash) {
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

      return model;
    });
    
    // Check if models actually changed before resetting forecast hash
    const modelsChanged = JSON.stringify(updatedModels) !== JSON.stringify(getDefaultModels());
    
    setModels(updatedModels);
    
    // Only reset forecast generation hash when models are actually updated from cache changes
    // This prevents unnecessary triggers when just clicking "Generate Forecasts"
    if (modelsChanged) {
      console.log('🔄 MODEL_SYNC: Models changed from cache, resetting forecast hash');
      lastForecastGenerationHashRef.current = '';
    }
  }, [cacheVersion, selectedSKU, data, cache, generateDataHash, updateAutoBestMethods, loadAutoBestMethod, setModels, lastForecastGenerationHashRef]);
};
