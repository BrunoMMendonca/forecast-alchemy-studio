
import { useCallback, useMemo } from 'react';
import { SalesData } from '@/pages/Index';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { generateDataHash } from '@/utils/cacheHashUtils';

export const useParameterManagement = (
  selectedSKU: string,
  data: SalesData[],
  setModels: React.Dispatch<React.SetStateAction<any[]>>,
  setSelectedMethod: (sku: string, modelId: string, method: 'ai' | 'grid' | 'manual') => void,
  cacheManualParameters: (sku: string, modelId: string, parameters: Record<string, number>, dataHash: string) => void
) => {
  const { cache } = useOptimizationCache();

  // Get current data hash for the selected SKU
  const currentDataHash = useMemo(() => {
    const skuData = data.filter(d => d.sku === selectedSKU);
    return generateDataHash(skuData);
  }, [data, selectedSKU]);

  // Helper function to determine if a model is currently in manual mode
  const isModelInManualMode = useCallback((modelId: string) => {
    const cachedEntry = cache[selectedSKU]?.[modelId];
    const userSelectedMethod = cachedEntry?.selected;
    
    // If user has explicitly selected manual, or no optimization data exists, it's manual
    if (userSelectedMethod === 'manual') {
      return true;
    }
    
    // If no explicit selection and no optimization data, default to manual
    if (!userSelectedMethod && !cachedEntry?.ai && !cachedEntry?.grid) {
      return true;
    }
    
    return false;
  }, [cache, selectedSKU]);

  const updateParameter = useCallback((modelId: string, parameter: string, value: number) => {
    const isCurrentlyManual = isModelInManualMode(modelId);
    
    if (isCurrentlyManual) {
      console.log(`🎚️ PARAMETER UPDATE (already manual): ${parameter} = ${value} for ${modelId}`);
      
      // Already in manual mode - just update parameters and cache
      setModels(prev => prev.map(model => {
        if (model.id === modelId) {
          const updatedParameters = { ...model.parameters, [parameter]: value };
          
          // Cache the manual parameters immediately
          cacheManualParameters(selectedSKU, modelId, updatedParameters, currentDataHash);
          
          return { 
            ...model, 
            parameters: updatedParameters
          };
        }
        return model;
      }));
    } else {
      console.log(`🎚️ PARAMETER UPDATE (switching to manual): ${parameter} = ${value} for ${modelId}`);
      
      // Not in manual mode - need to switch to manual first
      setSelectedMethod(selectedSKU, modelId, 'manual');
      
      // Update the model state to manual mode and clear optimization data
      setModels(prev => prev.map(model => {
        if (model.id === modelId) {
          const updatedParameters = { ...model.parameters, [parameter]: value };
          
          // Cache the manual parameters immediately
          cacheManualParameters(selectedSKU, modelId, updatedParameters, currentDataHash);
          
          return { 
            ...model, 
            parameters: updatedParameters,
            optimizedParameters: undefined,
            optimizationConfidence: undefined,
            optimizationReasoning: undefined,
            optimizationFactors: undefined,
            expectedAccuracy: undefined,
            optimizationMethod: undefined
          };
        }
        return model;
      }));
    }
  }, [selectedSKU, setSelectedMethod, setModels, cacheManualParameters, currentDataHash, isModelInManualMode]);

  const resetToManual = useCallback((modelId: string) => {
    console.log(`🔄 RESET TO MANUAL: ${modelId}`);
    
    // Set the method to manual in cache
    setSelectedMethod(selectedSKU, modelId, 'manual');
    
    // Immediately clear optimization data from the model
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
