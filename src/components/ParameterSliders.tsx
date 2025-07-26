import React from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ModelConfig } from '@/types/forecast';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface ParameterSlidersProps {
  model: ModelConfig;
  modelId: string;
  isManual: boolean;
  disabled: boolean;
  getParameterValue: (parameter: string) => number | undefined;
  onParameterChange: (parameter: string, values: number[] | string | boolean) => void;
}

export const ParameterSliders: React.FC<ParameterSlidersProps> = ({
  model,
  modelId,
  isManual,
  disabled,
  getParameterValue,
  onParameterChange,
}) => {
  // Helper to check for plain object
  function isPlainObject(val: any) {
    return val && typeof val === 'object' && !Array.isArray(val);
  }

  let paramsMeta: any[] = [];
  if (Array.isArray(model.parametersMeta)) {
    paramsMeta = model.parametersMeta;
  } else if (Array.isArray(model.parameters)) {
    paramsMeta = model.parameters;
  } else if (model.parameters && typeof model.parameters === 'object') {
    // Convert object to array, but only spread if value is a plain object
    paramsMeta = Object.keys(model.parameters).map(name => {
      const value = model.parameters[name];
      if (isPlainObject(value) && value !== null) {
        return Object.assign({ name }, value);
      } else {
        // Fallback: treat as number, fill in meta fields
        return {
          name,
          type: 'number',
          default: value,
          visible: true,
          label: name,
          description: '',
        };
      }
    });
  }
  // Only show parameters with visible: true or visible undefined (default true)
  const visibleParams = paramsMeta.filter((p: any) => p.visible !== false);

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
    ? visibleParams.filter((p: any) => p.name !== 'auto')
    : visibleParams;

  if (!model.parameters || filteredParams.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {filteredParams.map((param: any) => {
        // Always use param.name for state lookup and update
        const value = getParameterValue(param.name) ?? param.default;
        // Rate-limited debug logging per parameter
        if (!(window as any).__paramLogTimes) (window as any).__paramLogTimes = {};
        const now = Date.now();
        if (!(window as any).__paramLogTimes[param.name] || now - (window as any).__paramLogTimes[param.name] > 2000) {
          (window as any).__paramLogTimes[param.name] = now;
          console.log('[ParameterSliders] modelId:', modelId, 'Param:', param.name, 'type:', param.type, 'value:', value, 'meta:', param);
        }
        // Render select dropdown
        if (param.type === 'select' && Array.isArray(param.options)) {
          // Find the max width of the options
          const maxOptionLength = Math.max(...param.options.map((opt: any) => String(opt.label ?? opt.value ?? opt).length), (param.label || param.name).length);
          const approxCharWidth = 10; // px, slightly increased for safety
          const padding = 40; // px, for dropdown arrow and padding
          const minWidth = 120;
          const maxWidth = Math.max(minWidth, maxOptionLength * approxCharWidth + padding);
          return (
            <div key={param.name} className="flex items-center gap-4">
              <label className="w-40 text-sm font-medium text-slate-700">{param.label || param.name}</label>
              <Select
                value={String(value)}
                onValueChange={val => onParameterChange(param.name, val)}
                disabled={disabled}
              >
                <SelectTrigger className="flex-1" style={{ minWidth: maxWidth, maxWidth: maxWidth, width: maxWidth, textAlign: 'left' }}>
                  <SelectValue placeholder={param.label || param.name} />
                </SelectTrigger>
                <SelectContent>
                  {param.options.map((opt: any) => (
                    <SelectItem key={opt.value ?? opt} value={String(opt.value ?? opt)}>
                      {opt.label ?? opt.value ?? opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }
        // Render boolean switch
        if (param.type === 'boolean') {
        return (
            <div key={param.name} className="flex items-center gap-4">
              <label className="w-40 text-sm font-medium text-slate-700">{param.label || param.name}</label>
              <Switch
                checked={!!value}
                onCheckedChange={val => onParameterChange(param.name, val)}
                disabled={disabled}
              />
              <span className="w-12 text-right text-sm text-slate-600">{value ? 'On' : 'Off'}</span>
            </div>
          );
        }
        // Render number slider
        return (
          <div key={param.name} className="flex items-center gap-4">
            <label className="w-40 text-sm font-medium text-slate-700">{param.label || param.name}</label>
            <input
              type="range"
              min={param.min ?? 0}
              max={param.max ?? 10}
              step={param.step ?? 1}
              value={value}
              onChange={e => onParameterChange(param.name, [parseFloat(e.target.value)])}
              disabled={disabled}
              className="flex-1"
            />
            <span className="w-12 text-right text-sm text-slate-800 font-semibold">{value}</span>
          </div>
        );
      })}
    </div>
  );
};

