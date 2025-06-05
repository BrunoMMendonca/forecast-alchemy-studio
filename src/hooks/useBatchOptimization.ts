
import { useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { SalesData } from '@/pages/Index';
import { ModelConfig } from '@/types/forecast';
import { optimizationLogger } from '@/utils/optimizationLogger';
import { optimizeModelForSKU } from '@/utils/singleModelOptimization';

interface OptimizationProgress {
  currentSKU: string;
  completedSKUs: number;
  totalSKUs: number;
  currentModel: string;
  isComplete: boolean;
}

export const useBatchOptimization = () => {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState<OptimizationProgress | null>(null);
  const [optimizationCompleted, setOptimizationCompleted] = useState(false);
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  const clearProgress = () => {
    setProgress(null);
    setOptimizationCompleted(false);
  };

  const optimizeQueuedSKUs = async (
    data: SalesData[],
    models: ModelConfig[],
    queuedSKUs: string[],
    onModelOptimized: (
      sku: string, 
      modelId: string, 
      parameters: Record<string, number>, 
      confidence?: number, 
      reasoning?: string, 
      factors?: Record<string, any>, 
      expectedAccuracy?: number,
      method?: string
    ) => void,
    onSKUCompleted: (sku: string) => void,
    getSKUsNeedingOptimization: (data: SalesData[], models: ModelConfig[]) => { sku: string; models: string[] }[]
  ) => {
    if (isOptimizing) {
      console.log('⚠️ BATCH: Optimization already in progress, skipping');
      return;
    }

    setIsOptimizing(true);
    setOptimizationCompleted(false);
    abortControllerRef.current = new AbortController();

    console.log(`🚀 BATCH: Starting optimization for ${queuedSKUs.length} SKUs`);
    optimizationLogger.logBatchStart(queuedSKUs);

    let aiOptimizedCount = 0;
    let gridOptimizedCount = 0;
    let rejectedCount = 0;

    try {
      // Get the actual SKUs and models that need optimization
      const skusNeedingOptimization = getSKUsNeedingOptimization(data, models);
      console.log('🔍 BATCH: SKUs needing optimization:', skusNeedingOptimization);

      // Filter to only process queued SKUs that actually need optimization
      const skusToProcess = skusNeedingOptimization.filter(item => 
        queuedSKUs.includes(item.sku)
      );

      console.log(`🎯 BATCH: Processing ${skusToProcess.length} SKUs that need optimization:`, skusToProcess);

      for (let i = 0; i < skusToProcess.length; i++) {
        if (abortControllerRef.current?.signal.aborted) {
          console.log('🛑 BATCH: Optimization aborted');
          break;
        }

        const { sku, models: modelIds } = skusToProcess[i];
        console.log(`🎯 BATCH: Processing SKU ${i + 1}/${skusToProcess.length}: ${sku} with models:`, modelIds);
        
        setProgress({
          currentSKU: sku,
          completedSKUs: i,
          totalSKUs: skusToProcess.length,
          currentModel: '',
          isComplete: false
        });

        const skuData = data.filter(d => d.sku === sku);

        for (const modelId of modelIds) {
          if (abortControllerRef.current?.signal.aborted) break;

          const model = models.find(m => m.id === modelId);
          if (!model) {
            console.warn(`⚠️ BATCH: Model ${modelId} not found in models list`);
            continue;
          }

          console.log(`🔧 BATCH: Optimizing ${sku}:${modelId}`);
          
          setProgress(prev => prev ? { ...prev, currentModel: modelId } : null);

          try {
            const result = await optimizeModelForSKU(sku, skuData, model);
            
            if (result.success && result.optimizedParameters) {
              console.log(`✅ BATCH: ${sku}:${modelId} optimization successful with method: ${result.method}`);
              
              // Track optimization method
              if (result.method?.startsWith('ai_')) {
                aiOptimizedCount++;
              } else if (result.method === 'grid_search') {
                gridOptimizedCount++;
              } else {
                rejectedCount++;
              }

              onModelOptimized(
                sku, 
                modelId, 
                result.optimizedParameters, 
                result.confidence, 
                result.reasoning, 
                result.factors, 
                result.expectedAccuracy,
                result.method
              );
            } else {
              console.warn(`⚠️ BATCH: ${sku}:${modelId} optimization failed:`, result.error);
              rejectedCount++;
            }
          } catch (error) {
            console.error(`❌ BATCH: Error optimizing ${sku}:${modelId}:`, error);
            rejectedCount++;
          }
        }

        // Mark SKU as completed
        onSKUCompleted(sku);
        optimizationLogger.logSKUComplete(sku);
      }

      setProgress(prev => prev ? { ...prev, isComplete: true } : null);
      setOptimizationCompleted(true);
      
      console.log(`🏁 BATCH: Optimization complete! AI: ${aiOptimizedCount}, Grid: ${gridOptimizedCount}, Rejected: ${rejectedCount}`);
      optimizationLogger.logBatchComplete(aiOptimizedCount + gridOptimizedCount + rejectedCount);

      // Removed the toast notification that was showing the popup

    } catch (error) {
      console.error('❌ BATCH: Optimization failed:', error);
      toast({
        title: "Optimization Failed",
        description: "An error occurred during batch optimization. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsOptimizing(false);
      abortControllerRef.current = null;
      
      setTimeout(() => {
        clearProgress();
      }, 2000);
    }
  };

  const abortOptimization = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsOptimizing(false);
      toast({
        title: "Optimization Aborted",
        description: "Batch optimization has been stopped.",
        variant: "default",
      });
    }
  };

  return {
    isOptimizing,
    progress,
    optimizationCompleted,
    optimizeQueuedSKUs,
    abortOptimization,
    clearProgress
  };
};
