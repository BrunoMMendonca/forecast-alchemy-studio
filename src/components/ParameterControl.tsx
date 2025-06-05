
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
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { SalesData } from '@/pages/Index';

interface ParameterControlProps {
  model: ModelConfig;
  selectedSKU: string;
  data: SalesData[];
  onParameterUpdate: (parameter: string, value: number) => void;
  onUseAI: () => void;
  onUseGrid?: () => void;
  onResetToManual: () => void;
}

export const ParameterControl: React.FC<ParameterControlProps> = ({
  model,
  selectedSKU,
  data,
  onParameterUpdate,
  onUseAI,
  onUseGrid,
  onResetToManual,
}) => {
  console.log('🔧 ParameterControl render for model:', model.id, 'SKU:', selectedSKU);
  
  // Early return if no SKU selected to prevent infinite loops
  if (!selectedSKU || selectedSKU.trim() === '') {
    console.log('❌ No valid SKU selected, skipping ParameterControl render');
    return null;
  }
  
  const [isExpanded, setIsExpanded] = useState(false);
  const { getCachedParameters, isCacheValid, generateDataHash } = useOptimizationCache();

  const isManual = !model.optimizedParameters;
  const isAI = model.optimizationMethod === 'ai';
  const isGrid = model.optimizationMethod === 'grid_search';

  const currentParameters = model.optimizedParameters || model.parameters;

  // Only show parameters section if model actually has parameters
  const hasParameters = currentParameters && Object.keys(currentParameters).length > 0;

  // If model has no parameters, don't render anything and don't check cache
  if (!hasParameters) {
    console.log('❌ No parameters for model:', model.id, '- skipping cache checks and rendering');
    return null;
  }

  // Check if cached optimization results are available - only for models with parameters
  const skuData = data.filter(d => d.sku === selectedSKU);
  const currentDataHash = generateDataHash(skuData);
  
  const hasValidAICache = () => {
    try {
      const cachedAI = getCachedParameters(selectedSKU, model.id, 'ai');
      const isValid = cachedAI && isCacheValid(selectedSKU, model.id, currentDataHash, 'ai');
      console.log('🤖 AI cache check for', model.id, ':', !!cachedAI, 'valid:', isValid);
      return isValid;
    } catch (error) {
      console.error('Error checking AI cache:', error);
      return false;
    }
  };

  const hasValidGridCache = () => {
    try {
      const cachedGrid = getCachedParameters(selectedSKU, model.id, 'grid');
      const isValid = cachedGrid && isCacheValid(selectedSKU, model.id, currentDataHash, 'grid');
      console.log('📊 Grid cache check for', model.id, ':', !!cachedGrid, 'valid:', isValid);
      return isValid;
    } catch (error) {
      console.error('Error checking Grid cache:', error);
      return false;
    }
  };

  const aiCacheAvailable = hasValidAICache();
  const gridCacheAvailable = hasValidGridCache();

  // Check if optimization was actually performed
  const hasOptimizationResults = model.optimizationMethod && 
                                (model.optimizationReasoning || model.optimizationFactors);

  const handleParameterChange = useCallback((parameter: string, values: number[]) => {
    console.log('📝 Parameter change:', parameter, values[0]);
    onParameterUpdate(parameter, values[0]);
  }, [onParameterUpdate]);

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

  console.log('✅ Rendering ParameterControl for model with parameters:', model.id);

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
              </div>
              
              {/* Badge order: AI, Grid, Manual */}
              <div className="flex items-center gap-2">
                {/* AI Badge - Only clickable if cache available */}
                <Badge 
                  variant={isAI ? "default" : "outline"} 
                  className={`text-xs ${
                    aiCacheAvailable 
                      ? `cursor-pointer ${isAI ? 'bg-green-600' : 'hover:bg-green-100'}` 
                      : 'opacity-50 cursor-not-allowed bg-gray-300'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('🤖 AI badge clicked, cache available:', aiCacheAvailable);
                    if (aiCacheAvailable) {
                      onUseAI();
                    }
                  }}
                >
                  <Bot className="h-3 w-3 mr-1" />
                  AI
                </Badge>

                {/* Grid Badge - Only clickable if cache available */}
                <Badge 
                  variant={isGrid ? "default" : "outline"} 
                  className={`text-xs ${
                    gridCacheAvailable 
                      ? `cursor-pointer ${isGrid ? 'bg-blue-600' : 'hover:bg-blue-100'}` 
                      : 'opacity-50 cursor-not-allowed bg-gray-300'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('📊 Grid badge clicked, cache available:', gridCacheAvailable);
                    if (gridCacheAvailable && onUseGrid) {
                      onUseGrid();
                    }
                  }}
                >
                  <Grid3X3 className="h-3 w-3 mr-1" />
                  Grid
                </Badge>

                {/* Manual Badge - Always clickable */}
                <Badge 
                  variant={isManual ? "default" : "outline"} 
                  className={`text-xs cursor-pointer ${isManual ? 'bg-gray-700' : 'hover:bg-gray-100'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('👤 Manual badge clicked');
                    onResetToManual();
                  }}
                >
                  <User className="h-3 w-3 mr-1" />
                  Manual
                </Badge>
              </div>
            </div>

            {/* Optimization Status Summary */}
            {model.optimizationConfidence && (
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
                        disabled={!isManual}
                      />
                      <p className="text-xs text-slate-500">{config.description}</p>
                    </div>
                  );
                })}
              </div>

              {/* Reasoning Display - Only show if optimization was performed */}
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
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
