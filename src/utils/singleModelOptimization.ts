
import { optimizeParametersWithGrok } from '@/utils/grokApiUtils';
import { adaptiveGridSearchOptimization } from '@/utils/adaptiveOptimization';
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
  accuracy: number;
}

interface MultiMethodResult {
  aiResult?: EnhancedOptimizationResult;
  gridResult: EnhancedOptimizationResult;
  selectedResult: EnhancedOptimizationResult;
}

// Simple API key validation
const isValidApiKey = (apiKey: string): boolean => {
  const isValid = apiKey && 
         apiKey.length > 20 && 
         !apiKey.includes('XXXXXXXX') && 
         !apiKey.startsWith('your-grok-api-key') &&
         !apiKey.includes('placeholder') &&
         apiKey.startsWith('xai-');
  
  console.log(`🔑 API Key validation: ${isValid ? 'VALID' : 'INVALID'}`);
  return isValid;
};

export const optimizeSingleModel = async (
  model: ModelConfig,
  skuData: SalesData[],
  sku: string,
  progressUpdater: ProgressUpdater,
  forceGridSearch: boolean = false
): Promise<EnhancedOptimizationResult> => {
  console.log(`🚀 OPTIMIZATION START: ${sku}:${model.id} (forceGrid: ${forceGridSearch})`);
  
  if (!model.parameters || Object.keys(model.parameters).length === 0) {
    console.log(`⚠️ No parameters to optimize for ${sku}:${model.id}`);
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
      accuracy: 70,
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
    console.log(`🔍 FORCE GRID: Running grid-only optimization for ${sku}:${model.id}`);
    return await runGridOptimization(model, skuData, sku, progressUpdater);
  }

  // NEW SIMPLIFIED FLOW: Run both Grid and AI, select AI if successful
  const results = await runBothOptimizations(model, skuData, sku, progressUpdater);
  
  // Always prefer AI if it succeeded, otherwise use Grid
  console.log(`✅ OPTIMIZATION COMPLETE: ${sku}:${model.id} using ${results.selectedResult.method}`);
  return results.selectedResult;
};

// NEW: Simplified optimization flow - both run independently
const runBothOptimizations = async (
  model: ModelConfig,
  skuData: SalesData[],
  sku: string,
  progressUpdater: ProgressUpdater
): Promise<MultiMethodResult> => {
  console.log(`🔄 DUAL OPTIMIZATION: Starting Grid + AI for ${sku}:${model.id}`);
  
  optimizationLogger.logStep({
    sku,
    modelId: model.id,
    step: 'start',
    message: 'Starting dual optimization (Grid + AI)',
    parameters: model.parameters
  });

  // Step 1: ALWAYS run Grid optimization first
  console.log(`🔍 GRID: Running Grid optimization for ${sku}:${model.id}`);
  const gridResult = await runGridOptimization(model, skuData, sku, progressUpdater, false);
  
  optimizationLogger.logStep({
    sku,
    modelId: model.id,
    step: 'grid_complete',
    message: `Grid optimization complete: ${gridResult.accuracy.toFixed(2)}% accuracy`,
    parameters: gridResult.parameters
  });

  let aiResult: EnhancedOptimizationResult | null = null;
  
  // Step 2: Try AI optimization (only if API key is valid)
  if (isValidApiKey(GROK_API_KEY)) {
    console.log(`✅ API KEY VALID: Running AI optimization for ${sku}:${model.id}`);
    try {
      optimizationLogger.logStep({
        sku,
        modelId: model.id,
        step: 'ai_attempt',
        message: 'Starting AI optimization'
      });

      const frequency = detectDateFrequency(skuData.map(d => d.date));
      
      const businessContext = {
        costOfError: 'medium' as const,
        forecastHorizon: 'medium' as const,
        updateFrequency: 'weekly' as const,
        interpretabilityNeeds: 'medium' as const
      };

      // Pass Grid results as context to AI (not for validation, just for context)
      const gridContext = {
        parameters: gridResult.parameters,
        accuracy: gridResult.accuracy
      };

      console.log(`🤖 CALLING GROK API for ${sku}:${model.id} with Grid context`);

      const grokResult = await optimizeParametersWithGrok({
        modelType: model.id,
        historicalData: skuData.map(d => d.sales),
        currentParameters: model.parameters,
        seasonalPeriod: frequency.seasonalPeriod,
        targetMetric: 'accuracy',
        businessContext
      }, GROK_API_KEY, gridContext);

      console.log(`🤖 GROK SUCCESS for ${sku}:${model.id}:`, {
        hasParameters: !!grokResult.optimizedParameters,
        confidence: grokResult.confidence,
        expectedAccuracy: grokResult.expectedAccuracy
      });

      // NO VALIDATION - just use AI results directly
      aiResult = {
        parameters: grokResult.optimizedParameters,
        confidence: grokResult.confidence || 75,
        method: 'ai',
        accuracy: grokResult.expectedAccuracy || 75,
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
        message: `AI optimization succeeded: ${aiResult.accuracy?.toFixed(2)}% expected accuracy`,
        parameters: aiResult.parameters
      });

    } catch (error) {
      console.error(`❌ AI OPTIMIZATION ERROR for ${sku}:${model.id}:`, error);
      optimizationLogger.logStep({
        sku,
        modelId: model.id,
        step: 'ai_failed',
        message: `AI optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } else {
    console.log(`❌ API KEY INVALID: Skipping AI optimization for ${sku}:${model.id}`);
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'ai_skipped',
      message: 'AI optimization skipped: invalid API key'
    });
  }

  // Step 3: Select result - AI if successful, otherwise Grid
  let selectedResult: EnhancedOptimizationResult;
  
  if (aiResult) {
    selectedResult = aiResult;
    console.log(`🎯 USING AI RESULT for ${sku}:${model.id}: AI succeeded`);
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'complete',
      message: `Using AI optimized parameters (AI succeeded)`,
      parameters: aiResult.parameters
    });
  } else {
    // AI failed, use Grid as fallback
    selectedResult = gridResult;
    console.log(`🎯 USING GRID RESULT for ${sku}:${model.id}: AI failed`);
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'complete',
      message: `Using Grid parameters (AI failed)`,
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
  console.log(`🔍 GRID SEARCH: Starting for ${sku}:${model.id}`);
  
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
      useWalkForward: true
    }
  );
  
  if (updateProgress) {
    progressUpdater.setProgress(prev => prev ? { ...prev, gridOptimized: prev.gridOptimized + 1 } : null);
  }

  console.log(`✅ GRID SEARCH: Success for ${sku}:${model.id} with accuracy ${gridSearchResult.accuracy.toFixed(1)}%`);

  return {
    parameters: gridSearchResult.parameters,
    confidence: Math.max(60, gridSearchResult.confidence || 75),
    method: 'grid_search',
    accuracy: gridSearchResult.accuracy,
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

// Simplified method-specific optimization
export const getOptimizationByMethod = async (
  model: ModelConfig,
  skuData: SalesData[],
  sku: string,
  method: 'ai' | 'grid'
): Promise<EnhancedOptimizationResult | null> => {
  console.log(`🎯 GET OPTIMIZATION: ${method} for ${sku}:${model.id}`);
  const progressUpdater = { setProgress: () => {} };

  if (method === 'grid') {
    return await runGridOptimization(model, skuData, sku, progressUpdater, false);
  }
  
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

      console.log(`🤖 MANUAL AI REQUEST: Calling Grok for ${sku}:${model.id}`);

      const grokResult = await optimizeParametersWithGrok({
        modelType: model.id,
        historicalData: skuData.map(d => d.sales),
        currentParameters: model.parameters,
        seasonalPeriod: frequency.seasonalPeriod,
        targetMetric: 'accuracy',
        businessContext
      }, GROK_API_KEY);

      // NO VALIDATION - return AI result directly
      console.log(`✅ GET OPTIMIZATION: AI success for ${sku}:${model.id}`);
      return {
        parameters: grokResult.optimizedParameters,
        confidence: grokResult.confidence || 75,
        method: 'ai',
        accuracy: grokResult.expectedAccuracy || 75,
        reasoning: grokResult.reasoning,
        factors: grokResult.factors,
        expectedAccuracy: grokResult.expectedAccuracy
      };
    } catch (error) {
      console.error(`❌ GET OPTIMIZATION: AI failed for ${sku}:${model.id}:`, error);
      return null;
    }
  }

  return null;
};
