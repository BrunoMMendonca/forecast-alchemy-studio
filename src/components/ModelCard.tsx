
import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ModelConfig } from '@/types/forecast';
import { ParameterControl } from './ParameterControl';

interface ModelCardProps {
  model: ModelConfig;
  selectedSKU: string;
  onToggle: () => void;
  onParameterUpdate: (parameter: string, value: number) => void;
  onResetToManual: () => void;
  isOptimizing?: boolean;
  grokApiEnabled?: boolean;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  model,
  selectedSKU,
  onToggle,
  onParameterUpdate,
  onResetToManual,
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
          onParameterUpdate={onParameterUpdate}
          onResetToManual={onResetToManual}
          disabled={isOptimizing}
          grokApiEnabled={grokApiEnabled}
        />
      )}
    </div>
  );
};
