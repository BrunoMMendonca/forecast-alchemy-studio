
import { optimizationLogger } from '@/utils/optimizationLogger';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { BusinessContext } from '@/types/businessContext';
import { runAIOptimization, OptimizationResult } from '@/utils/aiOptimization';
import { runGridOptimization, GridOptimizationResult } from '@/utils/gridOptimization';

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
  onMethodComplete?: (method: 'grid' | 'ai', result: OptimizationResult | GridOptimizationResult) => void
): Promise<{
  selectedResult: OptimizationResult | GridOptimizationResult;
  bothResults?: { ai?: OptimizationResult; grid: GridOptimizationResult };
}> => {
  console.log(`🔧 SINGLE: Starting optimization for ${sku}:${model.id}`);

  if (!model.parameters || Object.keys(model.parameters).length === 0) {
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'complete',
      message: 'No parameters to optimize - using defaults',
      parameters: model.parameters
    });
    
    const defaultResult = { 
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
    
    return { 
      selectedResult: defaultResult,
      bothResults: { grid: defaultResult as GridOptimizationResult }
    };
  }

  if (forceGridSearch) {
    console.log(`🔧 SINGLE: Force grid search for ${sku}:${model.id}`);
    const gridResult = await runGridOptimization(model, skuData, sku);
    if (onMethodComplete) {
      onMethodComplete('grid', gridResult);
    }
    return { 
      selectedResult: gridResult,
      bothResults: { grid: gridResult }
    };
  }

  const results = await runBothOptimizations(model, skuData, sku, progressUpdater, businessContext, onMethodComplete);
  
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
  onMethodComplete?: (method: 'grid' | 'ai', result: OptimizationResult | GridOptimizationResult) => void
): Promise<MultiMethodResult> => {
  optimizationLogger.logStep({
    sku,
    modelId: model.id,
    step: 'start',
    message: 'Starting dual optimization (Grid + AI)',
    parameters: model.parameters
  });

  // Step 1: Always run Grid optimization first
  console.log(`🔧 SINGLE: Running grid optimization for ${sku}:${model.id}`);
  const gridResult = await runGridOptimization(model, skuData, sku);
  
  optimizationLogger.logStep({
    sku,
    modelId: model.id,
    step: 'grid_search',
    message: `Grid optimization complete`,
    parameters: gridResult.parameters
  });

  console.log(`✅ SINGLE: Grid complete for ${sku}:${model.id}`);
  
  // Notify that grid optimization is complete - cache immediately
  if (onMethodComplete) {
    console.log(`🔧 SINGLE: Calling onMethodComplete for grid ${sku}:${model.id}`);
    onMethodComplete('grid', gridResult);
  }

  // Step 2: Try AI optimization
  console.log(`🔧 SINGLE: Running AI optimization for ${sku}:${model.id}`);
  const aiResult = await runAIOptimization(
    model, 
    skuData, 
    sku, 
    businessContext,
    { parameters: gridResult.parameters, accuracy: gridResult.accuracy }
  );

  // Step 3: Select result and notify if AI succeeded
  let selectedResult: OptimizationResult | GridOptimizationResult;
  
  if (aiResult) {
    selectedResult = aiResult;
    console.log(`✅ SINGLE: AI success for ${sku}:${model.id}`);
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'ai_success',
      message: 'AI optimization succeeded',
      parameters: aiResult.parameters
    });
    
    // Notify that AI optimization is complete - cache immediately
    if (onMethodComplete) {
      console.log(`🔧 SINGLE: Calling onMethodComplete for AI ${sku}:${model.id}`);
      onMethodComplete('ai', aiResult);
    }
    
    progressUpdater.setProgress(prev => prev ? { 
      ...prev, 
      aiOptimized: prev.aiOptimized + 1
    } : null);
  } else {
    selectedResult = gridResult;
    console.log(`⚠️ SINGLE: AI failed, using grid for ${sku}:${model.id}`);
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
  businessContext?: BusinessContext
): Promise<OptimizationResult | GridOptimizationResult | null> => {
  if (method === 'grid') {
    return await runGridOptimization(model, skuData, sku);
  }
  
  if (method === 'ai') {
    return await runAIOptimization(model, skuData, sku, businessContext);
  }

  return null;
};

export const optimizeModelForSKU = async (
  sku: string,
  skuData: SalesData[],
  model: ModelConfig,
  businessContext?: BusinessContext
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
    const result = await optimizeSingleModel(model, skuData, sku, progressUpdater, false, businessContext);
    
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
