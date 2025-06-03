
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { optimizeParametersWithGrok } from '@/utils/grokApiUtils';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';

const GROK_API_KEY = 'your-grok-api-key-here';

export const useParameterOptimization = () => {
  const [optimizationProgress, setOptimizationProgress] = useState<string>('');
  const { toast } = useToast();

  const optimizeModelParameters = async (
    model: ModelConfig, 
    skuData: SalesData[], 
    frequency: any
  ): Promise<Record<string, number> | undefined> => {
    if (!model.parameters || Object.keys(model.parameters).length === 0) {
      return model.parameters;
    }

    try {
      setOptimizationProgress(`Optimizing ${model.name} parameters with AI...`);
      
      const result = await optimizeParametersWithGrok({
        modelType: model.id,
        historicalData: skuData.map(d => d.sales),
        currentParameters: model.parameters,
        seasonalPeriod: frequency.seasonalPeriod,
        targetMetric: 'mape'
      }, GROK_API_KEY);

      return result.optimizedParameters;
    } catch (error) {
      console.error(`Failed to optimize ${model.name}:`, error);
      toast({
        title: "Optimization Warning",
        description: `Failed to optimize ${model.name}, using manual parameters`,
        variant: "destructive",
      });
      return model.parameters;
    } finally {
      setOptimizationProgress('');
    }
  };

  return {
    optimizeModelParameters,
    optimizationProgress,
    setOptimizationProgress
  };
};
