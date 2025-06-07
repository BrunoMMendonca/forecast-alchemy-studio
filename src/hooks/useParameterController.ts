
import { useCallback, useMemo } from 'react';
import { SalesData } from '@/pages/Index';
import { generateDataHash } from '@/utils/cacheUtils';

export const useParameterController = (
  selectedSKU: string,
  data: SalesData[],
  setModels: React.Dispatch<React.SetStateAction<any[]>>,
  setSelectedMethod: (sku: string, modelId: string, method: 'ai' | 'grid' | 'manual') => void,
  cacheManualParameters: (sku: string, modelId: string, parameters: Record<string, number>, dataHash: string) => void,
  cache: any
) => {
  const currentDataHash = useMemo(() => {
    const skuData = data.filter(d => d.sku === selectedSKU);
    return generateDataHash(skuData);
  }, [data, selectedSKU]);

  const isModelInManualMode = useCallback((modelId: string) => {
    const cachedEntry = cache[selectedSKU]?.[modelId];
    const userSelectedMethod = cachedEntry?.selected;
    
    if (userSelectedMethod === 'manual') return true;
    if (!userSelectedMethod && !cachedEntry?.ai && !cachedEntry?.grid) return true;
    
    return false;
  }, [cache, selectedSKU]);

  const updateParameter = useCallback((modelId: string, parameter: string, value: number) => {
    console.log(`🎚️ PARAMETER CONTROLLER: Updating ${parameter} = ${value} for ${modelId}`);
    
    const isCurrentlyManual = isModelInManualMode(modelId);
    
    if (!isCurrentlyManual) {
      console.log(`🎚️ PARAMETER CONTROLLER: Switching to manual mode for ${modelId}`);
      setSelectedMethod(selectedSKU, modelId, 'manual');
    }
    
    // Update model state first, then cache
    setModels(prev => prev.map(model => {
      if (model.id === modelId) {
        const updatedParameters = { ...model.parameters, [parameter]: value };
        
        console.log(`🎚️ PARAMETER CONTROLLER: Updated model parameters:`, updatedParameters);
        
        // Cache the manual parameters
        cacheManualParameters(selectedSKU, modelId, updatedParameters, currentDataHash);
        
        return { 
          ...model, 
          parameters: updatedParameters,
          ...(isCurrentlyManual ? {} : {
            optimizedParameters: undefined,
            optimizationConfidence: undefined,
            optimizationReasoning: undefined,
            optimizationFactors: undefined,
            expectedAccuracy: undefined,
            optimizationMethod: undefined
          })
        };
      }
      return model;
    }));
  }, [selectedSKU, setSelectedMethod, setModels, cacheManualParameters, currentDataHash, isModelInManualMode]);

  const resetToManual = useCallback((modelId: string) => {
    console.log(`🎚️ PARAMETER CONTROLLER: Resetting to manual mode for ${modelId}`);
    
    setSelectedMethod(selectedSKU, modelId, 'manual');
    
    setModels(prev => prev.map(model => 
      model.id === modelId 
        ? { 
            ...model,
            optimizedParameters: undefined,
            optimizationConfidence: undefined,
            optimizationReasoning: undefined,
            optimizationFactors: undefined,
            expectedAccuracy: undefined,
            optimizationMethod: undefined
          }
        : model
    ));
  }, [selectedSKU, setSelectedMethod, setModels]);

  return {
    updateParameter,
    resetToManual,
    currentDataHash
  };
};
