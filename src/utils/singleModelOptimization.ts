
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

interface MultiMethodResult {
  aiResult?: EnhancedOptimizationResult;
  gridResult?: EnhancedOptimizationResult;
  selectedResult: EnhancedOptimizationResult;
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

  // If forcing grid search, only run grid
  if (forceGridSearch) {
    return await runGridOptimization(model, skuData, sku, progressUpdater);
  }

  // Run both AI and Grid optimization for batch processing
  const results = await runBothOptimizations(model, skuData, sku, progressUpdater);
  
  // Return the selected result (AI preferred if available)
  return results.selectedResult;
};

const runBothOptimizations = async (
  model: ModelConfig,
  skuData: SalesData[],
  sku: string,
  progressUpdater: ProgressUpdater
): Promise<MultiMethodResult> => {
  optimizationLogger.logStep({
    sku,
    modelId: model.id,
    step: 'start',
    message: 'Starting dual optimization (AI + Grid)',
    parameters: model.parameters
  });

  let aiResult = null;
  let gridResult = null;

  // Step 1: Try AI optimization
  if (isValidApiKey(GROK_API_KEY)) {
    try {
      optimizationLogger.logStep({
        sku,
        modelId: model.id,
        step: 'ai_attempt',
        message: 'Attempting AI optimization'
      });

      const frequency = detectDateFrequency(skuData.map(d => d.date));
      
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
        aiResult = {
          parameters: validationResult.parameters,
          confidence: validationResult.confidence,
          method: validationResult.method,
          reasoning: grokResult.reasoning,
          factors: grokResult.factors,
          expectedAccuracy: grokResult.expectedAccuracy
        };

        progressUpdater.setProgress(prev => prev ? { 
          ...prev, 
          aiOptimized: prev.aiOptimized + 1
        } : null);
      } else {
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

  // Step 2: Always run Grid optimization
  gridResult = await runGridOptimization(model, skuData, sku, progressUpdater, false);

  // Step 3: Determine which result to return as default
  let selectedResult: EnhancedOptimizationResult;
  
  if (aiResult) {
    selectedResult = aiResult;
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'complete',
      message: 'Using AI optimized parameters as default',
      parameters: aiResult.parameters
    });
  } else if (gridResult) {
    selectedResult = gridResult;
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'complete',
      message: 'Using grid search parameters as default',
      parameters: gridResult.parameters
    });
  } else {
    selectedResult = {
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

  return {
    aiResult: aiResult || undefined,
    gridResult: gridResult || undefined,
    selectedResult
  };
};

const runGridOptimization = async (
  model: ModelConfig,
  skuData: SalesData[],
  sku: string,
  progressUpdater: ProgressUpdater,
  updateProgress: boolean = true
): Promise<EnhancedOptimizationResult | null> => {
  optimizationLogger.logStep({
    sku,
    modelId: model.id,
    step: 'grid_search',
    message: 'Starting grid search optimization'
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
    if (updateProgress) {
      progressUpdater.setProgress(prev => prev ? { ...prev, gridOptimized: prev.gridOptimized + 1 } : null);
    }

    return {
      parameters: gridSearchResult.parameters,
      confidence: gridSearchResult.confidence,
      method: 'grid_search',
      reasoning: `Grid search optimization found parameters that improve accuracy by ${(gridSearchResult.accuracy - 60).toFixed(1)}%. Selected for balanced performance across validation periods.`,
      factors: {
        stability: 75,
        interpretability: 70,
        complexity: 60,
        businessImpact: 'Balanced optimization focusing on consistent performance'
      }
    };
  }

  return null;
};

// New function to get specific optimization method results
export const getOptimizationByMethod = async (
  model: ModelConfig,
  skuData: SalesData[],
  sku: string,
  method: 'ai' | 'grid'
): Promise<EnhancedOptimizationResult | null> => {
  const progressUpdater = { setProgress: () => {} };

  if (method === 'ai') {
    if (!isValidApiKey(GROK_API_KEY)) {
      return null;
    }

    try {
      const frequency = detectDateFrequency(skuData.map(d => d.date));
      
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
        return {
          parameters: validationResult.parameters,
          confidence: validationResult.confidence,
          method: validationResult.method,
          reasoning: grokResult.reasoning,
          factors: grokResult.factors,
          expectedAccuracy: grokResult.expectedAccuracy
        };
      }
    } catch (error) {
      console.error('AI optimization failed:', error);
    }
  } else if (method === 'grid') {
    return await runGridOptimization(model, skuData, sku, progressUpdater, false);
  }

  return null;
};
