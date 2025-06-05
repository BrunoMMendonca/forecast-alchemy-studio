
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
}

export const optimizeSingleModel = async (
  model: ModelConfig,
  skuData: SalesData[],
  sku: string,
  progressUpdater: ProgressUpdater,
  forceGridSearch: boolean = false,
  businessContext?: BusinessContext
): Promise<OptimizationResult | GridOptimizationResult> => {
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

  if (forceGridSearch) {
    console.log(`🔍 FORCE GRID: Running grid-only optimization for ${sku}:${model.id}`);
    return await runGridOptimization(model, skuData, sku);
  }

  const results = await runBothOptimizations(model, skuData, sku, progressUpdater, businessContext);
  
  console.log(`✅ OPTIMIZATION COMPLETE: ${sku}:${model.id} using ${results.selectedResult.method}`);
  return results.selectedResult;
};

const runBothOptimizations = async (
  model: ModelConfig,
  skuData: SalesData[],
  sku: string,
  progressUpdater: ProgressUpdater,
  businessContext?: BusinessContext
): Promise<MultiMethodResult> => {
  console.log(`🔄 DUAL OPTIMIZATION: Starting Grid + AI for ${sku}:${model.id}`);
  
  optimizationLogger.logStep({
    sku,
    modelId: model.id,
    step: 'start',
    message: 'Starting dual optimization (Grid + AI)',
    parameters: model.parameters
  });

  // Step 1: Always run Grid optimization first
  const gridResult = await runGridOptimization(model, skuData, sku);
  
  optimizationLogger.logStep({
    sku,
    modelId: model.id,
    step: 'complete',
    message: `Grid optimization complete: ${gridResult.accuracy.toFixed(2)}% accuracy`,
    parameters: gridResult.parameters
  });

  // Step 2: Try AI optimization
  const aiResult = await runAIOptimization(
    model, 
    skuData, 
    sku, 
    businessContext,
    { parameters: gridResult.parameters, accuracy: gridResult.accuracy }
  );

  // Step 3: Select result - AI if successful, otherwise Grid
  let selectedResult: OptimizationResult | GridOptimizationResult;
  
  if (aiResult) {
    selectedResult = aiResult;
    console.log(`🎯 USING AI RESULT for ${sku}:${model.id}: AI succeeded`);
    progressUpdater.setProgress(prev => prev ? { 
      ...prev, 
      aiOptimized: prev.aiOptimized + 1
    } : null);
  } else {
    selectedResult = gridResult;
    console.log(`🎯 USING GRID RESULT for ${sku}:${model.id}: AI failed`);
  }

  return {
    aiResult: aiResult || undefined,
    gridResult,
    selectedResult
  };
};

export const getOptimizationByMethod = async (
  model: ModelConfig,
  skuData: SalesData[],
  sku: string,
  method: 'ai' | 'grid',
  businessContext?: BusinessContext
): Promise<OptimizationResult | GridOptimizationResult | null> => {
  console.log(`🎯 GET OPTIMIZATION: ${method} for ${sku}:${model.id}`);

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
    console.log(`🚀 optimizeModelForSKU: Starting optimization for ${sku}:${model.id}`);
    
    const progressUpdater = { setProgress: () => {} };
    const result = await optimizeSingleModel(model, skuData, sku, progressUpdater, false, businessContext);
    
    return {
      success: true,
      optimizedParameters: result.parameters,
      confidence: result.confidence,
      reasoning: result.reasoning,
      factors: result.factors,
      expectedAccuracy: result.expectedAccuracy,
      method: result.method
    };
  } catch (error) {
    console.error(`❌ optimizeModelForSKU: Error for ${sku}:${model.id}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};
