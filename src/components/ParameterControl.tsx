import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
import { useOptimizationMethodManagement } from '@/hooks/useOptimizationMethodManagement';
import { generateDataHash } from '@/utils/cacheHashUtils';

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
  const { cache, cacheVersion } = useOptimizationCache();
  const { getBestAvailableMethod } = useOptimizationMethodManagement();

  // Get current user selection from cache
  const cacheEntry = useMemo(() => {
    console.log(`🔄 PARAM_CONTROL: Cache lookup for ${selectedSKU}:${model.id} (version: ${cacheVersion})`);
    const entry = cache[selectedSKU]?.[model.id];
    console.log(`🔄 PARAM_CONTROL: Found cache entry:`, entry);
    return entry;
  }, [cache, selectedSKU, model.id, cacheVersion]);

  const userSelectedMethod = useMemo(() => {
    const method = cacheEntry?.selected;
    console.log(`🔄 PARAM_CONTROL: User selected method for ${selectedSKU}:${model.id} = ${method} (cache version: ${cacheVersion})`);
    return method;
  }, [cacheEntry, selectedSKU, model.id, cacheVersion]);

  // NEW: Compute the effective selected method - combines user choice with best available
  const effectiveSelectedMethod = useMemo(() => {
    // If user has made an explicit choice, use that
    if (userSelectedMethod) {
      console.log(`🎯 PARAM_CONTROL: Using explicit user choice: ${userSelectedMethod} for ${selectedSKU}:${model.id}`);
      return userSelectedMethod;
    }

    // Otherwise, use the best available method based on current cache state
    // We need to generate a current data hash for this computation
    const currentDataHash = 'current'; // Simplified for now - in real usage this would be the actual data hash
    const bestMethod = getBestAvailableMethod(selectedSKU, model.id, currentDataHash);
    console.log(`🎯 PARAM_CONTROL: Using best available method: ${bestMethod} for ${selectedSKU}:${model.id}`);
    return bestMethod;
  }, [userSelectedMethod, selectedSKU, model.id, getBestAvailableMethod, cacheVersion]);

  // Local state for immediate visual feedback on user clicks
  const [localSelectedMethod, setLocalSelectedMethod] = useState<'ai' | 'grid' | 'manual' | undefined>(effectiveSelectedMethod);

  // Sync local state with effective method when it changes (due to optimization completion)
  useEffect(() => {
    setLocalSelectedMethod(effectiveSelectedMethod);
    console.log(`🎯 PARAM_CONTROL: Local state synced to effective method ${effectiveSelectedMethod} for ${selectedSKU}:${model.id}`);
  }, [effectiveSelectedMethod, selectedSKU, model.id]);

  // Load optimization data from cache based on effective selected method
  const optimizationData = useMemo(() => {
    if (!cacheEntry || localSelectedMethod === 'manual') {
      console.log(`🔄 PARAM_CONTROL: No optimization data - manual mode or no cache entry`);
      return null;
    }

    if (localSelectedMethod === 'ai' && cacheEntry.ai) {
      console.log(`🔄 PARAM_CONTROL: Using AI optimization data`);
      return cacheEntry.ai;
    } else if (localSelectedMethod === 'grid' && cacheEntry.grid) {
      console.log(`🔄 PARAM_CONTROL: Using Grid optimization data`);
      return cacheEntry.grid;
    }

    const fallback = cacheEntry.ai || cacheEntry.grid || null;
    console.log(`🔄 PARAM_CONTROL: Using fallback optimization data:`, fallback ? 'found' : 'none');
    return fallback;
  }, [cacheEntry, localSelectedMethod]);

  // Determine which method is currently active
  const isManual = localSelectedMethod === 'manual';
  const isAI = localSelectedMethod === 'ai';
  const isGrid = localSelectedMethod === 'grid';

  // Log current state for debugging
  useEffect(() => {
    console.log(`🎯 PARAM_CONTROL: Badge states for ${selectedSKU}:${model.id}:`, {
      effectiveSelectedMethod,
      localSelectedMethod,
      isManual,
      isAI,
      isGrid,
      cacheVersion
    });
  }, [selectedSKU, model.id, effectiveSelectedMethod, localSelectedMethod, isManual, isAI, isGrid, cacheVersion]);

  // Determine the source of truth for parameter values
  const getParameterValue = useCallback((parameter: string) => {
    if (isManual) {
      return model.parameters?.[parameter];
    } else {
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

  // Handle badge clicks with immediate local state update
  const handlePreferenceChange = useCallback((newMethod: 'manual' | 'ai' | 'grid') => {
    // Prevent duplicate calls by checking if we're already in this method
    if (localSelectedMethod === newMethod) {
      console.log(`🎯 BADGE CLICK: Already in ${newMethod} mode for ${model.id}, ignoring`);
      return;
    }
    
    console.log(`🎯 BADGE CLICK: Switching to ${newMethod} for ${model.id}`);
    
    // Update local state immediately for visual feedback
    setLocalSelectedMethod(newMethod);
    
    if (onMethodSelection) {
      onMethodSelection(newMethod);
    } else {
      if (newMethod === 'manual') {
        onResetToManual();
      }
    }
  }, [localSelectedMethod, model.id, onMethodSelection, onResetToManual]);

  // ... keep existing code (getParameterConfig function, hasParameters check, etc)
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
                      key={`ai-${localSelectedMethod}-${cacheVersion}`}
                      variant={isAI ? "default" : "outline"} 
                      className={`text-xs cursor-pointer ${isAI ? 'bg-green-600' : 'hover:bg-green-100'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        console.log(`🎯 AI BADGE CLICK: Current method = ${localSelectedMethod}, isAI = ${isAI}`);
                        handlePreferenceChange('ai');
                      }}
                    >
                      <Bot className="h-3 w-3 mr-1" />
                      AI
                    </Badge>
                  )}

                  {/* Grid Badge - Always show */}
                  <Badge 
                    key={`grid-${localSelectedMethod}-${cacheVersion}`}
                    variant={isGrid ? "default" : "outline"} 
                    className={`text-xs cursor-pointer ${isGrid ? 'bg-blue-600' : 'hover:bg-blue-100'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      console.log(`🎯 GRID BADGE CLICK: Current method = ${localSelectedMethod}, isGrid = ${isGrid}`);
                      handlePreferenceChange('grid');
                    }}
                  >
                    <Grid3X3 className="h-3 w-3 mr-1" />
                    Grid
                  </Badge>

                  {/* Manual Badge - Always show */}
                  <Badge 
                    key={`manual-${localSelectedMethod}-${cacheVersion}`}
                    variant={isManual ? "default" : "outline"} 
                    className={`text-xs cursor-pointer ${isManual ? 'bg-gray-700' : 'hover:bg-gray-100'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      console.log(`🎯 MANUAL BADGE CLICK: Current method = ${localSelectedMethod}, isManual = ${isManual}`);
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
