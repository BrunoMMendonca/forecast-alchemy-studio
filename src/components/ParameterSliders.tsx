
import React, { useMemo, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { ModelConfig } from '@/types/forecast';

interface ParameterSlidersProps {
  model: ModelConfig;
  isManual: boolean;
  disabled: boolean;
  getParameterValue: (parameter: string) => number | undefined;
  onParameterChange: (parameter: string, values: number[]) => void;
  cacheVersion: number;
  parameterValues: Record<string, number>;
}

export const ParameterSliders: React.FC<ParameterSlidersProps> = ({
  model,
  isManual,
  disabled,
  getParameterValue,
  onParameterChange,
  cacheVersion,
  parameterValues,
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

  const parameterEntries = useMemo(() => {
    if (!model.parameters) return [];
    return Object.entries(model.parameters);
  }, [model.parameters]);

  // Force slider updates when parameterValues change
  useEffect(() => {
    console.log(`🔄 NATIVE SLIDER EFFECT: parameterValues changed for ${model.id}, cacheVersion: ${cacheVersion}`);
    Object.keys(parameterValues).forEach(parameter => {
      const value = parameterValues[parameter];
      console.log(`🎚️ NATIVE SLIDER EFFECT UPDATE: ${parameter} = ${value}`);
    });
  }, [parameterValues, cacheVersion, model.id]);

  if (!model.parameters || Object.keys(model.parameters).length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4">
      {parameterEntries.map(([parameter, _]) => {
        const config = getParameterConfig(parameter);
        const currentValue = parameterValues[parameter];
        const safeValue = typeof currentValue === 'number' ? currentValue : config.min;
        
        console.log(`🎚️ NATIVE SLIDER RENDER: ${parameter} = ${safeValue}, from parameterValues: ${currentValue}`);
        
        return (
          <div key={`${parameter}-${model.id}-${cacheVersion}`} className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor={`slider-${parameter}`} className="text-sm font-medium">
                {parameter}
              </Label>
              <span className="text-sm font-mono bg-slate-100 px-2 py-1 rounded">
                {safeValue.toFixed(config.step < 1 ? 2 : 0)}
              </span>
            </div>
            
            {/* Native HTML Range Input */}
            <div className="relative">
              <input
                type="range"
                id={`slider-${parameter}`}
                min={config.min}
                max={config.max}
                step={config.step}
                value={safeValue}
                onChange={(e) => {
                  const newValue = parseFloat(e.target.value);
                  console.log(`🎚️ NATIVE SLIDER CHANGE: ${parameter} = ${newValue} (was ${safeValue})`);
                  onParameterChange(parameter, [newValue]);
                }}
                disabled={!isManual || disabled}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-thumb:appearance-none slider-thumb:h-4 slider-thumb:w-4 slider-thumb:rounded-full slider-thumb:bg-blue-600 slider-thumb:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((safeValue - config.min) / (config.max - config.min)) * 100}%, #e5e7eb ${((safeValue - config.min) / (config.max - config.min)) * 100}%, #e5e7eb 100%)`
                }}
              />
            </div>
            
            <p className="text-xs text-slate-500">{config.description}</p>
          </div>
        );
      })}
    </div>
  );
};
