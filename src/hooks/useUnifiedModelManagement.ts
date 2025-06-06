import { useState, useCallback, useEffect } from 'react';
import { SalesData } from '@/pages/Index';
import { ForecastResult } from '@/types/forecast';
import { ModelConfig } from '@/types/forecast';
import { useModelParameters } from '@/hooks/useModelParameters';
import { useOptimization } from '@/hooks/useOptimization';
import { generateForecastsForSKU } from '@/utils/forecastGenerator';
import { useForecastCache } from '@/hooks/useForecastCache';
import { BusinessContext } from '@/types/businessContext';

export const useUnifiedModelManagement = (
  selectedSKU: string,
  data: SalesData[],
  forecastPeriods: number,
  businessContext?: BusinessContext,
  onForecastGeneration?: (results: ForecastResult[], selectedSKU: string) => void
) => {
  const { models, toggleModel, updateParameter, updateModelOptimization, resetModel } = useModelParameters();
  const { isOptimizing, optimizingModel, optimizeModel } = useOptimization(selectedSKU, data, businessContext);
  const { getCachedForecast, setCachedForecast, generateParametersHash } = useForecastCache();
  const [results, setResults] = useState<ForecastResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateForecasts = useCallback(async () => {
    if (!selectedSKU || selectedSKU.trim() === '' || !data.length) {
      setResults([]);
      return;
    }

    const enabledModels = models.filter(m => m.enabled);
    if (enabledModels.length === 0) {
      setResults([]);
      return;
    }

    setIsGenerating(true);

    try {
      const forecastResults = await generateForecastsForSKU(
        selectedSKU,
        data,
        models,
        forecastPeriods,
        getCachedForecast,
        setCachedForecast,
        generateParametersHash
      );

      setResults(forecastResults);
      if (onForecastGeneration) {
        onForecastGeneration(forecastResults, selectedSKU);
      }
    } catch (error) {
      console.error('Forecast generation failed:', error);
      setResults([]);
    } finally {
      setIsGenerating(false);
    }
  }, [selectedSKU, data, models, forecastPeriods, getCachedForecast, setCachedForecast, generateParametersHash, onForecastGeneration]);

  useEffect(() => {
    if (selectedSKU && selectedSKU.trim() !== '') {
      generateForecasts();
    } else {
      setResults([]);
    }
  }, [generateForecasts, selectedSKU]);

  const handleOptimizeModel = useCallback(async (model: ModelConfig, method: 'ai' | 'grid') => {
    if (!selectedSKU) return null;

    const result = await optimizeModel(model, method);
    if (result) {
      updateModelOptimization(
        model.id,
        result.parameters,
        result.confidence,
        result.reasoning,
        result.method
      );
    }
    return result;
  }, [optimizeModel, updateModelOptimization, selectedSKU]);

  const useAIOptimization = useCallback(async (modelId: string) => {
    const model = models.find(m => m.id === modelId);
    if (!model) return;
    await handleOptimizeModel(model, 'ai');
  }, [models, handleOptimizeModel]);

  const useGridOptimization = useCallback(async (modelId: string) => {
    const model = models.find(m => m.id === modelId);
    if (!model) return;
    await handleOptimizeModel(model, 'grid');
  }, [models, handleOptimizeModel]);

  return {
    models,
    toggleModel,
    updateParameter,
    useAIOptimization,
    useGridOptimization,
    resetToManual: resetModel,
    results,
    isGenerating,
    isOptimizing,
    optimizingModel,
    generateForecasts
  };
};
