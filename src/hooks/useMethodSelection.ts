import { generateDataHash } from '@/utils/cacheUtils';

export const useMethodSelection = (
  selectedSKU: string,
  setSelectedMethod: (sku: string, modelId: string, method: 'ai' | 'grid' | 'manual') => void,
  setModels: React.Dispatch<React.SetStateAction<any[]>>,
  cache: any,
  data: any[]
) => {
  const handleMethodSelection = useCallback((modelId: string, method: 'ai' | 'grid' | 'manual') => {
    setSelectedMethod(selectedSKU, modelId, method);
    
    const skuData = data.filter(d => d.sku === selectedSKU);
    const currentDataHash = generateDataHash(skuData);
    
    setModels(prev => prev.map(model => {
      if (model.id !== modelId) return model;
      
      const cached = cache[selectedSKU]?.[modelId];
      
      if (method === 'manual') {
        const manualCache = cached?.manual;
        if (manualCache && manualCache.dataHash === currentDataHash) {
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
