
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

// Standardized accuracy calculation - same as used in optimization
const calculateStandardizedAccuracy = (actual: number[], predicted: number[]): number => {
  if (actual.length === 0 || predicted.length === 0) return 0;
  
  let mapeSum = 0;
  let validCount = 0;
  
  const length = Math.min(actual.length, predicted.length);
  
  for (let i = 0; i < length; i++) {
    if (actual[i] !== 0) {
      const error = Math.abs(actual[i] - predicted[i]);
      const percentError = error / Math.abs(actual[i]);
      mapeSum += percentError;
      validCount++;
    }
  }
  
  if (validCount === 0) return 0;
  
  const mape = (mapeSum / validCount) * 100;
  const accuracy = Math.max(0, 100 - mape);
  
  return accuracy;
};

export const generateForecastsForSKU = async (
  selectedSKU: string,
  data: SalesData[],
  models: ModelConfig[],
  forecastPeriods: number,
  grokApiEnabled: boolean = true
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

    // Use standardized accuracy calculation - same as optimization
    const recentActual = skuData.slice(-Math.min(10, skuData.length)).map(d => d.sales);
    const syntheticPredicted = predictions.slice(0, recentActual.length);
    const accuracy = calculateStandardizedAccuracy(recentActual, syntheticPredicted);

    const result: ForecastResult = {
      sku: selectedSKU,
      model: model.name,
      modelId: model.id, // Added missing modelId property
      predictions: forecastDates.map((date, i) => ({
        date,
        value: Math.round(predictions[i] || 0)
      })),
      accuracy
    };

    results.push(result);
  }

  return results;
};

