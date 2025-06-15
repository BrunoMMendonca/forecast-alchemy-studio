import { optimizationLogger } from '@/utils/optimizationLogger';
import { ModelConfig, SalesData } from '@/types/forecast';
import { BusinessContext } from '@/types/businessContext';
// @ts-ignore
import OptimizationWorker from '../workers/optimizationWorker.ts?worker';

interface ProgressUpdater {
  setProgress: (updater: (prev: any) => any) => void;
}

interface MultiMethodResult {
  aiResult?: any;
  gridResult: any;
  selectedResult: any;
  bothResults: {
    ai?: any;
    grid: any;
    manual: any;
  };
}

// Helper to run a job in the worker
const runOptimizationInWorker = (job: {
  type: 'grid' | 'ai';
  model: ModelConfig;
  skuData: SalesData[];
  sku: string;
  businessContext?: BusinessContext;
  grokApiEnabled?: boolean;
  gridBaseline?: any;
}) => {
  return new Promise<any>((resolve, reject) => {
    const worker = new OptimizationWorker();
    worker.onmessage = (event: MessageEvent) => {
      resolve(event.data.result);
      worker.terminate();
  };
    worker.onerror = (err) => {
      reject(err);
      worker.terminate();
    };
    worker.postMessage({ job });
  });
};

export const optimizeSingleModel = async (
  model: ModelConfig,
  skuData: SalesData[],
  sku: string,
  progressUpdater: ProgressUpdater,
  forceGridSearch: boolean = false,
  businessContext?: BusinessContext,
  onMethodComplete?: (method: 'grid' | 'ai', result: any) => void,
  grokApiEnabled: boolean = true
): Promise<{
  selectedResult: any;
  bothResults?: { ai?: any; grid: any };
}> => {
  if (!model.parameters || Object.keys(model.parameters).length === 0) {
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
      },
      expectedAccuracy: 70
    };
    return { 
      selectedResult: defaultResult
    };
  }

  if (forceGridSearch || !grokApiEnabled) {
    const gridResult = await runOptimizationInWorker({
      type: 'grid',
      model,
      skuData,
      sku
    });
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
  onMethodComplete?: (method: 'grid' | 'ai', result: any) => void,
  grokApiEnabled: boolean = true
): Promise<MultiMethodResult> => {
  if (!grokApiEnabled) {
    const gridResult = await runOptimizationInWorker({
      type: 'grid',
      model,
      skuData,
      sku
    });
    if (onMethodComplete) {
      onMethodComplete('grid', gridResult);
    }
    // After grid, set manual parameters to grid result
    let manualParams = gridResult.parameters;
    return {
      gridResult,
      selectedResult: gridResult,
      bothResults: { grid: gridResult, manual: manualParams }
    };
  }
  
  optimizationLogger.logStep({
    sku,
    modelId: model.id,
    step: 'start',
    message: 'Starting dual optimization (Grid + AI)',
    parameters: model.parameters
  });

  const gridResult = await runOptimizationInWorker({
    type: 'grid',
    model,
    skuData,
    sku
  });
  
  // After grid, set manual parameters to grid result
  let manualParams = gridResult.parameters;

  optimizationLogger.logStep({
    sku,
    modelId: model.id,
    step: 'grid',
    message: `Grid optimization complete with accuracy ${gridResult.accuracy?.toFixed(1)}%`,
    parameters: gridResult.parameters
  });

  if (onMethodComplete) {
    onMethodComplete('grid', gridResult);
  }

  let aiResult: any = null;
  aiResult = await runOptimizationInWorker({
    type: 'ai',
    model,
    skuData,
    sku,
    businessContext,
    grokApiEnabled,
    gridBaseline: gridResult // Pass grid as baseline
  });
  
  let selectedResult: any;
  if (aiResult) {
    // Compare AI and Grid results to determine winner
    const aiScore = (aiResult.accuracy * 0.7) + (aiResult.confidence * 0.3);
    const gridScore = (gridResult.accuracy * 0.7) + (gridResult.confidence * 0.3);
    if (aiScore > gridScore) {
      selectedResult = { ...aiResult, isWinner: true };
      gridResult.isWinner = false;
    } else {
      selectedResult = { ...gridResult, isWinner: true };
      aiResult.isWinner = false;
    }
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
    selectedResult = { ...gridResult, isWinner: true }; // Grid is winner if AI fails
    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'ai_rejected',
      message: 'AI optimization failed, using Grid result',
      parameters: gridResult.parameters
    });
  }

  return {
    gridResult,
    selectedResult,
    bothResults: {
      grid: gridResult,
      ai: aiResult || undefined,
      manual: manualParams // Add manual params for UI initialization
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
): Promise<any | null> => {
  if (!model.parameters || Object.keys(model.parameters).length === 0) {
    return null;
  }
  if (method === 'grid') {
    return await runOptimizationInWorker({
      type: 'grid',
      model,
      skuData,
      sku
    });
  }
  if (method === 'ai') {
    return await runOptimizationInWorker({
      type: 'ai',
      model,
      skuData,
      sku,
      businessContext,
      grokApiEnabled
    });
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
