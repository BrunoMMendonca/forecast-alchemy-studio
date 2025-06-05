
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ModelConfig } from '@/types/forecast';
import { ModelCard } from './ModelCard';
import { SalesData } from '@/pages/Index';

interface ModelSelectionProps {
  models: ModelConfig[];
  selectedSKU: string;
  data: SalesData[];
  onToggleModel: (modelId: string) => void;
  onUpdateParameter: (modelId: string, parameter: string, value: number) => void;
  onUseAI: (modelId: string) => void;
  onUseGrid?: (modelId: string) => void;
  onResetToManual: (modelId: string) => void;
}

export const ModelSelection: React.FC<ModelSelectionProps> = ({
  models,
  selectedSKU,
  data,
  onToggleModel,
  onUpdateParameter,
  onUseAI,
  onUseGrid,
  onResetToManual,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Forecasting Models</CardTitle>
        <CardDescription>
          Select and configure your forecasting models. AI optimization uses advanced algorithms to find optimal parameters.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {models.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            selectedSKU={selectedSKU}
            data={data}
            onToggle={() => onToggleModel(model.id)}
            onParameterUpdate={(parameter, value) => onUpdateParameter(model.id, parameter, value)}
            onUseAI={() => onUseAI(model.id)}
            onUseGrid={onUseGrid ? () => onUseGrid(model.id) : undefined}
            onResetToManual={() => onResetToManual(model.id)}
          />
        ))}
      </CardContent>
    </Card>
  );
};
