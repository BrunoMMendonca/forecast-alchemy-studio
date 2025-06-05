
import { useState, useCallback } from 'react';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { getBusinessContext } from '@/utils/businessContext';
import { optimizeSingleModel } from '@/utils/singleModelOptimization';

interface Progress {
  total: number;
  completed: number;
  failed: number;
  aiOptimized: number;
  currentSKU?: string;
  completedSKUs: number;
  totalSKUs: number;
}

export const useBatchOptimization = () => {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);

  const startOptimization = useCallback((total: number, totalSKUs: number = 0) => {
    setIsOptimizing(true);
    setProgress({ total, completed: 0, failed: 0, aiOptimized: 0, completedSKUs: 0, totalSKUs });
  }, []);

  const completeOptimization = useCallback(() => {
    setIsOptimizing(false);
    setProgress(null);
  }, []);

  const optimizeQueuedSKUs = useCallback(async (
    data: SalesData[],
    models: ModelConfig[],
    queuedSKUs: string[],
    onSKUModelComplete: (
      sku: string, 
      modelId: string, 
      parameters: Record<string, number>, 
      confidence: number, 
      reasoning: string, 
      factors: any, 
      expectedAccuracy: number, 
      method: string,
      bothResults?: { ai?: any; grid: any }
    ) => void,
    onSKUComplete: (sku: string) => void,
    getSKUsNeedingOptimization: (data: SalesData[], models: ModelConfig[]) => { sku: string; models: string[] }[]
  ) => {
    if (!queuedSKUs || queuedSKUs.length === 0) {
      return;
    }

    const sortedQueuedSKUs = [...queuedSKUs].sort();
    const skusNeedingOptimization = getSKUsNeedingOptimization(data, models);
    const totalModelsToOptimize = skusNeedingOptimization.reduce((acc, curr) => acc + curr.models.length, 0);

    if (totalModelsToOptimize === 0) {
      return;
    }

    startOptimization(totalModelsToOptimize, sortedQueuedSKUs.length);

    let completedSKUs = 0;

    for (const sku of sortedQueuedSKUs) {
      const skuData = data.filter(d => d.sku === sku);
      
      if (skuData.length === 0) {
        continue;
      }

      setProgress(prev => prev ? { ...prev, currentSKU: sku } : null);

      const modelsToOptimize = models.filter(m => m.enabled && m.parameters && Object.keys(m.parameters).length > 0);
      
      for (const model of modelsToOptimize) {
        try {
          const businessContext = getBusinessContext();
          const result = await optimizeSingleModel(model, skuData, sku, { setProgress }, false, businessContext);
          
          if (result) {
            const { selectedResult, bothResults } = result;
            
            onSKUModelComplete(
              sku,
              model.id,
              selectedResult.parameters,
              selectedResult.confidence,
              selectedResult.reasoning || '',
              selectedResult.factors,
              selectedResult.expectedAccuracy || selectedResult.accuracy,
              selectedResult.method || 'unknown',
              bothResults
            );
          }
        } catch (error) {
          setProgress(prev => prev ? { ...prev, failed: prev.failed + 1 } : null);
        }
      }
      
      completedSKUs++;
      setProgress(prev => prev ? { 
        ...prev, 
        completed: prev.completed + modelsToOptimize.length,
        completedSKUs 
      } : null);
      onSKUComplete(sku);
    }
    
    completeOptimization();
  }, [startOptimization, completeOptimization]);

  return {
    isOptimizing,
    progress,
    optimizeQueuedSKUs
  };
};
