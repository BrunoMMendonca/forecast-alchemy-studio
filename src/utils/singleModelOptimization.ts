
import { optimizeParametersWithGrok } from '@/utils/grokApiUtils';
import { gridSearchOptimization, validateOptimizedParameters } from '@/utils/localOptimization';
import { optimizationLogger } from '@/utils/optimizationLogger';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { detectDateFrequency } from '@/utils/dateUtils';
import { OptimizationResult } from '@/types/batchOptimization';

const GROK_API_KEY = 'xai-003DWefvygdxNiCFZlEUAvBIBHCiW4wPmJSOzet8xcOKqJq2nYMwbImiRqfgkoNoYP1sLCPOKPTC4HDf';

interface ProgressUpdater {
  setProgress: (updater: (prev: any) => any) => void;
}

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
    message: 'Starting enhanced optimization process',
    parameters: model.parameters
  });
  
  let aiResult = null;
  let gridResult = null;
  let finalResult = null;

  // Step 1: Try AI optimization (if API key available)
  if (GROK_API_KEY && !GROK_API_KEY.includes('XXXXXXXX') && !GROK_API_KEY.startsWith('your-grok-api-key')) {
    try {
      optimizationLogger.logStep({
        sku,
        modelId: model.id,
        step: 'ai_attempt',
        message: 'Attempting enhanced AI optimization with Grok'
      });

      const frequency = detectDateFrequency(skuData.map(d => d.date));
      
      const result = await optimizeParametersWithGrok({
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
        message: `Validating AI parameters with enhanced criteria (confidence: ${result.confidence}%)`,
        parameters: result.optimizedParameters
      });

      // Step 2: Enhanced validation with tolerance and confidence-based acceptance
      const validationConfig = {
        tolerance: 2.0, // Accept within 2%
        minConfidenceForAcceptance: 85, // Accept high confidence results
        useMultipleValidationSets: skuData.length >= 15,
        roundAIParameters: true
      };

      const validationResult = validateOptimizedParameters(
        model.id,
        skuData,
        model.parameters,
        result.optimizedParameters,
        result.confidence,
        validationConfig
      );

      if (validationResult) {
        const acceptanceType = validationResult.method === 'ai_high_confidence' ? 'confidence' : 'tolerance';
        
        optimizationLogger.logStep({
          sku,
          modelId: model.id,
          step: 'ai_success',
          message: `AI optimization accepted by ${acceptanceType}`,
          parameters: validationResult.parameters,
          accuracy: validationResult.accuracy,
          confidence: validationResult.confidence
        });

        aiResult = {
          parameters: validationResult.parameters,
          confidence: validationResult.confidence,
          method: `ai_${acceptanceType}`
        };

        // Update progress counters
        if (acceptanceType === 'confidence') {
          progressUpdater.setProgress(prev => prev ? { ...prev, aiAcceptedByConfidence: prev.aiAcceptedByConfidence + 1 } : null);
        } else {
          progressUpdater.setProgress(prev => prev ? { ...prev, aiAcceptedByTolerance: prev.aiAcceptedByTolerance + 1 } : null);
        }
      } else {
        optimizationLogger.logStep({
          sku,
          modelId: model.id,
          step: 'ai_rejected',
          message: 'AI optimization rejected - outside tolerance and confidence thresholds'
        });
        progressUpdater.setProgress(prev => prev ? { ...prev, aiRejected: prev.aiRejected + 1 } : null);
      }
    } catch (error) {
      optimizationLogger.logStep({
        sku,
        modelId: model.id,
        step: 'error',
        message: 'AI optimization failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Step 3: Try enhanced grid search if AI failed or was rejected
  if (!aiResult) {
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'grid_search',
      message: 'Starting enhanced grid search optimization'
    });

    const enhancedConfig = {
      tolerance: 2.0,
      minConfidenceForAcceptance: 85,
      useMultipleValidationSets: skuData.length >= 15,
      roundAIParameters: true
    };

    const gridSearchResult = gridSearchOptimization(model.id, skuData, enhancedConfig);
    
    if (gridSearchResult) {
      optimizationLogger.logStep({
        sku,
        modelId: model.id,
        step: 'complete',
        message: 'Enhanced grid search optimization completed',
        parameters: gridSearchResult.parameters,
        accuracy: gridSearchResult.accuracy,
        confidence: gridSearchResult.confidence
      });

      gridResult = {
        parameters: gridSearchResult.parameters,
        confidence: gridSearchResult.confidence,
        method: 'grid_search'
      };
    } else {
      optimizationLogger.logStep({
        sku,
        modelId: model.id,
        step: 'error',
        message: 'Enhanced grid search optimization failed'
      });
    }
  }

  // Step 4: Choose the best result
  if (aiResult) {
    finalResult = aiResult;
    progressUpdater.setProgress(prev => prev ? { ...prev, aiOptimized: prev.aiOptimized + 1 } : null);
  } else if (gridResult) {
    finalResult = gridResult;
    progressUpdater.setProgress(prev => prev ? { ...prev, gridOptimized: prev.gridOptimized + 1 } : null);
  } else {
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'complete',
      message: 'All optimization methods failed - using original parameters',
      parameters: model.parameters,
      confidence: 60
    });

    finalResult = {
      parameters: model.parameters,
      confidence: 60,
      method: 'fallback'
    };
  }

  return finalResult;
};
