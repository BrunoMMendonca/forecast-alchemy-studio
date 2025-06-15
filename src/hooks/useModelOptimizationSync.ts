import { useEffect, useRef } from 'react';
import { NormalizedSalesData as SalesData } from '@/pages/Index';
import { ModelConfig } from '@/types/forecast';
import { getDefaultModels } from '@/utils/modelConfig';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useAutoBestMethod } from '@/hooks/useAutoBestMethod';
import { getBestAvailableMethod } from '@/utils/cacheUtils';
import { loadCacheFromStorage } from '@/utils/cacheStorageUtils';

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
    
    const skuData = data.filter(d => d['Material Code'] === selectedSKU);
    const currentDataHash = generateDataHash(skuData);
    currentDataHashRef.current = currentDataHash;
    
    // First, update automatic best method selections
    updateAutoBestMethods(selectedSKU, currentDataHash);
    
    // Load automatic best methods
    const autoMethods = loadAutoBestMethod();

    // Load the latest cache from localStorage
    const latestCache = loadCacheFromStorage();

    const updatedModels = getDefaultModels().map(model => {
      const autoKey = `${selectedSKU}:${model.id}`;
      const cached = latestCache[selectedSKU]?.[model.id];
      const manualCache = cached?.manual;
      const selectedMethod = cached?.selected;

      // If manual is selected or we have valid manual parameters, use those
      if (selectedMethod === 'manual' || (manualCache && manualCache.dataHash === currentDataHash)) {
        return {
          ...model,
          parameters: manualCache?.parameters || model.parameters,
          optimizedParameters: undefined,
          optimizationConfidence: undefined,
          optimizationReasoning: undefined,
          optimizationFactors: undefined,
          expectedAccuracy: undefined,
          optimizationMethod: 'manual',
        };
      }

      // For AI/Grid, use their respective cached parameters
      let selectedCache = null;
      if (selectedMethod === 'ai' && cached?.ai) {
        selectedCache = cached.ai;
      } else if (selectedMethod === 'grid' && cached?.grid) {
        selectedCache = cached.grid;
      } else {
        // Fallback to best available method if no explicit selection
        const bestMethod = getBestAvailableMethod(selectedSKU, model.id, currentDataHash, latestCache);
        selectedCache = bestMethod === 'ai' ? cached?.ai : cached?.grid;
      }

      if (selectedCache && selectedCache.dataHash === currentDataHash) {
        return {
          ...model,
          optimizedParameters: selectedCache.parameters,
          optimizationConfidence: selectedCache.confidence,
          optimizationReasoning: selectedCache.reasoning,
          optimizationFactors: selectedCache.factors,
          expectedAccuracy: selectedCache.expectedAccuracy,
          optimizationMethod: selectedCache.method,
          isWinner: selectedCache.isWinner || false
        };
      }

      return model;
    });
    
    setModels(updatedModels);
    // Debug log: print parameters for each model after initialization
    updatedModels.forEach(m => {
      console.log(`[MODEL INIT] SKU: ${selectedSKU}, Model: ${m.id}, Parameters:`, m.parameters);
    });
    
    // Reset forecast generation hash when models are updated from cache changes
    lastForecastGenerationHashRef.current = '';
  }, [cacheVersion, selectedSKU, data, cache, generateDataHash, updateAutoBestMethods, loadAutoBestMethod, setModels, lastForecastGenerationHashRef]);
};
