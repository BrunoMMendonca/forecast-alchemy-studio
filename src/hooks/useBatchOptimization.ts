import { useState, useCallback } from 'react';
import { SalesData } from '@/pages/Index';
import { ModelConfig } from '@/types/forecast';
import { optimizationLogger } from '@/utils/optimizationLogger';
import { optimizeSingleModel } from '@/utils/singleModelOptimization';
import { useNavigationAwareOptimization } from '@/hooks/useNavigationAwareOptimization';
import { BusinessContext } from '@/types/businessContext';

interface OptimizationProgress {
  [sku: string]: {
    modelId: string;
    status: 'pending' | 'optimizing' | 'complete' | 'error';
    progress: number;
    result?: any;
    error?: string;
  };
}

export const useBatchOptimization = () => {
  const [optimizationProgress, setOptimizationProgress] = useState<OptimizationProgress>({});
  const [isOptimizing, setIsOptimizing] = useState(false);
  const navigationAware = useNavigationAwareOptimization();

  const runOptimization = useCallback(async (
    skus: string[],
    data: SalesData[],
    models: ModelConfig[],
    businessContext?: BusinessContext,
    forceGridSearch: boolean = false
  ) => {
    // NEW: Check if navigation-aware optimization is already running
    if (!navigationAware.shouldOptimize(data)) {
      return;
    }

    if (!skus || skus.length === 0 || !data || data.length === 0 || !models || models.length === 0) {
      console.warn('Invalid input to runOptimization. Skipping.');
      return;
    }

    const totalSKUs = skus.length;
    const startTime = Date.now();

    optimizationLogger.startSession(totalSKUs);
    optimizationLogger.logBatchStart(skus);

    setIsOptimizing(true);
    setOptimizationProgress(prev => {
      const newProgress: OptimizationProgress = {};
      skus.forEach(sku => {
        newProgress[sku] = {
          modelId: '',
          status: 'pending',
          progress: 0,
        };
      });
      return newProgress;
    });

    try {
      navigationAware.markOptimizationStarted(data);
      
      for (const sku of skus) {
        const skuData = data.filter(d => d.sku === sku);
        
        for (const model of models) {
          if (!model.enabled) continue;
          
          setOptimizationProgress(prev => ({
            ...prev,
            [sku]: {
              modelId: model.id,
              status: 'optimizing',
              progress: 0,
            }
          }));

          try {
            const result = await optimizeSingleModel(model, skuData, sku, {
              setProgress: (updater: (prev: any) => any) => {
                setOptimizationProgress(prev => {
                  if (!prev[sku]) return prev;
                  return {
                    ...prev,
                    [sku]: {
                      ...prev[sku],
                      progress: updater(prev[sku].progress)
                    }
                  };
                });
              }
            }, forceGridSearch, businessContext);

            setOptimizationProgress(prev => ({
              ...prev,
              [sku]: {
                ...prev[sku],
                status: 'complete',
                result: result.selectedResult
              }
            }));

            optimizationLogger.logStep({
              sku,
              modelId: model.id,
              step: 'complete',
              message: 'Optimization completed',
              parameters: result.selectedResult.parameters,
              accuracy: result.selectedResult.accuracy,
              confidence: result.selectedResult.confidence
            });
          } catch (error: any) {
            console.error(`Optimization failed for SKU ${sku} and model ${model.id}:`, error);
            
            setOptimizationProgress(prev => ({
              ...prev,
              [sku]: {
                ...prev[sku],
                status: 'error',
                error: error.message || 'Optimization failed'
              }
            }));

            optimizationLogger.logStep({
              sku,
              modelId: model.id,
              step: 'error',
              message: `Optimization failed: ${error.message || 'Unknown error'}`,
              error: error.message || 'Unknown error'
            });
          }
        }
        optimizationLogger.logSKUComplete(sku);
      }

      optimizationLogger.logBatchComplete(totalSKUs);
      navigationAware.markOptimizationCompleted(data);
    } catch (error: any) {
      console.error('Batch optimization failed:', error);
    } finally {
      setIsOptimizing(false);
      console.log(`Batch optimization completed in ${((Date.now() - startTime) / 1000).toFixed(2)} seconds`);
    }
  }, [navigationAware, optimizationLogger]);

  return {
    optimizationProgress,
    isOptimizing,
    runOptimization
  };
};
