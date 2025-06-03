
import { SalesData } from '@/pages/Index';
import { generateMovingAverage, generateSimpleExponentialSmoothing, generateDoubleExponentialSmoothing } from './forecastAlgorithms';
import { optimizationLogger } from './optimizationLogger';

interface OptimizationResult {
  parameters: Record<string, number>;
  accuracy: number;
  confidence: number;
  method: 'grid_search' | 'validation' | 'ai_high_confidence';
}

interface ValidationConfig {
  tolerance: number; // Accept AI if within this % of grid search
  minConfidenceForAcceptance: number; // Accept AI with high confidence even if slightly worse
  useMultipleValidationSets: boolean;
  roundAIParameters: boolean;
}

const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  tolerance: 2.0, // Accept AI if within 2% of grid search
  minConfidenceForAcceptance: 85, // Accept AI with 85%+ confidence
  useMultipleValidationSets: true,
  roundAIParameters: true
};

// Calculate MAPE (Mean Absolute Percentage Error)
const calculateMAPE = (actual: number[], predicted: number[]): number => {
  if (actual.length === 0 || predicted.length === 0) return 100;
  
  let sum = 0;
  let count = 0;
  
  for (let i = 0; i < Math.min(actual.length, predicted.length); i++) {
    if (actual[i] !== 0) {
      sum += Math.abs((actual[i] - predicted[i]) / actual[i]);
      count++;
    }
  }
  
  return count > 0 ? (sum / count) * 100 : 100;
};

// Round AI parameters to nearest grid values
const roundParametersToGrid = (modelId: string, parameters: Record<string, number>): Record<string, number> => {
  const rounded = { ...parameters };
  
  switch (modelId) {
    case 'moving_average':
    case 'seasonal_moving_average':
      if (rounded.window) {
        rounded.window = Math.round(rounded.window);
        rounded.window = Math.max(2, Math.min(15, rounded.window));
      }
      break;
    case 'simple_exponential_smoothing':
    case 'exponential_smoothing':
      if (rounded.alpha) {
        rounded.alpha = Math.round(rounded.alpha * 20) / 20; // Round to nearest 0.05
        rounded.alpha = Math.max(0.05, Math.min(0.95, rounded.alpha));
      }
      break;
    case 'double_exponential_smoothing':
      if (rounded.alpha) {
        rounded.alpha = Math.round(rounded.alpha * 20) / 20;
        rounded.alpha = Math.max(0.05, Math.min(0.95, rounded.alpha));
      }
      if (rounded.beta) {
        rounded.beta = Math.round(rounded.beta * 20) / 20;
        rounded.beta = Math.max(0.05, Math.min(0.95, rounded.beta));
      }
      break;
    case 'holt_winters':
      ['alpha', 'beta', 'gamma'].forEach(param => {
        if (rounded[param]) {
          rounded[param] = Math.round(rounded[param] * 20) / 20;
          rounded[param] = Math.max(0.05, Math.min(0.95, rounded[param]));
        }
      });
      break;
  }
  
  return rounded;
};

// Split data for multiple validation approaches
const createValidationSets = (data: SalesData[], useMultiple: boolean = true) => {
  if (!useMultiple || data.length < 15) {
    // Single validation set for small datasets
    const splitIndex = Math.floor(data.length * 0.8);
    return [{
      train: data.slice(0, splitIndex),
      test: data.slice(splitIndex)
    }];
  }
  
  // Multiple validation sets for cross-validation
  const sets = [];
  const foldSize = Math.floor(data.length * 0.2);
  
  for (let i = 0; i < 3; i++) {
    const testStart = Math.floor(data.length * 0.6) + (i * Math.floor(foldSize / 3));
    const testEnd = Math.min(testStart + foldSize, data.length);
    
    sets.push({
      train: data.slice(0, testStart),
      test: data.slice(testStart, testEnd)
    });
  }
  
  return sets;
};

// Generate forecast using model
const generateForecastForModel = (
  modelId: string,
  trainData: SalesData[],
  forecastPeriods: number,
  parameters: Record<string, number>
): number[] => {
  switch (modelId) {
    case 'moving_average':
      return generateMovingAverage(trainData, parameters.window || 3, forecastPeriods);
    case 'simple_exponential_smoothing':
    case 'exponential_smoothing':
      return generateSimpleExponentialSmoothing(trainData, parameters.alpha || 0.3, forecastPeriods);
    case 'double_exponential_smoothing':
      return generateDoubleExponentialSmoothing(
        trainData,
        parameters.alpha || 0.3,
        parameters.beta || 0.1,
        forecastPeriods
      );
    default:
      return [];
  }
};

// Enhanced grid search with finer granularity
export const gridSearchOptimization = (
  modelId: string,
  data: SalesData[],
  config: ValidationConfig = DEFAULT_VALIDATION_CONFIG
): OptimizationResult | null => {
  console.log(`🔍 Starting enhanced grid search optimization for ${modelId}`);
  
  if (data.length < 6) {
    console.log(`❌ Insufficient data for grid search (${data.length} points)`);
    return null;
  }

  const validationSets = createValidationSets(data, config.useMultipleValidationSets);
  let bestParameters = {};
  let bestMAPE = Infinity;
  let bestAccuracy = 0;

  // Enhanced parameter grids with finer granularity
  const parameterGrids: Record<string, Record<string, number[]>> = {
    moving_average: {
      window: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
    },
    simple_exponential_smoothing: {
      alpha: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95]
    },
    exponential_smoothing: {
      alpha: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95]
    },
    double_exponential_smoothing: {
      alpha: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95],
      beta: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95]
    }
  };

  const grid = parameterGrids[modelId];
  if (!grid) {
    console.log(`❌ No parameter grid defined for ${modelId}`);
    return null;
  }

  // Generate all parameter combinations
  const paramNames = Object.keys(grid);
  const paramValues = Object.values(grid);
  
  const generateCombinations = (arrays: number[][], current: number[] = []): number[][] => {
    if (arrays.length === 0) return [current];
    const [first, ...rest] = arrays;
    return first.flatMap(value => generateCombinations(rest, [...current, value]));
  };

  const combinations = generateCombinations(paramValues);
  console.log(`🧮 Testing ${combinations.length} parameter combinations across ${validationSets.length} validation sets`);

  let testedCount = 0;
  
  for (const combo of combinations) {
    const parameters: Record<string, number> = {};
    paramNames.forEach((name, i) => {
      parameters[name] = combo[i];
    });

    try {
      // Test across all validation sets
      let totalMAPE = 0;
      let validTests = 0;
      
      for (const validationSet of validationSets) {
        const testPeriods = validationSet.test.length;
        if (testPeriods === 0) continue;
        
        const actualValues = validationSet.test.map(d => d.sales);
        const predictions = generateForecastForModel(modelId, validationSet.train, testPeriods, parameters);
        
        if (predictions.length > 0) {
          const mape = calculateMAPE(actualValues, predictions);
          if (!isNaN(mape) && isFinite(mape)) {
            totalMAPE += mape;
            validTests++;
          }
        }
      }
      
      if (validTests > 0) {
        const avgMAPE = totalMAPE / validTests;
        const accuracy = Math.max(0, 100 - avgMAPE);
        
        if (avgMAPE < bestMAPE) {
          bestMAPE = avgMAPE;
          bestAccuracy = accuracy;
          bestParameters = { ...parameters };
        }
      }
      
      testedCount++;
    } catch (error) {
      console.warn(`⚠️ Error testing parameters ${JSON.stringify(parameters)}:`, error);
    }
  }

  console.log(`✅ Enhanced grid search completed: tested ${testedCount}/${combinations.length} combinations`);
  console.log(`🎯 Best accuracy: ${bestAccuracy.toFixed(1)}% (MAPE: ${bestMAPE.toFixed(1)}%)`);

  if (bestMAPE === Infinity) {
    return null;
  }

  const confidence = Math.min(95, Math.max(60, bestAccuracy));

  return {
    parameters: bestParameters,
    accuracy: bestAccuracy,
    confidence,
    method: 'grid_search'
  };
};

// Enhanced validation with tolerance and confidence-based acceptance
export const validateOptimizedParameters = (
  modelId: string,
  data: SalesData[],
  originalParameters: Record<string, number>,
  aiParameters: Record<string, number>,
  aiConfidence: number = 70,
  config: ValidationConfig = DEFAULT_VALIDATION_CONFIG
): OptimizationResult | null => {
  console.log(`🔬 Enhanced validation for ${modelId} with tolerance: ${config.tolerance}%`);
  
  if (data.length < 6) {
    console.log(`❌ Insufficient data for validation (${data.length} points)`);
    return null;
  }

  // Round AI parameters to grid values if configured
  const optimizedParameters = config.roundAIParameters 
    ? roundParametersToGrid(modelId, aiParameters)
    : aiParameters;

  console.log(`🔧 AI params: ${JSON.stringify(aiParameters)} -> Rounded: ${JSON.stringify(optimizedParameters)}`);

  const validationSets = createValidationSets(data, config.useMultipleValidationSets);

  try {
    let originalTotalMAPE = 0;
    let optimizedTotalMAPE = 0;
    let validTests = 0;

    // Test across all validation sets
    for (const validationSet of validationSets) {
      const testPeriods = validationSet.test.length;
      if (testPeriods === 0) continue;
      
      const actualValues = validationSet.test.map(d => d.sales);

      // Test original parameters
      const originalPredictions = generateForecastForModel(modelId, validationSet.train, testPeriods, originalParameters);
      const originalMAPE = calculateMAPE(actualValues, originalPredictions);

      // Test optimized parameters
      const optimizedPredictions = generateForecastForModel(modelId, validationSet.train, testPeriods, optimizedParameters);
      const optimizedMAPE = calculateMAPE(actualValues, optimizedPredictions);

      if (!isNaN(originalMAPE) && !isNaN(optimizedMAPE) && isFinite(originalMAPE) && isFinite(optimizedMAPE)) {
        originalTotalMAPE += originalMAPE;
        optimizedTotalMAPE += optimizedMAPE;
        validTests++;
      }
    }

    if (validTests === 0) {
      console.log(`❌ No valid validation tests completed`);
      return null;
    }

    const avgOriginalMAPE = originalTotalMAPE / validTests;
    const avgOptimizedMAPE = optimizedTotalMAPE / validTests;
    const originalAccuracy = Math.max(0, 100 - avgOriginalMAPE);
    const optimizedAccuracy = Math.max(0, 100 - avgOptimizedMAPE);
    const improvementPercent = optimizedAccuracy - originalAccuracy;

    console.log(`📊 Original accuracy: ${originalAccuracy.toFixed(2)}% (MAPE: ${avgOriginalMAPE.toFixed(2)}%)`);
    console.log(`📊 Optimized accuracy: ${optimizedAccuracy.toFixed(2)}% (MAPE: ${avgOptimizedMAPE.toFixed(2)}%)`);
    console.log(`📊 Improvement: ${improvementPercent.toFixed(2)}%, AI confidence: ${aiConfidence}%`);

    // Enhanced acceptance logic
    const isWithinTolerance = Math.abs(improvementPercent) <= config.tolerance;
    const isHighConfidenceAI = aiConfidence >= config.minConfidenceForAcceptance;
    const isActuallyBetter = improvementPercent > 0;

    let shouldAccept = false;
    let acceptanceReason = '';

    if (isActuallyBetter) {
      shouldAccept = true;
      acceptanceReason = 'actual improvement';
    } else if (isHighConfidenceAI && isWithinTolerance) {
      shouldAccept = true;
      acceptanceReason = 'high confidence within tolerance';
    } else if (isWithinTolerance && improvementPercent > -1.0) {
      shouldAccept = true;
      acceptanceReason = 'within tolerance (minor degradation)';
    }

    if (shouldAccept) {
      console.log(`✅ AI optimization ACCEPTED (${acceptanceReason}): improvement ${improvementPercent.toFixed(1)}%`);
      
      // Calculate final confidence based on multiple factors
      let finalConfidence = aiConfidence;
      if (isActuallyBetter) {
        finalConfidence = Math.min(95, aiConfidence + improvementPercent * 2);
      } else if (isWithinTolerance) {
        finalConfidence = Math.max(60, aiConfidence - Math.abs(improvementPercent));
      }
      
      return {
        parameters: optimizedParameters,
        accuracy: optimizedAccuracy,
        confidence: finalConfidence,
        method: isHighConfidenceAI ? 'ai_high_confidence' : 'validation'
      };
    } else {
      console.log(`❌ AI optimization REJECTED: improvement ${improvementPercent.toFixed(1)}% (outside tolerance ${config.tolerance}%, confidence ${aiConfidence}%)`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error during enhanced validation:`, error);
    return null;
  }
};
