
import { useCallback, useEffect, useMemo } from 'react';
import { SalesData, ForecastResult } from '@/pages/Index';
import { BusinessContext } from '@/types/businessContext';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useModelState } from './useModelState';
import { useForecastGeneration } from './useForecastGeneration';
import { useModelOptimizationSync } from './useModelOptimizationSync';
import { generateDataHash } from '@/utils/cacheHashUtils';

export const useUnifiedModelManagement = (
  selectedSKU: string, 
  data: SalesData[], 
  forecastPeriods: number,
  businessContext?: BusinessContext,
  onForecastGeneration?: (results: ForecastResult[], selectedSKU: string) => void
) => {
  const { cache, setSelectedMethod, cacheManualParameters } = useOptimizationCache();
  
  const {
    models,
    setModels,
    toggleModel,
    updateParameter: baseUpdateParameter
  } = useModelState();

  const {
    modelsHash,
    generateForecasts,
    lastForecastGenerationHashRef
  } = useForecastGeneration(
    selectedSKU,
    data,
    models,
    forecastPeriods,
    onForecastGeneration
  );

  // Get current data hash for the selected SKU
  const currentDataHash = useMemo(() => {
    const skuData = data.filter(d => d.sku === selectedSKU);
    return generateDataHash(skuData);
  }, [data, selectedSKU]);

  // Sync models with optimization cache
  useModelOptimizationSync(
    selectedSKU,
    data,
    setModels,
    lastForecastGenerationHashRef
  );

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

  // Method selection handler for badge clicks
  const handleMethodSelection = useCallback((modelId: string, method: 'ai' | 'grid' | 'manual') => {
    console.log(`🎯 METHOD SELECTION: ${modelId} -> ${method}`);
    
    // Update cache
    setSelectedMethod(selectedSKU, modelId, method);
    
    // Immediately update model state based on method
    setModels(prev => prev.map(model => {
      if (model.id !== modelId) return model;
      
      const cached = cache[selectedSKU]?.[modelId];
      
      if (method === 'manual') {
        // Try to restore manual parameters from cache first
        const manualCache = cached?.manual;
        if (manualCache && manualCache.dataHash === currentDataHash) {
          console.log(`🔄 RESTORING manual parameters from cache for ${modelId}`);
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
          // Clear optimization data for manual mode
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
        // Apply cached optimization data if available
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
  }, [selectedSKU, setSelectedMethod, setModels, cache, currentDataHash]);

  // CONTROLLED forecast generation - only when models hash actually changes
  useEffect(() => {
    if (!selectedSKU || !models.length) return;
    
    const enabledModels = models.filter(m => m.enabled);
    if (enabledModels.length === 0) return;

    // Only generate if the hash has actually changed and we're not currently processing
    if (lastForecastGenerationHashRef.current !== modelsHash) {
      // Use a timeout to debounce rapid changes
      const timeoutId = setTimeout(() => {
        if (lastForecastGenerationHashRef.current !== modelsHash) {
          generateForecasts();
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [modelsHash, selectedSKU, generateForecasts, lastForecastGenerationHashRef]);

  return {
    models,
    toggleModel,
    updateParameter,
    resetToManual,
    handleMethodSelection,
    generateForecasts
  };
};
