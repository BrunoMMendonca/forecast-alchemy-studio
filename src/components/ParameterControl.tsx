
import React, { useState, useCallback } from 'react';
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
import { useManualAIPreferences } from '@/hooks/useManualAIPreferences';

interface ParameterControlProps {
  model: ModelConfig;
  selectedSKU: string;
  onParameterUpdate: (parameter: string, value: number) => void;
  onResetToManual: () => void;
  disabled?: boolean;
  grokApiEnabled?: boolean;
}

export const ParameterControl: React.FC<ParameterControlProps> = ({
  model,
  selectedSKU,
  onParameterUpdate,
  onResetToManual,
  disabled = false,
  grokApiEnabled = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [pendingPreference, setPendingPreference] = useState<string | null>(null);
  const { loadManualAIPreferences, saveManualAIPreferences } = useManualAIPreferences();

  // Get current preference for this model
  const preferences = loadManualAIPreferences();
  const preferenceKey = `${selectedSKU}:${model.id}`;
  const currentPreference = pendingPreference || preferences[preferenceKey] || 'manual';

  // Determine which method is currently active
  const isManual = currentPreference === 'manual';
  const isAI = currentPreference === 'ai';
  const isGrid = currentPreference === 'grid';

  const currentParameters = model.optimizedParameters || model.parameters;
  const canOptimize = hasOptimizableParameters(model);

  // Only show parameters section if model actually has parameters
  const hasParameters = currentParameters && Object.keys(currentParameters).length > 0;

  // Check if optimization results exist for display - but respect pending preference
  const hasOptimizationResults = canOptimize && model.optimizationReasoning && !isManual;

  const handleParameterChange = useCallback((parameter: string, values: number[]) => {
    onParameterUpdate(parameter, values[0]);
  }, [onParameterUpdate]);

  // Handle badge clicks - update preference and trigger model update
  const handlePreferenceChange = useCallback((newPreference: 'manual' | 'ai' | 'grid') => {
    console.log(`🎯 BADGE CLICK: Switching to ${newPreference} view for ${model.id}`);
    
    // Set pending preference for immediate UI feedback
    setPendingPreference(newPreference);
    
    const updatedPreferences = { ...preferences };
    updatedPreferences[preferenceKey] = newPreference;
    saveManualAIPreferences(updatedPreferences);
    
    // If switching to manual, reset the model to clear optimization results
    if (newPreference === 'manual') {
      onResetToManual();
    }
    
    // Clear pending preference after a short delay to allow the hook to process
    setTimeout(() => {
      setPendingPreference(null);
    }, 100);
    
    // Note: The badge click changes the preference, and the useUnifiedModelManagement hook
    // will detect this change and update the model with the appropriate cached results
  }, [preferences, preferenceKey, saveManualAIPreferences, onResetToManual, model.id]);

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
            {canOptimize && model.optimizationConfidence && !isManual && (
              <div className="mt-2 flex items-center space-x-4 text-sm">
                <span className="text-slate-600">
                  Confidence: <span className="font-medium">{model.optimizationConfidence.toFixed(0)}%</span>
                </span>
                {model.expectedAccuracy && (
                  <span className="text-slate-600">
                    Expected Accuracy: <span className="font-medium">{model.expectedAccuracy.toFixed(1)}%</span>
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
                {Object.entries(currentParameters).map(([parameter, value]) => {
                  const config = getParameterConfig(parameter);
                  return (
                    <div key={parameter} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label htmlFor={`${model.id}-${parameter}`} className="text-sm font-medium">
                          {parameter}
                        </Label>
                        <span className="text-sm font-mono bg-slate-100 px-2 py-1 rounded">
                          {typeof value === 'number' ? value.toFixed(config.step < 1 ? 2 : 0) : value}
                        </span>
                      </div>
                      <Slider
                        id={`${model.id}-${parameter}`}
                        min={config.min}
                        max={config.max}
                        step={config.step}
                        value={[typeof value === 'number' ? value : config.min]}
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
              {hasOptimizationResults && (
                <div className="mt-6 pt-4 border-t">
                  <ReasoningDisplay
                    reasoning={model.optimizationReasoning}
                    factors={model.optimizationFactors}
                    method={model.optimizationMethod}
                    confidence={model.optimizationConfidence}
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

              {/* Status indicator when no optimization results are loaded - context aware */}
              {canOptimize && !isManual && !model.optimizationReasoning && !pendingPreference && (
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-700">
                    {isAI && !grokApiEnabled ? (
                      "AI optimization is not available because Grok API is disabled. Try using Grid optimization instead."
                    ) : isAI ? (
                      "No AI optimization results are currently loaded for this model. If optimization has been run, try refreshing or check if results are available for this SKU."
                    ) : isGrid ? (
                      "No Grid optimization results are currently loaded for this model. If optimization has been run, try refreshing or check if results are available for this SKU."
                    ) : (
                      "No optimization results are currently loaded for this model. If optimization has been run, try refreshing or check if results are available for this SKU."
                    )}
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
