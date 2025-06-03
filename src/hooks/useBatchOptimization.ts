
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { optimizeParametersWithGrok } from '@/utils/grokApiUtils';
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
}

export const useBatchOptimization = () => {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState<BatchOptimizationProgress | null>(null);
  const { toast } = useToast();

  const optimizeSingleModel = async (
    model: ModelConfig,
    skuData: SalesData[],
    sku: string
  ): Promise<Record<string, number> | undefined> => {
    if (!model.parameters || Object.keys(model.parameters).length === 0) {
      return model.parameters;
    }

    if (!GROK_API_KEY || GROK_API_KEY.includes('XXXXXXXX') || GROK_API_KEY.startsWith('your-grok-api-key')) {
      console.log(`Skipping optimization for ${sku}:${model.id} - no valid API key`);
      return model.parameters;
    }

    try {
      console.log(`Starting API optimization for ${sku}:${model.id}`);
      const frequency = detectDateFrequency(skuData.map(d => d.date));
      
      const result = await optimizeParametersWithGrok({
        modelType: model.id,
        historicalData: skuData.map(d => d.sales),
        currentParameters: model.parameters,
        seasonalPeriod: frequency.seasonalPeriod,
        targetMetric: 'mape'
      }, GROK_API_KEY);

      console.log(`API optimization completed for ${sku}:${model.id}`);
      return result.optimizedParameters;
    } catch (error) {
      console.error(`Failed to optimize ${model.name} for ${sku}:`, error);
      return model.parameters;
    }
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

    setIsOptimizing(true);
    console.log(`Starting batch optimization for ${totalSKUs} SKUs`);

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
          optimized: optimizedCount
        });

        for (const modelId of modelsToOptimize) {
          const model = models.find(m => m.id === modelId);
          if (!model) continue;

          setProgress(prev => prev ? { ...prev, currentModel: model.name } : null);

          const optimizedParams = await optimizeSingleModel(model, skuData, sku);
          if (optimizedParams) {
            onParametersOptimized(sku, model.id, optimizedParams, 85);
            optimizedCount++;
          } else {
            skippedCount++;
          }
        }
      }

      toast({
        title: "Optimization Complete",
        description: `Optimized ${optimizedCount} parameters across ${totalSKUs} products (${skippedCount} skipped from cache)`,
      });

    } catch (error) {
      toast({
        title: "Optimization Error",
        description: "Failed to complete batch optimization",
        variant: "destructive",
      });
      console.error('Batch optimization error:', error);
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
