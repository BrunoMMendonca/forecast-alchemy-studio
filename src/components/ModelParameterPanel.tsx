
import React from 'react';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { ModelCard } from './ModelCard';

interface ModelParameterPanelProps {
  models: ModelConfig[];
  selectedSKU: string;
  data: SalesData[];
  onToggleModel: (modelId: string) => void;
  onUpdateParameter: (modelId: string, parameter: string, value: number) => void;
  onResetModel: (modelId: string) => void;
  isOptimizing: boolean;
  optimizingModel: string | null;
  aiForecastModelOptimizationEnabled?: boolean;
}

export const ModelParameterPanel: React.FC<ModelParameterPanelProps> = ({
  models,
  selectedSKU,
  data,
  onToggleModel,
  onUpdateParameter,
  onResetModel,
  isOptimizing,
  optimizingModel,
  aiForecastModelOptimizationEnabled
}) => {
  return (
    <div className="space-y-4">
      {models.map((model) => (
        <ModelCard
          key={model.id}
          model={model}
          selectedSKU={selectedSKU}
          data={data}
          onToggle={() => onToggleModel(model.id)}
          onParameterUpdate={(parameter, value) => onUpdateParameter(model.id, parameter, value)}
          onResetToManual={() => onResetModel(model.id)}
          isOptimizing={isOptimizing && optimizingModel === model.id}
          aiForecastModelOptimizationEnabled={aiForecastModelOptimizationEnabled}
        />
      ))}
    </div>
  );
};
