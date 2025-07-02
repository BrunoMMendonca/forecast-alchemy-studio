import { useState, useCallback, useEffect } from 'react';
import { ModelConfig } from '@/types/forecast';
import { fetchAvailableModels } from '@/utils/modelConfig';

export const useModelParameters = (aiForecastModelOptimizationEnabled: boolean = true) => {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch models from backend on mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        const fetchedModels = await fetchAvailableModels();
        console.log('[useModelParameters] Models fetched:', fetchedModels);
        // Transform backend model metadata to frontend ModelConfig format
        const transformedModels: ModelConfig[] = fetchedModels.map((model: any) => ({
          id: model.id,
          name: model.displayName || model.id,
          displayName: model.displayName,
          description: model.description || '',
          enabled: true, // Default to enabled
          // --- Parameter sets ---
          manualParameters: { ...model.defaultParameters },
          gridParameters: undefined,
          aiParameters: undefined,
          parameters: { ...model.defaultParameters }, // Active set starts as manual
          bestSource: undefined,
          // --- Legacy/compatibility fields ---
          defaultParameters: { ...model.defaultParameters }, // Store original defaults
          isSeasonal: model.isSeasonal || false,
          category: model.category || 'Other',
          icon: undefined, // Backend models don't have icons, will be handled by UI
          // Deprecated fields for compatibility
          optimizationConfidence: undefined,
          optimizationReasoning: undefined,
          optimizationMethod: undefined,
          isWinner: false
        }));
        setModels(transformedModels);
      } catch (error) {
        console.error('[useModelParameters] Failed to fetch models:', error);
        setModels([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadModels();
  }, []);

  const toggleModel = useCallback((modelId: string) => {
    setModels(prev => prev.map(model => 
      model.id === modelId ? { ...model, enabled: !model.enabled } : model
    ));
  }, []);

  const updateParameter = useCallback((modelId: string, parameter: string, value: number) => {
    setModels(prev => prev.map(model => {
      if (model.id !== modelId) return model;
      // Only allow updates to valid parameter keys
      const validKeys = model.defaultParameters ? Object.keys(model.defaultParameters) : [];
      if (!validKeys.includes(parameter)) return model;
      return {
        ...model,
        manualParameters: { ...model.manualParameters, [parameter]: value },
        parameters: { ...model.manualParameters, [parameter]: value }, // Active set is manual when editing
        // Clear optimization data when manually changing parameters
        gridParameters: model.gridParameters,
        aiParameters: model.aiParameters,
        bestSource: model.bestSource,
        optimizationConfidence: undefined,
        optimizationReasoning: undefined,
        optimizationMethod: undefined
      };
    }));
  }, []);

  const resetModel = useCallback((modelId: string) => {
    setModels(prev => prev.map(model => 
      model.id === modelId 
        ? { 
            ...model, 
            // Reset to original default parameters
            manualParameters: { ...model.defaultParameters },
            parameters: { ...model.defaultParameters },
            gridParameters: model.gridParameters,
            aiParameters: model.aiParameters,
            bestSource: model.bestSource,
            optimizationConfidence: undefined,
            optimizationReasoning: undefined,
            optimizationMethod: undefined,
            isWinner: false
          }
        : model
    ));
  }, []);

  const updateModelOptimization = useCallback((modelId: string, optimizationData: any) => {
    setModels(prev => prev.map(model => 
      model.id === modelId 
        ? { 
            ...model, 
            gridParameters: optimizationData.parameters,
            optimizationConfidence: optimizationData.confidence,
            optimizationReasoning: optimizationData.reasoning,
            optimizationMethod: optimizationData.method,
            isWinner: optimizationData.isWinner || false
          }
        : model
    ));
  }, []);

  return {
    models,
    toggleModel,
    updateParameter,
    resetModel,
    updateModelOptimization,
    isLoading
  };
};
