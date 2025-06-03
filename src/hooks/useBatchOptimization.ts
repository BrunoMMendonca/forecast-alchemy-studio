
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
      return model.parameters;
    }

    try {
      const frequency = detectDateFrequency(skuData.map(d => d.date));
      
      const result = await optimizeParametersWithGrok({
        modelType: model.id,
        historicalData: skuData.map(d => d.sales),
        currentParameters: model.parameters,
        seasonalPeriod: frequency.seasonalPeriod,
        targetMetric: 'mape'
      }, GROK_API_KEY);

      return result.optimizedParameters;
    } catch (error) {
      console.error(`Failed to optimize ${model.name} for ${sku}:`, error);
      return model.parameters;
    }
  };

  const optimizeAllSKUs = async (
    data: SalesData[],
    models: ModelConfig[],
    onParametersOptimized: (sku: string, modelId: string, parameters: Record<string, number>, confidence?: number) => void
  ) => {
    const skus = Array.from(new Set(data.map(d => d.sku))).sort();
    const enabledModels = models.filter(m => m.enabled && m.parameters && Object.keys(m.parameters).length > 0);
    
    if (skus.length === 0 || enabledModels.length === 0) return;

    setIsOptimizing(true);

    try {
      for (let i = 0; i < skus.length; i++) {
        const sku = skus[i];
        const skuData = data
          .filter(d => d.sku === sku)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (skuData.length < 3) continue;

        setProgress({
          currentSKU: sku,
          completedSKUs: i,
          totalSKUs: skus.length,
          currentModel: ''
        });

        for (const model of enabledModels) {
          setProgress(prev => prev ? { ...prev, currentModel: model.name } : null);

          const optimizedParams = await optimizeSingleModel(model, skuData, sku);
          if (optimizedParams) {
            onParametersOptimized(sku, model.id, optimizedParams, 85);
          }
        }
      }

      toast({
        title: "Optimization Complete",
        description: `Optimized parameters for ${skus.length} products across ${enabledModels.length} models`,
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
