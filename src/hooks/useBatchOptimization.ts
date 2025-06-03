
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { optimizeParametersWithGrok } from '@/utils/grokApiUtils';
import { gridSearchOptimization, validateOptimizedParameters } from '@/utils/localOptimization';
import { optimizationLogger } from '@/utils/optimizationLogger';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { detectDateFrequency } from '@/utils/dateUtils';

const GROK_API_KEY = 'xai-003DWefvygdxNiCFZlEUAvBIBHCiW4wPmJSOzet8xcOKqJq2nYMwbImiRqfgkoNoYP1sLCPOKPTC4HDf';

interface BatchOptimizationProgress {
  currentSKU: string;
  completedSKUs: number;
  totalSKUs: number;
  currentModel: string;
  skipped: number;
  optimized: number;
  aiOptimized: number;
  gridOptimized: number;
  aiRejected: number;
}

export const useBatchOptimization = () => {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState<BatchOptimizationProgress | null>(null);
  const { toast } = useToast();

  const optimizeSingleModel = async (
    model: ModelConfig,
    skuData: SalesData[],
    sku: string
  ): Promise<{ parameters: Record<string, number>; confidence: number; method: string } | undefined> => {
    if (!model.parameters || Object.keys(model.parameters).length === 0) {
      optimizationLogger.logStep({
        sku,
        modelId: model.id,
        step: 'complete',
        message: 'No parameters to optimize - using defaults',
        parameters: model.parameters
      });
      return { parameters: model.parameters, confidence: 70, method: 'default' };
    }

    optimizationLogger.logStep({
      sku,
      modelId: model.id,
      step: 'start',
      message: 'Starting optimization process',
      parameters: model.parameters
    });
    
    let aiResult = null;
    let gridResult = null;
    let finalResult = null;

    // Step 1: Try AI optimization (if API key available)
    if (GROK_API_KEY && !GROK_API_KEY.includes('XXXXXXXX') && !GROK_API_KEY.startsWith('your-grok-api-key')) {
      try {
        optimizationLogger.logStep({
          sku,
          modelId: model.id,
          step: 'ai_attempt',
          message: 'Attempting AI optimization with Grok'
        });

        const frequency = detectDateFrequency(skuData.map(d => d.date));
        
        const result = await optimizeParametersWithGrok({
          modelType: model.id,
          historicalData: skuData.map(d => d.sales),
          currentParameters: model.parameters,
          seasonalPeriod: frequency.seasonalPeriod,
          targetMetric: 'mape'
        }, GROK_API_KEY);

        optimizationLogger.logStep({
          sku,
          modelId: model.id,
          step: 'validation',
          message: 'Validating AI-optimized parameters',
          parameters: result.optimizedParameters
        });

        // Step 2: Validate AI optimization
        const validationResult = validateOptimizedParameters(
          model.id,
          skuData,
          model.parameters,
          result.optimizedParameters
        );

        if (validationResult) {
          optimizationLogger.logStep({
            sku,
            modelId: model.id,
            step: 'ai_success',
            message: 'AI optimization validated and approved',
            parameters: validationResult.parameters,
            accuracy: validationResult.accuracy,
            confidence: validationResult.confidence
          });

          aiResult = {
            parameters: validationResult.parameters,
            confidence: validationResult.confidence,
            method: 'ai_validated'
          };
        } else {
          optimizationLogger.logStep({
            sku,
            modelId: model.id,
            step: 'ai_rejected',
            message: 'AI optimization rejected - no improvement over baseline'
          });
          setProgress(prev => prev ? { ...prev, aiRejected: prev.aiRejected + 1 } : null);
        }
      } catch (error) {
        optimizationLogger.logStep({
          sku,
          modelId: model.id,
          step: 'error',
          message: 'AI optimization failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Step 3: Try grid search if AI failed or was rejected
    if (!aiResult) {
      optimizationLogger.logStep({
        sku,
        modelId: model.id,
        step: 'grid_search',
        message: 'Starting grid search optimization'
      });

      const gridSearchResult = gridSearchOptimization(model.id, skuData);
      
      if (gridSearchResult) {
        optimizationLogger.logStep({
          sku,
          modelId: model.id,
          step: 'complete',
          message: 'Grid search optimization completed',
          parameters: gridSearchResult.parameters,
          accuracy: gridSearchResult.accuracy,
          confidence: gridSearchResult.confidence
        });

        gridResult = {
          parameters: gridSearchResult.parameters,
          confidence: gridSearchResult.confidence,
          method: 'grid_search'
        };
      } else {
        optimizationLogger.logStep({
          sku,
          modelId: model.id,
          step: 'error',
          message: 'Grid search optimization failed'
        });
      }
    }

    // Step 4: Choose the best result
    if (aiResult) {
      finalResult = aiResult;
      setProgress(prev => prev ? { ...prev, aiOptimized: prev.aiOptimized + 1 } : null);
    } else if (gridResult) {
      finalResult = gridResult;
      setProgress(prev => prev ? { ...prev, gridOptimized: prev.gridOptimized + 1 } : null);
    } else {
      optimizationLogger.logStep({
        sku,
        modelId: model.id,
        step: 'complete',
        message: 'All optimization methods failed - using original parameters',
        parameters: model.parameters,
        confidence: 60
      });

      finalResult = {
        parameters: model.parameters,
        confidence: 60,
        method: 'fallback'
      };
    }

    return finalResult;
  };

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

    setIsOptimizing(true);
    
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
          aiRejected: aiRejectedCount
        });

        for (const modelId of modelsToOptimize) {
          const model = models.find(m => m.id === modelId);
          if (!model) continue;

          setProgress(prev => prev ? { ...prev, currentModel: model.name } : null);

          const result = await optimizeSingleModel(model, skuData, sku);
          if (result) {
            onParametersOptimized(sku, model.id, result.parameters, result.confidence);
            optimizedCount++;
            
            // Update counters based on method
            if (result.method === 'ai_validated') {
              aiOptimizedCount++;
            } else if (result.method === 'grid_search') {
              gridOptimizedCount++;
            }
          } else {
            skippedCount++;
          }
        }
      }

      const successMessage = `Optimization Complete! AI: ${aiOptimizedCount}, Grid: ${gridOptimizedCount}, Rejected: ${aiRejectedCount}`;

      toast({
        title: "Enhanced Optimization Complete",
        description: successMessage,
      });

    } catch (error) {
      toast({
        title: "Optimization Error",
        description: "Failed to complete enhanced batch optimization",
        variant: "destructive",
      });
      console.error('Enhanced batch optimization error:', error);
    } finally {
      setIsOptimizing(false);
      setProgress(null);
      optimizationLogger.endSession();
    }
  };

  return {
    isOptimizing,
    progress,
    optimizeAllSKUs,
    optimizeSingleModel
  };
};
