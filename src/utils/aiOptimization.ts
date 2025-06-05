
import { optimizeParametersWithGrok } from '@/utils/grokApiUtils';
import { detectDateFrequency } from '@/utils/dateUtils';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { BusinessContext } from '@/types/businessContext';

const GROK_API_KEY = 'xai-003DWefvygdxNiCFZlEUAvBIBHCiW4wPmJSOzet8xcOKqJq2nYMwbImiRqfgkoNoYP1sLCPOKPTC4HDf';

export interface OptimizationResult {
  parameters: Record<string, number>;
  confidence: number;
  method: string;
  accuracy: number;
  reasoning?: string;
  factors?: {
    stability: number;
    interpretability: number;
    complexity: number;
    businessImpact: string;
  };
  expectedAccuracy?: number;
}

export const isValidApiKey = (apiKey: string): boolean => {
  const isValid = apiKey && 
         apiKey.length > 20 && 
         !apiKey.includes('XXXXXXXX') && 
         !apiKey.startsWith('your-grok-api-key') &&
         !apiKey.includes('placeholder') &&
         apiKey.startsWith('xai-');
  
  return isValid;
};

export const runAIOptimization = async (
  model: ModelConfig,
  skuData: SalesData[],
  sku: string,
  businessContext?: BusinessContext,
  gridContext?: { parameters: Record<string, number>; accuracy: number }
): Promise<OptimizationResult | null> => {
  if (!isValidApiKey(GROK_API_KEY)) {
    return null;
  }

  try {
    const frequency = detectDateFrequency(skuData.map(d => d.date));
    
    const contextToUse = businessContext || {
      costOfError: 'medium' as const,
      planningPurpose: 'tactical' as const,
      updateFrequency: 'weekly' as const,
      interpretabilityNeeds: 'medium' as const
    };

    const grokResult = await optimizeParametersWithGrok({
      modelType: model.id,
      historicalData: skuData.map(d => d.sales),
      currentParameters: model.parameters,
      seasonalPeriod: frequency.seasonalPeriod,
      targetMetric: 'accuracy',
      businessContext: contextToUse
    }, GROK_API_KEY, gridContext);

    return {
      parameters: grokResult.optimizedParameters,
      confidence: grokResult.confidence || 75,
      method: 'ai',
      accuracy: grokResult.expectedAccuracy || 75,
      reasoning: grokResult.reasoning,
      factors: grokResult.factors,
      expectedAccuracy: grokResult.expectedAccuracy
    };

  } catch (error) {
    return null;
  }
};
