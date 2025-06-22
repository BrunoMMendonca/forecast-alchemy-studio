import { runGridOptimization } from '../utils/gridOptimization';
import { runAIOptimization } from '../utils/aiOptimization';
import { ModelConfig } from '../types/forecast';
import { SalesData } from '../types/forecast';
import { NormalizedSalesData, ForecastResult } from '../pages/Index';
import { BusinessContext } from '../types/businessContext';
import { generateForecastsForSKU } from '../utils/forecastGenerator';

// Define the job types for the worker
interface OptimizationJob {
  type: 'grid' | 'ai';
  model: ModelConfig;
  skuData: SalesData[];
  sku: string;
  businessContext?: BusinessContext;
  aiForecastModelOptimizationEnabled?: boolean;
}

interface ForecastJob {
  type: 'forecast';
  selectedSKU: string;
  data: NormalizedSalesData[];
  models: ModelConfig[];
  forecastPeriods: number;
  aiForecastModelOptimizationEnabled: boolean;
}

interface BatchOptimizationJob {
  type: 'batch_optimization';
  models: ModelConfig[];
  skuData: SalesData[];
  sku: string;
  businessContext?: BusinessContext;
  aiForecastModelOptimizationEnabled: boolean;
}

interface DataProcessingJob {
  type: 'data_processing';
  data: any[];
  operation: 'clean' | 'validate' | 'transform';
  options?: any;
}

type WorkerJob = OptimizationJob | ForecastJob | BatchOptimizationJob | DataProcessingJob;

// Progress tracking
let progressInterval: NodeJS.Timeout | null = null;

const sendProgress = (progress: number, message?: string) => {
  (self as any).postMessage({ 
    type: 'progress', 
    progress, 
    message 
  });
};

const startProgressTracking = (totalSteps: number) => {
  let currentStep = 0;
  progressInterval = setInterval(() => {
    currentStep++;
    const progress = Math.min((currentStep / totalSteps) * 100, 99);
    sendProgress(progress);
  }, 100);
};

const stopProgressTracking = () => {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
};

// Main worker message handler
self.onmessage = async (event) => {
  const job: WorkerJob = event.data.job;
  let result: any;

  try {
    switch (job.type) {
      case 'grid':
        result = await runGridOptimization(job.model, job.skuData, job.sku);
        break;

      case 'ai':
        result = await runAIOptimization(
          job.model,
          job.skuData,
          job.sku,
          job.businessContext,
          undefined,
          job.aiForecastModelOptimizationEnabled
        );
        break;

      case 'forecast':
        startProgressTracking(3);
        sendProgress(0, 'Generating forecasts...');
        
        result = await generateForecastsForSKU(
          job.selectedSKU,
          job.data,
          job.models,
          job.forecastPeriods,
          job.aiForecastModelOptimizationEnabled
        );
        
        stopProgressTracking();
        sendProgress(100, 'Forecasts generated successfully');
        break;

      case 'batch_optimization':
        const enabledModels = job.models.filter(m => m.enabled && m.parameters && Object.keys(m.parameters).length > 0);
        const totalModels = enabledModels.length;
        
        if (totalModels === 0) {
          result = { error: 'No optimizable models found' };
          break;
        }

        startProgressTracking(totalModels * 2);
        const results: any[] = [];

        for (let i = 0; i < enabledModels.length; i++) {
          const model = enabledModels[i];
          sendProgress((i / totalModels) * 50, `Optimizing ${model.name}...`);

          try {
            // Run both AI and Grid optimization
            const [aiResult, gridResult] = await Promise.all([
              job.aiForecastModelOptimizationEnabled ? 
                runAIOptimization(model, job.skuData, job.sku, job.businessContext, undefined, true) :
                Promise.resolve(null),
              runGridOptimization(model, job.skuData, job.sku)
            ]);

            // Compare and select best result
            let selectedResult = gridResult;
            if (aiResult && aiResult.confidence > gridResult.confidence) {
              selectedResult = aiResult;
            }

            results.push({
              modelId: model.id,
              modelName: model.name,
              aiResult,
              gridResult,
              selectedResult
            });

            sendProgress(50 + ((i + 1) / totalModels) * 50, `Completed ${model.name}`);
          } catch (error) {
            console.error(`Error optimizing model ${model.name}:`, error);
            results.push({
              modelId: model.id,
              modelName: model.name,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }

        stopProgressTracking();
        result = { results, totalModels: enabledModels.length };
        break;

      case 'data_processing':
        sendProgress(0, 'Processing data...');
        
        switch (job.operation) {
          case 'clean':
            // Basic data cleaning
            result = job.data.filter((item: any) => 
              item && typeof item === 'object' && 
              !Object.values(item).some(val => val === null || val === undefined)
            );
            break;
            
          case 'validate':
            // Data validation
            result = job.data.map((item: any) => ({
              ...item,
              isValid: item && typeof item === 'object' && 
                Object.values(item).some(val => val !== null && val !== undefined)
            }));
            break;
            
          case 'transform':
            // Data transformation
            result = job.data.map((item: any) => ({
              ...item,
              processed: true,
              timestamp: Date.now()
            }));
            break;
            
          default:
            result = { error: 'Unknown data processing operation' };
        }
        
        sendProgress(100, 'Data processing completed');
        break;

      default:
        result = { error: 'Unknown job type' };
    }
  } catch (error) {
    stopProgressTracking();
    result = { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    };
  }

  (self as any).postMessage({ 
    type: 'result',
    result 
  });
};

export {}; 