import { useCallback, useRef, useMemo } from 'react';
import { ForecastResult } from '@/pages/Index';
import { SalesData } from '@/types/forecast';
import { ModelConfig } from '@/types/forecast';
import { useToast } from '@/hooks/use-toast';
import { useWorkerManager } from './useWorkerManager';

export const useForecastGeneration = (
  selectedSKU: string,
  data: SalesData[],
  models: ModelConfig[],
  forecastPeriods: number,
  onForecastGeneration?: (results: ForecastResult[], selectedSKU: string) => void,
  aiForecastModelOptimizationEnabled: boolean = true
) => {
  const { toast } = useToast();
  const { runForecast, isWorking, progress, progressMessage } = useWorkerManager();
  const forecastGenerationInProgressRef = useRef<boolean>(false);
  const lastForecastGenerationHashRef = useRef<string>('');

  // Create a stable hash of model state to prevent unnecessary re-renders
  const modelsHash = useMemo(() => {
    const enabledModels = models.filter(m => m.enabled);
    if (enabledModels.length === 0) return 'no-enabled-models';
    
    const hashData = enabledModels.map(m => ({
      id: m.id,
      enabled: m.enabled,
      params: m.optimizedParameters || m.parameters
    }));
    
    return JSON.stringify(hashData);
  }, [models]);

  const generateForecasts = useCallback(async () => {
    // DISABLED: Frontend forecast generation is now handled by the backend
    // This was causing 6GB+ RAM usage and browser freezing with large files
    console.log('Frontend forecast generation disabled - use backend system instead');
    return;
    
    /*
    if (!selectedSKU || models.length === 0) return;
    if (forecastGenerationInProgressRef.current || isWorking) {
      return;
    }

    // Check if we've already generated for this exact state
    if (lastForecastGenerationHashRef.current === modelsHash) {
      return;
    }

    const enabledModels = models.filter(m => m.enabled);
    if (enabledModels.length === 0) return;

    try {
      forecastGenerationInProgressRef.current = true;
      lastForecastGenerationHashRef.current = modelsHash;
      
      const results = await runForecast({
        selectedSKU,
        data,
        models,
        forecastPeriods,
        aiForecastModelOptimizationEnabled
      });
      
      if (onForecastGeneration) {
        onForecastGeneration(results, selectedSKU);
      }

    } catch (error) {
      toast({
        title: "Forecast Error",
        description: error instanceof Error ? error.message : "Failed to generate forecasts. Please try again.",
        variant: "destructive",
      });
    } finally {
      forecastGenerationInProgressRef.current = false;
    }
    */
  }, [selectedSKU, data, modelsHash, forecastPeriods, onForecastGeneration, toast, runForecast, isWorking, aiForecastModelOptimizationEnabled]);

  return {
    modelsHash,
    generateForecasts,
    lastForecastGenerationHashRef,
    isGenerating: isWorking,
    generationProgress: progress,
    generationProgressMessage: progressMessage
  };
};
