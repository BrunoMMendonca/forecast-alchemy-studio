import React, { useCallback } from 'react';
import { generateDataHash } from '@/utils/cacheUtils';

export const useMethodSelection = (
  selectedSKU: string,
  setSelectedMethod: (sku: string, modelId: string, method: 'ai' | 'grid' | 'manual') => void,
  setModels: React.Dispatch<React.SetStateAction<any[]>>,
  cache: any,
  data: any[]
) => {
  const handleMethodSelection = useCallback((modelId: string, method: 'ai' | 'grid' | 'manual') => {
    console.log(`🎯 Method Selection: Setting ${selectedSKU}:${modelId} to ${method}`);
    
    // First update the selected method in the cache
    setSelectedMethod(selectedSKU, modelId, method);
    
    const skuData = data.filter(d => d.sku === selectedSKU);
    const currentDataHash = generateDataHash(skuData);
    
    // Then update the model state
    setModels(prev => prev.map(model => {
      if (model.id !== modelId) return model;
      
      const cached = cache[selectedSKU]?.[modelId];
      console.log(`🎯 Method Selection: Cache entry for ${selectedSKU}:${modelId}:`, cached);
      
      if (method === 'manual') {
        const manualCache = cached?.manual;
        if (manualCache && manualCache.dataHash === currentDataHash) {
          console.log(`🎯 Method Selection: Using manual cache for ${selectedSKU}:${modelId}`);
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
          console.log(`🎯 Method Selection: No valid manual cache for ${selectedSKU}:${modelId}`);
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
      if (method === 'ai' && cached?.ai) {
        selectedCache = cached.ai;
      } else if (method === 'grid' && cached?.grid) {
        selectedCache = cached.grid;
      }
      
      if (selectedCache) {
        console.log(`🎯 Method Selection: Using ${method} cache for ${selectedSKU}:${modelId}`);
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
      
      console.log(`🎯 Method Selection: No cache found for ${selectedSKU}:${modelId}`);
      return model;
    }));
  }, [selectedSKU, setSelectedMethod, setModels, cache, data]);

  return { handleMethodSelection };
};
