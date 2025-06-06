
import { useState, useCallback } from 'react';
import { ModelConfig } from '@/types/forecast';
import { getDefaultModels } from '@/utils/modelConfig';

export const useModelParameters = (grokApiEnabled: boolean = true) => {
  const [models, setModels] = useState<ModelConfig[]>(() => getDefaultModels());

  const toggleModel = useCallback((modelId: string) => {
    setModels(prev => prev.map(model => 
      model.id === modelId ? { ...model, enabled: !model.enabled } : model
    ));
  }, []);

  const updateParameter = useCallback((modelId: string, parameter: string, value: number) => {
    setModels(prev => prev.map(model => 
      model.id === modelId 
        ? { 
            ...model, 
            parameters: { 
              ...model.parameters, 
              [parameter]: { 
                ...model.parameters![parameter], 
                value 
              } 
            },
            // Clear optimization data when manually changing parameters
            optimizedParameters: undefined,
            optimizationConfidence: undefined,
            optimizationReasoning: undefined,
            optimizationMethod: undefined
          }
        : model
    ));
  }, []);

  const updateModelOptimization = useCallback((
    modelId: string, 
    optimizedParameters: Record<string, number>,
    confidence?: number,
    reasoning?: string,
    method?: string
  ) => {
    // If Grok API is disabled and the method is 'ai', don't update with AI results
    if (!grokApiEnabled && method === 'ai') {
      console.log('useModelParameters: Grok API disabled, ignoring AI optimization result');
      return;
    }

    setModels(prev => prev.map(model => 
      model.id === modelId 
        ? { 
            ...model, 
            optimizedParameters,
            optimizationConfidence: confidence,
            optimizationReasoning: reasoning,
            optimizationMethod: method
          }
        : model
    ));
  }, [grokApiEnabled]);

  const resetModel = useCallback((modelId: string) => {
    setModels(prev => prev.map(model => 
      model.id === modelId 
        ? { 
            ...model, 
            optimizedParameters: undefined,
            optimizationConfidence: undefined,
            optimizationReasoning: undefined,
            optimizationMethod: undefined
          }
        : model
    ));
  }, []);

  return {
    models,
    toggleModel,
    updateParameter,
    updateModelOptimization,
    resetModel
  };
};
