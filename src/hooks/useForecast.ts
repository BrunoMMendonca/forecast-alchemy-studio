import { useState, useCallback } from 'react';
import type { SalesData, ForecastResult, ForecastState } from '@/types/forecast';
import { generateMovingAverage, generateSimpleExponentialSmoothing, generateDoubleExponentialSmoothing } from '@/utils/forecastAlgorithms';

const initialState: ForecastState = {
  forecastResults: [],
  selectedSKU: '',
  forecastPeriods: 12,
  isGenerating: false,
  error: null,
};

export const useForecast = () => {
  const [state, setState] = useState<ForecastState>(initialState);

  const setSelectedSKU = useCallback((sku: string) => {
    setState(prev => ({ ...prev, selectedSKU: sku }));
  }, []);

  const setForecastPeriods = useCallback((periods: number) => {
    setState(prev => ({ ...prev, forecastPeriods: periods }));
  }, []);

  const generateForecast = useCallback(async (sku: string, data: SalesData[]) => {
    try {
      setState(prev => ({ ...prev, isGenerating: true, error: null }));

      // Filter data for selected SKU
      const skuData = data.filter(item => item['Material Code'] === sku);
      if (skuData.length === 0) {
        throw new Error('No data available for selected SKU');
      }

      // Sort data by date
      const sortedData = skuData.sort((a, b) => 
        new Date(a.Date).getTime() - new Date(b.Date).getTime()
      );

      // Extract sales values
      const salesValues = sortedData.map(item => item.Sales);

      // Generate forecasts using different models
      const results: ForecastResult[] = [
        {
          sku,
          model: 'Moving Average',
          predictions: generateMovingAverage(salesValues, 3, state.forecastPeriods),
        },
        {
          sku,
          model: 'Simple Exponential Smoothing',
          predictions: generateSimpleExponentialSmoothing(salesValues, 0.3, state.forecastPeriods),
        },
        {
          sku,
          model: 'Double Exponential Smoothing',
          predictions: generateDoubleExponentialSmoothing(salesValues, 0.3, 0.1, state.forecastPeriods),
        },
      ];

      setState(prev => ({
        ...prev,
        forecastResults: results,
        isGenerating: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isGenerating: false,
        error: error instanceof Error ? error.message : 'An error occurred while generating forecast',
      }));
      throw error;
    }
  }, [state.forecastPeriods]);

  return {
    ...state,
    setSelectedSKU,
    setForecastPeriods,
    generateForecast,
  };
}; 