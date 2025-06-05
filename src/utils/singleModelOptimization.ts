
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

  // Step 2: ALWAYS run Grid optimization (independent of AI)
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
    // AI failed, use grid as fallback
    selectedResult = gridResult;
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'complete',
      message: 'AI failed, using grid search parameters as fallback',
      parameters: gridResult.parameters
    });
  } else {
    // Both failed - this should be very rare now
    selectedResult = {
      parameters: model.parameters,
      confidence: 60,
      method: 'default',
      reasoning: 'Both AI and grid search failed to find optimal parameters. Using default configuration.',
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
  console.log(`🔍 GRID SEARCH: Starting independent grid search for ${sku}:${model.id}`);
  
  optimizationLogger.logStep({
    sku,
    modelId: model.id,
    step: 'grid_search',
    message: 'Starting grid search optimization'
  });

  try {
    const gridSearchResult = adaptiveGridSearchOptimization(
      model.id,
      skuData,
      undefined, // Don't pass AI parameters for comparison
      {
        ...ENHANCED_VALIDATION_CONFIG,
        useWalkForward: true
      }
    );
    
    console.log(`🔍 GRID SEARCH: Result for ${sku}:${model.id}:`, gridSearchResult);
    
    // Grid search should ALWAYS return something unless there's a critical error
    if (gridSearchResult && gridSearchResult.parameters) {
      if (updateProgress) {
        progressUpdater.setProgress(prev => prev ? { ...prev, gridOptimized: prev.gridOptimized + 1 } : null);
      }

      console.log(`✅ GRID SEARCH: Success for ${sku}:${model.id} with accuracy ${gridSearchResult.accuracy.toFixed(1)}%`);

      return {
        parameters: gridSearchResult.parameters,
        confidence: Math.max(70, gridSearchResult.confidence || 75), // Ensure minimum confidence
        method: 'grid_search', // Always grid_search
        reasoning: `Grid search systematically tested parameter combinations and selected the configuration with highest validation accuracy (${gridSearchResult.accuracy.toFixed(1)}%). This method provides reliable, data-driven parameter selection through comprehensive evaluation.`,
        factors: {
          stability: 85,
          interpretability: 90,
          complexity: 45,
          businessImpact: 'Systematic optimization ensuring reliable performance through comprehensive parameter testing'
        },
        expectedAccuracy: gridSearchResult.accuracy
      };
    } else {
      console.log(`❌ GRID SEARCH: Critical error - no results for ${sku}:${model.id}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ GRID SEARCH: Error for ${sku}:${model.id}:`, error);
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'error',
      message: 'Grid search optimization failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
};

// New function to get specific optimization method results
export const getOptimizationByMethod = async (
  model: ModelConfig,
  skuData: SalesData[],
  sku: string,
  method: 'ai' | 'grid'
): Promise<EnhancedOptimizationResult | null> => {
  console.log(`🎯 GET OPTIMIZATION: ${method} for ${sku}:${model.id}`);
  const progressUpdater = { setProgress: () => {} };

  if (method === 'ai') {
    if (!isValidApiKey(GROK_API_KEY)) {
      console.log(`❌ GET OPTIMIZATION: Invalid API key for AI`);
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
        console.log(`✅ GET OPTIMIZATION: AI success for ${sku}:${model.id}`);
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

  console.log(`❌ GET OPTIMIZATION: Failed ${method} for ${sku}:${model.id}`);
  return null;
};
