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

      console.log(`🔄 ModelSync: SKU ${selectedSKU}, Model ${model.id}`);
      console.log(`   Cache entry:`, cached);
      console.log(`   Effective method:`, effectiveMethod);

      if (effectiveMethod === 'manual') {
        const manualCache = cached?.manual;
        if (manualCache && manualCache.dataHash === currentDataHash) {
          console.log(`   Using manual cache for ${selectedSKU}:${model.id}`);
          return {
            ...model,
            parameters: manualCache.parameters,
            optimizedParameters: undefined,
            optimizationConfidence: undefined,
            optimizationReasoning: undefined,
            optimizationFactors: undefined,
            expectedAccuracy: undefined,
            optimizationMethod: undefined
          };
        } else {
          console.log(`   No valid manual cache for ${selectedSKU}:${model.id}, keeping current parameters`);
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
      }

      let selectedCache = null;
      if (effectiveMethod === 'ai' && cached?.ai) {
        selectedCache = cached.ai;
      } else if (effectiveMethod === 'grid' && cached?.grid) {
        selectedCache = cached.grid;
      }

      if (selectedCache && selectedCache.dataHash === currentDataHash) {
        console.log(`   Using ${effectiveMethod} cache for ${selectedSKU}:${model.id}`);
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

      console.log(`   No valid cache found for ${selectedSKU}:${model.id}, keeping current state`);
      return model;
    });
    
    setModels(updatedModels);
    
    // Reset forecast generation hash when models are updated from cache changes
    lastForecastGenerationHashRef.current = '';
  }, [cacheVersion, selectedSKU, data, cache, generateDataHash, updateAutoBestMethods, loadAutoBestMethod, setModels, lastForecastGenerationHashRef]);
};