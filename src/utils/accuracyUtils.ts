
// Shared accuracy calculation utilities to avoid code duplication
export const calculateMAPE = (actual: number[], predicted: number[]): number => {
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
  return (mapeSum / validCount) * 100;
};

export const calculateAccuracy = (actual: number[], predicted: number[]): number => {
  const mape = calculateMAPE(actual, predicted);
  return Math.max(0, 100 - mape);
};

// Optimized sampling for large datasets
export const sampleForAccuracy = (data: number[], maxSamples: number = 100): number[] => {
  if (data.length <= maxSamples) return data;
  
  const step = Math.floor(data.length / maxSamples);
  const sampled: number[] = [];
  
  for (let i = 0; i < data.length; i += step) {
    sampled.push(data[i]);
    if (sampled.length >= maxSamples) break;
  }
  
  return sampled;
};
