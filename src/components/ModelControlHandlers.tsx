
import { useCallback } from 'react';
import { ModelConfig } from '@/types/forecast';

interface ModelControlHandlersProps {
  setModels: React.Dispatch<React.SetStateAction<ModelConfig[]>>;
  updateParameter: (modelId: string, parameter: string, value: number) => void;
  useAIOptimization: (modelId: string) => void;
  resetToManual: (modelId: string) => void;
  generateForecastsForSelectedSKU: () => void;
}

export const useModelControlHandlers = ({
  setModels,
  updateParameter,
  useAIOptimization,
  resetToManual,
  generateForecastsForSelectedSKU
}: ModelControlHandlersProps) => {
  const handleToggleModel = useCallback((modelId: string) => {
    console.log(`🔄 Toggling model ${modelId}`);
    
    setModels(prev => {
      const updated = prev.map(model => 
        model.id === modelId ? { ...model, enabled: !model.enabled } : model
      );
      
      console.log(`🔄 Model ${modelId} toggled to ${updated.find(m => m.id === modelId)?.enabled}`);
      
      setTimeout(() => {
        console.log(`🔄 Regenerating forecasts with updated models after toggling ${modelId}`);
        generateForecastsForSelectedSKU();
      }, 10);
      
      return updated;
    });
  }, [setModels, generateForecastsForSelectedSKU]);

  const handleUpdateParameter = useCallback((modelId: string, parameter: string, value: number) => {
    console.log(`🔧 Updating parameter ${parameter} for ${modelId} to ${value}`);
    updateParameter(modelId, parameter, value);
    setTimeout(() => {
      console.log(`🔧 Regenerating forecasts after parameter update for ${modelId}`);
      generateForecastsForSelectedSKU();
    }, 50);
  }, [updateParameter, generateForecastsForSelectedSKU]);

  const handleUseAI = useCallback((modelId: string) => {
    console.log(`🤖 Using AI for ${modelId}`);
    useAIOptimization(modelId);
    setTimeout(() => {
      console.log(`🤖 Regenerating forecasts after AI toggle for ${modelId}`);
      generateForecastsForSelectedSKU();
    }, 50);
  }, [useAIOptimization, generateForecastsForSelectedSKU]);

  const handleResetToManual = useCallback((modelId: string) => {
    console.log(`👤 Resetting to manual for ${modelId}`);
    resetToManual(modelId);
    setTimeout(() => {
      console.log(`👤 Regenerating forecasts after manual reset for ${modelId}`);
      generateForecastsForSelectedSKU();
    }, 50);
  }, [resetToManual, generateForecastsForSelectedSKU]);

  return {
    handleToggleModel,
    handleUpdateParameter,
    handleUseAI,
    handleResetToManual
  };
};
