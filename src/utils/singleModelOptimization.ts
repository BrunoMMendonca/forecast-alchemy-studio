import { ModelConfig } from '@/types/forecast';
import { optimizeParametersWithGrok } from '@/utils/grokApiUtils';
import { optimizeModelLocally } from '@/utils/localOptimization';
import { adaptiveGridSearchOptimization } from '@/utils/adaptiveOptimization';
import { enhancedParameterValidation, ENHANCED_VALIDATION_CONFIG } from '@/utils/enhancedValidation';
import { optimizationLogger } from '@/utils/optimizationLogger';
import { SalesData } from '@/types/sales';
import { detectDateFrequency } from '@/utils/dateUtils';

const GROK_API_KEY = 'xai-003DWefvygdxNiCFZlEUAvBIBHCiW4wPmJSOzet8xcOKqJq2nYMwbImiRqfgkoNoYP1sLCPOKPTC4HDf';

interface ProgressUpdater {
  setProgress: (updater: (prev: any) => any) => void;
}

interface OptimizationResult {
  parameters: Record<string, number>;
  confidence: number;
  method: string;
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
        aiResult = {
          parameters: validationResult.parameters,
          confidence: validationResult.confidence,
          method: validationResult.method
        };

        progressUpdater.setProgress(prev => prev ? { 
          ...prev, 
          aiOptimized: prev.aiOptimized + 1,
          aiAcceptedByConfidence: prev.aiAcceptedByConfidence + (validationResult.method === 'ai_optimal' ? 1 : 0)
        } : null);
      } else {
        progressUpdater.setProgress(prev => prev ? { ...prev, aiRejected: prev.aiRejected + 1 } : null);
      }
    } catch (error) {
      console.error('AI optimization failed:', error);
    }
  }

  // Step 2: Try adaptive grid search with AI guidance
  if (!aiResult) {
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
      gridResult = {
        parameters: gridSearchResult.parameters,
        confidence: gridSearchResult.confidence,
        method: gridSearchResult.method
      };

      progressUpdater.setProgress(prev => prev ? { ...prev, gridOptimized: prev.gridOptimized + 1 } : null);
    }
  }

  // Step 3: Return the best result
  if (aiResult) {
    return aiResult;
  } else if (gridResult) {
    return gridResult;
  } else {
    return {
      parameters: model.parameters,
      confidence: 60,
      method: 'fallback'
    };
  }
};
