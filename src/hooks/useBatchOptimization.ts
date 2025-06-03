
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

  const optimizeAllSKUs = async (
    data: SalesData[],
    models: ModelConfig[],
    onParametersOptimized: (sku: string, modelId: string, parameters: Record<string, number>, confidence?: number) => void,
    getSKUsNeedingOptimization: (data: SalesData[], models: ModelConfig[]) => { sku: string; models: string[] }[]
  ) => {
    const skusToOptimize = getSKUsNeedingOptimization(data, models);
    
    if (skusToOptimize.length === 0) {
      console.log('No SKUs need optimization - all parameters are cached');
      toast({
        title: "Optimization Skipped",
        description: "All parameters are already optimized and cached",
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
    
    // Start logging session
    optimizationLogger.startSession(totalSKUs);

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

        for (const modelId of modelsToOptimize) {
          const model = models.find(m => m.id === modelId);
          if (!model) continue;

          setProgress(prev => prev ? { ...prev, currentModel: model.name } : null);

          const result = await optimizeSingleModel(model, skuData, sku, { setProgress });
          if (result) {
            onParametersOptimized(sku, model.id, result.parameters, result.confidence);
            optimizedCount++;
            
            // Update counters based on method
            if (result.method.startsWith('ai_')) {
              aiOptimizedCount++;
              if (result.method === 'ai_confidence') {
                aiAcceptedByConfidenceCount++;
              } else if (result.method === 'ai_tolerance') {
                aiAcceptedByToleranceCount++;
              }
            } else if (result.method === 'grid_search') {
              gridOptimizedCount++;
            }
          } else {
            skippedCount++;
          }
        }
      }

      const aiAcceptanceRate = aiOptimizedCount > 0 ? 
        ((aiOptimizedCount / (aiOptimizedCount + aiRejectedCount)) * 100).toFixed(1) : '0';

      const successMessage = `Enhanced Optimization Complete! AI: ${aiOptimizedCount} (${aiAcceptanceRate}% accepted), Grid: ${gridOptimizedCount}, Rejected: ${aiRejectedCount}`;

      toast({
        title: "Enhanced Optimization Complete",
        description: successMessage,
      });

      // Update final progress state
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
        description: "Failed to complete enhanced batch optimization",
        variant: "destructive",
      });
      console.error('Enhanced batch optimization error:', error);
    } finally {
      setIsOptimizing(false);
      // DON'T clear progress here - let it stay visible with final results
      optimizationLogger.endSession();
    }
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
    optimizeSingleModel: (model: ModelConfig, skuData: SalesData[], sku: string) => 
      optimizeSingleModel(model, skuData, sku, { setProgress }),
    clearProgress
  };
};
