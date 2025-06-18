import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { ParameterControl } from './ParameterControl';
import { Info, Star } from 'lucide-react';

interface ModelCardProps {
  model: ModelConfig;
  onToggle: (modelId: string) => void;
  onUpdateParameter: (modelId: string, paramName: string, value: any) => void;
  onResetToManual: (modelId: string) => void;
  onMethodSelection: (modelId: string, method: 'ai' | 'grid' | 'manual') => void;
  aiForecastModelOptimizationEnabled: boolean;
  disableToggle?: boolean;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  model,
  onToggle,
  onUpdateParameter,
  onResetToManual,
  onMethodSelection,
  aiForecastModelOptimizationEnabled,
  disableToggle = false
}) => {
  return (
    <div className={`bg-white rounded-lg shadow p-4 ${model.isWinner ? 'ring-2 ring-blue-500' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {model.isWinner && (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
              <Badge variant="default" className="text-xs">
                Best Model
              </Badge>
            </div>
          )}
        <h3 className="text-lg font-semibold">{model.name}</h3>
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      <div className="space-y-4">
        {/* Optimization Method Selection */}
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
            {aiForecastModelOptimizationEnabled && <option value="ai">AI Optimization</option>}
          </select>
        </div>

        {/* Optimization Results */}
        {model.optimizationMethod && model.optimizationMethod !== 'manual' && (
          <div className="space-y-2 p-3 bg-gray-50 rounded-md">
            {/* Method and Score */}
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="capitalize">
                {model.optimizationMethod.replace('_', ' ')}
              </Badge>
              {model.optimizationConfidence && (
                <Badge variant="secondary">
                  Score: {model.optimizationConfidence.toFixed(1)}%
                </Badge>
              )}
            </div>
            
            {/* Winner Indicator */}
            {model.isWinner && (
              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center gap-2 text-green-700">
                  <Star className="h-4 w-4 fill-green-500" />
                  <span className="font-medium">Best Performing Model</span>
                </div>
                <div className="mt-1 text-sm text-green-600">
                  Highest accuracy and confidence score
                </div>
              </div>
            )}
            
            {/* Optimized Parameters */}
            {model.optimizedParameters && (
              <div className="mt-2">
                <div className="text-sm font-medium mb-1">Optimized Parameters:</div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(model.optimizedParameters).map(([param, value]) => (
                    <div key={param} className="text-sm">
                      <span className="font-medium">{param}:</span> {value}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Optimization Reasoning */}
            {model.optimizationReasoning && (
              <div className="mt-2">
                <div className="text-sm font-medium mb-1">Reasoning:</div>
                <p className="text-sm text-gray-600">{model.optimizationReasoning}</p>
              </div>
            )}

            {/* Optimization Factors */}
            {model.optimizationFactors && (
              <div className="mt-2">
                <div className="text-sm font-medium mb-1">Performance Factors:</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="font-medium">Stability:</span> {model.optimizationFactors.stability}%
                  </div>
                  <div>
                    <span className="font-medium">Interpretability:</span> {model.optimizationFactors.interpretability}%
                  </div>
                  <div>
                    <span className="font-medium">Complexity:</span> {model.optimizationFactors.complexity}%
                  </div>
                  <div>
                    <span className="font-medium">Business Impact:</span> {model.optimizationFactors.businessImpact}
                  </div>
                </div>
              </div>
            )}

            {/* Reset Button */}
            <button
              onClick={() => onResetToManual(model.id)}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800"
            >
              Reset to Manual
            </button>
          </div>
        )}

        {/* Manual Parameters */}
        {(!model.optimizationMethod || model.optimizationMethod === 'manual') && model.parameters && (
          <div className="space-y-2">
            <div className="text-sm font-medium mb-1">Parameters:</div>
            {Object.entries(model.parameters).map(([paramName, value]) => (
              <div key={paramName} className="flex items-center space-x-2">
                <label className="text-sm font-medium">{paramName}:</label>
                <input
                  type="number"
                  value={value}
                  onChange={(e) => onUpdateParameter(model.id, paramName, parseFloat(e.target.value))}
                  className="border rounded px-2 py-1 w-24"
                  disabled={!model.enabled}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
