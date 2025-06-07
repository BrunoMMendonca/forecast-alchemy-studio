
import React, { useCallback } from 'react';
import { flushSync } from 'react-dom';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ModelConfig } from '@/types/forecast';

interface ParameterSlidersProps {
  model: ModelConfig;
  isManual: boolean;
  disabled: boolean;
  getParameterValue: (parameter: string) => number | undefined;
  onParameterChange: (parameter: string, values: number[]) => void;
}

export const ParameterSliders: React.FC<ParameterSlidersProps> = ({
  model,
  isManual,
  disabled,
  getParameterValue,
  onParameterChange,
}) => {
  const getParameterConfig = (parameter: string) => {
    const configs: Record<string, { min: number; max: number; step: number; description: string }> = {
      alpha: { min: 0.1, max: 0.9, step: 0.05, description: "Level smoothing parameter" },
      beta: { min: 0.1, max: 0.9, step: 0.05, description: "Trend smoothing parameter" },
      gamma: { min: 0.1, max: 0.9, step: 0.05, description: "Seasonal smoothing parameter" },
      phi: { min: 0.8, max: 1.0, step: 0.02, description: "Damping parameter" },
      seasonalPeriods: { min: 2, max: 52, step: 1, description: "Number of periods in a season" },
      trend: { min: 0, max: 2, step: 1, description: "Trend component (0=none, 1=additive, 2=multiplicative)" },
      seasonal: { min: 0, max: 2, step: 1, description: "Seasonal component (0=none, 1=additive, 2=multiplicative)" },
      damped: { min: 0, max: 1, step: 1, description: "Damped trend (0=false, 1=true)" },
      window: { min: 1, max: 12, step: 1, description: "Number of periods to average" },
    };
    
    return configs[parameter] || { min: 0, max: 1, step: 0.1, description: "Parameter" };
  };

  const handleParameterChange = useCallback((parameter: string, values: number[]) => {
    flushSync(() => {
      onParameterChange(parameter, values);
    });
  }, [onParameterChange]);

  if (!model.parameters || Object.keys(model.parameters).length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4">
      {Object.entries(model.parameters).map(([parameter, _]) => {
        const config = getParameterConfig(parameter);
        const currentValue = getParameterValue(parameter);
        const safeValue = typeof currentValue === 'number' ? currentValue : config.min;
        
        return (
          <div key={parameter} className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor={`${model.id}-${parameter}`} className="text-sm font-medium">
                {parameter}
              </Label>
              <span className="text-sm font-mono bg-slate-100 px-2 py-1 rounded">
                {safeValue.toFixed(config.step < 1 ? 2 : 0)}
              </span>
            </div>
            <Slider
              id={`${model.id}-${parameter}`}
              min={config.min}
              max={config.max}
              step={config.step}
              value={[safeValue]}
              onValueChange={(values) => handleParameterChange(parameter, values)}
              className="w-full"
              disabled={!isManual || disabled}
            />
            <p className="text-xs text-slate-500">{config.description}</p>
          </div>
        );
      })}
    </div>
  );
};
