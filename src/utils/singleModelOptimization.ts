
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
  if (!hasOptimizableParameters(model)) {
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
    const gridResult = await runGridOptimization(model, skuData, sku);
    if (onMethodComplete) {
      onMethodComplete('grid', gridResult);
    }
    return { 
      selectedResult: gridResult,
      bothResults: { grid: gridResult }
    };
  }

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
  if (!grokApiEnabled) {
    const gridResult = await runGridOptimization(model, skuData, sku);
    if (onMethodComplete) {
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

  const gridResult = await runGridOptimization(model, skuData, sku);
  
  optimizationLogger.logStep({
    sku,
    modelId: model.id,
    step: 'grid_search',
    message: `Grid optimization complete with accuracy ${gridResult.accuracy.toFixed(1)}%`,
    parameters: gridResult.parameters
  });

  if (onMethodComplete) {
    onMethodComplete('grid', gridResult);
  }

  let aiResult: OptimizationResult | null = null;
  
  aiResult = await runAIOptimization(
    model, 
    skuData, 
    sku, 
    businessContext,
    { parameters: gridResult.parameters, accuracy: gridResult.accuracy },
    grokApiEnabled
  );

  let selectedResult: OptimizationResult | GridOptimizationResult;
  
  if (aiResult) {
    selectedResult = aiResult;
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'ai_success',
      message: 'AI optimization succeeded',
      parameters: aiResult.parameters
    });
    
    if (onMethodComplete) {
      onMethodComplete('ai', aiResult);
    }
    
    progressUpdater.setProgress(prev => prev ? { 
      ...prev, 
      aiOptimized: prev.aiOptimized + 1
    } : null);
  } else {
    selectedResult = gridResult;
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
  if (!hasOptimizableParameters(model)) {
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
