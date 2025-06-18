import { ForecastPrediction } from '@/types/forecast';
import { generateDates } from '@/utils/dateUtils';

export const calculateSeasonalDecomposition = (values: number[], seasonalPeriod: number) => {
  if (values.length < seasonalPeriod * 2) {
    return { trend: values, seasonal: new Array(values.length).fill(0), residual: new Array(values.length).fill(0) };
  }

  const trend: number[] = [];
  const seasonal: number[] = new Array(values.length);
  const residual: number[] = [];

  // Calculate trend using centered moving average
  for (let i = 0; i < values.length; i++) {
    if (i < Math.floor(seasonalPeriod / 2) || i >= values.length - Math.floor(seasonalPeriod / 2)) {
      trend.push(values[i]);
    } else {
      const sum = values.slice(i - Math.floor(seasonalPeriod / 2), i + Math.floor(seasonalPeriod / 2) + 1)
        .reduce((acc, val) => acc + val, 0);
      trend.push(sum / seasonalPeriod);
    }
  }

  // Calculate seasonal components
  const seasonalSums = new Array(seasonalPeriod).fill(0);
  const seasonalCounts = new Array(seasonalPeriod).fill(0);

  for (let i = 0; i < values.length; i++) {
    const seasonIndex = i % seasonalPeriod;
    const detrended = values[i] - trend[i];
    seasonalSums[seasonIndex] += detrended;
    seasonalCounts[seasonIndex]++;
  }

  const seasonalPattern = seasonalSums.map((sum, i) => 
    seasonalCounts[i] > 0 ? sum / seasonalCounts[i] : 0
  );

  // Apply seasonal pattern to all points
  for (let i = 0; i < values.length; i++) {
    seasonal[i] = seasonalPattern[i % seasonalPeriod];
    residual.push(values[i] - trend[i] - seasonal[i]);
  }

  return { trend, seasonal, residual, seasonalPattern };
};

export const generateSeasonalMovingAverage = (
  values: number[], 
  window: number, 
  seasonalPeriod: number, 
  periods: number
): number[] => {
  const predictions: number[] = [];
  const extendedValues = [...values];

  for (let i = 0; i < periods; i++) {
    const recentValues = extendedValues.slice(-window);
    const seasonIndex = (extendedValues.length + i) % seasonalPeriod;
    
    // Get seasonal component from same season in historical data
    const seasonalValues = values.filter((_, idx) => idx % seasonalPeriod === seasonIndex);
    const seasonalAvg = seasonalValues.length > 0 
      ? seasonalValues.reduce((sum, val) => sum + val, 0) / seasonalValues.length
      : 0;
    
    const baseAvg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const overallAvg = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    const seasonalFactor = overallAvg > 0 ? seasonalAvg / overallAvg : 1;
    const prediction = baseAvg * seasonalFactor;
    
    predictions.push(Math.max(0, prediction));
    extendedValues.push(prediction);
  }

  return predictions;
};

export const generateHoltWinters = (
  values: number[], 
  seasonalPeriod: number, 
  periods: number,
  alpha: number = 0.3,
  beta: number = 0.1,
  gamma: number = 0.1
): ForecastPrediction[] => {
  // Validate input data
  if (values.length === 0) {
    console.log('❌ FORECAST: Empty data array for Holt-Winters');
    return [];
  }

  if (values.some(v => isNaN(v) || !isFinite(v))) {
    console.log('❌ FORECAST: Invalid values in input data');
    return [];
  }

  // Validate and bound parameters
  alpha = Math.max(0.01, Math.min(0.99, alpha));
  beta = Math.max(0.01, Math.min(0.99, beta));
  gamma = Math.max(0.01, Math.min(0.99, gamma));

  // Adjust seasonal period if data is too short
  let effectiveSeasonalPeriod = seasonalPeriod;
  if (values.length < seasonalPeriod * 2) {
    effectiveSeasonalPeriod = Math.max(2, Math.floor(values.length / 2));
    console.log(`⚠️ FORECAST: Adjusted seasonal period to ${effectiveSeasonalPeriod} due to limited data`);
  }

  // Initialize components
  const initialValues = values.slice(0, effectiveSeasonalPeriod);
  const initialSum = initialValues.reduce((sum, val) => sum + val, 0);
  let level = initialSum / effectiveSeasonalPeriod;
  let trend = 0;
  const seasonal: number[] = new Array(effectiveSeasonalPeriod).fill(1);

  // Initialize seasonal factors if we have enough data
  if (values.length >= effectiveSeasonalPeriod * 2) {
    const firstSeasonAvg = initialSum / effectiveSeasonalPeriod;
    const secondSeasonAvg = values.slice(effectiveSeasonalPeriod, effectiveSeasonalPeriod * 2)
      .reduce((sum, val) => sum + val, 0) / effectiveSeasonalPeriod;
    
    trend = (secondSeasonAvg - firstSeasonAvg) / effectiveSeasonalPeriod;

    // Initialize seasonal factors with bounds checking
    for (let i = 0; i < effectiveSeasonalPeriod; i++) {
      if (firstSeasonAvg > 0) {
        seasonal[i] = Math.max(0.1, Math.min(10, values[i] / firstSeasonAvg));
      } else {
        seasonal[i] = 1;
      }
    }
  } else {
    // Use simple initialization for shorter sequences
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    if (avg > 0) {
      for (let i = 0; i < effectiveSeasonalPeriod; i++) {
        seasonal[i] = Math.max(0.1, Math.min(10, values[i % values.length] / avg));
      }
    }
  }

  // Update components through historical data
  for (let i = effectiveSeasonalPeriod; i < values.length; i++) {
    const seasonIndex = i % effectiveSeasonalPeriod;
    const prevLevel = level;
    
    // Update level with bounds checking
    const seasonalFactor = seasonal[seasonIndex];
    if (seasonalFactor > 0) {
      level = alpha * (values[i] / seasonalFactor) + (1 - alpha) * (prevLevel + trend);
    } else {
      level = alpha * values[i] + (1 - alpha) * (prevLevel + trend);
    }
    
    // Update trend
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    
    // Update seasonal with bounds checking
    if (level > 0) {
      seasonal[seasonIndex] = gamma * (values[i] / level) + (1 - gamma) * seasonal[seasonIndex];
      seasonal[seasonIndex] = Math.max(0.1, Math.min(10, seasonal[seasonIndex]));
    }
  }

  // Generate forecasts
  const predictions: ForecastPrediction[] = [];
  const dates = generateDates(new Date(), periods);

  for (let i = 0; i < periods; i++) {
    const seasonIndex = (values.length + i) % effectiveSeasonalPeriod;
    const forecast = (level + (i + 1) * trend) * seasonal[seasonIndex];
    
    // Ensure forecast is valid
    if (isNaN(forecast) || !isFinite(forecast)) {
      console.log(`⚠️ FORECAST: Invalid forecast generated, using fallback`);
      predictions.push({
        date: dates[i],
        value: Math.max(0, values[values.length - 1]),
        confidence: {
          lower: Math.max(0, values[values.length - 1] * 0.9),
          upper: values[values.length - 1] * 1.1
        }
      });
    } else {
      predictions.push({
        date: dates[i],
        value: Math.max(0, forecast),
        confidence: {
          lower: Math.max(0, forecast * 0.9),
          upper: forecast * 1.1
        }
      });
    }
  }

  console.log(`📈 FORECAST: Generated Holt-Winters predictions:`, predictions.map(p => p.value));
  return predictions;
};

const generateExponentialSmoothing = (values: number[], alpha: number, periods: number): ForecastPrediction[] => {
  // Validate input data
  if (values.length === 0) {
    console.log('❌ FORECAST: Empty data array for exponential smoothing');
    return [];
  }

  if (values.some(v => isNaN(v) || !isFinite(v))) {
    console.log('❌ FORECAST: Invalid values in input data');
    return [];
  }

  // Calculate the last smoothed value
  let lastSmoothed = values[0];
  for (let i = 1; i < values.length; i++) {
    lastSmoothed = alpha * values[i] + (1 - alpha) * lastSmoothed;
  }

  console.log(`📊 FORECAST: Last smoothed value: ${lastSmoothed}`);

  // Generate predictions
  const dates = generateDates(new Date(), periods);
  const predictions = dates.map((date) => ({
    date,
    value: Math.max(0, lastSmoothed),
    confidence: {
      lower: Math.max(0, lastSmoothed * 0.9),
      upper: lastSmoothed * 1.1
    }
  }));

  console.log(`📈 FORECAST: Generated exponential smoothing predictions:`, predictions.map(p => p.value));
  return predictions;
};

export const generateSeasonalNaive = (
  values: number[], 
  seasonalPeriod: number, 
  periods: number
): number[] => {
  const predictions: number[] = [];
  
  for (let i = 0; i < periods; i++) {
    const seasonIndex = (values.length + i) % seasonalPeriod;
    
    // Find the most recent value from the same season
    let lastSeasonalValue = values[values.length - 1];
    for (let j = values.length - 1; j >= 0; j--) {
      if (j % seasonalPeriod === seasonIndex) {
        lastSeasonalValue = values[j];
        break;
      }
    }
    
    predictions.push(Math.max(0, lastSeasonalValue));
  }
  
  return predictions;
};
