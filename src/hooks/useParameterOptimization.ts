
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { optimizeParametersWithGrok } from '@/utils/grokApiUtils';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';

const GROK_API_KEY = 'xai-003DWefvygdxNiCFZlEUAvBIBHCiW4wPmJSOzet8xcOKqJq2nYMwbImiRqfgkoNoYP1sLCPOKPTC4HDf';

const isValidApiKey = (apiKey: string): boolean => {
  const isValid = apiKey && 
         apiKey.length > 20 && 
         !apiKey.includes('XXXXXXXX') && 
         !apiKey.startsWith('your-grok-api-key') &&
         !apiKey.includes('placeholder') &&
         apiKey.startsWith('xai-');
  
  console.log(`🔑 useParameterOptimization API Key validation: ${isValid ? 'VALID' : 'INVALID'}`);
  return isValid;
};

export const useParameterOptimization = () => {
  const [optimizationProgress, setOptimizationProgress] = useState<string>('');
  const { toast } = useToast();

  const optimizeModelParameters = async (
    model: ModelConfig, 
    skuData: SalesData[], 
    frequency: any
  ): Promise<Record<string, number> | undefined> => {
    if (!model.parameters || Object.keys(model.parameters).length === 0) {
      console.log(`⚠️ useParameterOptimization: No parameters for ${model.name}`);
      return model.parameters;
    }

    if (!isValidApiKey(GROK_API_KEY)) {
      console.warn('❌ useParameterOptimization: Invalid Grok API key, skipping optimization');
      toast({
        title: "AI Optimization Unavailable",
        description: "AI optimization is not available due to invalid API key. Using manual parameters.",
        variant: "destructive",
      });
      return model.parameters;
    }

    try {
      console.log(`🤖 useParameterOptimization: Starting AI optimization for ${model.name}`);
      setOptimizationProgress(`Optimizing ${model.name} parameters with enhanced AI approach...`);
      
      const result = await optimizeParametersWithGrok({
        modelType: model.id,
        historicalData: skuData.map(d => d.sales),
        currentParameters: model.parameters,
        seasonalPeriod: frequency.seasonalPeriod,
        targetMetric: 'accuracy'
      }, GROK_API_KEY);

      console.log(`🎯 useParameterOptimization: Enhanced optimization completed for ${model.name}:`);
      console.log(`📊 Expected accuracy: ${result.expectedAccuracy}%`);
      console.log(`🔧 Optimized parameters:`, result.optimizedParameters);
      console.log(`💭 AI reasoning:`, result.reasoning);

      toast({
        title: "AI Optimization Complete",
        description: `${model.name} optimized with ${result.expectedAccuracy?.toFixed(1)}% expected accuracy`,
      });

      return result.optimizedParameters;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`❌ useParameterOptimization: Failed to optimize ${model.name}:`, error);
      
      // Provide user-friendly error messages based on error type
      let userMessage = `Failed to optimize ${model.name} with AI.`;
      
      if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        userMessage = `AI service access denied. Please check your subscription or try again later.`;
      } else if (errorMessage.includes('429') || errorMessage.includes('Rate limit')) {
        userMessage = `AI service rate limit exceeded. Please wait a moment before trying again.`;
      } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        userMessage = `AI service authentication failed. API key may be invalid.`;
      } else if (errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503')) {
        userMessage = `AI service is temporarily unavailable. Please try again later.`;
      }
      
      toast({
        title: "AI Optimization Failed",
        description: userMessage,
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
