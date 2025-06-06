
import { useState, useCallback } from 'react';
import { SalesData } from '@/pages/Index';
import { ModelConfig } from '@/types/forecast';
import { getOptimizationByMethod } from '@/utils/singleModelOptimization';
import { BusinessContext } from '@/types/businessContext';

export const useOptimization = (
  selectedSKU: string,
  data: SalesData[],
  businessContext?: BusinessContext
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
    if (!selectedSKU || !data.length) return null;

    setIsOptimizing(true);
    setOptimizingModel(model.id);

    try {
      const skuData = data.filter(d => d.sku === selectedSKU);
      const result = await getOptimizationByMethod(model, skuData, selectedSKU, method, businessContext);
      
      return result ? {
        parameters: result.parameters,
        confidence: result.confidence,
        reasoning: result.reasoning,
        method: result.method
      } : null;
    } catch (error) {
      console.error(`${method} optimization failed:`, error);
      return null;
    } finally {
      setIsOptimizing(false);
      setOptimizingModel(null);
    }
  }, [selectedSKU, data, businessContext]);

  return {
    isOptimizing,
    optimizingModel,
    optimizeModel
  };
};
