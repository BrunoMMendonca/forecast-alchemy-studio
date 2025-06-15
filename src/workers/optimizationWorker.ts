// src/workers/optimizationWorker.ts

import { runGridOptimization } from '../utils/gridOptimization';
import { runAIOptimization } from '../utils/aiOptimization';
import { ModelConfig } from '../types/forecast';
import { SalesData } from '../types/forecast';
import { BusinessContext } from '../types/businessContext';

// Define the job type for the worker
interface OptimizationJob {
  type: 'grid' | 'ai';
  model: ModelConfig;
  skuData: SalesData[];
  sku: string;
  businessContext?: BusinessContext;
  grokApiEnabled?: boolean;
}

self.onmessage = async (event) => {
  const job: OptimizationJob = event.data.job;
  let result: any;

  try {
    if (job.type === 'grid') {
      result = await runGridOptimization(job.model, job.skuData, job.sku);
    } else if (job.type === 'ai') {
      result = await runAIOptimization(
        job.model,
        job.skuData,
        job.sku,
        job.businessContext,
        undefined,
        job.grokApiEnabled
      );
    } else {
      result = { error: 'Unknown optimization type' };
    }
  } catch (error) {
    result = { error: error instanceof Error ? error.message : String(error) };
  }

  (self as any).postMessage({ result });
};

export {}; 