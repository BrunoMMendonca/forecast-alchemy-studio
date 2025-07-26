import { useCallback, useRef, useMemo, useState } from 'react';
import { ForecastResult } from '@/types/forecast';
import { SalesData } from '@/types/forecast';
import { ModelConfig } from '@/types/forecast';
import { useToast } from '@/hooks/use-toast';
import { generateForecasts as generateForecastsFromBackend } from '@/services/forecastService';

export const useForecastGeneration = (
  selectedSKU: string,
  data: SalesData[],
  models: ModelConfig[],
  forecastPeriods: number,
  onForecastGeneration?: (results: ForecastResult[], selectedSKU: string) => void,
  aiForecastModelOptimizationEnabled: boolean = true
) => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationProgressMessage, setGenerationProgressMessage] = useState('');
  const forecastGenerationInProgressRef = useRef<boolean>(false);
  const lastForecastGenerationHashRef = useRef<string>('');

  // Create a stable hash of model state to prevent unnecessary re-renders
  const modelsHash = useMemo(() => {
    const enabledModels = models.filter(m => m.enabled);
    if (enabledModels.length === 0) return 'no-enabled-models';
    
    const hashData = enabledModels.map(m => ({
      id: m.id,
      enabled: m.enabled,
      params: m.gridParameters || m.parameters
    }));
    
    return JSON.stringify(hashData);
  }, [models]);

  const generateForecasts = useCallback(async () => {
    if (!selectedSKU || models.length === 0) return;
    if (forecastGenerationInProgressRef.current || isGenerating) {
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
      setIsGenerating(true);
      setGenerationProgress(0);
      setGenerationProgressMessage('Initializing forecast generation...');
      lastForecastGenerationHashRef.current = modelsHash;
      
      setGenerationProgress(25);
      setGenerationProgressMessage('Preparing data for backend...');
      
      // Call the backend forecast generation API
      const results = await generateForecastsFromBackend({
        sku: selectedSKU,
        data,
        models,
        forecastPeriods
      });
      
      setGenerationProgress(100);
      setGenerationProgressMessage('Forecast generation complete!');
      
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
      setIsGenerating(false);
      setGenerationProgress(0);
      setGenerationProgressMessage('');
    }
  }, [selectedSKU, data, modelsHash, forecastPeriods, onForecastGeneration, toast, isGenerating]);

  return {
    modelsHash,
    generateForecasts,
    lastForecastGenerationHashRef,
    isGenerating,
    generationProgress,
    generationProgressMessage
  };
};
