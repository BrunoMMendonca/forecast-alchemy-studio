
import { useCallback, useEffect } from 'react';
import { SalesData, ForecastResult } from '@/pages/Index';
import { BusinessContext } from '@/types/businessContext';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useModelState } from './useModelState';
import { useForecastGeneration } from './useForecastGeneration';
import { useModelOptimizationSync } from './useModelOptimizationSync';

export const useUnifiedModelManagement = (
  selectedSKU: string, 
  data: SalesData[], 
  forecastPeriods: number,
  businessContext?: BusinessContext,
  onForecastGeneration?: (results: ForecastResult[], selectedSKU: string) => void
) => {
  const { cache, setSelectedMethod } = useOptimizationCache();
  
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

  // Sync models with optimization cache
  useModelOptimizationSync(
    selectedSKU,
    data,
    setModels,
    lastForecastGenerationHashRef
  );

  const updateParameter = useCallback((modelId: string, parameter: string, value: number) => {
    console.log(`🎚️ PARAMETER UPDATE: ${parameter} = ${value} for ${modelId} - switching to manual`);
    
    // Set explicit user selection to manual in cache
    setSelectedMethod(selectedSKU, modelId, 'manual');
    
    // Immediately update the model state to manual mode (clear optimization data)
    setModels(prev => prev.map(model => 
      model.id === modelId 
        ? { 
            ...model, 
            parameters: { ...model.parameters, [parameter]: value },
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
  }, [selectedSKU, setSelectedMethod, setModels, cache]);

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
