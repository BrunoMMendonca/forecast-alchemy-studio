import { useCallback, useEffect } from 'react';
import { ForecastResult } from '@/pages/Index';
import { SalesData } from '@/types/forecast';
import { BusinessContext } from '@/types/businessContext';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useModelState } from './useModelState';
import { useForecastGeneration } from './useForecastGeneration';
import { useModelOptimizationSync } from './useModelOptimizationSync';
import { useParameterController } from './useParameterController';
import { useMethodSelection } from './useMethodSelection';
import { useOptimizationCacheContext } from '@/context/OptimizationCacheContext';

export const useModelController = (
  selectedSKU: string, 
  data: SalesData[], 
  forecastPeriods: number,
  businessContext?: BusinessContext,
  onForecastGeneration?: (results: ForecastResult[], selectedSKU: string) => void,
  aiForecastModelOptimizationEnabled: boolean = true
) => {
  const { isLoading } = useOptimizationCacheContext();
  const { setSelectedMethod, cacheManualParameters, cache } = useOptimizationCache();
  
  const {
    models,
    setModels,
    toggleModel
  } = useModelState();

  const {
    modelsHash,
    generateForecasts,
    lastForecastGenerationHashRef,
    isGenerating,
    generationProgress,
    generationProgressMessage
  } = useForecastGeneration(
    selectedSKU,
    data,
    models,
    forecastPeriods,
    onForecastGeneration,
    aiForecastModelOptimizationEnabled
  );

  useModelOptimizationSync(
    selectedSKU,
    data,
    setModels,
    lastForecastGenerationHashRef
  );

  const {
    updateParameter,
    resetToManual
  } = useParameterController(
    selectedSKU,
    data,
    setModels,
    setSelectedMethod,
    cacheManualParameters,
    cache
  );

  const { handleMethodSelection } = useMethodSelection(
    selectedSKU,
    setSelectedMethod,
    setModels,
    cache,
    data
  );

  useEffect(() => {
    if (isLoading || !selectedSKU || !models.length) return;
    
    const enabledModels = models.filter(m => m.enabled);
    if (enabledModels.length === 0) return;

    // DISABLED: Frontend forecast generation is now handled by the backend
    // This was causing 6GB+ RAM usage and browser freezing with large files
    /*
    if (lastForecastGenerationHashRef.current !== modelsHash) {
      const timeoutId = setTimeout(() => {
        if (lastForecastGenerationHashRef.current !== modelsHash) {
          generateForecasts();
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
    */
  }, [modelsHash, selectedSKU, lastForecastGenerationHashRef, isLoading]);

  return {
    models,
    toggleModel,
    updateParameter,
    resetToManual,
    handleMethodSelection,
    generateForecasts,
    isLoading,
    isGenerating,
    generationProgress,
    generationProgressMessage
  };
};
