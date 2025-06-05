import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { optimizationLogger } from '@/utils/optimizationLogger';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { BatchOptimizationProgress } from '@/types/batchOptimization';
import { optimizeSingleModel } from '@/utils/singleModelOptimization';

export const useBatchOptimization = () => {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState<BatchOptimizationProgress | null>(null);
  const [optimizationCompleted, setOptimizationCompleted] = useState(false);
  const { toast } = useToast();

  const optimizeQueuedSKUs = async (
    data: SalesData[],
    models: ModelConfig[],
    queuedSKUs: string[],
    onParametersOptimized: (
      sku: string, 
      modelId: string, 
      parameters: Record<string, number>, 
      confidence?: number,
      reasoning?: string,
      factors?: {
        stability: number;
        interpretability: number;
        complexity: number;
        businessImpact: string;
      },
      expectedAccuracy?: number,
      method?: string
    ) => void,
    onSKUCompleted: (sku: string) => void,
    getSKUsNeedingOptimization: (data: SalesData[], models: ModelConfig[]) => { sku: string; models: string[] }[]
  ) => {
    if (queuedSKUs.length === 0) {
      console.log('📋 MULTI-QUEUE: No SKUs in queue for optimization');
      toast({
        title: "No Optimization Needed",
        description: "No SKUs are queued for optimization",
      });
      return;
    }

    const currentSKUs = Array.from(new Set(data.map(d => d.sku)));
    const validQueuedSKUs = queuedSKUs.filter(sku => currentSKUs.includes(sku));
    
    if (validQueuedSKUs.length < queuedSKUs.length) {
      const invalidSKUs = queuedSKUs.filter(sku => !currentSKUs.includes(sku));
      console.warn('📋 MULTI-QUEUE: Removing invalid SKUs from queue:', invalidSKUs);
      invalidSKUs.forEach(sku => onSKUCompleted(sku));
    }

    if (validQueuedSKUs.length === 0) {
      console.log('📋 MULTI-QUEUE: No valid SKUs found in queue after validation');
      toast({
        title: "No Valid SKUs",
        description: "All queued SKUs are no longer present in the current data",
      });
      return;
    }

    const skusNeedingOptimization = getSKUsNeedingOptimization(data, models);
    const skusToOptimize = skusNeedingOptimization.filter(({ sku }) => validQueuedSKUs.includes(sku));
    
    if (skusToOptimize.length === 0) {
      console.log('📋 MULTI-QUEUE: All valid queued SKUs already have optimized parameters');
      validQueuedSKUs.forEach(sku => onSKUCompleted(sku));
      toast({
        title: "Optimization Complete",
        description: "All valid queued SKUs are already optimized",
      });
      return;
    }

    const totalSKUs = skusToOptimize.length;
    let optimizedCount = 0;
    let skippedCount = 0;
    let aiOptimizedCount = 0;
    let gridOptimizedCount = 0;
    let aiRejectedCount = 0;
    let aiAcceptedByToleranceCount = 0;
    let aiAcceptedByConfidenceCount = 0;

    setIsOptimizing(true);
    setOptimizationCompleted(false);
    
    optimizationLogger.startSession(totalSKUs);

    console.log(`📋 MULTI-QUEUE: Starting dual optimization (AI + Grid) for ${totalSKUs} valid queued SKUs`, skusToOptimize.map(s => s.sku));

    try {
      for (let i = 0; i < skusToOptimize.length; i++) {
        const { sku, models: modelsToOptimize } = skusToOptimize[i];
        const skuData = data
          .filter(d => d.sku === sku)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        setProgress({
          currentSKU: sku,
          completedSKUs: i,
          totalSKUs,
          currentModel: '',
          skipped: skippedCount,
          optimized: optimizedCount,
          aiOptimized: aiOptimizedCount,
          gridOptimized: gridOptimizedCount,
          aiRejected: aiRejectedCount,
          aiAcceptedByTolerance: aiAcceptedByToleranceCount,
          aiAcceptedByConfidence: aiAcceptedByConfidenceCount
        });

        console.log(`📋 MULTI-QUEUE: Optimizing SKU ${i + 1}/${totalSKUs}: ${sku}`);

        for (const modelId of modelsToOptimize) {
          const model = models.find(m => m.id === modelId);
          if (!model) continue;

          setProgress(prev => prev ? { ...prev, currentModel: model.name } : null);

          // Run optimization (which now does both AI and Grid)
          const result = await optimizeSingleModel(model, skuData, sku, { setProgress });
          
          if (result) {
            // Store the primary result (AI preferred)
            onParametersOptimized(
              sku, 
              model.id, 
              result.parameters, 
              result.confidence,
              result.reasoning,
              result.factors,
              result.expectedAccuracy,
              result.method
            );
            optimizedCount++;
            
            // Update counters based on method
            if (result.method?.startsWith('ai_')) {
              aiOptimizedCount++;
              if (result.method === 'ai_confidence') {
                aiAcceptedByConfidenceCount++;
              } else if (result.method === 'ai_tolerance') {
                aiAcceptedByToleranceCount++;
              }
            } else if (result.method === 'grid_search') {
              gridOptimizedCount++;
            }

            // Note: Both AI and Grid results are now automatically stored in cache
            // by the updated optimization function
          } else {
            skippedCount++;
          }
        }

        console.log(`📋 MULTI-QUEUE: Completed dual optimization for SKU: ${sku}`);
        onSKUCompleted(sku);
      }

      const aiAcceptanceRate = aiOptimizedCount > 0 ? 
        ((aiOptimizedCount / (aiOptimizedCount + aiRejectedCount)) * 100).toFixed(1) : '0';

      const successMessage = `Dual Optimization Complete! AI: ${aiOptimizedCount} (${aiAcceptanceRate}% accepted), Grid: ${gridOptimizedCount}, Rejected: ${aiRejectedCount}`;

      toast({
        title: "Dual Optimization Complete",
        description: successMessage,
      });

      setProgress({
        currentSKU: '',
        completedSKUs: totalSKUs,
        totalSKUs,
        currentModel: '',
        skipped: skippedCount,
        optimized: optimizedCount,
        aiOptimized: aiOptimizedCount,
        gridOptimized: gridOptimizedCount,
        aiRejected: aiRejectedCount,
        aiAcceptedByTolerance: aiAcceptedByToleranceCount,
        aiAcceptedByConfidence: aiAcceptedByConfidenceCount
      });

      setOptimizationCompleted(true);

    } catch (error) {
      toast({
        title: "Optimization Error",
        description: "Failed to complete dual optimization",
        variant: "destructive",
      });
      console.error('Dual optimization error:', error);
    } finally {
      setIsOptimizing(false);
      optimizationLogger.endSession();
    }
  };

  const optimizeAllSKUs = async (
    data: SalesData[],
    models: ModelConfig[],
    onParametersOptimized: (
      sku: string, 
      modelId: string, 
      parameters: Record<string, number>, 
      confidence?: number,
      reasoning?: string,
      factors?: {
        stability: number;
        interpretability: number;
        complexity: number;
        businessImpact: string;
      },
      expectedAccuracy?: number,
      method?: string
    ) => void,
    getSKUsNeedingOptimization: (data: SalesData[], models: ModelConfig[]) => { sku: string; models: string[] }[]
  ) => {
    const skusToOptimize = getSKUsNeedingOptimization(data, models);
    return optimizeQueuedSKUs(
      data,
      models,
      skusToOptimize.map(s => s.sku),
      onParametersOptimized,
      () => {},
      getSKUsNeedingOptimization
    );
  };

  const clearProgress = () => {
    setProgress(null);
    setOptimizationCompleted(false);
  };

  return {
    isOptimizing,
    progress,
    optimizationCompleted,
    optimizeAllSKUs,
    optimizeQueuedSKUs,
    optimizeSingleModel: (model: ModelConfig, skuData: SalesData[], sku: string) => 
      optimizeSingleModel(model, skuData, sku, { setProgress }),
    clearProgress
  };
};
