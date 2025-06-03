
import { SalesData } from '@/pages/Index';
import { generateMovingAverage, generateSimpleExponentialSmoothing, generateDoubleExponentialSmoothing } from './forecastAlgorithms';

interface OptimizationResult {
  parameters: Record<string, number>;
  accuracy: number;
  confidence: number;
  method: 'grid_search' | 'validation';
}

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

// Split data for validation (use last 20% for testing)
const splitDataForValidation = (data: SalesData[]) => {
  const splitIndex = Math.floor(data.length * 0.8);
  return {
    train: data.slice(0, splitIndex),
    test: data.slice(splitIndex)
  };
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

// Grid search optimization for a specific model
export const gridSearchOptimization = (
  modelId: string,
  data: SalesData[]
): OptimizationResult | null => {
  console.log(`🔍 Starting grid search optimization for ${modelId}`);
  
  if (data.length < 10) {
    console.log(`❌ Insufficient data for grid search (${data.length} points)`);
    return null;
  }

  const { train, test } = splitDataForValidation(data);
  const testPeriods = test.length;
  const actualValues = test.map(d => d.sales);
  
  let bestParameters = {};
  let bestMAPE = Infinity;
  let bestAccuracy = 0;

  // Define parameter grids based on model type
  const parameterGrids: Record<string, Record<string, number[]>> = {
    moving_average: {
      window: [2, 3, 4, 5, 6, 7, 8, 9, 10]
    },
    simple_exponential_smoothing: {
      alpha: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
    },
    exponential_smoothing: {
      alpha: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
    },
    double_exponential_smoothing: {
      alpha: [0.1, 0.3, 0.5, 0.7, 0.9],
      beta: [0.1, 0.3, 0.5, 0.7, 0.9]
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
  console.log(`🧮 Testing ${combinations.length} parameter combinations`);

  let testedCount = 0;
  
  for (const combo of combinations) {
    const parameters: Record<string, number> = {};
    paramNames.forEach((name, i) => {
      parameters[name] = combo[i];
    });

    try {
      const predictions = generateForecastForModel(modelId, train, testPeriods, parameters);
      
      if (predictions.length > 0) {
        const mape = calculateMAPE(actualValues, predictions);
        const accuracy = Math.max(0, 100 - mape);
        
        if (mape < bestMAPE) {
          bestMAPE = mape;
          bestAccuracy = accuracy;
          bestParameters = { ...parameters };
        }
      }
      
      testedCount++;
    } catch (error) {
      console.warn(`⚠️ Error testing parameters ${JSON.stringify(parameters)}:`, error);
    }
  }

  console.log(`✅ Grid search completed: tested ${testedCount}/${combinations.length} combinations`);
  console.log(`🎯 Best accuracy: ${bestAccuracy.toFixed(1)}% (MAPE: ${bestMAPE.toFixed(1)}%)`);

  if (bestMAPE === Infinity) {
    return null;
  }

  // Calculate confidence based on how much better this is than random
  const confidence = Math.min(95, Math.max(60, bestAccuracy));

  return {
    parameters: bestParameters,
    accuracy: bestAccuracy,
    confidence,
    method: 'grid_search'
  };
};

// Validate AI-optimized parameters against historical data
export const validateOptimizedParameters = (
  modelId: string,
  data: SalesData[],
  originalParameters: Record<string, number>,
  optimizedParameters: Record<string, number>
): OptimizationResult | null => {
  console.log(`🔬 Validating AI-optimized parameters for ${modelId}`);
  
  if (data.length < 10) {
    console.log(`❌ Insufficient data for validation (${data.length} points)`);
    return null;
  }

  const { train, test } = splitDataForValidation(data);
  const testPeriods = test.length;
  const actualValues = test.map(d => d.sales);

  try {
    // Test original parameters
    const originalPredictions = generateForecastForModel(modelId, train, testPeriods, originalParameters);
    const originalMAPE = calculateMAPE(actualValues, originalPredictions);
    const originalAccuracy = Math.max(0, 100 - originalMAPE);

    // Test optimized parameters
    const optimizedPredictions = generateForecastForModel(modelId, train, testPeriods, optimizedParameters);
    const optimizedMAPE = calculateMAPE(actualValues, optimizedPredictions);
    const optimizedAccuracy = Math.max(0, 100 - optimizedMAPE);

    console.log(`📊 Original accuracy: ${originalAccuracy.toFixed(1)}%`);
    console.log(`📊 Optimized accuracy: ${optimizedAccuracy.toFixed(1)}%`);

    // Only use optimized parameters if they're actually better
    if (optimizedAccuracy > originalAccuracy) {
      console.log(`✅ AI optimization improved accuracy by ${(optimizedAccuracy - originalAccuracy).toFixed(1)}%`);
      
      // Calculate confidence based on improvement
      const improvement = optimizedAccuracy - originalAccuracy;
      const confidence = Math.min(95, Math.max(60, 70 + improvement * 2));
      
      return {
        parameters: optimizedParameters,
        accuracy: optimizedAccuracy,
        confidence,
        method: 'validation'
      };
    } else {
      console.log(`❌ AI optimization did not improve accuracy (${optimizedAccuracy.toFixed(1)}% vs ${originalAccuracy.toFixed(1)}%)`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error during validation:`, error);
    return null;
  }
};
