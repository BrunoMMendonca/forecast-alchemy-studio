
import { SalesData } from '@/pages/Index';

export interface ValidationResult {
  accuracy: number;
  mape: number;
  mae: number;
  rmse: number;
  confidence: number;
}

export interface ValidationConfig {
  tolerance: number;
  minConfidenceForAcceptance: number;
  useMultipleValidationSets: boolean;
  roundAIParameters: boolean;
  useWalkForward: boolean;
  minValidationSize: number;
  recentDataWeight: number;
}

export const ENHANCED_VALIDATION_CONFIG: ValidationConfig = {
  tolerance: 1.0,
  minConfidenceForAcceptance: 75,
  useMultipleValidationSets: true,
  roundAIParameters: false,
  useWalkForward: true,
  minValidationSize: 6,
  recentDataWeight: 1.5
};

// Calculate multiple metrics for robust validation
export const calculateMetrics = (actual: number[], predicted: number[], recentWeight: number = 1.0): ValidationResult => {
  if (actual.length === 0 || predicted.length === 0) {
    return { accuracy: 0, mape: 100, mae: Infinity, rmse: Infinity, confidence: 0 };
  }
  
  let mapeSum = 0;
  let maeSum = 0;
  let rmseSum = 0;
  let validCount = 0;
  let totalWeight = 0;
  
  const length = Math.min(actual.length, predicted.length);
  
  for (let i = 0; i < length; i++) {
    const weight = i >= length - 3 ? recentWeight : 1.0;
    
    if (actual[i] !== 0) {
      const error = Math.abs(actual[i] - predicted[i]);
      const percentError = error / Math.abs(actual[i]);
      
      mapeSum += percentError * weight;
      maeSum += error * weight;
      rmseSum += Math.pow(error, 2) * weight;
      totalWeight += weight;
      validCount++;
    }
  }
  
  if (validCount === 0 || totalWeight === 0) {
    return { accuracy: 0, mape: 100, mae: Infinity, rmse: Infinity, confidence: 0 };
  }
  
  const mape = (mapeSum / totalWeight) * 100;
  const mae = maeSum / totalWeight;
  const rmse = Math.sqrt(rmseSum / totalWeight);
  const accuracy = Math.max(0, 100 - mape);
  
  // Calculate confidence based on consistency and recent performance - FIXED: No recursion
  let recentMape = mape;
  if (actual.length >= 3 && predicted.length >= 3) {
    const recentActualSlice = actual.slice(-3);
    const recentPredictedSlice = predicted.slice(-3);
    
    // Direct calculation without recursion
    let recentMapeSum = 0;
    let recentValidCount = 0;
    
    for (let i = 0; i < Math.min(recentActualSlice.length, recentPredictedSlice.length); i++) {
      if (recentActualSlice[i] !== 0) {
        const error = Math.abs(recentActualSlice[i] - recentPredictedSlice[i]);
        const percentError = error / Math.abs(recentActualSlice[i]);
        recentMapeSum += percentError;
        recentValidCount++;
      }
    }
    
    if (recentValidCount > 0) {
      recentMape = (recentMapeSum / recentValidCount) * 100;
    }
  }
  
  const consistency = Math.max(0, 100 - Math.abs(mape - recentMape) * 2);
  const confidence = Math.min(95, (accuracy * 0.7) + (consistency * 0.3));
  
  return { accuracy, mape, mae, rmse, confidence };
};

// Walk-forward validation for time series data - FIXED: Added safety checks to prevent infinite recursion
export const walkForwardValidation = (
  data: SalesData[],
  generateForecast: (trainData: SalesData[], forecastPeriods: number) => number[],
  config: ValidationConfig
): ValidationResult => {
  console.log(`🚶 Starting walk-forward validation with ${data.length} data points`);
  
  // Enhanced safety checks
  if (!data || data.length === 0) {
    console.log(`❌ No data provided for validation`);
    return { accuracy: 0, mape: 100, mae: Infinity, rmse: Infinity, confidence: 0 };
  }
  
  if (data.length < config.minValidationSize * 2) {
    console.log(`❌ Insufficient data for walk-forward validation: ${data.length} < ${config.minValidationSize * 2}`);
    return { accuracy: 0, mape: 100, mae: Infinity, rmse: Infinity, confidence: 0 };
  }
  
  const results: ValidationResult[] = [];
  const minTrainSize = Math.max(config.minValidationSize, Math.floor(data.length * 0.6));
  const maxValidationSteps = Math.min(5, data.length - minTrainSize - 1);
  
  console.log(`🔢 Validation params: minTrainSize=${minTrainSize}, maxSteps=${maxValidationSteps}`);
  
  // Safety check to prevent infinite loops
  if (maxValidationSteps <= 0) {
    console.log(`❌ No valid steps possible for validation`);
    return { accuracy: 0, mape: 100, mae: Infinity, rmse: Infinity, confidence: 0 };
  }
  
  for (let step = 0; step < maxValidationSteps; step++) {
    const trainSize = minTrainSize + step;
    
    // Safety bounds checking
    if (trainSize >= data.length) {
      console.log(`⚠️ Train size ${trainSize} exceeds data length ${data.length}, stopping`);
      break;
    }
    
    const trainEndIndex = Math.min(trainSize, data.length);
    const testStartIndex = trainEndIndex;
    const testEndIndex = Math.min(testStartIndex + config.minValidationSize, data.length);
    
    // Ensure we don't go out of bounds
    if (testStartIndex >= data.length || testEndIndex > data.length || testStartIndex >= testEndIndex) {
      console.log(`⚠️ Invalid indices in step ${step}: train end=${trainEndIndex}, test start=${testStartIndex}, test end=${testEndIndex}`);
      continue;
    }
    
    // FIXED: Use safe slicing with explicit bounds
    const trainData = data.slice(0, trainEndIndex);
    const testData = data.slice(testStartIndex, testEndIndex);
    
    if (testData.length === 0) {
      console.log(`⚠️ No test data in step ${step}`);
      continue;
    }
    
    try {
      console.log(`🔄 Walk-forward step ${step}: Training on ${trainData.length} points, testing on ${testData.length} points`);
      
      // Add safety checks for data validity
      if (trainData.some(d => !d || typeof d.sales !== 'number' || isNaN(d.sales))) {
        console.warn(`⚠️ Invalid training data in step ${step}, skipping`);
        continue;
      }
      
      if (testData.some(d => !d || typeof d.sales !== 'number' || isNaN(d.sales))) {
        console.warn(`⚠️ Invalid test data in step ${step}, skipping`);
        continue;
      }
      
      // FIXED: Add timeout protection for forecast generation
      const startTime = Date.now();
      const predictions = generateForecast(trainData, testData.length);
      const endTime = Date.now();
      
      if (endTime - startTime > 5000) { // 5 second timeout
        console.warn(`⚠️ Forecast generation took too long in step ${step}: ${endTime - startTime}ms`);
        continue;
      }
      
      if (!predictions || predictions.length === 0) {
        console.warn(`⚠️ No predictions generated in step ${step}`);
        continue;
      }
      
      if (predictions.some(p => typeof p !== 'number' || isNaN(p))) {
        console.warn(`⚠️ Invalid predictions in step ${step}:`, predictions);
        continue;
      }
      
      const actualValues = testData.map(d => d.sales);
      
      console.log(`📊 Step ${step} - Actual:`, actualValues, 'Predicted:', predictions);
      
      const result = calculateMetrics(actualValues, predictions, config.recentDataWeight);
      results.push(result);
      console.log(`📊 Step ${step + 1}: Accuracy ${result.accuracy.toFixed(1)}%, MAPE ${result.mape.toFixed(1)}%`);
    } catch (error) {
      console.error(`❌ Detailed error in walk-forward step ${step}:`, error);
      console.error(`❌ Error details - trainData length: ${trainData.length}, testData length: ${testData.length}`);
      if (error instanceof Error) {
        console.error(`❌ Error message: ${error.message}`);
        console.error(`❌ Error stack: ${error.stack}`);
      }
      // Continue to next step instead of breaking the entire validation
      continue;
    }
  }
  
  if (results.length === 0) {
    console.log(`❌ No valid results from walk-forward validation`);
    return { accuracy: 0, mape: 100, mae: Infinity, rmse: Infinity, confidence: 0 };
  }
  
  // Aggregate results with more weight on recent validations
  const totalWeight = results.reduce((sum, _, i) => sum + (i + 1), 0);
  const weightedAccuracy = results.reduce((sum, result, i) => sum + result.accuracy * (i + 1), 0) / totalWeight;
  const weightedMape = results.reduce((sum, result, i) => sum + result.mape * (i + 1), 0) / totalWeight;
  const weightedMae = results.reduce((sum, result, i) => sum + result.mae * (i + 1), 0) / totalWeight;
  const weightedRmse = results.reduce((sum, result, i) => sum + result.rmse * (i + 1), 0) / totalWeight;
  const weightedConfidence = results.reduce((sum, result, i) => sum + result.confidence * (i + 1), 0) / totalWeight;
  
  console.log(`✅ Walk-forward complete: Final accuracy ${weightedAccuracy.toFixed(1)}%`);
  
  return {
    accuracy: weightedAccuracy,
    mape: weightedMape,
    mae: weightedMae,
    rmse: weightedRmse,
    confidence: weightedConfidence
  };
};

// Time-series cross-validation that respects temporal order
export const timeSeriesCrossValidation = (
  data: SalesData[],
  generateForecast: (trainData: SalesData[], forecastPeriods: number) => number[],
  config: ValidationConfig,
  folds: number = 3
): ValidationResult => {
  console.log(`🔄 Starting time-series cross-validation with ${folds} folds`);
  
  if (data.length < config.minValidationSize * folds) {
    console.log(`❌ Insufficient data for ${folds}-fold cross-validation`);
    return walkForwardValidation(data, generateForecast, config);
  }
  
  const results: ValidationResult[] = [];
  const foldSize = Math.floor(data.length / folds);
  
  for (let fold = 0; fold < folds; fold++) {
    const testStart = fold * foldSize;
    const testEnd = fold === folds - 1 ? data.length : (fold + 1) * foldSize;
    
    // Use all data before test period for training (temporal order)
    const trainData = data.slice(0, testStart);
    const testData = data.slice(testStart, testEnd);
    
    if (trainData.length < config.minValidationSize || testData.length === 0) {
      continue;
    }
    
    try {
      const predictions = generateForecast(trainData, testData.length);
      const actualValues = testData.map(d => d.sales);
      
      if (predictions.length > 0) {
        const result = calculateMetrics(actualValues, predictions, config.recentDataWeight);
        results.push(result);
        console.log(`📊 Fold ${fold + 1}: Accuracy ${result.accuracy.toFixed(1)}%, MAPE ${result.mape.toFixed(1)}%`);
      }
    } catch (error) {
      console.warn(`⚠️ Error in cross-validation fold ${fold}:`, error);
    }
  }
  
  if (results.length === 0) {
    return walkForwardValidation(data, generateForecast, config);
  }
  
  // Average the results
  const avgAccuracy = results.reduce((sum, r) => sum + r.accuracy, 0) / results.length;
  const avgMape = results.reduce((sum, r) => sum + r.mape, 0) / results.length;
  const avgMae = results.reduce((sum, r) => sum + r.mae, 0) / results.length;
  const avgRmse = results.reduce((sum, r) => sum + r.rmse, 0) / results.length;
  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
  
  console.log(`✅ Cross-validation complete: Final accuracy ${avgAccuracy.toFixed(1)}%`);
  
  return {
    accuracy: avgAccuracy,
    mape: avgMape,
    mae: avgMae,
    rmse: avgRmse,
    confidence: avgConfidence
  };
};
