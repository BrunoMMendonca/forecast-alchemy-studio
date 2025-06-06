
import { useEffect, useRef } from 'react';
import { SalesData, ForecastResult } from '@/pages/Index';
import { ModelConfig } from '@/types/forecast';
import { getDefaultModels } from '@/utils/modelConfig';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useAutoBestMethod } from '@/hooks/useAutoBestMethod';
import { useOptimizationMethodManagement } from './useOptimizationMethodManagement';

export const useModelOptimizationSync = (
  selectedSKU: string,
  data: SalesData[],
  setModels: React.Dispatch<React.SetStateAction<ModelConfig[]>>,
  lastForecastGenerationHashRef: React.MutableRefObject<string>
) => {
  const lastProcessedCacheVersionRef = useRef<number>(-1);
  const lastProcessedMethodVersionRef = useRef<number>(-1);
  const lastProcessedSKURef = useRef<string>('');
  const currentDataHashRef = useRef<string>('');

  const { 
    cache,
    generateDataHash, 
    cacheVersion,
    methodSelectionVersion
  } = useOptimizationCache();
  
  const { loadAutoBestMethod } = useAutoBestMethod();
  const { getBestAvailableMethod, updateAutoBestMethods } = useOptimizationMethodManagement();

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
    
    console.log(`🗄️ CACHE: Processing cache version change: ${lastProcessedCacheVersionRef.current} -> ${cacheVersion}`);
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
        effectiveMethod = autoMethods[autoKey] || getBestAvailableMethod(selectedSKU, model.id, currentDataHash);
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
    
    setModels(updatedModels);
    
    // Reset forecast generation hash when models are updated from cache changes
    lastForecastGenerationHashRef.current = '';
  }, [cacheVersion, selectedSKU, data, cache, generateDataHash, updateAutoBestMethods, loadAutoBestMethod, getBestAvailableMethod, setModels, lastForecastGenerationHashRef]);

  // LIGHTWEIGHT method selection changes - minimal processing for UI responsiveness
  useEffect(() => {
    if (!selectedSKU) return;

    // Only process method selection changes
    const shouldProcessMethodVersion = (
      methodSelectionVersion !== lastProcessedMethodVersionRef.current &&
      methodSelectionVersion > 0
    );

    if (!shouldProcessMethodVersion) {
      return;
    }

    console.log(`🎯 METHOD: Processing method selection change (lightweight): ${lastProcessedMethodVersionRef.current} -> ${methodSelectionVersion}`);
    lastProcessedMethodVersionRef.current = methodSelectionVersion;

    // Use cached hash if available to avoid regeneration
    const currentDataHash = currentDataHashRef.current || generateDataHash(data.filter(d => d.sku === selectedSKU));

    // Only update models that actually changed their selection
    setModels(prevModels => {
      return prevModels.map(model => {
        const cached = cache[selectedSKU]?.[model.id];
        const userSelectedMethod = cached?.selected;
        
        // Check if this model's method selection actually changed
        const currentIsManual = !model.optimizedParameters;
        const newIsManual = !userSelectedMethod || userSelectedMethod === 'manual';
        
        // If switching to manual mode
        if (!currentIsManual && newIsManual) {
          console.log(`🎯 METHOD: Switching ${model.id} to manual (clearing optimization data)`);
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
        
        // If switching to AI/Grid mode
        if (currentIsManual && !newIsManual) {
          let selectedCache = null;
          if (userSelectedMethod === 'ai' && cached?.ai) {
            selectedCache = cached.ai;
          } else if (userSelectedMethod === 'grid' && cached?.grid) {
            selectedCache = cached.grid;
          }

          if (selectedCache && selectedCache.dataHash === currentDataHash) {
            console.log(`🎯 METHOD: Switching ${model.id} to ${userSelectedMethod} (applying optimization data)`);
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
        
        // No change needed for this model
        return model;
      });
    });
  }, [methodSelectionVersion, selectedSKU, cache, generateDataHash, data, setModels]);
};
