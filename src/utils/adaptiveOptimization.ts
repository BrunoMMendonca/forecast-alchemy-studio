
import { SalesData } from '@/pages/Index';
import { generateMovingAverage, generateSimpleExponentialSmoothing, generateDoubleExponentialSmoothing } from './forecastAlgorithms';
import { ValidationConfig, ValidationResult, walkForwardValidation, timeSeriesCrossValidation, ENHANCED_VALIDATION_CONFIG } from './enhancedValidation';

interface OptimizationResult {
  parameters: Record<string, number>;
  accuracy: number;
  confidence: number;
  method: 'ai_optimal' | 'grid_search' | 'adaptive_grid' | 'validation';
  validationDetails: ValidationResult;
}

// Generate forecast using model with enhanced error handling
const generateForecastForModel = (
  modelId: string,
  trainData: SalesData[],
  forecastPeriods: number,
  parameters: Record<string, number>
): number[] => {
  try {
    switch (modelId) {
      case 'moving_average':
        return generateMovingAverage(trainData, Math.round(parameters.window || 3), forecastPeriods);
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
        console.warn(`Unknown model type: ${modelId}`);
        return [];
    }
  } catch (error) {
    console.error(`Error generating forecast for ${modelId}:`, error);
    return [];
  }
};

// Adaptive grid search that focuses around AI suggestions
export const adaptiveGridSearchOptimization = (
  modelId: string,
  data: SalesData[],
  aiParameters?: Record<string, number>,
  config: ValidationConfig = ENHANCED_VALIDATION_CONFIG
): OptimizationResult | null => {
  console.log(`🧠 Starting adaptive grid search for ${modelId}`);
  
  if (data.length < config.minValidationSize * 2) {
    console.log(`❌ Insufficient data for optimization (${data.length} points)`);
    return null;
  }

  // Define base parameter ranges
  const baseRanges: Record<string, Record<string, number[]>> = {
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

  const baseGrid = baseRanges[modelId];
  if (!baseGrid) {
    console.log(`❌ No parameter grid defined for ${modelId}`);
    return null;
  }

  // If AI parameters provided, create focused grid around them
  let searchGrid = { ...baseGrid };
  if (aiParameters) {
    console.log(`🎯 Creating focused grid around AI parameters:`, aiParameters);
    
    Object.keys(aiParameters).forEach(param => {
      const aiValue = aiParameters[param];
      const baseValues = baseGrid[param] || [];
      
      if (param === 'window') {
        // For window, create range around AI suggestion
        const aiWindow = Math.round(aiValue);
        const focused = [];
        for (let i = Math.max(2, aiWindow - 3); i <= Math.min(15, aiWindow + 3); i++) {
          focused.push(i);
        }
        searchGrid[param] = [...new Set([...focused, ...baseValues])].sort((a, b) => a - b);
      } else {
        // For continuous parameters, create fine-grained range around AI value
        const focused = [];
        const step = 0.05;
        for (let i = Math.max(0.05, aiValue - 0.15); i <= Math.min(0.95, aiValue + 0.15); i += step) {
          focused.push(Math.round(i * 20) / 20);
        }
        searchGrid[param] = [...new Set([...focused, ...baseValues])].sort((a, b) => a - b);
      }
    });
  }

  // Test parameters and collect results
  const results: Array<{ params: Record<string, number>; validation: ValidationResult }> = [];
  const paramNames = Object.keys(searchGrid);
  const paramValues = Object.values(searchGrid);
  
  // Generate all combinations
  const generateCombinations = (arrays: number[][], current: number[] = []): number[][] => {
    if (arrays.length === 0) return [current];
    const [first, ...rest] = arrays;
    return first.flatMap(value => generateCombinations(rest, [...current, value]));
  };

  const combinations = generateCombinations(paramValues);
  console.log(`🧮 Testing ${combinations.length} parameter combinations`);

  // Test AI parameters first if provided
  if (aiParameters) {
    console.log(`🤖 Testing AI parameters first:`, aiParameters);
    
    const generateForecast = (trainData: SalesData[], periods: number) => 
      generateForecastForModel(modelId, trainData, periods, aiParameters);
    
    const aiValidation = config.useWalkForward ? 
      walkForwardValidation(data, generateForecast, config) :
      timeSeriesCrossValidation(data, generateForecast, config);
    
    if (aiValidation.accuracy > 0) {
      results.push({ params: aiParameters, validation: aiValidation });
      console.log(`🤖 AI parameters: Accuracy ${aiValidation.accuracy.toFixed(1)}%, Confidence ${aiValidation.confidence.toFixed(1)}%`);
    }
  }

  // Test grid combinations
  let testedCount = 0;
  for (const combo of combinations) {
    const parameters: Record<string, number> = {};
    paramNames.forEach((name, i) => {
      parameters[name] = combo[i];
    });

    // Skip if this is the AI parameters we already tested
    if (aiParameters && JSON.stringify(parameters) === JSON.stringify(aiParameters)) {
      continue;
    }

    try {
      const generateForecast = (trainData: SalesData[], periods: number) => 
        generateForecastForModel(modelId, trainData, periods, parameters);
      
      const validation = config.useWalkForward ? 
        walkForwardValidation(data, generateForecast, config) :
        timeSeriesCrossValidation(data, generateForecast, config);
      
      if (validation.accuracy > 0) {
        results.push({ params: parameters, validation });
        
        // Log interesting results (top performers or significant differences)
        if (validation.accuracy > 70 || results.length <= 10) {
          console.log(`📊 ${JSON.stringify(parameters)}: Accuracy ${validation.accuracy.toFixed(1)}%, MAPE ${validation.mape.toFixed(1)}%`);
        }
      }
      
      testedCount++;
    } catch (error) {
      console.warn(`⚠️ Error testing parameters ${JSON.stringify(parameters)}:`, error);
    }
  }

  console.log(`✅ Adaptive grid search completed: tested ${testedCount} combinations, found ${results.length} valid results`);

  if (results.length === 0) {
    return null;
  }

  // Find the best result using multiple criteria
  const sortedResults = results.sort((a, b) => {
    // Primary: accuracy
    const accuracyDiff = b.validation.accuracy - a.validation.accuracy;
    if (Math.abs(accuracyDiff) > 1.0) return accuracyDiff;
    
    // Secondary: confidence
    const confidenceDiff = b.validation.confidence - a.validation.confidence;
    if (Math.abs(confidenceDiff) > 5.0) return confidenceDiff;
    
    // Tertiary: prefer simpler parameters (for moving average, smaller window)
    if (modelId === 'moving_average') {
      return (a.params.window || 0) - (b.params.window || 0);
    }
    
    return 0;
  });

  const bestResult = sortedResults[0];
  const isAIBest = aiParameters && JSON.stringify(bestResult.params) === JSON.stringify(aiParameters);
  
  console.log(`🏆 Best parameters: ${JSON.stringify(bestResult.params)}`);
  console.log(`📊 Best accuracy: ${bestResult.validation.accuracy.toFixed(1)}% (MAPE: ${bestResult.validation.mape.toFixed(1)}%)`);
  console.log(`🤖 AI was ${isAIBest ? 'OPTIMAL' : 'NOT optimal'}`);

  // Log top 3 results for comparison
  console.log(`📋 Top 3 results:`);
  sortedResults.slice(0, 3).forEach((result, i) => {
    console.log(`  ${i + 1}. ${JSON.stringify(result.params)} - ${result.validation.accuracy.toFixed(1)}%`);
  });

  return {
    parameters: bestResult.params,
    accuracy: bestResult.validation.accuracy,
    confidence: bestResult.validation.confidence,
    method: isAIBest ? 'ai_optimal' : 'adaptive_grid',
    validationDetails: bestResult.validation
  };
};

// Enhanced parameter validation with statistical significance
export const enhancedParameterValidation = (
  modelId: string,
  data: SalesData[],
  originalParameters: Record<string, number>,
  aiParameters: Record<string, number>,
  aiConfidence: number = 70,
  config: ValidationConfig = ENHANCED_VALIDATION_CONFIG
): OptimizationResult | null => {
  console.log(`🔬 Enhanced validation for ${modelId}`);
  console.log(`🔧 Original: ${JSON.stringify(originalParameters)}`);
  console.log(`🤖 AI: ${JSON.stringify(aiParameters)} (confidence: ${aiConfidence}%)`);
  
  if (data.length < config.minValidationSize * 2) {
    console.log(`❌ Insufficient data for validation (${data.length} points)`);
    return null;
  }

  try {
    // Test original parameters
    const originalForecast = (trainData: SalesData[], periods: number) => 
      generateForecastForModel(modelId, trainData, periods, originalParameters);
    
    const originalValidation = config.useWalkForward ? 
      walkForwardValidation(data, originalForecast, config) :
      timeSeriesCrossValidation(data, originalForecast, config);

    // Test AI parameters (without rounding first)
    const aiForecast = (trainData: SalesData[], periods: number) => 
      generateForecastForModel(modelId, trainData, periods, aiParameters);
    
    const aiValidation = config.useWalkForward ? 
      walkForwardValidation(data, aiForecast, config) :
      timeSeriesCrossValidation(data, aiForecast, config);

    console.log(`📊 Original accuracy: ${originalValidation.accuracy.toFixed(2)}% (MAPE: ${originalValidation.mape.toFixed(2)}%)`);
    console.log(`📊 AI accuracy: ${aiValidation.accuracy.toFixed(2)}% (MAPE: ${aiValidation.mape.toFixed(2)}%)`);
    
    const improvementPercent = aiValidation.accuracy - originalValidation.accuracy;
    console.log(`📊 Improvement: ${improvementPercent.toFixed(2)}%`);

    // Enhanced acceptance logic
    const isSignificantImprovement = improvementPercent >= 1.0; // Require meaningful improvement
    const isWithinTolerance = Math.abs(improvementPercent) <= config.tolerance;
    const isHighConfidenceAI = aiConfidence >= config.minConfidenceForAcceptance;
    const isMinorDegradation = improvementPercent >= -0.5 && improvementPercent < 0;

    let shouldAccept = false;
    let acceptanceReason = '';

    if (isSignificantImprovement) {
      shouldAccept = true;
      acceptanceReason = 'significant improvement';
    } else if (isHighConfidenceAI && (isWithinTolerance || isMinorDegradation)) {
      shouldAccept = true;
      acceptanceReason = 'high confidence with acceptable performance';
    } else if (aiValidation.accuracy > originalValidation.accuracy) {
      shouldAccept = true;
      acceptanceReason = 'any improvement accepted';
    }

    if (shouldAccept) {
      console.log(`✅ AI optimization ACCEPTED (${acceptanceReason}): improvement ${improvementPercent.toFixed(2)}%`);
      
      // Calculate final confidence
      let finalConfidence = Math.min(95, aiConfidence + Math.max(0, improvementPercent * 2));
      
      return {
        parameters: aiParameters,
        accuracy: aiValidation.accuracy,
        confidence: finalConfidence,
        method: 'ai_optimal',
        validationDetails: aiValidation
      };
    } else {
      console.log(`❌ AI optimization REJECTED: improvement ${improvementPercent.toFixed(2)}% (threshold: ${config.tolerance}%, confidence: ${aiConfidence}%)`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error during enhanced validation:`, error);
    return null;
  }
};
