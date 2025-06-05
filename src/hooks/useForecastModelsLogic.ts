
import { useState, useRef, useCallback, useEffect } from 'react';
import { SalesData, ForecastResult } from '@/pages/Index';
import { useToast } from '@/hooks/use-toast';
import { useForecastCache } from '@/hooks/useForecastCache';
import { useOptimizationHandler } from '@/hooks/useOptimizationHandler';
import { useModelManagement } from '@/hooks/useModelManagement';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { generateForecastsForSKU } from '@/utils/forecastGenerator';

interface OptimizationQueue {
  getSKUsInQueue: () => string[];
  removeSKUsFromQueue: (skus: string[]) => void;
}

export const useForecastModelsLogic = (
  data: SalesData[],
  forecastPeriods: number,
  selectedSKU: string,
  onForecastGeneration: (results: ForecastResult[], selectedSKU: string) => void,
  optimizationQueue?: OptimizationQueue
) => {
  const { toast } = useToast();
  const hasTriggeredOptimizationRef = useRef(false);
  
  const { cacheVersion } = useOptimizationCache();
  
  const {
    getCachedForecast,
    setCachedForecast,
    generateParametersHash
  } = useForecastCache();

  const {
    models,
    toggleModel,
    updateParameter,
    useAIOptimization,
    useGridOptimization,
    resetToManual
  } = useModelManagement(selectedSKU, data);

  const generateForecastsForSelectedSKU = useCallback(async () => {
    if (!selectedSKU) return;

    try {
      console.log(`🎯 Generating forecasts for ${selectedSKU} with models:`, models.map(m => ({ 
        id: m.id, 
        enabled: m.enabled,
        hasReasoning: !!m.optimizationReasoning 
      })));
      
      const results = await generateForecastsForSKU(
        selectedSKU,
        data,
        models,
        forecastPeriods,
        getCachedForecast,
        setCachedForecast,
        generateParametersHash
      );

      console.log(`✅ Generated ${results.length} forecasts for ${selectedSKU}, passing to parent`);
      onForecastGeneration(results, selectedSKU);

    } catch (error) {
      toast({
        title: "Forecast Error",
        description: error instanceof Error ? error.message : "Failed to generate forecasts. Please try again.",
        variant: "destructive",
      });
      console.error('Forecast generation error:', error);
    }
  }, [selectedSKU, data, models, forecastPeriods, getCachedForecast, setCachedForecast, generateParametersHash, onForecastGeneration, toast]);

  // Watch for cache version changes and trigger forecast regeneration
  useEffect(() => {
    if (selectedSKU && cacheVersion > 0) {
      console.log(`🔄 FORECAST UI: Cache version changed (${cacheVersion}), regenerating forecasts for ${selectedSKU}`);
      setTimeout(() => generateForecastsForSelectedSKU(), 100);
    }
  }, [cacheVersion, selectedSKU, generateForecastsForSelectedSKU]);

  const {
    isOptimizing,
    progress,
    handleQueueOptimization: baseHandleQueueOptimization
  } = useOptimizationHandler(data, selectedSKU, optimizationQueue, generateForecastsForSelectedSKU);

  const handleQueueOptimization = useCallback(async () => {
    await baseHandleQueueOptimization();
  }, [baseHandleQueueOptimization]);

  const handleToggleModel = useCallback((modelId: string) => {
    toggleModel(modelId);
    setTimeout(() => generateForecastsForSelectedSKU(), 50);
  }, [toggleModel, generateForecastsForSelectedSKU]);

  const handleUpdateParameter = useCallback((modelId: string, parameter: string, value: number) => {
    updateParameter(modelId, parameter, value);
    setTimeout(() => generateForecastsForSelectedSKU(), 50);
  }, [updateParameter, generateForecastsForSelectedSKU]);

  const handleUseAI = useCallback((modelId: string) => {
    useAIOptimization(modelId);
    setTimeout(() => generateForecastsForSelectedSKU(), 50);
  }, [useAIOptimization, generateForecastsForSelectedSKU]);

  const handleUseGrid = useCallback((modelId: string) => {
    useGridOptimization(modelId);
    setTimeout(() => generateForecastsForSelectedSKU(), 50);
  }, [useGridOptimization, generateForecastsForSelectedSKU]);

  const handleResetToManual = useCallback((modelId: string) => {
    resetToManual(modelId);
    setTimeout(() => generateForecastsForSelectedSKU(), 50);
  }, [resetToManual, generateForecastsForSelectedSKU]);

  return {
    models,
    isOptimizing,
    progress,
    hasTriggeredOptimizationRef,
    handleQueueOptimization,
    handleToggleModel,
    handleUpdateParameter,
    handleUseAI,
    handleUseGrid,
    handleResetToManual,
    generateForecastsForSelectedSKU
  };
};
