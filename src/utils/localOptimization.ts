import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/types/sales';
import { adaptiveGridSearchOptimization, enhancedParameterValidation } from '@/utils/adaptiveOptimization';
import { ENHANCED_VALIDATION_CONFIG, ValidationConfig } from '@/utils/enhancedValidation';

interface OptimizationResult {
  parameters: Record<string, number>;
  accuracy: number;
  confidence: number;
  method: 'grid_search' | 'validation' | 'ai_high_confidence' | 'ai_optimal' | 'adaptive_grid';
}

// Export the enhanced grid search as the main grid search function
export const gridSearchOptimization = (
  modelId: string,
  data: SalesData[],
  config: ValidationConfig = ENHANCED_VALIDATION_CONFIG
): OptimizationResult | null => {
  console.log(`🔍 Starting enhanced grid search optimization for ${modelId}`);
  
  const result = adaptiveGridSearchOptimization(modelId, data, undefined, config);
  
  if (!result) {
    return null;
  }
  
  return {
    parameters: result.parameters,
    accuracy: result.accuracy,
    confidence: result.confidence,
    method: result.method === 'adaptive_grid' ? 'grid_search' : result.method
  };
};

// Export the enhanced validation as the main validation function
export const validateOptimizedParameters = (
  modelId: string,
  data: SalesData[],
  originalParameters: Record<string, number>,
  aiParameters: Record<string, number>,
  aiConfidence: number = 70,
  config: ValidationConfig = ENHANCED_VALIDATION_CONFIG
): OptimizationResult | null => {
  console.log(`🔬 Enhanced validation for ${modelId} with improved criteria`);
  
  const result = enhancedParameterValidation(
    modelId,
    data,
    originalParameters,
    aiParameters,
    aiConfidence,
    config
  );
  
  if (!result) {
    return null;
  }
  
  return {
    parameters: result.parameters,
    accuracy: result.accuracy,
    confidence: result.confidence,
    method: result.method === 'ai_optimal' ? 'ai_high_confidence' : result.method
  };
};
