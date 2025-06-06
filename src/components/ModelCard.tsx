
import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { ParameterControl } from './ParameterControl';

interface ModelCardProps {
  model: ModelConfig;
  selectedSKU: string;
  data: SalesData[];
  onToggle: () => void;
  onParameterUpdate: (parameter: string, value: number) => void;
  onResetToManual: () => void;
  onMethodSelection?: (method: 'ai' | 'grid' | 'manual') => void;
  isOptimizing?: boolean;
  grokApiEnabled?: boolean;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  model,
  selectedSKU,
  data,
  onToggle,
  onParameterUpdate,
  onResetToManual,
  onMethodSelection,
  isOptimizing = false,
  grokApiEnabled
}) => {
  return (
    <div className="border border-slate-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Switch
            id={`model-${model.id}`}
            checked={model.enabled}
            onCheckedChange={onToggle}
          />
          <Label htmlFor={`model-${model.id}`} className="text-base font-medium">
            {model.name}
          </Label>
          {model.enabled && (
            <Badge variant="outline" className="text-xs">
              Enabled
            </Badge>
          )}
          {isOptimizing && (
            <Badge variant="secondary" className="text-xs">
              Optimizing...
            </Badge>
          )}
        </div>
      </div>

      {model.description && (
        <p className="text-sm text-slate-600">{model.description}</p>
      )}

      {model.enabled && (
        <ParameterControl
          model={model}
          selectedSKU={selectedSKU}
          data={data}
          onParameterUpdate={onParameterUpdate}
          onResetToManual={onResetToManual}
          onMethodSelection={onMethodSelection}
          disabled={isOptimizing}
          grokApiEnabled={grokApiEnabled}
        />
      )}
    </div>
  );
};
