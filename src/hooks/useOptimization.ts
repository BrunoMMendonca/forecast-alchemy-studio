import { useState, useCallback } from 'react';
import { SalesData } from '@/types/forecast';
import { ModelConfig } from '@/types/forecast';
import { getOptimizationByMethod } from '@/utils/singleModelOptimization';
import { BusinessContext } from '@/types/businessContext';
import { hasOptimizableParameters } from '@/utils/modelConfig';

export const useOptimization = (
  selectedSKU: string,
  data: SalesData[],
  businessContext?: BusinessContext,
  aiForecastModelOptimizationEnabled: boolean = true
) => {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizingModel, setOptimizingModel] = useState<string | null>(null);

  const optimizeModel = useCallback(async (
    model: ModelConfig,
    method: 'ai' | 'grid'
  ): Promise<{
    parameters: Record<string, number>;
    confidence?: number;
    reasoning?: string;
    method: string;
  } | null> => {
    console.warn('🚫 FRONTEND OPTIMIZATION DISABLED: Use backend optimization system instead');
    console.warn('🚫 This function should not be called - all optimization should go through the backend queue');
    return null;
  }, [selectedSKU, data, businessContext, aiForecastModelOptimizationEnabled]);

  return {
    isOptimizing,
    optimizingModel,
    optimizeModel
  };
};
