import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Settings, Zap, Grid3X3, User } from 'lucide-react';
import { ModelConfig } from '@/types/forecast';
import { ReasoningDisplay } from './ReasoningDisplay';

interface ParameterControlProps {
  model: ModelConfig;
  onParameterUpdate: (parameter: string, value: number) => void;
  onUseAI: () => void;
  onUseGrid?: () => void;
  onResetToManual: () => void;
}

export const ParameterControl: React.FC<ParameterControlProps> = ({
  model,
  onParameterUpdate,
  onUseAI,
  onUseGrid,
  onResetToManual,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const isManual = !model.optimizedParameters;
  const isAI = model.optimizationMethod?.startsWith('ai_');
  const isGrid = model.optimizationMethod === 'grid_search';

  // Check if AI optimization is available (has cached AI results)
  const hasAIOptimization = model.optimizationMethod?.startsWith('ai_') || 
                           (model.optimizationReasoning && model.optimizationReasoning.includes('AI'));

  const currentParameters = model.optimizedParameters || model.parameters;

  const handleParameterChange = useCallback((parameter: string, values: number[]) => {
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
    };
    
    return configs[parameter] || { min: 0, max: 1, step: 0.1, description: "Parameter" };
  };

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
              
              {/* FIXED: Keep badges in consistent order - Manual, Grid, AI */}
              <div className="flex items-center gap-2">
                {/* Manual Badge - Always show, highlight when active */}
                <Badge 
                  variant={isManual ? "default" : "outline"} 
                  className={`text-xs cursor-pointer ${isManual ? 'bg-gray-700' : 'hover:bg-gray-100'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onResetToManual();
                  }}
                >
                  <User className="h-3 w-3 mr-1" />
                  Manual
                </Badge>

                {/* Grid Badge - Always show, highlight when active */}
                <Badge 
                  variant={isGrid ? "default" : "outline"} 
                  className={`text-xs cursor-pointer ${isGrid ? 'bg-blue-600' : 'hover:bg-blue-100'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onUseGrid) onUseGrid();
                  }}
                >
                  <Grid3X3 className="h-3 w-3 mr-1" />
                  Grid
                </Badge>

                {/* AI Badge - Only show if AI optimization is available */}
                {hasAIOptimization && (
                  <Badge 
                    variant={isAI ? "default" : "outline"} 
                    className={`text-xs cursor-pointer ${isAI ? 'bg-green-600' : 'hover:bg-green-100'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onUseAI();
                    }}
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    AI
                  </Badge>
                )}
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
            {currentParameters && Object.keys(currentParameters).length > 0 && (
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

                {/* Reasoning Display */}
                {(model.optimizationReasoning || model.optimizationFactors) && (
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
            )}

            {(!currentParameters || Object.keys(currentParameters).length === 0) && (
              <div className="text-center py-4 text-slate-500">
                No parameters available for this model
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
