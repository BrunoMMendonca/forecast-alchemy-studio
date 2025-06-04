
import { optimizeParametersWithGrok } from '@/utils/grokApiUtils';
import { adaptiveGridSearchOptimization, enhancedParameterValidation } from '@/utils/adaptiveOptimization';
import { ENHANCED_VALIDATION_CONFIG } from '@/utils/enhancedValidation';
import { optimizationLogger } from '@/utils/optimizationLogger';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/types/sales';
import { detectDateFrequency } from '@/utils/dateUtils';
import { OptimizationResult } from '@/types/batchOptimization';

const GROK_API_KEY = 'xai-003DWefvygdxNiCFZlEUAvBIBHCiW4wPmJSOzet8xcOKqJq2nYMwbImiRqfgkoNoYP1sLCPOKPTC4HDf';

interface ProgressUpdater {
  setProgress: (updater: (prev: any) => any) => void;
}

// Validate API key
const isValidApiKey = (apiKey: string): boolean => {
  return apiKey && 
         apiKey.length > 10 && 
         !apiKey.includes('XXXXXXXX') && 
         !apiKey.startsWith('your-grok-api-key') &&
         !apiKey.includes('placeholder');
};

// Calculate accuracy using the same method as forecast generator
const calculateAccuracy = (actual: number[], predicted: number[]): number => {
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
  return Math.max(0, 100 - mape);
};

export const optimizeSingleModel = async (
  model: ModelConfig,
  skuData: SalesData[],
  sku: string,
  progressUpdater: ProgressUpdater
): Promise<OptimizationResult | undefined> => {
  if (!model.parameters || Object.keys(model.parameters).length === 0) {
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'complete',
      message: 'No parameters to optimize - using defaults',
      parameters: model.parameters
    });
    return { parameters: model.parameters, confidence: 70, method: 'default' };
  }

  optimizationLogger.logStep({
    sku,
    modelId: model.id,
    step: 'start',
    message: 'Starting enhanced optimization with aligned metrics',
    parameters: model.parameters
  });
  
  let aiResult = null;
  let gridResult = null;

  // Step 1: Validate API key and try AI optimization
  if (isValidApiKey(GROK_API_KEY)) {
    try {
      optimizationLogger.logStep({
        sku,
        modelId: model.id,
        step: 'ai_attempt',
        message: 'Attempting AI optimization with accuracy-focused approach'
      });

      const frequency = detectDateFrequency(skuData.map(d => d.date));
      
      const grokResult = await optimizeParametersWithGrok({
        modelType: model.id,
        historicalData: skuData.map(d => d.sales),
        currentParameters: model.parameters,
        seasonalPeriod: frequency.seasonalPeriod,
        targetMetric: 'accuracy'
      }, GROK_API_KEY);

      optimizationLogger.logStep({
        sku,
        modelId: model.id,
        step: 'validation',
        message: `Validating AI parameters with accuracy alignment (expected: ${grokResult.expectedAccuracy}%, confidence: ${grokResult.confidence}%)`,
        parameters: grokResult.optimizedParameters
      });

      // Enhanced validation with stricter requirements
      const validationResult = enhancedParameterValidation(
        model.id,
        skuData,
        model.parameters,
        grokResult.optimizedParameters,
        grokResult.confidence,
        {
          ...ENHANCED_VALIDATION_CONFIG,
          tolerance: 1.0,
          minConfidenceForAcceptance: 70
        }
      );

      if (validationResult) {
        optimizationLogger.logStep({
          sku,
          modelId: model.id,
          step: 'ai_success',
          message: `AI optimization ACCEPTED - accuracy improved by ${(validationResult.accuracy - calculateAccuracy(skuData.slice(-5).map(d => d.sales), [])).toFixed(2)}%`,
          parameters: validationResult.parameters,
          accuracy: validationResult.accuracy,
          confidence: validationResult.confidence
        });

        // CRITICAL FIX: Return AI result with proper method naming
        aiResult = {
          parameters: validationResult.parameters,
          confidence: validationResult.confidence,
          method: validationResult.method === 'ai_optimal' ? 'ai_optimal' : 'ai_success'
        };

        console.log(`🤖 AI OPTIMIZATION ACCEPTED for ${sku}:${model.id} - Method: ${aiResult.method}`);

      } else {
        optimizationLogger.logStep({
          sku,
          modelId: model.id,
          step: 'ai_rejected',
          message: 'AI optimization REJECTED - insufficient improvement with aligned metrics'
        });
        
        // CRITICAL FIX: Update rejected counter through progress updater
        progressUpdater.setProgress(prev => prev ? { 
          ...prev, 
          aiRejected: (prev.aiRejected || 0) + 1 
        } : null);
      }
    } catch (error) {
      optimizationLogger.logStep({
        sku,
        modelId: model.id,
        step: 'error',
        message: 'AI optimization failed - will try adaptive grid search',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } else {
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'ai_attempt',
      message: 'Invalid or missing API key - skipping AI optimization'
    });
  }

  // Step 2: Try adaptive grid search if AI didn't work
  if (!aiResult) {
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'grid_search',
      message: 'Starting adaptive grid search with enhanced accuracy validation'
    });

    const gridSearchResult = adaptiveGridSearchOptimization(
      model.id,
      skuData,
      undefined,
      {
        ...ENHANCED_VALIDATION_CONFIG,
        tolerance: 1.0,
        useWalkForward: true
      }
    );
    
    if (gridSearchResult) {
      optimizationLogger.logStep({
        sku,
        modelId: model.id,
        step: 'complete',
        message: `Adaptive grid search completed - method: ${gridSearchResult.method}, accuracy: ${gridSearchResult.accuracy.toFixed(2)}%`,
        parameters: gridSearchResult.parameters,
        accuracy: gridSearchResult.accuracy,
        confidence: gridSearchResult.confidence
      });

      gridResult = {
        parameters: gridSearchResult.parameters,
        confidence: gridSearchResult.confidence,
        method: gridSearchResult.method === 'adaptive_grid' ? 'grid_search' : gridSearchResult.method
      };

      console.log(`🔍 GRID SEARCH SUCCESS for ${sku}:${model.id} - Method: ${gridResult.method}`);

    } else {
      optimizationLogger.logStep({
        sku,
        modelId: model.id,
        step: 'error',
        message: 'Adaptive grid search failed to find better parameters'
      });
    }
  }

  // Step 3: Return the best result
  if (aiResult) {
    console.log(`✅ RETURNING AI RESULT for ${sku}:${model.id} - Method: ${aiResult.method}`);
    return aiResult;
  } else if (gridResult) {
    console.log(`✅ RETURNING GRID RESULT for ${sku}:${model.id} - Method: ${gridResult.method}`);
    return gridResult;
  } else {
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'complete',
      message: 'All optimization methods failed to improve accuracy - using original parameters',
      parameters: model.parameters,
      confidence: 60
    });

    return {
      parameters: model.parameters,
      confidence: 60,
      method: 'fallback'
    };
  }
};
