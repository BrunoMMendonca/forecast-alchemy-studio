
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ModelConfig } from '@/types/forecast';

interface ModelCardProps {
  model: ModelConfig;
  onToggle: (modelId: string) => void;
  onParameterUpdate: (modelId: string, parameter: string, value: number) => void;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  model,
  onToggle,
  onParameterUpdate
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
      
      {model.enabled && model.parameters && Object.keys(model.parameters).length > 0 && (
        <CardContent className="pt-0">
          <div className="space-y-3 pl-8">
            {Object.entries(model.optimizedParameters || model.parameters).map(([param, value]) => (
              <div key={param} className="flex items-center space-x-3">
                <Label className="w-20 text-sm capitalize">{param}:</Label>
                <Input
                  type="number"
                  value={value}
                  onChange={(e) => onParameterUpdate(model.id, param, parseFloat(e.target.value) || 0)}
                  className="w-24 h-8"
                  step={param === 'alpha' || param === 'beta' || param === 'gamma' ? 0.1 : 1}
                  min={param === 'alpha' || param === 'beta' || param === 'gamma' ? 0.1 : 1}
                  max={param === 'alpha' || param === 'beta' || param === 'gamma' ? 1 : 30}
                  disabled={!!model.optimizedParameters}
                />
                <span className="text-xs text-slate-500">
                  {param === 'window' && 'periods'}
                  {(param === 'alpha' || param === 'beta' || param === 'gamma') && '(0.1-1.0)'}
                  {model.optimizedParameters && <span className="text-purple-600 ml-1">(AI optimized)</span>}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
};
