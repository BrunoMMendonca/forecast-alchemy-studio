
import { SalesData, ForecastResult } from '@/pages/Index';
import { ModelConfig } from '@/types/forecast';
import { detectDateFrequency, generateForecastDates } from '@/utils/dateUtils';
import { 
  generateSeasonalMovingAverage, 
  generateHoltWinters, 
  generateSeasonalNaive 
} from '@/utils/seasonalUtils';
import { 
  generateMovingAverage, 
  generateSimpleExponentialSmoothing, 
  generateDoubleExponentialSmoothing,
  generateLinearTrend 
} from '@/utils/forecastAlgorithms';

export const generateForecastsForSKU = async (
  selectedSKU: string,
  data: SalesData[],
  models: ModelConfig[],
  forecastPeriods: number,
  getCachedForecast: (sku: string, model: string, hash: string, periods: number) => ForecastResult | null,
  setCachedForecast: (result: ForecastResult, hash: string, periods: number) => void,
  generateParametersHash: (params?: Record<string, number>, optimized?: Record<string, number>) => string
): Promise<ForecastResult[]> => {
  const enabledModels = models.filter(m => m.enabled);
  if (enabledModels.length === 0) return [];

  const skuData = data
    .filter(d => d.sku === selectedSKU)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (skuData.length < 3) {
    throw new Error(`Not enough data points for ${selectedSKU}. Need at least 3 data points.`);
  }

  const frequency = detectDateFrequency(skuData.map(d => d.date));
  const lastDate = new Date(Math.max(...skuData.map(d => new Date(d.date).getTime())));
  const forecastDates = generateForecastDates(lastDate, forecastPeriods, frequency);
  const results: ForecastResult[] = [];

  for (const model of enabledModels) {
    const effectiveParameters = model.optimizedParameters || model.parameters;
    const parametersHash = generateParametersHash(model.parameters, model.optimizedParameters);
    
    const cachedForecast = getCachedForecast(selectedSKU, model.name, parametersHash, forecastPeriods);
    if (cachedForecast) {
      console.log(`Using cached forecast for ${selectedSKU}:${model.name}`);
      results.push(cachedForecast);
      continue;
    }

    let predictions: number[] = [];

    switch (model.id) {
      case 'moving_average':
        predictions = generateMovingAverage(skuData, effectiveParameters?.window || 3, forecastPeriods);
        break;
      case 'simple_exponential_smoothing':
        predictions = generateSimpleExponentialSmoothing(skuData, effectiveParameters?.alpha || 0.3, forecastPeriods);
        break;
      case 'double_exponential_smoothing':
        predictions = generateDoubleExponentialSmoothing(
          skuData, 
          effectiveParameters?.alpha || 0.3, 
          effectiveParameters?.beta || 0.1, 
          forecastPeriods
        );
        break;
      case 'exponential_smoothing':
        predictions = generateSimpleExponentialSmoothing(skuData, effectiveParameters?.alpha || 0.3, forecastPeriods);
        break;
      case 'linear_trend':
        predictions = generateLinearTrend(skuData, forecastPeriods);
        break;
      case 'seasonal_moving_average':
        predictions = generateSeasonalMovingAverage(
          skuData.map(d => d.sales),
          effectiveParameters?.window || 3,
          frequency.seasonalPeriod,
          forecastPeriods
        );
        break;
      case 'holt_winters':
        predictions = generateHoltWinters(
          skuData.map(d => d.sales),
          frequency.seasonalPeriod,
          forecastPeriods,
          effectiveParameters?.alpha || 0.3,
          effectiveParameters?.beta || 0.1,
          effectiveParameters?.gamma || 0.1
        );
        break;
      case 'seasonal_naive':
        predictions = generateSeasonalNaive(
          skuData.map(d => d.sales),
          frequency.seasonalPeriod,
          forecastPeriods
        );
        break;
    }

    const recentActual = skuData.slice(-5).map(d => d.sales);
    const recentPredicted = predictions.slice(0, 5);
    const mape = recentActual.reduce((sum, actual, i) => {
      const predicted = recentPredicted[i] || predictions[0];
      return sum + Math.abs((actual - predicted) / actual);
    }, 0) / recentActual.length * 100;
    
    const accuracy = Math.max(0, 100 - mape);

    const result: ForecastResult = {
      sku: selectedSKU,
      model: model.name,
      predictions: forecastDates.map((date, i) => ({
        date,
        value: Math.round(predictions[i] || 0)
      })),
      accuracy
    };

    setCachedForecast(result, parametersHash, forecastPeriods);
    results.push(result);
  }

  return results;
};
