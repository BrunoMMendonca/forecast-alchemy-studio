
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

interface BatchProgress {
  currentSKU?: string;
  completedSKUs: number;
  totalSKUs: number;
}

export const useBatchOptimization = () => {
  const [optimizationProgress, setOptimizationProgress] = useState<OptimizationProgress>({});
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const navigationAware = useNavigationAwareOptimization();

  const runOptimization = useCallback(async (
    skus: string[],
    data: SalesData[],
    models: ModelConfig[],
    businessContext?: BusinessContext,
    forceGridSearch: boolean = false
  ) => {
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
    setProgress({ currentSKU: undefined, completedSKUs: 0, totalSKUs });
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
      
      for (let skuIndex = 0; skuIndex < skus.length; skuIndex++) {
        const sku = skus[skuIndex];
        const skuData = data.filter(d => d.sku === sku);
        
        setProgress({ currentSKU: sku, completedSKUs: skuIndex, totalSKUs });
        
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
      setProgress(null);
      console.log(`Batch optimization completed in ${((Date.now() - startTime) / 1000).toFixed(2)} seconds`);
    }
  }, [navigationAware, optimizationLogger]);

  const optimizeQueuedSKUs = useCallback(async (
    data: SalesData[],
    models: ModelConfig[],
    queuedSKUs: string[],
    onComplete: (sku: string, modelId: string, parameters: any, confidence: number, reasoning: string, factors: any, expectedAccuracy: number, method: string, bothResults?: any) => void,
    onSKUComplete: (sku: string) => void,
    getSKUsNeedingOptimization: (data: SalesData[], models: ModelConfig[]) => { sku: string; models: string[] }[]
  ) => {
    console.log('🚀 BATCH: Starting optimization for queued SKUs:', queuedSKUs);
    
    if (!queuedSKUs || queuedSKUs.length === 0) {
      console.log('🚀 BATCH: No SKUs to optimize');
      return;
    }

    const startTime = Date.now();
    setIsOptimizing(true);
    setProgress({ currentSKU: undefined, completedSKUs: 0, totalSKUs: queuedSKUs.length });

    try {
      for (let skuIndex = 0; skuIndex < queuedSKUs.length; skuIndex++) {
        const sku = queuedSKUs[skuIndex];
        const skuData = data.filter(d => d.sku === sku);
        
        console.log(`🚀 BATCH: Processing SKU ${sku} (${skuIndex + 1}/${queuedSKUs.length})`);
        setProgress({ currentSKU: sku, completedSKUs: skuIndex, totalSKUs: queuedSKUs.length });
        
        for (const model of models) {
          if (!model.enabled) continue;
          
          console.log(`🚀 BATCH: Optimizing ${sku}:${model.id}`);
          
          try {
            // Use progressive callback to cache results immediately as they become available
            const result = await optimizeSingleModel(
              model, 
              skuData, 
              sku, 
              {
                setProgress: () => {} // Not using progress updates here
              }, 
              false, // Don't force grid search
              undefined, // No business context
              (method, methodResult) => {
                // Progressive callback - cache results immediately
                console.log(`🚀 BATCH: Method ${method} complete for ${sku}:${model.id}`);
                onComplete(
                  sku,
                  model.id,
                  methodResult.parameters,
                  methodResult.confidence || 0,
                  methodResult.reasoning || '',
                  methodResult.factors || {},
                  methodResult.expectedAccuracy || 0,
                  methodResult.method || method,
                  // Don't pass bothResults here since this is progressive
                );
              }
            );

            console.log(`✅ BATCH: Completed ${sku}:${model.id} with method ${result.selectedResult.method}`);

            // Final completion callback with bothResults
            if (result.bothResults) {
              onComplete(
                sku,
                model.id,
                result.selectedResult.parameters,
                result.selectedResult.confidence || 0,
                result.selectedResult.reasoning || '',
                result.selectedResult.factors || {},
                result.selectedResult.expectedAccuracy || 0,
                result.selectedResult.method || 'unknown',
                result.bothResults
              );
            }

          } catch (error: any) {
            console.error(`❌ BATCH: Failed ${sku}:${model.id}:`, error);
          }
        }
        
        console.log(`✅ BATCH: SKU ${sku} complete`);
        onSKUComplete(sku);
      }
    } catch (error: any) {
      console.error('❌ BATCH: Batch optimization failed:', error);
    } finally {
      setIsOptimizing(false);
      setProgress(null);
      console.log(`🚀 BATCH: Completed in ${((Date.now() - startTime) / 1000).toFixed(2)} seconds`);
    }
  }, []);

  return {
    optimizationProgress,
    isOptimizing,
    progress,
    runOptimization,
    optimizeQueuedSKUs
  };
};
