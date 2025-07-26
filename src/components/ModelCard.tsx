import React, { useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/types/forecast';
import { ParameterControl } from './ParameterControl';
import { Info, Star, Calendar, TrendingUp, Lock, BarChart3 } from 'lucide-react';
import { useModelUIStore, ModelMethod } from '@/store/optimizationStore';
import { ParameterControlContainer } from './ParameterControlContainer';
import { Button } from '@/components/ui/button';

interface ModelCardProps {
  model: ModelConfig;
  selectedSKU: string;
  filePath: string;
  uuid: string;
  data: SalesData[];
  onToggle: (modelId: string) => void;
  onUpdateParameter: (modelId: string, paramName: string, value: any) => void;
  onResetToManual: (modelId: string) => void;
  onMethodSelection: (modelId: string, method: 'ai' | 'grid' | 'manual') => void;
  aiForecastModelOptimizationEnabled: boolean;
  disableToggle?: boolean;
  disableReason?: string;
  isOptimizing?: boolean;
  onViewChart?: (modelId: string) => void;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  model,
  selectedSKU,
  filePath,
  uuid,
  data,
  onToggle,
  onUpdateParameter,
  onResetToManual,
  onMethodSelection,
  aiForecastModelOptimizationEnabled,
  disableToggle = false,
  disableReason = '',
  isOptimizing = false,
  onViewChart
}) => {
  console.log('[ModelCard] filePath:', filePath, 'uuid:', uuid, 'modelId:', model.id);
  const modelUI = useModelUIStore(state => state.getModelUIState(filePath, uuid, selectedSKU, model.id));
  const localSelectedMethod = modelUI?.selectedMethod || 'grid';
  const isWinner = !!modelUI?.[localSelectedMethod as ModelMethod]?.isWinner;
  const compositeScore = modelUI?.[localSelectedMethod as ModelMethod]?.compositeScore;

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

  return (
    <div className={`bg-white rounded-lg shadow p-4 border ${isWinner ? 'ring-2 ring-blue-500' : ''} relative`}>
      {/* Winner Badge */}
      {isWinner && (
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
          {compositeScore !== undefined && (
            <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">Score: {(compositeScore * 100).toFixed(1)}%</span>
          )}
          {onViewChart && (
            <Button variant="ghost" size="icon" onClick={() => onViewChart(model.id)}>
              <BarChart3 className="h-4 w-4" />
            </Button>
          )}
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
        {/* Parameter Controls */}
        <ParameterControlContainer
          model={model}
            selectedSKU={selectedSKU}
            data={data}
          onParameterUpdate={(param, value) => onUpdateParameter(model.id, param, value)}
            onResetToManual={() => onResetToManual(model.id)}
          onMethodSelection={method => onMethodSelection(model.id, method)}
          disabled={disableToggle || isOptimizing}
            aiForecastModelOptimizationEnabled={aiForecastModelOptimizationEnabled}
          filePath={filePath}
          uuid={uuid}
        />
      </div>
    </div>
  );
};