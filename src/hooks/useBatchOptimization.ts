
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

  const startOptimization = useCallback((total: number) => {
    setIsOptimizing(true);
    setProgress({ total, completed: 0, failed: 0, aiOptimized: 0 });
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
      console.warn('No SKUs provided for optimization.');
      return;
    }

    const skusNeedingOptimization = getSKUsNeedingOptimization(data, models);
    const totalModelsToOptimize = skusNeedingOptimization.reduce((acc, curr) => acc + curr.models.length, 0);

    if (totalModelsToOptimize === 0) {
      console.log('No models need optimization, completing.');
      return;
    }

    startOptimization(totalModelsToOptimize);

    for (const sku of queuedSKUs) {
      const skuData = data.filter(d => d.sku === sku);
      
      if (skuData.length === 0) {
        console.warn(`No data found for SKU: ${sku}`);
        continue;
      }

      const modelsToOptimize = models.filter(m => m.enabled && m.parameters && Object.keys(m.parameters).length > 0);
      
      for (const model of modelsToOptimize) {
        try {
          console.log(`🔧 OPTIMIZING: ${sku}:${model.id}`);
          
          const businessContext = getBusinessContext();
          const result = await optimizeSingleModel(model, skuData, sku, { setProgress }, false, businessContext);
          
          if (result) {
            const { selectedResult, bothResults } = result;
            
            console.log(`✅ OPTIMIZATION SUCCESS: ${sku}:${model.id} (method: ${selectedResult.method})`);
            
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
          console.error(`❌ OPTIMIZATION ERROR: ${sku}:${model.id}:`, error);
          setProgress(prev => prev ? { ...prev, failed: prev.failed + 1 } : null);
        }
      }
      
      console.log(`🏁 SKU OPTIMIZATION COMPLETE: ${sku}`);
      setProgress(prev => prev ? { ...prev, completed: prev.completed + modelsToOptimize.length } : null);
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
