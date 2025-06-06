
import { useState, useCallback, useEffect } from 'react';
import { SalesData, ForecastResult } from '@/pages/Index';
import { ModelConfig } from '@/types/forecast';
import { generateForecastsForSKU } from '@/utils/forecastGenerator';

export const useForecastEngine = (
  selectedSKU: string,
  data: SalesData[],
  models: ModelConfig[],
  forecastPeriods: number,
  grokApiEnabled: boolean = true
) => {
  const [results, setResults] = useState<ForecastResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateForecasts = useCallback(async () => {
    // Early return if no valid SKU or data
    if (!selectedSKU || selectedSKU.trim() === '' || !data.length) {
      console.log('useForecastEngine: No valid SKU or data, clearing results');
      setResults([]);
      return;
    }

    const enabledModels = models.filter(m => m.enabled);
    if (enabledModels.length === 0) {
      console.log('useForecastEngine: No enabled models, clearing results');
      setResults([]);
      return;
    }

    console.log('useForecastEngine: Generating forecasts for SKU:', selectedSKU, 'Grok API enabled:', grokApiEnabled);
    setIsGenerating(true);
    
    try {
      const forecastResults = await generateForecastsForSKU(
        selectedSKU,
        data,
        models,
        forecastPeriods,
        grokApiEnabled
      );
      
      setResults(forecastResults);
    } catch (error) {
      console.error('Forecast generation failed:', error);
      setResults([]);
    } finally {
      setIsGenerating(false);
    }
  }, [selectedSKU, data, models, forecastPeriods, grokApiEnabled]);

  // Auto-generate forecasts when dependencies change, but only with valid SKU
  useEffect(() => {
    if (selectedSKU && selectedSKU.trim() !== '') {
      generateForecasts();
    } else {
      setResults([]);
    }
  }, [generateForecasts, selectedSKU]);

  return {
    results,
    isGenerating,
    regenerateForecasts: generateForecasts
  };
};
