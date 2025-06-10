import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { ParameterControl } from './ParameterControl';

interface ModelCardProps {
  model: ModelConfig;
  onToggle: (modelId: string) => void;
  onUpdateParameter: (modelId: string, paramName: string, value: any) => void;
  onResetToManual: (modelId: string) => void;
  onMethodSelection: (modelId: string, method: 'ai' | 'grid' | 'manual') => void;
  grokApiEnabled: boolean;
  disableToggle?: boolean;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  model,
  onToggle,
  onUpdateParameter,
  onResetToManual,
  onMethodSelection,
  grokApiEnabled,
  disableToggle = false
}) => {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{model.name}</h3>
        <Switch
          id={`model-toggle-${model.id}`}
          checked={model.enabled}
          onCheckedChange={() => onToggle(model.id)}
          disabled={disableToggle}
        />
        <Label htmlFor={`model-toggle-${model.id}`} className="ml-2">
          {model.enabled ? 'Enabled' : 'Disabled'}
        </Label>
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium">Method:</label>
          <select
            value={model.optimizationMethod || 'manual'}
            onChange={(e) => onMethodSelection(model.id, e.target.value as 'ai' | 'grid' | 'manual')}
            className="border rounded px-2 py-1"
            disabled={!model.enabled}
          >
            <option value="manual">Manual</option>
            <option value="grid">Grid Search</option>
            {grokApiEnabled && <option value="ai">AI Optimization</option>}
          </select>
        </div>

        {model.parameters && Object.entries(model.parameters).map(([paramName, value]) => (
          <div key={paramName} className="flex items-center space-x-2">
            <label className="text-sm font-medium">{paramName}:</label>
            <input
              type="number"
              value={value}
              onChange={(e) => onUpdateParameter(model.id, paramName, parseFloat(e.target.value))}
              className="border rounded px-2 py-1 w-24"
              disabled={!model.enabled || (model.optimizationMethod !== 'manual' && !!model.optimizationMethod)}
            />
          </div>
        ))}

        {model.optimizationMethod !== 'manual' && (
          <button
            onClick={() => onResetToManual(model.id)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Reset to Manual
          </button>
        )}
      </div>
    </div>
  );
};
