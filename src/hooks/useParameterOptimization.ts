import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { optimizeParametersWithGrok } from '@/utils/grokApiUtils';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/types/sales';

// Replace with your actual Grok API key from X.AI
const GROK_API_KEY = 'xai-003DWefvygdxNiCFZlEUAvBIBHCiW4wPmJSOzet8xcOKqJq2nYMwbImiRqfgkoNoYP1sLCPOKPTC4HDf';

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

    // Check if API key is valid (not a placeholder or empty)
    if (!GROK_API_KEY || GROK_API_KEY.includes('XXXXXXXX') || GROK_API_KEY.startsWith('your-grok-api-key')) {
      console.warn('Using placeholder Grok API key, skipping optimization');
      return model.parameters;
    }

    try {
      setOptimizationProgress(`Optimizing ${model.name} parameters with enhanced AI approach...`);
      
      const result = await optimizeParametersWithGrok({
        modelType: model.id,
        historicalData: skuData.map(d => d.sales),
        currentParameters: model.parameters,
        seasonalPeriod: frequency.seasonalPeriod,
        targetMetric: 'accuracy' // Changed from 'mape' to 'accuracy' for metric alignment
      }, GROK_API_KEY);

      console.log(`🎯 Enhanced optimization completed for ${model.name}:`);
      console.log(`📊 Expected accuracy: ${result.expectedAccuracy}%`);
      console.log(`🔧 Optimized parameters:`, result.optimizedParameters);
      console.log(`💭 AI reasoning:`, result.reasoning);

      return result.optimizedParameters;
    } catch (error) {
      console.error(`Failed to optimize ${model.name}:`, error);
      toast({
        title: "Optimization Warning",
        description: `Failed to optimize ${model.name} with enhanced approach, using manual parameters`,
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
