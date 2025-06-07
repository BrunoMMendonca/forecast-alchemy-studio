
import { useCallback, useEffect } from 'react';
import { SalesData, ForecastResult } from '@/pages/Index';
import { BusinessContext } from '@/types/businessContext';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useModelState } from './useModelState';
import { useForecastGeneration } from './useForecastGeneration';
import { useModelOptimizationSync } from './useModelOptimizationSync';
import { useParameterController } from './useParameterController';
import { useMethodSelection } from './useMethodSelection';

export const useModelController = (
  selectedSKU: string, 
  data: SalesData[], 
  forecastPeriods: number,
  businessContext?: BusinessContext,
  onForecastGeneration?: (results: ForecastResult[], selectedSKU: string) => void
) => {
  const { setSelectedMethod, cacheManualParameters, cache } = useOptimizationCache();
  
  const {
    models,
    setModels,
    toggleModel
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
    if (!selectedSKU || !models.length) return;
    
    const enabledModels = models.filter(m => m.enabled);
    if (enabledModels.length === 0) return;

    if (lastForecastGenerationHashRef.current !== modelsHash) {
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
