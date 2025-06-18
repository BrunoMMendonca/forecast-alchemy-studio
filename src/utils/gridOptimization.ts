import { SalesData } from '@/types/forecast';
import { ModelConfig } from '@/types/forecast';
import { adaptiveGridSearchOptimization } from '@/utils/adaptiveOptimization';
import { ENHANCED_VALIDATION_CONFIG } from '@/utils/enhancedValidation';

export interface GridOptimizationResult {
  parameters: Record<string, number>;
  confidence: number;
  method: string;
  accuracy: number;
  reasoning: string;
  factors: {
    stability: number;
    interpretability: number;
    complexity: number;
    businessImpact: string;
  };
  expectedAccuracy: number;
}

export const runGridOptimization = async (
  model: ModelConfig,
  skuData: SalesData[],
  sku: string
): Promise<GridOptimizationResult> => {
  const gridSearchResult = adaptiveGridSearchOptimization(
    model.id,
    skuData,
    undefined,
    {
      ...ENHANCED_VALIDATION_CONFIG,
      useWalkForward: true
    },
    sku
  );

  return {
    parameters: gridSearchResult.parameters,
    confidence: Math.max(60, gridSearchResult.confidence || 75),
    method: 'grid',
    accuracy: gridSearchResult.accuracy,
    reasoning: `Grid systematically tested parameter combinations and selected the configuration with highest validation accuracy (${gridSearchResult.accuracy.toFixed(1)}%). This method provides reliable, data-driven parameter selection through comprehensive evaluation.`,
    factors: {
      stability: 85,
      interpretability: 90,
      complexity: 45,
      businessImpact: 'Systematic optimization ensuring reliable performance through comprehensive parameter testing'
    },
    expectedAccuracy: gridSearchResult.accuracy
  };
};
