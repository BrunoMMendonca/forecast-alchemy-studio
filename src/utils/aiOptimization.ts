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
  isWinner: boolean;
}

export const isValidApiKey = (apiKey: string): boolean => {
  const isValid = apiKey && 
         apiKey.length > 20 && 
         !apiKey.includes('XXXXXXXX') && 
         !apiKey.startsWith('your-grok-api-key') &&
         !apiKey.includes('placeholder') &&
         apiKey.startsWith('xai-');
  
  if (!isValid) {
    console.warn('🔑 AI: API key validation failed - key appears invalid');
  }
  
  return isValid;
};

export const runAIOptimization = async (
  model: ModelConfig,
  skuData: SalesData[],
  sku: string,
  businessContext?: BusinessContext,
  gridBaseline?: { parameters: Record<string, number>; accuracy: number },
  grokApiEnabled: boolean = true
): Promise<OptimizationResult | null> => {
  if (!grokApiEnabled) {
    console.log('🔑 AI: Grok API disabled in global settings, skipping AI optimization');
    return null;
  }

  if (!isValidApiKey(GROK_API_KEY)) {
    console.warn('🔑 AI: Invalid API key, skipping AI optimization');
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

    console.log(`🤖 AI: Starting optimization for ${sku}: ${model.id}`);
    
    const grokResult = await optimizeParametersWithGrok({
      modelType: model.id,
      historicalData: skuData.map(d => d.sales),
      currentParameters: model.parameters,
      seasonalPeriod: frequency.seasonalPeriod,
      targetMetric: 'accuracy',
      businessContext: contextToUse
    }, GROK_API_KEY, gridBaseline);

    console.log(`✅ AI: Success for ${sku}: ${model.id}`);
    
    if (!grokResult) {
      return null;
    }

    return {
      parameters: grokResult.optimizedParameters,
      confidence: grokResult.confidence || 75,
      method: 'ai',
      accuracy: grokResult.expectedAccuracy || 75,
      reasoning: grokResult.reasoning,
      factors: grokResult.factors,
      expectedAccuracy: grokResult.expectedAccuracy,
      isWinner: true
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // More specific error handling
    if (errorMessage.includes('403')) {
      console.error(`❌ AI: API authentication failed for ${sku}: ${model.id} - Check API key validity and rate limits`);
    } else if (errorMessage.includes('429')) {
      console.error(`❌ AI: Rate limit exceeded for ${sku}: ${model.id} - Please wait before retrying`);
    } else if (errorMessage.includes('401')) {
      console.error(`❌ AI: Unauthorized access for ${sku}: ${model.id} - API key may be invalid`);
    } else {
      console.error(`❌ AI: Failed for ${sku}: ${model.id}: - `, errorMessage);
    }
    
    return null;
  }
};
