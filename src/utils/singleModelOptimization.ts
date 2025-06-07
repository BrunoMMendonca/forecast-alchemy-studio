
import { optimizationLogger } from '@/utils/optimizationLogger';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { BusinessContext } from '@/types/businessContext';
import { runAIOptimization, OptimizationResult } from '@/utils/aiOptimization';
import { runGridOptimization, GridOptimizationResult } from '@/utils/gridOptimization';
import { hasOptimizableParameters } from '@/utils/modelConfig';

interface ProgressUpdater {
  setProgress: (updater: (prev: any) => any) => void;
}

interface MultiMethodResult {
  aiResult?: OptimizationResult;
  gridResult: GridOptimizationResult;
  selectedResult: OptimizationResult | GridOptimizationResult;
  bothResults: {
    ai?: OptimizationResult;
    grid: GridOptimizationResult;
  };
}

export const optimizeSingleModel = async (
  model: ModelConfig,
  skuData: SalesData[],
  sku: string,
  progressUpdater: ProgressUpdater,
  forceGridSearch: boolean = false,
  businessContext?: BusinessContext,
  onMethodComplete?: (method: 'grid' | 'ai', result: OptimizationResult | GridOptimizationResult) => void,
  grokApiEnabled: boolean = true
): Promise<{
  selectedResult: OptimizationResult | GridOptimizationResult;
  bothResults?: { ai?: OptimizationResult; grid: GridOptimizationResult };
}> => {
  console.log(`🔧 SINGLE: Starting optimization for ${sku}:${model.id}, grokEnabled=${grokApiEnabled}`);

  // CRITICAL: Early check for models without optimizable parameters
  if (!hasOptimizableParameters(model)) {
    console.log(`🚫 SINGLE: Model ${model.id} has no optimizable parameters, skipping optimization entirely`);
    
    const defaultResult = { 
      parameters: model.parameters || {}, 
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
    
    return { 
      selectedResult: defaultResult
    };
  }

  if (forceGridSearch || !grokApiEnabled) {
    console.log(`🔧 SINGLE: ${forceGridSearch ? 'Force grid search' : 'Grok disabled, using grid only'} for ${sku}:${model.id}`);
    const gridResult = await runGridOptimization(model, skuData, sku);
    console.log(`✅ SINGLE: Grid-only result for ${sku}:${model.id}:`, gridResult);
    if (onMethodComplete) {
      console.log(`🔧 SINGLE: Calling onMethodComplete for grid-only ${sku}:${model.id}`);
      onMethodComplete('grid', gridResult);
    }
    return { 
      selectedResult: gridResult,
      bothResults: { grid: gridResult }
    };
  }

  // Run both optimizations only if Grok is enabled
  const results = await runBothOptimizations(model, skuData, sku, progressUpdater, businessContext, onMethodComplete, grokApiEnabled);
  
  return {
    selectedResult: results.selectedResult,
    bothResults: results.bothResults
  };
};

const runBothOptimizations = async (
  model: ModelConfig,
  skuData: SalesData[],
  sku: string,
  progressUpdater: ProgressUpdater,
  businessContext?: BusinessContext,
  onMethodComplete?: (method: 'grid' | 'ai', result: OptimizationResult | GridOptimizationResult) => void,
  grokApiEnabled: boolean = true
): Promise<MultiMethodResult> => {
  console.log(`🔧 DUAL: Starting dual optimization for ${sku}:${model.id}, grokEnabled=${grokApiEnabled}`);
  
  // If Grok is disabled, we shouldn't be in this function, but handle it gracefully
  if (!grokApiEnabled) {
    console.log(`🚫 DUAL: Grok disabled, falling back to grid-only for ${sku}:${model.id}`);
    const gridResult = await runGridOptimization(model, skuData, sku);
    if (onMethodComplete) {
      console.log(`🔧 DUAL: Calling onMethodComplete for grid fallback ${sku}:${model.id}`);
      onMethodComplete('grid', gridResult);
    }
    return {
      gridResult,
      selectedResult: gridResult,
      bothResults: { grid: gridResult }
    };
  }
  
  optimizationLogger.logStep({
    sku,
    modelId: model.id,
    step: 'start',
    message: 'Starting dual optimization (Grid + AI)',
    parameters: model.parameters
  });

  // Step 1: ALWAYS run Grid optimization first
  console.log(`📊 GRID: Starting grid optimization for ${sku}:${model.id}`);
  const gridResult = await runGridOptimization(model, skuData, sku);
  console.log(`✅ GRID: Completed for ${sku}:${model.id}`, gridResult);
  
  optimizationLogger.logStep({
    sku,
    modelId: model.id,
    step: 'grid_search',
    message: `Grid optimization complete with accuracy ${gridResult.accuracy.toFixed(1)}%`,
    parameters: gridResult.parameters
  });

  // Notify that grid optimization is complete - cache immediately
  if (onMethodComplete) {
    console.log(`🔧 CACHE: Calling onMethodComplete for grid ${sku}:${model.id}`);
    onMethodComplete('grid', gridResult);
  }

  // Step 2: Try AI optimization (only if enabled)
  let aiResult: OptimizationResult | null = null;
  
  console.log(`🤖 AI: Starting AI optimization for ${sku}:${model.id}`);
  aiResult = await runAIOptimization(
    model, 
    skuData, 
    sku, 
    businessContext,
    { parameters: gridResult.parameters, accuracy: gridResult.accuracy },
    grokApiEnabled
  );
  
  if (aiResult) {
    console.log(`✅ AI: Completed for ${sku}:${model.id}`, aiResult);
  } else {
    console.log(`❌ AI: Failed for ${sku}:${model.id}`);
  }

  // Step 3: Select result and notify if AI succeeded
  let selectedResult: OptimizationResult | GridOptimizationResult;
  
  if (aiResult) {
    selectedResult = aiResult;
    console.log(`🎯 RESULT: AI selected for ${sku}:${model.id}`);
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'ai_success',
      message: 'AI optimization succeeded',
      parameters: aiResult.parameters
    });
    
    // Notify that AI optimization is complete - cache immediately
    if (onMethodComplete) {
      console.log(`🔧 CACHE: Calling onMethodComplete for AI ${sku}:${model.id}`);
      onMethodComplete('ai', aiResult);
    }
    
    progressUpdater.setProgress(prev => prev ? { 
      ...prev, 
      aiOptimized: prev.aiOptimized + 1
    } : null);
  } else {
    selectedResult = gridResult;
    console.log(`🎯 RESULT: Grid selected for ${sku}:${model.id} (AI failed)`);
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'ai_rejected',
      message: 'AI optimization failed, using Grid result',
      parameters: gridResult.parameters
    });
  }

  return {
    aiResult: aiResult || undefined,
    gridResult,
    selectedResult,
    bothResults: {
      ai: aiResult || undefined,
      grid: gridResult
    }
  };
};

export const getOptimizationByMethod = async (
  model: ModelConfig,
  skuData: SalesData[],
  sku: string,
  method: 'ai' | 'grid',
  businessContext?: BusinessContext,
  grokApiEnabled: boolean = true
): Promise<OptimizationResult | GridOptimizationResult | null> => {
  // Early check for models without optimizable parameters
  if (!hasOptimizableParameters(model)) {
    console.log(`🔧 OPTIMIZATION: Model ${model.id} has no optimizable parameters, returning null`);
    return null;
  }

  if (method === 'grid') {
    return await runGridOptimization(model, skuData, sku);
  }
  
  if (method === 'ai') {
    return await runAIOptimization(model, skuData, sku, businessContext, undefined, grokApiEnabled);
  }

  return null;
};

export const optimizeModelForSKU = async (
  sku: string,
  skuData: SalesData[],
  model: ModelConfig,
  businessContext?: BusinessContext,
  grokApiEnabled: boolean = true
): Promise<{
  success: boolean;
  optimizedParameters?: Record<string, number>;
  confidence?: number;
  reasoning?: string;
  factors?: {
    stability: number;
    interpretability: number;
    complexity: number;
    businessImpact: string;
  };
  expectedAccuracy?: number;
  method?: string;
  error?: string;
}> => {
  try {
    const progressUpdater = { setProgress: () => {} };
    const result = await optimizeSingleModel(model, skuData, sku, progressUpdater, false, businessContext, undefined, grokApiEnabled);
    
    return {
      success: true,
      optimizedParameters: result.selectedResult.parameters,
      confidence: result.selectedResult.confidence,
      reasoning: result.selectedResult.reasoning,
      factors: result.selectedResult.factors,
      expectedAccuracy: result.selectedResult.expectedAccuracy,
      method: result.selectedResult.method
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};
