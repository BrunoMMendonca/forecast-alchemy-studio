import { SalesData } from '@/types/forecast';
import { generateMovingAverage, generateSimpleExponentialSmoothing, generateDoubleExponentialSmoothing } from './nonSeasonalForecastAlgorithms';
import { generateHoltWinters, generateSeasonalMovingAverage } from './seasonalForecastAlgorithms';
import { ValidationConfig, ValidationResult, walkForwardValidation, timeSeriesCrossValidation, ENHANCED_VALIDATION_CONFIG } from './enhancedValidation';
import { ForecastPrediction } from '@/types/forecast';

interface OptimizationResult {
  parameters: Record<string, number>;
  accuracy: number;
  confidence: number;
  method: 'ai_optimal' | 'grid' | 'adaptive_grid' | 'validation';
  validationDetails: ValidationResult;
}

// Smart parameter ranges based on data characteristics
const getSmartParameterRanges = (modelId: string, data: SalesData[]): Record<string, number[]> => {
  const dataLength = data.length;
  const sales = data.map(d => Number(d['Sales']));
  const mean = sales.reduce((a, b) => a + b, 0) / sales.length;
  const std = Math.sqrt(sales.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / sales.length);
  
  // Base ranges on data characteristics
  const ranges: Record<string, Record<string, number[]>> = {
    moving_average: {
      window: Array.from({ length: 5 }, (_, i) => Math.max(2, Math.min(12, Math.floor(dataLength / (10 - i)))))
    },
    simple_exponential_smoothing: {
      alpha: [0.1, 0.2, 0.3, 0.4, 0.5]
    },
    double_exponential_smoothing: {
      alpha: [0.1, 0.2, 0.3, 0.4, 0.5],
      beta: [0.1, 0.2, 0.3]
    },
    holt_winters: {
      alpha: [0.2, 0.3, 0.4, 0.5, 0.6],
      beta: [0.1, 0.2, 0.3, 0.4],
      gamma: [0.1, 0.2, 0.3, 0.4],
      seasonalPeriods: [12]
    }
  };

  return ranges[modelId] || {};
};

// Early stopping criteria
const shouldStopEarly = (
  currentBest: { accuracy: number; confidence: number },
  iterations: number,
  maxIterations: number
): boolean => {
  // Don't stop early if results are poor
  if (currentBest.accuracy < 60 || currentBest.confidence < 50) {
    return false;
  }
  
  // Stop if we have a very good result
  if (currentBest.accuracy > 85 && currentBest.confidence > 80) {
    console.log(`✅ Found excellent parameters: accuracy=${currentBest.accuracy.toFixed(1)}%, confidence=${currentBest.confidence.toFixed(1)}%`);
    return true;
  }
  
  // Stop if we've done enough iterations
  if (iterations >= maxIterations) {
    console.log(`ℹ️ Reached maximum iterations (${maxIterations})`);
    return true;
  }
  
  return false;
};

// Generate forecast using model with enhanced error handling
const generateForecastForModel = (
  modelId: string,
  trainData: SalesData[],
  forecastPeriods: number,
  parameters: Record<string, number>
): number[] => {
  try {
    // console.log(`🔍 FORECAST: Generating forecast for ${modelId}`);
    // console.log(`📊 FORECAST: Training data length: ${trainData.length}`);
    // console.log(`📊 FORECAST: Parameters:`, parameters);

    // Validate training data
    if (trainData.length === 0) {
      console.log('❌ FORECAST: Empty training data');
      return [];
    }

    // Extract sales values from training data
    const salesValues = trainData.map(d => {
      const value = Number(d['Sales']);
      if (isNaN(value)) {
        console.log('❌ FORECAST: Invalid sales value:', d);
        return 0;
      }
      return value;
    });

    if (salesValues.some(v => isNaN(v))) {
      console.log('❌ FORECAST: Invalid sales values in training data');
      return [];
    }

    let predictions: ForecastPrediction[] = [];
    switch (modelId) {
      case 'moving_average':
        predictions = generateMovingAverage(salesValues, Math.round(parameters.window), forecastPeriods);
        break;
      case 'simple_exponential_smoothing':
      case 'exponential_smoothing':
        predictions = generateSimpleExponentialSmoothing(salesValues, parameters.alpha, forecastPeriods);
        break;
      case 'double_exponential_smoothing':
        predictions = generateDoubleExponentialSmoothing(
          salesValues,
          parameters.alpha,
          parameters.beta,
          forecastPeriods
        );
        break;
      case 'holt_winters':
        predictions = generateHoltWinters(
          salesValues,
          parameters.seasonalPeriods,
          forecastPeriods,
          parameters.alpha,
          parameters.beta,
          parameters.gamma
        );
        break;
      case 'seasonal_moving_average':
        return generateSeasonalMovingAverage(
          salesValues,
          parameters.window,
          parameters.seasonalPeriods,
          forecastPeriods
        );
      default:
        console.log(`❌ FORECAST: Unknown model type: ${modelId}`);
        return [];
    }

    // Extract values from ForecastPrediction objects
    const values = predictions.map(p => p.value);
    // console.log(`📈 FORECAST: Generated predictions:`, values);
    return values;
  } catch (error) {
    console.log(`❌ FORECAST: Error generating forecast:`, error);
    return [];
  }
};

// Smart grid search with early stopping
export const adaptiveGridSearchOptimization = (
  modelId: string,
  data: SalesData[],
  aiParameters?: Record<string, number>,
  config: ValidationConfig = ENHANCED_VALIDATION_CONFIG,
  sku?: string
): OptimizationResult => {
  // console.log(`🔍 Starting smart grid search for ${modelId}`);
  
  if (data.length < config.minValidationSize * 2) {
    console.log(`⚠️ Insufficient data, using default parameters for SKU=${sku || 'unknown'}, Model=${modelId}`);
    return createDefaultResult(modelId);
  }

  const parameterRanges = getSmartParameterRanges(modelId, data);
  // console.log(`📊 Smart parameter ranges:`, parameterRanges);

  const paramNames = Object.keys(parameterRanges);
  const paramValues = Object.values(parameterRanges);
  
  // Calculate total combinations
  const totalCombinations = paramValues.reduce((acc, values) => acc * values.length, 1);
  const maxIterations = Math.min(totalCombinations, 50); // Cap at 50 iterations
  
  // console.log(`📊 Testing up to ${maxIterations} combinations out of ${totalCombinations} total`);

  let bestResult: OptimizationResult | null = null;
  let iterations = 0;
  let failedAttempts = 0;
  let lastError: string | null = null;
  
  // Generate combinations on-the-fly instead of all at once
  const generateNextCombination = (): number[] | null => {
    if (iterations >= maxIterations) return null;
    
    const combination: number[] = [];
    let temp = iterations;
    
    for (let i = paramValues.length - 1; i >= 0; i--) {
      const values = paramValues[i];
      const index = temp % values.length;
      combination.unshift(values[index]);
      temp = Math.floor(temp / values.length);
    }
    
    iterations++;
    return combination;
  };

  while (true) {
    const combination = generateNextCombination();
    if (!combination) break;

    const parameters: Record<string, number> = {};
    paramNames.forEach((name, i) => {
      parameters[name] = combination[i];
    });

    // console.log(`🔄 Testing parameters:`, parameters);

    try {
      const generateForecast = (trainData: SalesData[], periods: number) => 
        generateForecastForModel(modelId, trainData, periods, parameters);
      
      const validation = config.useWalkForward ? 
        walkForwardValidation(data, generateForecast, { ...config, sku, modelId, method: 'grid' }) :
        timeSeriesCrossValidation(data, generateForecast, { ...config, sku, modelId, method: 'grid' });
      
      if (validation.accuracy >= 0 && validation.confidence >= 50) {
        const result: OptimizationResult = {
          parameters,
          accuracy: validation.accuracy,
          confidence: validation.confidence,
          method: 'grid',
          validationDetails: validation
        };

        if (!bestResult || 
            (validation.accuracy > bestResult.accuracy && validation.confidence >= bestResult.confidence * 0.9)) {
          bestResult = result;
          console.log(`✅ New best result found for SKU=${sku || 'unknown'}, Model=${modelId}:`, {
            parameters,
            accuracy: validation.accuracy.toFixed(2),
            confidence: validation.confidence.toFixed(2)
          });
        }
      } else {
        failedAttempts++;
        if (validation.accuracy === 0) {
          lastError = `Validation failed with accuracy=0%, MAPE=${validation.mape.toFixed(2)}%`;
        } else if (validation.confidence < 50) {
          lastError = `Validation failed with low confidence=${validation.confidence.toFixed(2)}%`;
        }
      }
    } catch (error) {
      failedAttempts++;
      lastError = error instanceof Error ? error.message : 'Unknown error';
      console.log(`⚠️ Error with parameters for SKU=${sku || 'unknown'}, Model=${modelId}:`, parameters, error);
      continue;
    }

    // Check early stopping criteria
    if (bestResult && shouldStopEarly(bestResult, iterations, maxIterations)) {
      console.log(`🛑 Early stopping triggered at iteration ${iterations}/${maxIterations} for SKU=${sku || 'unknown'}, Model=${modelId} with accuracy=${bestResult.accuracy.toFixed(1)}% and confidence=${bestResult.confidence.toFixed(1)}%`);
      break;
    }
  }

  if (!bestResult) {
    console.log(`⚠️ No valid results found for SKU=${sku || 'unknown'}, Model=${modelId} after ${iterations} iterations (${failedAttempts} failed attempts). Last error: ${lastError || 'No specific error recorded'}. Using default parameters.`);
    return createDefaultResult(modelId);
  }

  return bestResult;
};

// Create default result with reasonable parameters
const createDefaultResult = (modelId: string): OptimizationResult => {
  const defaultParams: Record<string, Record<string, number>> = {
    moving_average: { window: 3 },
    simple_exponential_smoothing: { alpha: 0.3 },
    double_exponential_smoothing: { alpha: 0.3, beta: 0.1 },
    holt_winters: { alpha: 0.3, beta: 0.1, gamma: 0.1, seasonalPeriods: 12 }
  };

  return {
    parameters: defaultParams[modelId] || {},
    accuracy: 65,
    confidence: 60,
    method: 'grid',
    validationDetails: {
      accuracy: 65,
      mape: 35,
      confidence: 60,
      rmse: 0,
      mae: 0
    }
  };
};

// Enhanced parameter validation with Grid baseline comparison
export const enhancedParameterValidation = (
  modelId: string,
  data: SalesData[],
  originalParameters: Record<string, number>,
  aiParameters: Record<string, number>,
  aiConfidence: number = 70,
  config: ValidationConfig = ENHANCED_VALIDATION_CONFIG,
  gridBaseline?: { parameters: Record<string, number>; accuracy: number }
): OptimizationResult | null => {
  if (data.length < config.minValidationSize * 2) {
    return null;
  }

  try {
    // Test AI parameters
    const aiForecast = (trainData: SalesData[], periods: number) => 
      generateForecastForModel(modelId, trainData, periods, aiParameters);
    
    const aiValidation = config.useWalkForward ? 
      walkForwardValidation(data, aiForecast, config) :
      timeSeriesCrossValidation(data, aiForecast, config);

    // Compare against Grid baseline if available, otherwise use original
    let baselineAccuracy = gridBaseline?.accuracy || 0;
    const baselineParameters = gridBaseline?.parameters || originalParameters;
    
    if (!gridBaseline) {
      // Fallback to original comparison if no grid baseline
      const originalForecast = (trainData: SalesData[], periods: number) => 
        generateForecastForModel(modelId, trainData, periods, originalParameters);
      
      const originalValidation = config.useWalkForward ? 
        walkForwardValidation(data, originalForecast, config) :
        timeSeriesCrossValidation(data, originalForecast, config);
      
      baselineAccuracy = originalValidation.accuracy;
    }
    
    const improvementPercent = aiValidation.accuracy - baselineAccuracy;

    // Enhanced acceptance logic with Grid baseline consideration
    const isSignificantImprovement = improvementPercent >= (gridBaseline ? 2.0 : 1.0);
    const isWithinTolerance = Math.abs(improvementPercent) <= config.tolerance;
    const isHighConfidenceAI = aiConfidence >= config.minConfidenceForAcceptance;
    const isMinorDegradation = improvementPercent >= -0.5 && improvementPercent < 0;

    let shouldAccept = false;

    if (isSignificantImprovement) {
      shouldAccept = true;
    } else if (isHighConfidenceAI && (isWithinTolerance || isMinorDegradation)) {
      shouldAccept = true;
    } else if (aiValidation.accuracy > baselineAccuracy) {
      shouldAccept = true;
    }

    if (shouldAccept) {
      let finalConfidence = Math.min(95, aiConfidence + Math.max(0, improvementPercent * 2));
      
      return {
        parameters: aiParameters,
        accuracy: aiValidation.accuracy,
        confidence: finalConfidence,
        method: 'ai_optimal',
        validationDetails: aiValidation
      };
    } else {
      return null;
    }
  } catch (error) {
    return null;
  }
};
