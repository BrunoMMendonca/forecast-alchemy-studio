
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
): number[] => {
  if (values.length < seasonalPeriod * 2) {
    // Fallback to simple exponential smoothing if not enough data
    return generateExponentialSmoothing(values, alpha, periods);
  }

  // Initialize components
  let level = values.slice(0, seasonalPeriod).reduce((sum, val) => sum + val, 0) / seasonalPeriod;
  let trend = 0;
  const seasonal: number[] = new Array(seasonalPeriod);

  // Initialize seasonal factors
  const firstSeasonAvg = values.slice(0, seasonalPeriod).reduce((sum, val) => sum + val, 0) / seasonalPeriod;
  const secondSeasonAvg = values.slice(seasonalPeriod, seasonalPeriod * 2).reduce((sum, val) => sum + val, 0) / seasonalPeriod;
  trend = (secondSeasonAvg - firstSeasonAvg) / seasonalPeriod;

  for (let i = 0; i < seasonalPeriod; i++) {
    seasonal[i] = values[i] / firstSeasonAvg;
  }

  // Update components through historical data
  for (let i = seasonalPeriod; i < values.length; i++) {
    const seasonIndex = i % seasonalPeriod;
    const prevLevel = level;
    
    level = alpha * (values[i] / seasonal[seasonIndex]) + (1 - alpha) * (prevLevel + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    seasonal[seasonIndex] = gamma * (values[i] / level) + (1 - gamma) * seasonal[seasonIndex];
  }

  // Generate forecasts
  const predictions: number[] = [];
  for (let i = 0; i < periods; i++) {
    const seasonIndex = (values.length + i) % seasonalPeriod;
    const forecast = (level + (i + 1) * trend) * seasonal[seasonIndex];
    predictions.push(Math.max(0, forecast));
  }

  return predictions;
};

const generateExponentialSmoothing = (values: number[], alpha: number, periods: number): number[] => {
  let lastSmoothed = values[values.length - 1];
  return new Array(periods).fill(lastSmoothed);
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
