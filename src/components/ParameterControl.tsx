import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Settings, Bot, Grid3X3, User } from 'lucide-react';
import { ModelConfig } from '@/types/forecast';
import { ReasoningDisplay } from './ReasoningDisplay';
import { hasOptimizableParameters } from '@/utils/modelConfig';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';

interface ParameterControlProps {
  model: ModelConfig;
  selectedSKU: string;
  onParameterUpdate: (parameter: string, value: number) => void;
  onResetToManual: () => void;
  onMethodSelection?: (method: 'ai' | 'grid' | 'manual') => void;
  disabled?: boolean;
  grokApiEnabled?: boolean;
}

export const ParameterControl: React.FC<ParameterControlProps> = ({
  model,
  selectedSKU,
  onParameterUpdate,
  onResetToManual,
  onMethodSelection,
  disabled = false,
  grokApiEnabled = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { cache } = useOptimizationCache();

  // Get current user selection from cache
  const cacheEntry = cache[selectedSKU]?.[model.id];
  const userSelectedMethod = cacheEntry?.selected;
  
  // Load optimization data from cache based on user selection
  const optimizationData = useMemo(() => {
    if (!cacheEntry || userSelectedMethod === 'manual') {
      return null;
    }

    // Try to get data for the selected method first
    if (userSelectedMethod === 'ai' && cacheEntry.ai) {
      return cacheEntry.ai;
    } else if (userSelectedMethod === 'grid' && cacheEntry.grid) {
      return cacheEntry.grid;
    }

    // Fallback to any available optimization data
    return cacheEntry.ai || cacheEntry.grid || null;
  }, [cacheEntry, userSelectedMethod]);

  // Determine which method is currently active based on user selection
  const isManual = userSelectedMethod === 'manual';
  const isAI = userSelectedMethod === 'ai';
  const isGrid = userSelectedMethod === 'grid';

  // SIMPLIFIED: Determine the source of truth for parameter values
  const getParameterValue = useCallback((parameter: string) => {
    if (isManual) {
      // In manual mode, ALWAYS use model.parameters
      return model.parameters?.[parameter];
    } else {
      // In AI/Grid mode, use optimized parameters if available, otherwise fall back to model parameters
      const optimizedValue = model.optimizedParameters?.[parameter];
      const modelValue = model.parameters?.[parameter];
      return optimizedValue !== undefined ? optimizedValue : modelValue;
    }
  }, [isManual, model.parameters, model.optimizedParameters]);

  const canOptimize = hasOptimizableParameters(model);

  // Only show parameters section if model actually has parameters
  const hasParameters = model.parameters && Object.keys(model.parameters).length > 0;

  // Check if optimization results exist for display
  const hasOptimizationResults = canOptimize && optimizationData && !isManual;

  const handleParameterChange = useCallback((parameter: string, values: number[]) => {
    const newValue = values[0];
    console.log(`🎚️ SLIDER CHANGE: ${parameter} = ${newValue}, switching to manual mode`);
    onParameterUpdate(parameter, newValue);
  }, [onParameterUpdate]);

  // Handle badge clicks - use the new method selection handler if available, otherwise fallback
  const handlePreferenceChange = useCallback((newMethod: 'manual' | 'ai' | 'grid') => {
    // Prevent duplicate calls by checking if we're already in this method
    if (userSelectedMethod === newMethod) {
      return;
    }
    
    console.log(`🎯 BADGE CLICK: Switching to ${newMethod} for ${model.id}`);
    
    if (onMethodSelection) {
      // Use the new direct method selection handler
      onMethodSelection(newMethod);
    } else {
      // Fallback to the old approach
      if (newMethod === 'manual') {
        onResetToManual();
      }
    }
  }, [userSelectedMethod, model.id, onMethodSelection, onResetToManual]);

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

  // If model has no parameters, don't render anything
  if (!hasParameters) {
    return null;
  }

  // Add safety check for selectedSKU
  if (!selectedSKU) {
    console.log('ParameterControl: No selectedSKU provided');
    return null;
  }

  return (
    <Card className="w-full">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <div className="p-4 cursor-pointer hover:bg-slate-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Settings className="h-4 w-4" />
                <span className="font-medium">Parameters</span>
                {!canOptimize && (
                  <Badge variant="outline" className="text-xs">
                    No Optimization
                  </Badge>
                )}
              </div>
              
              {/* Show optimization badges for models with optimizable parameters */}
              {canOptimize && (
                <div className="flex items-center gap-2">
                  {/* AI Badge - Only show when Grok API is enabled */}
                  {grokApiEnabled && (
                    <Badge 
                      variant={isAI ? "default" : "outline"} 
                      className={`text-xs cursor-pointer ${isAI ? 'bg-green-600' : 'hover:bg-green-100'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handlePreferenceChange('ai');
                      }}
                    >
                      <Bot className="h-3 w-3 mr-1" />
                      AI
                    </Badge>
                  )}

                  {/* Grid Badge - Always show */}
                  <Badge 
                    variant={isGrid ? "default" : "outline"} 
                    className={`text-xs cursor-pointer ${isGrid ? 'bg-blue-600' : 'hover:bg-blue-100'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handlePreferenceChange('grid');
                    }}
                  >
                    <Grid3X3 className="h-3 w-3 mr-1" />
                    Grid
                  </Badge>

                  {/* Manual Badge - Always show */}
                  <Badge 
                    variant={isManual ? "default" : "outline"} 
                    className={`text-xs cursor-pointer ${isManual ? 'bg-gray-700' : 'hover:bg-gray-100'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handlePreferenceChange('manual');
                    }}
                  >
                    <User className="h-3 w-3 mr-1" />
                    Manual
                  </Badge>
                </div>
              )}
            </div>

            {/* Optimization Status Summary - only for optimizable models */}
            {canOptimize && optimizationData && !isManual && (
              <div className="mt-2 flex items-center space-x-4 text-sm">
                <span className="text-slate-600">
                  Confidence: <span className="font-medium">{optimizationData.confidence?.toFixed(1)}%</span>
                </span>
                {optimizationData.expectedAccuracy && (
                  <span className="text-slate-600">
                    Expected Accuracy: <span className="font-medium">{optimizationData.expectedAccuracy.toFixed(1)}%</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {/* Parameter Controls */}
            <div className="space-y-4">
              <div className="grid gap-4">
                {Object.entries(model.parameters || {}).map(([parameter, _]) => {
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

              {/* Reasoning Display - Only show if optimization results exist */}
              {hasOptimizationResults && optimizationData.reasoning && (
                <div className="mt-6 pt-4 border-t">
                  <ReasoningDisplay
                    reasoning={optimizationData.reasoning}
                    factors={optimizationData.factors}
                    method={optimizationData.method || 'unknown'}
                    confidence={optimizationData.confidence || 0}
                    expectedAccuracy={optimizationData.expectedAccuracy}
                  />
                </div>
              )}

              {/* Information for non-optimizable models */}
              {!canOptimize && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    This model uses a fixed algorithm and doesn't require parameter optimization.
                  </p>
                </div>
              )}

              {/* Manual mode indicator */}
              {canOptimize && isManual && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    Manual mode: You can adjust parameters using the sliders above.
                  </p>
                </div>
              )}

              {/* Status indicator when no optimization results are loaded */}
              {canOptimize && !isManual && !optimizationData && (
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-700">
                    No {isAI ? 'AI' : 'Grid'} optimization results are currently loaded for this model. 
                    If optimization has been run, try refreshing or check if results are available for this SKU.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
