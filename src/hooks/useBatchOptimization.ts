
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { optimizeParametersWithGrok } from '@/utils/grokApiUtils';
import { gridSearchOptimization, validateOptimizedParameters } from '@/utils/localOptimization';
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
      console.log(`❌ ${sku}:${model.id} - No parameters to optimize`);
      return { parameters: model.parameters, confidence: 70, method: 'default' };
    }

    console.log(`🚀 Starting optimization for ${sku}:${model.id}`);
    
    let aiResult = null;
    let gridResult = null;
    let finalResult = null;

    // Step 1: Try AI optimization (if API key available)
    if (GROK_API_KEY && !GROK_API_KEY.includes('XXXXXXXX') && !GROK_API_KEY.startsWith('your-grok-api-key')) {
      try {
        console.log(`🤖 Attempting AI optimization for ${sku}:${model.id}`);
        const frequency = detectDateFrequency(skuData.map(d => d.date));
        
        const result = await optimizeParametersWithGrok({
          modelType: model.id,
          historicalData: skuData.map(d => d.sales),
          currentParameters: model.parameters,
          seasonalPeriod: frequency.seasonalPeriod,
          targetMetric: 'mape'
        }, GROK_API_KEY);

        // Step 2: Validate AI optimization
        const validationResult = validateOptimizedParameters(
          model.id,
          skuData,
          model.parameters,
          result.optimizedParameters
        );

        if (validationResult) {
          console.log(`✅ AI optimization validated for ${sku}:${model.id}`);
          aiResult = {
            parameters: validationResult.parameters,
            confidence: validationResult.confidence,
            method: 'ai_validated'
          };
        } else {
          console.log(`❌ AI optimization rejected for ${sku}:${model.id} - not better than baseline`);
          // Track AI rejection for progress
          setProgress(prev => prev ? { ...prev, aiRejected: prev.aiRejected + 1 } : null);
        }
      } catch (error) {
        console.error(`❌ AI optimization failed for ${sku}:${model.id}:`, error);
      }
    }

    // Step 3: Try grid search if AI failed or was rejected
    if (!aiResult) {
      console.log(`🔍 Falling back to grid search for ${sku}:${model.id}`);
      const gridSearchResult = gridSearchOptimization(model.id, skuData);
      
      if (gridSearchResult) {
        console.log(`✅ Grid search completed for ${sku}:${model.id}`);
        gridResult = {
          parameters: gridSearchResult.parameters,
          confidence: gridSearchResult.confidence,
          method: 'grid_search'
        };
      } else {
        console.log(`❌ Grid search failed for ${sku}:${model.id}`);
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
      // Fallback to original parameters
      console.log(`⚠️ All optimization methods failed for ${sku}:${model.id}, using original parameters`);
      finalResult = {
        parameters: model.parameters,
        confidence: 60,
        method: 'fallback'
      };
    }

    console.log(`🎯 Final result for ${sku}:${model.id}: ${finalResult.method} with confidence ${finalResult.confidence}%`);
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
    console.log(`🚀 Starting enhanced batch optimization for ${totalSKUs} SKUs`);

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
      console.log(`✅ ${successMessage}`);

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
    }
  };

  return {
    isOptimizing,
    progress,
    optimizeAllSKUs,
    optimizeSingleModel
  };
};
