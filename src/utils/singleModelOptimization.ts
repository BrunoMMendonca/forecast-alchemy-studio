import { optimizationLogger } from '@/utils/optimizationLogger';
import { ModelConfig, SalesData } from '@/types/forecast';
import { BusinessContext } from '@/types/businessContext';
// @ts-ignore
// import OptimizationWorker from '../workers/optimizationWorker.ts?worker';

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

// Helper to run a job in the worker - DISABLED
const runOptimizationInWorker = (job: {
  type: 'grid' | 'ai';
  model: ModelConfig;
  skuData: SalesData[];
  sku: string;
  businessContext?: BusinessContext;
  aiForecastModelOptimizationEnabled?: boolean;
  gridBaseline?: any;
}) => {
  console.warn('🚫 FRONTEND OPTIMIZATION DISABLED: Use backend optimization system instead');
  throw new Error('Frontend optimization is disabled - use backend system');
};

export const optimizeSingleModel = async (
  model: ModelConfig,
  skuData: SalesData[],
  sku: string,
  progressUpdater: ProgressUpdater,
  forceGridSearch: boolean = false,
  businessContext?: BusinessContext,
  onMethodComplete?: (method: 'grid' | 'ai', result: any) => void,
  aiForecastModelOptimizationEnabled: boolean = true
): Promise<{
  selectedResult: any;
  bothResults?: { ai?: any; grid: any };
}> => {
  console.warn('🚫 FRONTEND OPTIMIZATION DISABLED: Use backend optimization system instead');
  throw new Error('Frontend optimization is disabled - use backend system');
};

export const getOptimizationByMethod = async (
  model: ModelConfig,
  skuData: SalesData[],
  sku: string,
  method: 'ai' | 'grid',
  businessContext?: BusinessContext,
  aiForecastModelOptimizationEnabled: boolean = true
): Promise<any | null> => {
  console.warn('🚫 FRONTEND OPTIMIZATION DISABLED: Use backend optimization system instead');
  throw new Error('Frontend optimization is disabled - use backend system');
};

export const optimizeModelForSKU = async (
  sku: string,
  skuData: SalesData[],
  model: ModelConfig,
  businessContext?: BusinessContext,
  aiForecastModelOptimizationEnabled: boolean = true
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
  console.warn('🚫 FRONTEND OPTIMIZATION DISABLED: Use backend optimization system instead');
  return {
    success: false,
    error: 'Frontend optimization is disabled - use backend system'
  };
};
