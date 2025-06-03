
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/types/sales';
import { detectDateFrequency } from '@/utils/dateUtils';

export const generateForecasts = async (
  data: SalesData[],
  modelConfigs: ModelConfig[],
  forecastPeriods: number,
  selectedSKU: string
): Promise<{ sku: string; model: string; predictions: { date: Date; value: number }[]; accuracy: number }[]> => {
  const skuData = data.filter(item => item.sku === selectedSKU);
  if (skuData.length === 0) {
    console.warn(`No data found for SKU: ${selectedSKU}`);
    return [];
  }

  const frequencyInfo = detectDateFrequency(skuData.map(d => d.date));
  if (!frequencyInfo) {
    console.warn(`Could not determine frequency for SKU: ${selectedSKU}`);
    return [];
  }

  const results: { sku: string; model: string; predictions: { date: Date; value: number }[]; accuracy: number }[] = [];

  for (const modelConfig of modelConfigs) {
    if (!modelConfig.enabled) {
      console.log(`Model ${modelConfig.name} is disabled, skipping.`);
      continue;
    }

    try {
      const forecastFunction = await import(`./forecastAlgorithms/${modelConfig.id}`);
      const forecast = await forecastFunction.default(
        skuData.map(d => d.sales),
        modelConfig.parameters,
        forecastPeriods,
        frequencyInfo.seasonalPeriod
      );

      if (!forecast || !forecast.predictions || forecast.predictions.length === 0) {
        console.warn(`No predictions returned from model ${modelConfig.name} for SKU ${selectedSKU}`);
        continue;
      }

      const startDate = new Date(skuData[skuData.length - 1].date);
      const predictions = forecast.predictions.map((value: number, index: number) => {
        const date = new Date(startDate);
        
        if (frequencyInfo.timeUnit === 'days') {
          date.setDate(startDate.getDate() + index + 1);
        } else if (frequencyInfo.timeUnit === 'weeks') {
          date.setDate(startDate.getDate() + (index + 1) * 7);
        } else if (frequencyInfo.timeUnit === 'months') {
          date.setMonth(startDate.getMonth() + index + 1);
        } else if (frequencyInfo.timeUnit === 'years') {
          date.setFullYear(startDate.getFullYear() + index + 1);
        }
        
        return { date, value };
      });

      results.push({
        sku: selectedSKU,
        model: modelConfig.name,
        predictions,
        accuracy: forecast.accuracy || 0
      });

    } catch (error: any) {
      console.error(`Error generating forecast for model ${modelConfig.name} and SKU ${selectedSKU}:`, error);
    }
  }

  return results;
};

export const generateForecastsForSKU = async (
  selectedSKU: string,
  data: SalesData[],
  models: ModelConfig[],
  forecastPeriods: number,
  getCachedForecast?: any,
  setCachedForecast?: any,
  generateParametersHash?: any
) => {
  return generateForecasts(data, models, forecastPeriods, selectedSKU);
};
