
import React from 'react';
import { ModelConfig } from '@/types/forecast';
import { ModelCard } from './ModelCard';

interface ModelParameterPanelProps {
  models: ModelConfig[];
  selectedSKU: string;
  onToggleModel: (modelId: string) => void;
  onUpdateParameter: (modelId: string, parameter: string, value: number) => void;
  onResetModel: (modelId: string) => void;
  isOptimizing: boolean;
  optimizingModel: string | null;
  grokApiEnabled?: boolean;
}

export const ModelParameterPanel: React.FC<ModelParameterPanelProps> = ({
  models,
  selectedSKU,
  onToggleModel,
  onUpdateParameter,
  onResetModel,
  isOptimizing,
  optimizingModel,
  grokApiEnabled
}) => {
  return (
    <div className="space-y-4">
      {models.map((model) => (
        <ModelCard
          key={model.id}
          model={model}
          selectedSKU={selectedSKU}
          onToggle={() => onToggleModel(model.id)}
          onParameterUpdate={(parameter, value) => onUpdateParameter(model.id, parameter, value)}
          onResetToManual={() => onResetModel(model.id)}
          isOptimizing={isOptimizing && optimizingModel === model.id}
          grokApiEnabled={grokApiEnabled}
        />
      ))}
    </div>
  );
};
