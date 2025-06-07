
import { useCallback, useRef, useMemo } from 'react';
import { SalesData, ForecastResult } from '@/pages/Index';
import { ModelConfig } from '@/types/forecast';
import { generateForecastsForSKU } from '@/utils/forecastGenerator';
import { useToast } from '@/hooks/use-toast';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { generateDataHash } from '@/utils/cacheHashUtils';

export const useForecastGeneration = (
  selectedSKU: string,
  data: SalesData[],
  models: ModelConfig[],
  forecastPeriods: number,
  onForecastGeneration?: (results: ForecastResult[], selectedSKU: string) => void
) => {
  const { toast } = useToast();
  const { cacheManualParameters } = useOptimizationCache();
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
    if (!selectedSKU || models.length === 0) return;
    if (forecastGenerationInProgressRef.current) {
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
      
      // Cache manual parameters for all enabled models with default values
      const skuData = data.filter(d => d.sku === selectedSKU);
      const currentDataHash = generateDataHash(skuData);
      
      enabledModels.forEach(model => {
        if (model.parameters && Object.keys(model.parameters).length > 0) {
          // Cache the current parameter values (either optimized or default) as manual
          const parametersToCache = model.optimizedParameters || model.parameters;
          console.log(`🗄️ FORECAST: Caching manual parameters for ${selectedSKU}:${model.id}`, parametersToCache);
          cacheManualParameters(selectedSKU, model.id, parametersToCache, currentDataHash);
        }
      });
      
      const results = await generateForecastsForSKU(
        selectedSKU,
        data,
        models,
        forecastPeriods
      );
      
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
  }, [selectedSKU, data, modelsHash, forecastPeriods, onForecastGeneration, toast, models, cacheManualParameters]);

  return {
    modelsHash,
    generateForecasts,
    lastForecastGenerationHashRef
  };
};
