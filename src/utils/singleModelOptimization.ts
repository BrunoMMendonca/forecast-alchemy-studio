
import { optimizeParametersWithGrok } from '@/utils/grokApiUtils';
import { adaptiveGridSearchOptimization, enhancedParameterValidation } from '@/utils/adaptiveOptimization';
import { ENHANCED_VALIDATION_CONFIG } from '@/utils/enhancedValidation';
import { optimizationLogger } from '@/utils/optimizationLogger';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
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
    message: 'Starting enhanced optimization with improved validation',
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
        message: 'Attempting AI optimization with enhanced validation'
      });

      const frequency = detectDateFrequency(skuData.map(d => d.date));
      
      const grokResult = await optimizeParametersWithGrok({
        modelType: model.id,
        historicalData: skuData.map(d => d.sales),
        currentParameters: model.parameters,
        seasonalPeriod: frequency.seasonalPeriod,
        targetMetric: 'mape'
      }, GROK_API_KEY);

      optimizationLogger.logStep({
        sku,
        modelId: model.id,
        step: 'validation',
        message: `Validating AI parameters with enhanced criteria (confidence: ${grokResult.confidence}%)`,
        parameters: grokResult.optimizedParameters
      });

      // Enhanced validation without immediate rounding
      const validationResult = enhancedParameterValidation(
        model.id,
        skuData,
        model.parameters,
        grokResult.optimizedParameters,
        grokResult.confidence,
        ENHANCED_VALIDATION_CONFIG
      );

      if (validationResult) {
        optimizationLogger.logStep({
          sku,
          modelId: model.id,
          step: 'ai_success',
          message: `AI optimization ACCEPTED - method: ${validationResult.method}`,
          parameters: validationResult.parameters,
          accuracy: validationResult.accuracy,
          confidence: validationResult.confidence
        });

        aiResult = {
          parameters: validationResult.parameters,
          confidence: validationResult.confidence,
          method: validationResult.method
        };

        // Update progress counter
        progressUpdater.setProgress(prev => prev ? { 
          ...prev, 
          aiOptimized: prev.aiOptimized + 1,
          aiAcceptedByConfidence: prev.aiAcceptedByConfidence + (validationResult.method === 'ai_optimal' ? 1 : 0)
        } : null);
      } else {
        optimizationLogger.logStep({
          sku,
          modelId: model.id,
          step: 'ai_rejected',
          message: 'AI optimization REJECTED by enhanced validation'
        });
        progressUpdater.setProgress(prev => prev ? { ...prev, aiRejected: prev.aiRejected + 1 } : null);
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

  // Step 2: Try adaptive grid search (enhanced with AI focus if available)
  if (!aiResult) {
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'grid_search',
      message: 'Starting adaptive grid search with enhanced validation'
    });

    const gridSearchResult = adaptiveGridSearchOptimization(
      model.id,
      skuData,
      undefined, // Don't use AI parameters for grid search if AI was rejected
      ENHANCED_VALIDATION_CONFIG
    );
    
    if (gridSearchResult) {
      optimizationLogger.logStep({
        sku,
        modelId: model.id,
        step: 'complete',
        message: `Adaptive grid search completed - method: ${gridSearchResult.method}`,
        parameters: gridSearchResult.parameters,
        accuracy: gridSearchResult.accuracy,
        confidence: gridSearchResult.confidence
      });

      gridResult = {
        parameters: gridSearchResult.parameters,
        confidence: gridSearchResult.confidence,
        method: gridSearchResult.method
      };

      progressUpdater.setProgress(prev => prev ? { ...prev, gridOptimized: prev.gridOptimized + 1 } : null);
    } else {
      optimizationLogger.logStep({
        sku,
        modelId: model.id,
        step: 'error',
        message: 'Adaptive grid search failed'
      });
    }
  }

  // Step 3: Return the best result
  if (aiResult) {
    return aiResult;
  } else if (gridResult) {
    return gridResult;
  } else {
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'complete',
      message: 'All optimization methods failed - using original parameters',
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
