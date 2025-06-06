
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
  const { setSelectedMethod } = useOptimizationCache();
  
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
    // Set explicit user selection to manual in cache (this will trigger method selection effect)
    setSelectedMethod(selectedSKU, modelId, 'manual');
    
    // Update the parameter - this will trigger forecast regeneration via modelsHash change
    baseUpdateParameter(modelId, parameter, value);
  }, [selectedSKU, setSelectedMethod, baseUpdateParameter]);

  const resetToManual = useCallback((modelId: string) => {
    console.log(`🔄 RESET TO MANUAL: ${modelId}`);
    
    // Only set the method to manual - the method selection effect will handle the UI update
    setSelectedMethod(selectedSKU, modelId, 'manual');
  }, [selectedSKU, setSelectedMethod]);

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
    generateForecasts
  };
};
