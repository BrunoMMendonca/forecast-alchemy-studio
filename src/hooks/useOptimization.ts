
import { useState, useCallback } from 'react';
import { SalesData } from '@/pages/Index';
import { ModelConfig } from '@/types/forecast';
import { getOptimizationByMethod } from '@/utils/singleModelOptimization';
import { BusinessContext } from '@/types/businessContext';
import { hasOptimizableParameters } from '@/utils/modelConfig';

export const useOptimization = (
  selectedSKU: string,
  data: SalesData[],
  businessContext?: BusinessContext,
  grokApiEnabled: boolean = true
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
    // Guard against empty or invalid SKU
    if (!selectedSKU || selectedSKU.trim() === '' || !data.length) {
      console.log('useOptimization: No valid SKU or data, skipping optimization');
      return null;
    }

    // Guard against models without optimizable parameters
    if (!hasOptimizableParameters(model)) {
      console.log('useOptimization: Model has no optimizable parameters, skipping optimization:', model.id);
      return null;
    }

    // If AI method is requested but Grok API is disabled, fall back to grid
    if (method === 'ai' && !grokApiEnabled) {
      console.log('useOptimization: Grok API disabled, falling back to grid optimization');
      method = 'grid';
    }

    console.log('useOptimization: Starting optimization for SKU:', selectedSKU, 'Model:', model.id, 'Method:', method);
    setIsOptimizing(true);
    setOptimizingModel(model.id);

    try {
      const skuData = data.filter(d => d.sku === selectedSKU);
      if (skuData.length === 0) {
        console.log('useOptimization: No data found for SKU:', selectedSKU);
        return null;
      }

      const result = await getOptimizationByMethod(model, skuData, selectedSKU, method, businessContext, grokApiEnabled);
      
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
  }, [selectedSKU, data, businessContext, grokApiEnabled]);

  return {
    isOptimizing,
    optimizingModel,
    optimizeModel
  };
};
