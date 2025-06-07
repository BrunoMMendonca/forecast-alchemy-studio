
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

    console.log('🔄 SYNC: Starting model sync for SKU:', selectedSKU);
    console.log('🔄 SYNC: Cache version:', cacheVersion, 'Last processed:', lastProcessedCacheVersionRef.current);

    // Only process cache version changes (when optimization data changes)
    const shouldProcessCacheVersion = (
      cacheVersion !== lastProcessedCacheVersionRef.current || 
      selectedSKU !== lastProcessedSKURef.current
    );

    if (!shouldProcessCacheVersion) {
      console.log('🔄 SYNC: Skipping sync - no changes detected');
      return;
    }
    
    lastProcessedCacheVersionRef.current = cacheVersion;
    lastProcessedSKURef.current = selectedSKU;
    
    const skuData = data.filter(d => d.sku === selectedSKU);
    const currentDataHash = generateDataHash(skuData);
    currentDataHashRef.current = currentDataHash;
    
    console.log('🔄 SYNC: Current data hash:', currentDataHash);
    console.log('🔄 SYNC: Full cache for SKU:', JSON.stringify(cache[selectedSKU], null, 2));

    // First, update automatic best method selections
    updateAutoBestMethods(selectedSKU, currentDataHash);
    
    // Load automatic best methods
    const autoMethods = loadAutoBestMethod();

    const updatedModels = getDefaultModels().map(model => {
      const autoKey = `${selectedSKU}:${model.id}`;
      const cached = cache[selectedSKU]?.[model.id];
      
      console.log(`🔄 SYNC: Processing model ${model.id} for SKU ${selectedSKU}`);
      console.log(`🔄 SYNC: Cached data for ${model.id}:`, JSON.stringify(cached, null, 2));
      
      // Priority: Use user's explicit "selected" choice, fallback to automatic best method
      let effectiveMethod = cached?.selected;
      if (!effectiveMethod) {
        effectiveMethod = autoMethods[autoKey] || getBestAvailableMethod(selectedSKU, model.id, currentDataHash, cache);
      }

      console.log(`🔄 SYNC: Effective method for ${model.id}: ${effectiveMethod}`);

      // Handle manual mode - restore manual parameters if available
      if (effectiveMethod === 'manual') {
        const manualCache = cached?.manual;
        console.log(`🔄 SYNC: Manual cache for ${model.id}:`, JSON.stringify(manualCache, null, 2));
        
        if (manualCache && manualCache.dataHash === currentDataHash) {
          console.log(`🔄 SYNC: Restoring manual parameters for ${model.id}:`, manualCache.parameters);
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
          console.log(`🔄 SYNC: Manual cache invalid or missing for ${model.id}, using defaults`);
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

      // Handle AI/Grid optimization modes
      let selectedCache = null;
      if (effectiveMethod === 'ai' && cached?.ai) {
        selectedCache = cached.ai;
      } else if (effectiveMethod === 'grid' && cached?.grid) {
        selectedCache = cached.grid;
      }

      if (selectedCache && selectedCache.dataHash === currentDataHash) {
        console.log(`🔄 SYNC: Restoring ${effectiveMethod} optimization for ${model.id}:`, selectedCache.parameters);
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

      console.log(`🔄 SYNC: No valid cache found for ${model.id}, using defaults`);
      return model;
    });
    
    console.log('🔄 SYNC: Setting updated models');
    setModels(updatedModels);
    
    // Reset forecast generation hash when models are updated from cache changes
    lastForecastGenerationHashRef.current = '';
  }, [cacheVersion, selectedSKU, data, cache, generateDataHash, updateAutoBestMethods, loadAutoBestMethod, setModels, lastForecastGenerationHashRef]);
};
