
import { useCallback } from 'react';
import { generateDataHash } from '@/utils/cacheUtils';

export const useMethodSelection = (
  selectedSKU: string,
  setSelectedMethod: (sku: string, modelId: string, method: 'ai' | 'grid' | 'manual') => void,
  setModels: React.Dispatch<React.SetStateAction<any[]>>,
  cache: any,
  data: any[]
) => {
  const handleMethodSelection = useCallback((modelId: string, method: 'ai' | 'grid' | 'manual') => {
    console.log(`🔄 METHOD_SELECTION: ${modelId} switching to ${method} for SKU ${selectedSKU}`);
    
    setSelectedMethod(selectedSKU, modelId, method);
    
    const skuData = data.filter(d => d.sku === selectedSKU);
    const currentDataHash = generateDataHash(skuData);
    
    setModels(prev => prev.map(model => {
      if (model.id !== modelId) return model;
      
      const cached = cache[selectedSKU]?.[modelId];
      
      if (method === 'manual') {
        const manualCache = cached?.manual;
        if (manualCache && manualCache.dataHash === currentDataHash) {
          console.log(`🔄 METHOD_SWITCH_MANUAL: ${modelId} updating model.parameters with manual cache:`, manualCache.parameters);
          return {
            ...model,
            parameters: manualCache.parameters, // Update base parameters with manual values
            optimizedParameters: undefined,
            optimizationConfidence: undefined,
            optimizationReasoning: undefined,
            optimizationFactors: undefined,
            expectedAccuracy: undefined,
            optimizationMethod: undefined
          };
        } else {
          console.log(`🔄 METHOD_SWITCH_MANUAL_NO_CACHE: ${modelId} no valid manual cache, keeping current parameters`);
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
        let selectedCache = null;
        if (method === 'ai' && cached?.ai) {
          selectedCache = cached.ai;
        } else if (method === 'grid' && cached?.grid) {
          selectedCache = cached.grid;
        }

        if (selectedCache) {
          console.log(`🔄 METHOD_SWITCH_OPTIMIZED: ${modelId} restoring ${method} parameters:`, selectedCache.parameters);
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
    }));
  }, [selectedSKU, setSelectedMethod, setModels, cache, data]);

  return { handleMethodSelection };
};
