
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ModelConfig } from '@/types/forecast';
import { ModelCard } from './ModelCard';

interface ModelSelectionProps {
  models: ModelConfig[];
  selectedSKU: string;
  onToggleModel: (modelId: string) => void;
  onUpdateParameter: (modelId: string, parameter: string, value: number) => void;
  onResetToManual: (modelId: string) => void;
  onMethodSelection?: (modelId: string, method: 'ai' | 'grid' | 'manual') => void;
  grokApiEnabled?: boolean;
}

export const ModelSelection: React.FC<ModelSelectionProps> = ({
  models,
  selectedSKU,
  onToggleModel,
  onUpdateParameter,
  onResetToManual,
  onMethodSelection,
  grokApiEnabled,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Forecasting Models</CardTitle>
        <CardDescription>
          Select and configure your forecasting models. Optimization happens automatically in the background.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {models.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            selectedSKU={selectedSKU}
            onToggle={() => onToggleModel(model.id)}
            onParameterUpdate={(parameter, value) => onUpdateParameter(model.id, parameter, value)}
            onResetToManual={() => onResetToManual(model.id)}
            onMethodSelection={onMethodSelection ? (method) => onMethodSelection(model.id, method) : undefined}
            grokApiEnabled={grokApiEnabled}
          />
        ))}
      </CardContent>
    </Card>
  );
};
