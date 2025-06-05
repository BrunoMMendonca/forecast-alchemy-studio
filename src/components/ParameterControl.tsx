
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, User, Grid3x3 } from 'lucide-react';
import { ModelConfig } from '@/types/forecast';
import { ReasoningDisplay } from './ReasoningDisplay';

interface ParameterControlProps {
  model: ModelConfig;
  onParameterUpdate: (parameter: string, value: number) => void;
  onUseAI?: () => void;
  onUseGrid?: () => void;
  onResetToManual?: () => void;
}

export const ParameterControl: React.FC<ParameterControlProps> = ({
  model,
  onParameterUpdate,
  onUseAI,
  onUseGrid,
  onResetToManual
}) => {
  if (!model.parameters || Object.keys(model.parameters).length === 0) {
    return null;
  }

  const hasOptimizedParams = !!model.optimizedParameters;
  const displayParams = model.optimizedParameters || model.parameters;
  const isUsingOptimized = hasOptimizedParams;
  const optimizationMethod = model.optimizationMethod;

  // Enhanced debug logging
  console.log(`🎨 UI DEBUG: ParameterControl rendering for ${model.id}:`, {
    hasOptimizedParams,
    optimizationMethod,
    confidence: model.optimizationConfidence,
    reasoning: !!model.optimizationReasoning,
    modelState: {
      optimizedParameters: !!model.optimizedParameters,
      optimizationMethod: model.optimizationMethod,
      optimizationConfidence: model.optimizationConfidence
    }
  });

  const getOptimizationBadge = () => {
    console.log(`🎨 UI DEBUG: Determining badge for ${model.id} - hasOptimized: ${hasOptimizedParams}, method: ${optimizationMethod}`);
    
    if (!hasOptimizedParams) {
      console.log(`🎨 UI DEBUG: Showing Manual badge for ${model.id}`);
      return (
        <Badge variant="outline" className="text-slate-600">
          <User className="h-3 w-3 mr-1" />
          Manual
        </Badge>
      );
    }

    // Check the optimization method explicitly
    console.log(`🎨 UI DEBUG: Badge determination for ${model.id}: method="${optimizationMethod}"`);
    
    switch (optimizationMethod) {
      case 'ai_optimal':
      case 'ai_tolerance':
      case 'ai_confidence':
        console.log(`🎨 UI DEBUG: Showing AI badge for ${model.id}`);
        return (
          <Badge variant="default" className="text-white bg-purple-600">
            <Bot className="h-3 w-3 mr-1" />
            AI Optimized
          </Badge>
        );
      case 'grid_search':
        console.log(`🎨 UI DEBUG: Showing Grid badge for ${model.id}`);
        return (
          <Badge variant="default" className="text-white bg-blue-600">
            <Grid3x3 className="h-3 w-3 mr-1" />
            Grid Optimized
          </Badge>
        );
      default:
        console.log(`🎨 UI DEBUG: Unknown method "${optimizationMethod}" for ${model.id}, showing Manual badge as fallback`);
        return (
          <Badge variant="outline" className="text-slate-600">
            <User className="h-3 w-3 mr-1" />
            Manual
          </Badge>
        );
    }
  };

  const getActionButtons = () => {
    if (!hasOptimizedParams) {
      // Manual state - show AI and Grid options
      return (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onUseAI}
            className="h-6 text-xs text-purple-600 border-purple-200"
          >
            <Bot className="h-3 w-3 mr-1" />
            Use AI
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onUseGrid}
            className="h-6 text-xs text-blue-600 border-blue-200"
          >
            <Grid3x3 className="h-3 w-3 mr-1" />
            Use Grid
          </Button>
        </div>
      );
    } else {
      // Optimized state - show alternative options and manual reset
      const currentMethod = optimizationMethod;
      
      return (
        <div className="flex gap-2">
          {currentMethod !== 'ai_optimal' && currentMethod !== 'ai_tolerance' && currentMethod !== 'ai_confidence' && (
            <Button
              variant="outline"
              size="sm"
              onClick={onUseAI}
              className="h-6 text-xs text-purple-600 border-purple-200"
            >
              <Bot className="h-3 w-3 mr-1" />
              Use AI
            </Button>
          )}
          {currentMethod !== 'grid_search' && (
            <Button
              variant="outline"
              size="sm"
              onClick={onUseGrid}
              className="h-6 text-xs text-blue-600 border-blue-200"
            >
              <Grid3x3 className="h-3 w-3 mr-1" />
              Use Grid
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onResetToManual}
            className="h-6 text-xs"
          >
            <User className="h-3 w-3 mr-1" />
            Use Manual
          </Button>
        </div>
      );
    }
  };

  return (
    <div className="space-y-3 pl-8">
      <div className="flex items-center gap-2 mb-3">
        {getOptimizationBadge()}
        {getActionButtons()}
        {optimizationMethod === 'grid_search' && model.optimizationConfidence && (
          <Badge variant="secondary" className="text-xs">
            {model.optimizationConfidence.toFixed(0)}% accuracy
          </Badge>
        )}
      </div>

      {Object.entries(displayParams).map(([param, value]) => (
        <div key={param} className="flex items-center space-x-3">
          <Label className="w-20 text-sm capitalize">{param}:</Label>
          <Input
            type="number"
            value={value}
            onChange={(e) => onParameterUpdate(param, parseFloat(e.target.value) || 0)}
            className="w-24 h-8"
            step={param === 'alpha' || param === 'beta' || param === 'gamma' ? 0.1 : 1}
            min={param === 'alpha' || param === 'beta' || param === 'gamma' ? 0.1 : 1}
            max={param === 'alpha' || param === 'beta' || param === 'gamma' ? 1 : 30}
            disabled={isUsingOptimized}
          />
          <span className="text-xs text-slate-500">
            {param === 'window' && 'periods'}
            {(param === 'alpha' || param === 'beta' || param === 'gamma') && '(0.1-1.0)'}
          </span>
          {hasOptimizedParams && model.parameters && (
            <span className="text-xs text-slate-400">
              (manual: {model.parameters[param]})
            </span>
          )}
        </div>
      ))}

      {/* Show reasoning if available */}
      {hasOptimizedParams && model.optimizationReasoning && (
        <div className="mt-4">
          <ReasoningDisplay
            reasoning={model.optimizationReasoning}
            confidence={model.optimizationConfidence || 0}
            method={optimizationMethod || 'unknown'}
            expectedAccuracy={model.expectedAccuracy}
            factors={model.optimizationFactors}
            compact={true}
          />
        </div>
      )}
    </div>
  );
};
