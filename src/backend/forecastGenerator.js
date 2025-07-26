// Backend forecast generation module migrated from frontend.

const { detectDateFrequency, generateForecastDates } = require('../utils/dateUtils');
const { generateSeasonalMovingAverage, generateHoltWinters, generateSeasonalNaive } = require('../utils/seasonalForecastAlgorithms');
const { generateMovingAverage, generateSimpleExponentialSmoothing, generateDoubleExponentialSmoothing, generateLinearTrend } = require('../utils/nonSeasonalForecastAlgorithms');

// Standardized accuracy calculation - same as used in optimization
function calculateStandardizedAccuracy(actual, predicted) {
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
}

async function generateForecastsForSKU(selectedSKU, data, models, forecastPeriods, aiForecastModelOptimizationEnabled = true) {
  const enabledModels = models.filter(m => m.enabled);
  if (enabledModels.length === 0) return [];

  const skuData = data
    .filter(d => d['Material Code'] === selectedSKU)
    .sort((a, b) => new Date(a['Date']).getTime() - new Date(b['Date']).getTime());

  if (skuData.length < 3) {
    throw new Error(`Not enough data points for ${selectedSKU}. Need at least 3 data points.`);
  }

  const frequency = detectDateFrequency(skuData.map(d => d['Date']));
  const lastDate = new Date(Math.max(...skuData.map(d => new Date(d['Date']).getTime())));
  const forecastDates = generateForecastDates(lastDate, forecastPeriods, frequency);
  const results = [];

  for (const model of enabledModels) {
    const effectiveParameters = model.parameters;
    let predictions = [];
    switch (model.id) {
      case 'moving_average': {
        const preds = generateMovingAverage(skuData, effectiveParameters?.window || 3, forecastPeriods);
        predictions = preds.map(p => p.value);
        break;
      }
      case 'simple_exponential_smoothing': {
        const preds = generateSimpleExponentialSmoothing(skuData.map(d => d['Sales']), effectiveParameters?.alpha || 0.3, forecastPeriods);
        predictions = preds.map(p => p.value);
        break;
      }
      case 'double_exponential_smoothing': {
        const preds = generateDoubleExponentialSmoothing(
          skuData.map(d => d['Sales']),
          effectiveParameters?.alpha || 0.3, 
          effectiveParameters?.beta || 0.1, 
          forecastPeriods
        );
        predictions = preds.map(p => p.value);
        break;
      }
      case 'exponential_smoothing': {
        const preds = generateSimpleExponentialSmoothing(skuData.map(d => d['Sales']), effectiveParameters?.alpha || 0.3, forecastPeriods);
        predictions = preds.map(p => p.value);
        break;
      }
      case 'linear_trend':
        predictions = generateLinearTrend(skuData, forecastPeriods);
        break;
      case 'seasonal_moving_average':
        predictions = generateSeasonalMovingAverage(
          skuData.map(d => d['Sales']),
          effectiveParameters?.window || 3,
          frequency.seasonalPeriod,
          forecastPeriods
        );
        break;
      case 'holt_winters': {
        const preds = generateHoltWinters(
          skuData.map(d => d['Sales']),
          frequency.seasonalPeriod,
          forecastPeriods,
          effectiveParameters?.alpha || 0.3,
          effectiveParameters?.beta || 0.1,
          effectiveParameters?.gamma || 0.1
        );
        predictions = preds.map(p => p.value);
        break;
      }
      case 'seasonal_naive':
        predictions = generateSeasonalNaive(
          skuData.map(d => d['Sales']),
          frequency.seasonalPeriod,
          forecastPeriods
        );
        break;
    }
    const recentActual = skuData.slice(-Math.min(10, skuData.length)).map(d => d['Sales']);
    const syntheticPredicted = predictions.slice(0, recentActual.length);
    const accuracy = calculateStandardizedAccuracy(recentActual, syntheticPredicted);
    const result = {
      sku: selectedSKU,
      model: model.name,
      predictions: forecastDates.map((date, i) => ({
        date,
        value: Math.round(predictions[i] || 0)
      })),
      accuracy
    };
    results.push(result);
  }
  return results;
}

module.exports = { generateForecastsForSKU }; 