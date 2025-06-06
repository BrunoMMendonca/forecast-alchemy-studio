
import { useState, useCallback } from 'react';
import { ModelConfig } from '@/types/forecast';
import { getDefaultModels } from '@/utils/modelConfig';

export const useModelState = () => {
  const [models, setModels] = useState<ModelConfig[]>(() => {
    return getDefaultModels();
  });

  const toggleModel = useCallback((modelId: string) => {
    setModels(prev => prev.map(model => 
      model.id === modelId ? { ...model, enabled: !model.enabled } : model
    ));
  }, []);

  const updateParameter = useCallback((modelId: string, parameter: string, value: number) => {
    console.log(`🎚️ PARAMETER UPDATE: ${parameter} = ${value} for ${modelId}`);
    
    setModels(prev => prev.map(model => 
      model.id === modelId 
        ? { 
            ...model, 
            parameters: { ...model.parameters, [parameter]: value }
          }
        : model
    ));
  }, []);

  return {
    models,
    setModels,
    toggleModel,
    updateParameter
  };
};
