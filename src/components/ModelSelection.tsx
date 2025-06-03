
import React from 'react';
import { ModelCard } from './ModelCard';
import { ModelConfig } from '@/types/forecast';

interface ModelSelectionProps {
  models: ModelConfig[];
  onToggleModel: (modelId: string) => void;
  onUpdateParameter: (modelId: string, parameter: string, value: number) => void;
  onReOptimize?: (modelId: string) => void;
  onResetToManual?: (modelId: string) => void;
}

export const ModelSelection: React.FC<ModelSelectionProps> = ({
  models,
  onToggleModel,
  onUpdateParameter,
  onReOptimize,
  onResetToManual
}) => {
  const basicModels = models.filter(m => !m.isSeasonal);
  const seasonalModels = models.filter(m => m.isSeasonal);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-800">Select Forecasting Models</h3>
      <p className="text-sm text-slate-500">
        Parameters can be AI-optimized or manually adjusted for the selected product
      </p>
      
      {/* Basic Models */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-slate-700">Basic Models</h4>
        {basicModels.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            onToggle={onToggleModel}
            onParameterUpdate={onUpdateParameter}
            onReOptimize={onReOptimize}
            onResetToManual={onResetToManual}
          />
        ))}
      </div>

      {/* Seasonal Models */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-slate-700">Seasonal Models</h4>
        <p className="text-sm text-slate-500">
          These models automatically detect and account for seasonal patterns in your data
        </p>
        {seasonalModels.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            onToggle={onToggleModel}
            onParameterUpdate={onUpdateParameter}
            onReOptimize={onReOptimize}
            onResetToManual={onResetToManual}
          />
        ))}
      </div>
    </div>
  );
};
