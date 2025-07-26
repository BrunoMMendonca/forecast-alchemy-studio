import { NormalizedSalesData } from '@/types/forecast';

export interface ValidationResult {
  accuracy: number;
  mape: number;
  confidence: number;
  rmse: number;
  mae: number;
}

export interface ValidationConfig {
  minValidationSize: number;
  maxSteps: number;
  testSize: number;
  useWalkForward: boolean;
  tolerance: number;
  minConfidenceForAcceptance: number;
  sku?: string;
  modelId?: string;
  method?: string;
}

export const ENHANCED_VALIDATION_CONFIG: ValidationConfig = {
  minValidationSize: 12,
  maxSteps: 5,
  testSize: 6,
  useWalkForward: true,
  tolerance: 2.0,
  minConfidenceForAcceptance: 60
};

const calculateMetrics = (
  actual: number[], 
  predicted: number[],
  config: ValidationConfig = ENHANCED_VALIDATION_CONFIG
): ValidationResult => {
  if (actual.length === 0 || predicted.length === 0) {
    console.log(`❌ VALIDATION: Empty actual or predicted arrays for SKU=${config.sku || 'unknown'}, Model=${config.modelId || 'unknown'}, Method=${config.method || 'unknown'}`);
    return { accuracy: 0, mape: 100, confidence: 0, rmse: 0, mae: 0 };
  }

  const hasNonZeroActual = actual.some(v => v !== 0);
  if (!hasNonZeroActual) {
    console.log(`❌ VALIDATION: All actual values are zero for SKU=${config.sku || 'unknown'}, Model=${config.modelId || 'unknown'}, Method=${config.method || 'unknown'}`);
    return { accuracy: 0, mape: 100, confidence: 0, rmse: 0, mae: 0 };
  }

  let mapeSum = 0;
  let rmseSum = 0;
  let maeSum = 0;
  let validCount = 0;

  const length = Math.min(actual.length, predicted.length);
  
  for (let i = 0; i < length; i++) {
    const actualValue = actual[i];
    const predictedValue = predicted[i];
    
    if (actualValue !== 0) {
      const error = Math.abs(actualValue - predictedValue);
      const percentError = error / Math.abs(actualValue);
      mapeSum += percentError;
      validCount++;
    } else if (predictedValue !== 0) {
      mapeSum += 1;
      validCount++;
    }

    const error = actualValue - predictedValue;
    rmseSum += error * error;
    maeSum += Math.abs(error);
  }

  if (validCount === 0) {
    console.log('❌ VALIDATION: No valid points for MAPE calculation');
    return { accuracy: 0, mape: 100, confidence: 0, rmse: 0, mae: 0 };
  }

  const mape = (mapeSum / validCount) * 100;
  const accuracy = Math.max(0, 100 - mape);
  const rmse = Math.sqrt(rmseSum / length);
  const mae = maeSum / length;
  
  const baseConfidence = accuracy - (mape * 0.2);
  const confidence = Math.min(95, Math.max(0, baseConfidence));

  console.log(`📊 VALIDATION: Results for SKU=${config.sku || 'unknown'}, Model=${config.modelId || 'unknown'}, Method=${config.method || 'unknown'} - Accuracy: ${accuracy.toFixed(2)}%, MAPE: ${mape.toFixed(2)}%, Confidence: ${confidence.toFixed(2)}%`);

  return { accuracy, mape, confidence, rmse, mae };
};

export const walkForwardValidation = (
  data: NormalizedSalesData[],
  generateForecast: (trainData: NormalizedSalesData[], periods: number) => number[],
  config: ValidationConfig = ENHANCED_VALIDATION_CONFIG
): ValidationResult => {
  if (data.length < config.minValidationSize) {
    console.log(`❌ VALIDATION: Insufficient data length: ${data.length} < ${config.minValidationSize} for SKU=${config.sku || 'unknown'}, Model=${config.modelId || 'unknown'}, Method=${config.method || 'unknown'}`);
    return { accuracy: 0, mape: 100, confidence: 0, rmse: 0, mae: 0 };
  }

  const minTrainSize = Math.max(
    config.minValidationSize - config.testSize,
    Math.floor(data.length * 0.3)
  );
  const maxSteps = Math.min(config.maxSteps, Math.floor((data.length - minTrainSize) / config.testSize));

  if (maxSteps <= 0) {
    console.log('❌ VALIDATION: Invalid max steps');
    return { accuracy: 0, mape: 100, confidence: 0, rmse: 0, mae: 0 };
  }

  const allActual: number[] = [];
  const allPredicted: number[] = [];

  for (let step = 0; step < maxSteps; step++) {
    const trainSize = minTrainSize + step;
    const trainData = data.slice(0, trainSize);
    const testData = data.slice(trainSize, trainSize + config.testSize);

    if (testData.length === 0) {
      console.log(`⚠️ VALIDATION: Empty test data at step ${step}`);
      break;
    }

    try {
      const predictions = generateForecast(trainData, testData.length);
      const actual = testData.map(d => {
        const value = typeof d['Sales'] === 'number' ? d['Sales'] : Number(d['Sales']);
        if (isNaN(value)) {
          console.log('❌ VALIDATION: Invalid sales value:', d);
          return 0;
        }
        return value;
      });

      if (predictions.length > 0 && actual.length > 0) {
        allActual.push(...actual);
        allPredicted.push(...predictions.slice(0, actual.length));
      }
    } catch (error) {
      console.log(`❌ VALIDATION: Error in step ${step}:`, error);
      continue;
    }
  }

  return calculateMetrics(allActual, allPredicted, config);
};

export const timeSeriesCrossValidation = (
  data: NormalizedSalesData[],
  generateForecast: (trainData: NormalizedSalesData[], periods: number) => number[],
  config: ValidationConfig = ENHANCED_VALIDATION_CONFIG
): ValidationResult => {
  if (data.length < config.minValidationSize) {
    console.log(`❌ VALIDATION: Insufficient data length: ${data.length} < ${config.minValidationSize} for SKU=${config.sku || 'unknown'}, Model=${config.modelId || 'unknown'}, Method=${config.method || 'unknown'}`);
    return { accuracy: 0, mape: 100, confidence: 0, rmse: 0, mae: 0 };
  }

  const folds = Math.min(5, Math.floor(data.length / config.minValidationSize));
  const foldSize = Math.floor(data.length / folds);
  
  const allActual: number[] = [];
  const allPredicted: number[] = [];

  for (let fold = 0; fold < folds; fold++) {
    const testStart = fold * foldSize;
    const testEnd = fold === folds - 1 ? data.length : (fold + 1) * foldSize;
    
    const trainData = [
      ...data.slice(0, testStart),
      ...data.slice(testEnd)
    ];
    const testData = data.slice(testStart, testEnd);

    if (trainData.length < config.minValidationSize || testData.length === 0) {
      continue;
    }

    try {
      const predictions = generateForecast(trainData, testData.length);
      const actual = testData.map(d => Number(d['Sales']));

      if (predictions.length > 0 && actual.length > 0) {
        allActual.push(...actual);
        allPredicted.push(...predictions.slice(0, actual.length));
      }
    } catch (error) {
      continue;
    }
  }

  return calculateMetrics(allActual, allPredicted, config);
};
