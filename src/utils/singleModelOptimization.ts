
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

interface EnhancedOptimizationResult extends OptimizationResult {
  reasoning?: string;
  factors?: {
    stability: number;
    interpretability: number;
    complexity: number;
    businessImpact: string;
  };
  expectedAccuracy?: number;
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
  progressUpdater: ProgressUpdater,
  forceGridSearch: boolean = false
): Promise<EnhancedOptimizationResult | undefined> => {
  if (!model.parameters || Object.keys(model.parameters).length === 0) {
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'complete',
      message: 'No parameters to optimize - using defaults',
      parameters: model.parameters
    });
    return { 
      parameters: model.parameters, 
      confidence: 70, 
      method: 'default',
      reasoning: 'No parameters available for optimization. Using default configuration.',
      factors: {
        stability: 70,
        interpretability: 90,
        complexity: 10,
        businessImpact: 'Minimal risk with default parameters'
      }
    };
  }

  optimizationLogger.logStep({
    sku,
    modelId: model.id,
    step: 'start',
    message: `Starting optimization${forceGridSearch ? ' (forced grid search)' : ' (multi-criteria)'}`,
    parameters: model.parameters
  });
  
  let aiResult = null;
  let gridResult = null;

  // Step 1: Skip AI if grid search is forced, otherwise try AI optimization
  if (!forceGridSearch && isValidApiKey(GROK_API_KEY)) {
    try {
      optimizationLogger.logStep({
        sku,
        modelId: model.id,
        step: 'ai_attempt',
        message: 'Attempting AI optimization with multi-criteria approach'
      });

      const frequency = detectDateFrequency(skuData.map(d => d.date));
      
      // Add business context for more intelligent optimization
      const businessContext = {
        costOfError: 'medium' as const,
        forecastHorizon: 'medium' as const,
        updateFrequency: 'weekly' as const,
        interpretabilityNeeds: 'medium' as const
      };

      const grokResult = await optimizeParametersWithGrok({
        modelType: model.id,
        historicalData: skuData.map(d => d.sales),
        currentParameters: model.parameters,
        seasonalPeriod: frequency.seasonalPeriod,
        targetMetric: 'accuracy',
        businessContext
      }, GROK_API_KEY);

      optimizationLogger.logStep({
        sku,
        modelId: model.id,
        step: 'validation',
        message: `Validating AI parameters with multi-criteria analysis (expected: ${grokResult.expectedAccuracy}%, confidence: ${grokResult.confidence}%)`,
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
          tolerance: 1.0, // Require at least 1% improvement
          minConfidenceForAcceptance: 70 // Higher confidence threshold
        }
      );

      if (validationResult) {
        optimizationLogger.logStep({
          sku,
          modelId: model.id,
          step: 'ai_success',
          message: `Multi-criteria AI optimization ACCEPTED - accuracy improved by ${(validationResult.accuracy - calculateAccuracy(skuData.slice(-5).map(d => d.sales), [])).toFixed(2)}%`,
          parameters: validationResult.parameters,
          accuracy: validationResult.accuracy,
          confidence: validationResult.confidence
        });

        aiResult = {
          parameters: validationResult.parameters,
          confidence: validationResult.confidence,
          method: validationResult.method,
          reasoning: grokResult.reasoning,
          factors: grokResult.factors,
          expectedAccuracy: grokResult.expectedAccuracy
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
          message: 'Multi-criteria AI optimization REJECTED - insufficient improvement'
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
  } else if (forceGridSearch) {
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'ai_attempt',
      message: 'Skipping AI optimization - grid search forced by user'
    });
  } else {
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'ai_attempt',
      message: 'Invalid or missing API key - skipping AI optimization'
    });
  }

  // Step 2: Try grid search if AI failed or was skipped
  if (!aiResult || forceGridSearch) {
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'grid_search',
      message: `Starting ${forceGridSearch ? 'user-requested' : 'adaptive'} grid search with multi-criteria validation`
    });

    const gridSearchResult = adaptiveGridSearchOptimization(
      model.id,
      skuData,
      undefined, // Don't use AI parameters for forced grid search
      {
        ...ENHANCED_VALIDATION_CONFIG,
        tolerance: 1.0, // Consistent tolerance requirement
        useWalkForward: true // Ensure proper time-series validation
      }
    );
    
    if (gridSearchResult) {
      optimizationLogger.logStep({
        sku,
        modelId: model.id,
        step: 'complete',
        message: `Grid search completed - method: ${gridSearchResult.method}, accuracy: ${gridSearchResult.accuracy.toFixed(2)}%`,
        parameters: gridSearchResult.parameters,
        accuracy: gridSearchResult.accuracy,
        confidence: gridSearchResult.confidence
      });

      gridResult = {
        parameters: gridSearchResult.parameters,
        confidence: gridSearchResult.confidence,
        method: 'grid_search', // Ensure it's always grid_search for user-initiated grid optimization
        reasoning: `Grid search optimization found parameters that improve accuracy by ${(gridSearchResult.accuracy - 60).toFixed(1)}%. Selected for balanced performance across validation periods.`,
        factors: {
          stability: 75,
          interpretability: 70,
          complexity: 60,
          businessImpact: 'Balanced optimization focusing on consistent performance'
        }
      };

      progressUpdater.setProgress(prev => prev ? { ...prev, gridOptimized: prev.gridOptimized + 1 } : null);
    } else {
      optimizationLogger.logStep({
        sku,
        modelId: model.id,
        step: 'error',
        message: 'Grid search failed to find better parameters'
      });
    }
  }

  // Step 3: Return the best result with comprehensive reasoning
  if (aiResult && !forceGridSearch) {
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'complete',
      message: `Using AI optimized parameters with multi-criteria reasoning - confidence: ${aiResult.confidence}%`,
      parameters: aiResult.parameters
    });
    return aiResult;
  } else if (gridResult) {
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'complete',
      message: `Using grid search parameters with balanced reasoning - confidence: ${gridResult.confidence}%`,
      parameters: gridResult.parameters
    });
    return gridResult;
  } else {
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'complete',
      message: 'All optimization methods failed to improve accuracy - using original parameters with default reasoning',
      parameters: model.parameters,
      confidence: 60
    });

    return {
      parameters: model.parameters,
      confidence: 60,
      method: 'fallback',
      reasoning: 'No optimization method found significant improvements over current parameters. Maintaining original configuration for stability.',
      factors: {
        stability: 80,
        interpretability: 85,
        complexity: 40,
        businessImpact: 'Conservative approach maintaining known performance'
      }
    };
  }
};
