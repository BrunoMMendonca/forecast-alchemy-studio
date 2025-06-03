
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { optimizeParametersWithGrok } from '@/utils/grokApiUtils';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';

// Replace with your actual Grok API key from X.AI
const GROK_API_KEY = 'grok-beta-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

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

    // Check if API key is still placeholder
    if (GROK_API_KEY === 'grok-beta-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' || GROK_API_KEY.startsWith('your-grok-api-key')) {
      console.warn('Using placeholder Grok API key, skipping optimization');
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
