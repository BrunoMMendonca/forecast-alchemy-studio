
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ModelConfig } from '@/types/forecast';
import { ParameterControl } from './ParameterControl';

interface ModelCardProps {
  model: ModelConfig;
  onToggle: (modelId: string) => void;
  onParameterUpdate: (modelId: string, parameter: string, value: number) => void;
  onUseAI?: (modelId: string) => void;
  onUseGrid?: (modelId: string) => void;
  onResetToManual?: (modelId: string) => void;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  model,
  onToggle,
  onParameterUpdate,
  onUseAI,
  onUseGrid,
  onResetToManual
}) => {
  const ringColor = model.isSeasonal ? 'ring-green-200' : 'ring-blue-200';

  return (
    <Card className={`transition-all ${model.enabled ? `ring-2 ${ringColor}` : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-3">
          <Checkbox
            checked={model.enabled}
            onCheckedChange={(checked) => {
              if (checked !== 'indeterminate') {
                onToggle(model.id);
              }
            }}
          />
          {model.icon}
          <div className="flex-1">
            <CardTitle className="text-base flex items-center gap-2">
              {model.name}
              {model.optimizationConfidence && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                  AI: {model.optimizationConfidence.toFixed(0)}% confidence
                </span>
              )}
            </CardTitle>
            <CardDescription className="text-sm">
              {model.description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      {model.enabled && (
        <CardContent className="pt-0">
          <ParameterControl
            model={model}
            onParameterUpdate={(param, value) => onParameterUpdate(model.id, param, value)}
            onUseAI={() => onUseAI?.(model.id)}
            onUseGrid={() => onUseGrid?.(model.id)}
            onResetToManual={() => onResetToManual?.(model.id)}
          />
        </CardContent>
      )}
    </Card>
  );
};
