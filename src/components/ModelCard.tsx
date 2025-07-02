import React, { useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/types/forecast';
import { ParameterControl } from './ParameterControl';
import { Info, Star, Calendar, TrendingUp, Lock } from 'lucide-react';

interface ModelCardProps {
  model: ModelConfig;
  selectedSKU: string;
  data: SalesData[];
  onToggle: (modelId: string) => void;
  onUpdateParameter: (modelId: string, paramName: string, value: any) => void;
  onResetToManual: (modelId: string) => void;
  onMethodSelection: (modelId: string, method: 'ai' | 'grid' | 'manual') => void;
  aiForecastModelOptimizationEnabled: boolean;
  disableToggle?: boolean;
  disableReason?: string;
  isOptimizing?: boolean;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  model,
  selectedSKU,
  data,
  onToggle,
  onUpdateParameter,
  onResetToManual,
  onMethodSelection,
  aiForecastModelOptimizationEnabled,
  disableToggle = false,
  disableReason = '',
  isOptimizing = false
}) => {
  const getModelIcon = () => {
    if (model.isSeasonal) {
      return <Calendar className="h-4 w-4 text-blue-600" />;
    }
    return <TrendingUp className="h-4 w-4 text-green-600" />;
  };

  const getCategoryColor = () => {
    switch (model.category) {
      case 'Basic Models':
        return 'bg-blue-100 text-blue-800';
      case 'Trend Models':
        return 'bg-green-100 text-green-800';
      case 'Advanced Seasonal Models':
        return 'bg-purple-100 text-purple-800';
      case 'Advanced Trend Models':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Determine which parameters to display in the controls
  const displayedParameters = useMemo(() => {
    if (model.optimizationMethod === 'grid' && model.gridParameters) {
      return model.gridParameters;
    }
    if (model.optimizationMethod === 'ai' && model.aiParameters) {
      return model.aiParameters;
    }
    return model.parameters;
  }, [model]);

  // Determine which composite score to show based on selected method
  const selectedMethod = model.optimizationMethod || 'grid';
  let methodCompositeScore: number | null = null;
  if (selectedMethod === 'grid' && typeof model.gridCompositeScore === 'number') {
    methodCompositeScore = model.gridCompositeScore;
  } else if (selectedMethod === 'ai' && typeof model.aiCompositeScore === 'number') {
    methodCompositeScore = model.aiCompositeScore;
  }

  return (
    <div className={`bg-white rounded-lg shadow p-4 border ${model.isWinner ? 'ring-2 ring-blue-500' : ''} relative`}>
      {/* Winner Badge */}
      {model.isWinner && (
        <div className="absolute top-2 right-2 z-10">
          <Badge variant="default" className="bg-yellow-400 text-yellow-900 font-bold shadow">Winner</Badge>
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            {getModelIcon()}
            <div>
              <h3 className="text-lg font-semibold">{model.displayName || model.name}</h3>
              {model.category && (
                <Badge variant="outline" className={`text-xs ${getCategoryColor()}`}>
                  {model.category}
              </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-start">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1">
            <Switch
              id={`model-toggle-${model.id}`}
                      checked={disableToggle ? false : model.enabled}
                      onCheckedChange={() => !disableToggle && onToggle(model.id)}
              disabled={disableToggle || isOptimizing}
                      className={disableToggle ? '!opacity-100' : ''}
            />
                    {disableToggle && (
                      <Lock className="h-4 w-4 text-red-500 ml-1" aria-label="Locked due to data requirements" />
                    )}
                  </div>
                </TooltipTrigger>
            {disableToggle && disableReason && (
                  <TooltipContent className="max-w-xs p-2 rounded-md text-center text-sm shadow-lg border border-slate-200 bg-white">
                    <p>{disableReason}</p>
                  </TooltipContent>
            )}
              </Tooltip>
            </TooltipProvider>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Label htmlFor={`model-toggle-${model.id}`} className={`ml-2 ${disableToggle ? 'text-gray-400' : ''}`}>
                  {disableToggle ? 'Disabled' : model.enabled ? 'Enabled' : 'Disabled'}
          </Label>
              </TooltipTrigger>
              {disableToggle && disableReason && (
                <TooltipContent className="max-w-xs p-2 rounded-md text-center text-sm shadow-lg border border-slate-200 bg-white">
                  <p>{disableReason}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          {/* Composite Score Badge - always visible */}
          <span className="ml-2 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded border border-yellow-300 font-mono">
            Score: {typeof methodCompositeScore === 'number' ? (methodCompositeScore * 100).toFixed(1) + '%' : 'N/A'}
          </span>
        </div>
      </div>

      {/* Model Description */}
      {model.description && (
        <div className="mb-4 p-3 bg-slate-50 rounded-md">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-slate-600">{model.description}</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Optimization Results from Backend */}
        {model.optimizationMethod && model.optimizationMethod !== 'manual' && (
          <div className="space-y-2 p-3 bg-blue-50 rounded-md border border-blue-200">
            {/* Method and Score */}
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="capitalize bg-blue-100 text-blue-800">
                {model.optimizationMethod.replace('_', ' ')}
              </Badge>
              {model.optimizationConfidence && (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
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
            {model.gridParameters && (
              <div className="mt-2">
                <div className="text-sm font-medium mb-1 text-blue-800">Optimized Parameters:</div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(model.gridParameters).map(([param, value]) => (
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
                <div className="text-sm font-medium mb-1 text-blue-800">Reasoning:</div>
                <p className="text-sm text-slate-600">{model.optimizationReasoning}</p>
              </div>
            )}

            {/* Reset Button */}
            <button
              onClick={() => onResetToManual(model.id)}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Reset to Manual
            </button>
          </div>
        )}

        {/* Parameter Controls */}
        {displayedParameters && Object.keys(displayedParameters).length > 0 && (
          <ParameterControl
            model={{ ...model, parameters: displayedParameters }}
            selectedSKU={selectedSKU}
            data={data}
            onParameterUpdate={(parameter, value) => onUpdateParameter(model.id, parameter, value)}
            onResetToManual={() => onResetToManual(model.id)}
            onMethodSelection={(method) => onMethodSelection(model.id, method)}
            disabled={!model.enabled || isOptimizing}
            aiForecastModelOptimizationEnabled={aiForecastModelOptimizationEnabled}
          />
        )}

        {/* No Parameters Message */}
        {(!displayedParameters || Object.keys(displayedParameters).length === 0) && (
          <div className="text-sm text-slate-500 italic">
            This model uses default parameters optimized for general use.
          </div>
        )}
      </div>
    </div>
  );
};
