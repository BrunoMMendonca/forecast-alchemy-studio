
import { useState, useCallback, useEffect } from 'react';
import { SalesData, ForecastResult } from '@/pages/Index';
import { ModelConfig } from '@/types/forecast';
import { generateForecastsForSKU } from '@/utils/forecastGenerator';
import { useForecastCache } from '@/hooks/useForecastCache';

export const useForecastEngine = (
  selectedSKU: string,
  data: SalesData[],
  models: ModelConfig[],
  forecastPeriods: number
) => {
  const [results, setResults] = useState<ForecastResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const {
    getCachedForecast,
    setCachedForecast,
    generateParametersHash
  } = useForecastCache();

  const generateForecasts = useCallback(async () => {
    if (!selectedSKU || !data.length) {
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
    } catch (error) {
      console.error('Forecast generation failed:', error);
      setResults([]);
    } finally {
      setIsGenerating(false);
    }
  }, [selectedSKU, data, models, forecastPeriods, getCachedForecast, setCachedForecast, generateParametersHash]);

  // Auto-generate forecasts when dependencies change
  useEffect(() => {
    generateForecasts();
  }, [generateForecasts]);

  return {
    results,
    isGenerating,
    regenerateForecasts: generateForecasts
  };
};
