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
  gridResult: EnhancedOptimizationResult; // Grid never fails now
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
): Promise<EnhancedOptimizationResult> => {
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

  // NEW FLOW: Run Grid first, then AI with Grid baseline
  const results = await runGridFirstThenAI(model, skuData, sku, progressUpdater);
  
  // Return the selected result (AI preferred if available and better, otherwise grid)
  return results.selectedResult;
};

// NEW: Grid-first optimization flow
const runGridFirstThenAI = async (
  model: ModelConfig,
  skuData: SalesData[],
  sku: string,
  progressUpdater: ProgressUpdater
): Promise<MultiMethodResult> => {
  optimizationLogger.logStep({
    sku,
    modelId: model.id,
    step: 'start',
    message: 'Starting Grid-first optimization (Grid → AI)',
    parameters: model.parameters
  });

  // Step 1: ALWAYS run Grid optimization first to establish baseline
  console.log(`🔍 GRID FIRST: Running Grid optimization as baseline for ${sku}:${model.id}`);
  const gridResult = await runGridOptimization(model, skuData, sku, progressUpdater, false);
  
  optimizationLogger.logStep({
    sku,
    modelId: model.id,
    step: 'grid_complete',
    message: `Grid baseline established: ${gridResult.accuracy.toFixed(2)}% accuracy`,
    parameters: gridResult.parameters
  });

  let aiResult = null;
  
  // Step 2: Try AI optimization with Grid baseline (only if API key is valid)
  if (isValidApiKey(GROK_API_KEY)) {
    try {
      optimizationLogger.logStep({
        sku,
        modelId: model.id,
        step: 'ai_attempt',
        message: 'Attempting AI optimization with Grid baseline'
      });

      console.log(`🤖 AI REFINEMENT: Using Grid baseline for ${sku}:${model.id}`);
      
      const frequency = detectDateFrequency(skuData.map(d => d.date));
      
      const businessContext = {
        costOfError: 'medium' as const,
        forecastHorizon: 'medium' as const,
        updateFrequency: 'weekly' as const,
        interpretabilityNeeds: 'medium' as const
      };

      // Pass Grid baseline to AI optimization
      const gridBaseline = {
        parameters: gridResult.parameters,
        accuracy: gridResult.accuracy
      };

      const grokResult = await optimizeParametersWithGrok({
        modelType: model.id,
        historicalData: skuData.map(d => d.sales),
        currentParameters: model.parameters,
        seasonalPeriod: frequency.seasonalPeriod,
        targetMetric: 'accuracy',
        businessContext
      }, GROK_API_KEY, gridBaseline); // NEW: Pass Grid baseline

      // Validate AI results against Grid baseline (not original parameters)
      const validationResult = enhancedParameterValidation(
        model.id,
        skuData,
        model.parameters,
        grokResult.optimizedParameters,
        grokResult.confidence,
        {
          ...ENHANCED_VALIDATION_CONFIG,
          tolerance: 2.0, // Higher threshold when comparing to Grid
          minConfidenceForAcceptance: 75 // Higher confidence required
        },
        gridBaseline // NEW: Pass Grid baseline for comparison
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

        optimizationLogger.logStep({
          sku,
          modelId: model.id,
          step: 'ai_success',
          message: `AI optimization succeeded: ${validationResult.accuracy.toFixed(2)}% accuracy (vs Grid: ${gridResult.accuracy.toFixed(2)}%)`,
          parameters: validationResult.parameters
        });
      } else {
        progressUpdater.setProgress(prev => prev ? { ...prev, aiRejected: prev.aiRejected + 1 } : null);
        
        optimizationLogger.logStep({
          sku,
          modelId: model.id,
          step: 'ai_rejected',
          message: `AI optimization rejected: couldn't improve over Grid baseline (${gridResult.accuracy.toFixed(2)}%)`,
          parameters: gridResult.parameters
        });
      }
    } catch (error) {
      optimizationLogger.logStep({
        sku,
        modelId: model.id,
        step: 'error',
        message: 'AI optimization failed, using Grid baseline',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } else {
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'ai_skipped',
      message: 'AI optimization skipped: invalid API key, using Grid baseline'
    });
  }

  // Step 3: Determine which result to return as default
  let selectedResult: EnhancedOptimizationResult;
  
  if (aiResult) {
    selectedResult = aiResult;
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'complete',
      message: `Using AI optimized parameters (${aiResult.accuracy?.toFixed(2)}% vs Grid ${gridResult.accuracy.toFixed(2)}%)`,
      parameters: aiResult.parameters
    });
  } else {
    // AI failed or didn't improve, use Grid as result
    selectedResult = gridResult;
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'complete',
      message: `Using Grid baseline parameters (AI couldn't improve: ${gridResult.accuracy.toFixed(2)}%)`,
      parameters: gridResult.parameters
    });
  }

  return {
    aiResult: aiResult || undefined,
    gridResult,
    selectedResult
  };
};

const runGridOptimization = async (
  model: ModelConfig,
  skuData: SalesData[],
  sku: string,
  progressUpdater: ProgressUpdater,
  updateProgress: boolean = true
): Promise<EnhancedOptimizationResult> => {
  console.log(`🔍 GRID SEARCH: Starting reliable grid search for ${sku}:${model.id}`);
  
  optimizationLogger.logStep({
    sku,
    modelId: model.id,
    step: 'grid_search',
    message: 'Starting grid search optimization'
  });

  // Grid search now NEVER returns null
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
  
  if (updateProgress) {
    progressUpdater.setProgress(prev => prev ? { ...prev, gridOptimized: prev.gridOptimized + 1 } : null);
  }

  console.log(`✅ GRID SEARCH: Success for ${sku}:${model.id} with accuracy ${gridSearchResult.accuracy.toFixed(1)}%`);

  return {
    parameters: gridSearchResult.parameters,
    confidence: Math.max(60, gridSearchResult.confidence || 75), // Ensure minimum confidence
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
};

// New function to get specific optimization method results with Grid-first flow
export const getOptimizationByMethod = async (
  model: ModelConfig,
  skuData: SalesData[],
  sku: string,
  method: 'ai' | 'grid'
): Promise<EnhancedOptimizationResult | null> => {
  console.log(`🎯 GET OPTIMIZATION: ${method} for ${sku}:${model.id}`);
  const progressUpdater = { setProgress: () => {} };

  if (method === 'grid') {
    // Grid optimization stays the same
    return await runGridOptimization(model, skuData, sku, progressUpdater, false);
  }
  
  if (method === 'ai') {
    if (!isValidApiKey(GROK_API_KEY)) {
      console.log(`❌ GET OPTIMIZATION: Invalid API key for AI`);
      return null;
    }

    try {
      // NEW: For manual AI requests, first get Grid baseline
      console.log(`🔍 AI REQUEST: Getting Grid baseline first for ${sku}:${model.id}`);
      const gridBaseline = await runGridOptimization(model, skuData, sku, progressUpdater, false);
      
      const frequency = detectDateFrequency(skuData.map(d => d.date));
      
      const businessContext = {
        costOfError: 'medium' as const,
        forecastHorizon: 'medium' as const,
        updateFrequency: 'weekly' as const,
        interpretabilityNeeds: 'medium' as const
      };

      const gridBaselineData = {
        parameters: gridBaseline.parameters,
        accuracy: gridBaseline.accuracy
      };

      const grokResult = await optimizeParametersWithGrok({
        modelType: model.id,
        historicalData: skuData.map(d => d.sales),
        currentParameters: model.parameters,
        seasonalPeriod: frequency.seasonalPeriod,
        targetMetric: 'accuracy',
        businessContext
      }, GROK_API_KEY, gridBaselineData); // NEW: Always pass Grid baseline

      const validationResult = enhancedParameterValidation(
        model.id,
        skuData,
        model.parameters,
        grokResult.optimizedParameters,
        grokResult.confidence,
        {
          ...ENHANCED_VALIDATION_CONFIG,
          tolerance: 2.0, // Higher threshold vs Grid
          minConfidenceForAcceptance: 75
        },
        gridBaselineData // NEW: Compare against Grid baseline
      );

      if (validationResult) {
        console.log(`✅ GET OPTIMIZATION: AI success for ${sku}:${model.id} (improved over Grid)`);
        return {
          parameters: validationResult.parameters,
          confidence: validationResult.confidence,
          method: validationResult.method,
          reasoning: grokResult.reasoning,
          factors: grokResult.factors,
          expectedAccuracy: grokResult.expectedAccuracy
        };
      } else {
        console.log(`❌ GET OPTIMIZATION: AI couldn't improve over Grid baseline for ${sku}:${model.id}`);
        return null;
      }
    } catch (error) {
      console.error('AI optimization failed:', error);
    }
  }

  console.log(`❌ GET OPTIMIZATION: Failed ${method} for ${sku}:${model.id}`);
  return null;
};
