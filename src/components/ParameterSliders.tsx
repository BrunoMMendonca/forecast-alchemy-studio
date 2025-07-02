import React from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ModelConfig } from '@/types/forecast';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface ParameterSlidersProps {
  model: ModelConfig;
  isManual: boolean;
  disabled: boolean;
  getParameterValue: (parameter: string) => number | undefined;
  onParameterChange: (parameter: string, values: number[] | string | boolean) => void;
}

export const ParameterSliders: React.FC<ParameterSlidersProps> = ({
  model,
  isManual,
  disabled,
  getParameterValue,
  onParameterChange,
}) => {
  // Use parametersMeta if available, otherwise fallback to old logic
  const paramsMeta = model.parametersMeta || [];
  const visibleParams = paramsMeta.length > 0
    ? paramsMeta.filter(p => p.visible !== false)
    : (model.defaultParameters ? Object.keys(model.defaultParameters) : Object.keys(model.parameters)).map(name => ({ name, label: name, description: '', type: 'number', default: 0, visible: true }));

  // Check if current value matches optimized value
  const isOptimizedValue = (parameter: string, currentValue: number) => {
    return model.gridParameters &&
           model.gridParameters[parameter] !== undefined &&
           Math.abs(model.gridParameters[parameter] - currentValue) < 0.001;
  };

  // Determine which parameter set to use for display
  const isGridMode = !isManual && !!model.gridParameters;
  const isAIMode = !isManual && !!model.aiParameters && model.bestSource === 'ai';
  const activeParams = isAIMode ? model.aiParameters : isGridMode ? model.gridParameters : model.parameters;

  // For ARIMA/SARIMA, filter out the 'auto' parameter from visibleParams
  const isArimaOrSarima = model.id === 'arima' || model.id === 'sarima';
  const filteredParams = isArimaOrSarima
    ? visibleParams.filter(p => p.name !== 'auto')
    : visibleParams;

  if (!model.parameters || visibleParams.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4">
      {filteredParams.map((param) => {
        const parameter = param.name;
        let currentValue = activeParams && activeParams[parameter] !== undefined
          ? activeParams[parameter]
          : getParameterValue(parameter);
        if (currentValue === undefined) currentValue = param.default ?? 0;
        const min = 'min' in param ? param.min ?? 0 : 0;
        const max = 'max' in param ? param.max ?? (param.type === 'number' ? 1 : 1) : (param.type === 'number' ? 1 : 1);
        const step = 'step' in param ? param.step ?? 0.01 : 0.01;
        const fieldDisabled = disabled || isGridMode || isAIMode;

        // Render select for 'select' type parameters
        if (param.type === 'select' && 'options' in param && param.options) {
          return (
            <div key={parameter} className="flex flex-col gap-1">
              <Label htmlFor={parameter}>{param.label || parameter}</Label>
              <Select
                value={String(currentValue)}
                onValueChange={value => onParameterChange(parameter, value)}
                disabled={fieldDisabled}
              >
                <SelectTrigger id={parameter} className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {param.options.map((opt: any) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label || opt.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {param.description && (
                <div className="text-xs text-muted-foreground">{param.description}</div>
              )}
            </div>
          );
        }

        // Render slider for numeric parameters (show value)
        return (
          <div key={parameter} className="flex flex-col gap-1">
            <Label htmlFor={parameter}>{param.label || parameter}</Label>
            <div className="flex items-center gap-2">
              <Slider
                id={parameter}
                min={min}
                max={max}
                step={step}
                value={[Number(currentValue)]}
                onValueChange={values => onParameterChange(parameter, values)}
                disabled={fieldDisabled}
              />
              <span className="text-sm font-mono px-2 py-1 rounded bg-slate-100">{typeof currentValue === 'number' ? currentValue.toFixed(step < 1 ? 2 : 0) : String(currentValue)}</span>
            </div>
            {param.description && (
              <div className="text-xs text-muted-foreground">{param.description}</div>
            )}
          </div>
        );
      })}
    </div>
  );
};
