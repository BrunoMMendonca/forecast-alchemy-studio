
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, User } from 'lucide-react';
import { ModelConfig } from '@/types/forecast';
import { ReasoningDisplay } from './ReasoningDisplay';

interface ParameterControlProps {
  model: ModelConfig;
  onParameterUpdate: (parameter: string, value: number) => void;
  onUseAI?: () => void;
  onResetToManual?: () => void;
}

export const ParameterControl: React.FC<ParameterControlProps> = ({
  model,
  onParameterUpdate,
  onUseAI,
  onResetToManual
}) => {
  if (!model.parameters || Object.keys(model.parameters).length === 0) {
    return null;
  }

  const hasOptimizedParams = !!model.optimizedParameters;
  const displayParams = model.optimizedParameters || model.parameters;
  const isUsingAI = hasOptimizedParams;

  return (
    <div className="space-y-3 pl-8">
      <div className="flex items-center gap-2 mb-3">
        {hasOptimizedParams ? (
          <>
            <Badge variant="default" className="text-white bg-purple-600">
              <Bot className="h-3 w-3 mr-1" />
              AI Optimized
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={onResetToManual}
              className="h-6 text-xs"
            >
              <User className="h-3 w-3 mr-1" />
              Use Manual
            </Button>
          </>
        ) : (
          <>
            <Badge variant="outline" className="text-slate-600">
              <User className="h-3 w-3 mr-1" />
              Manual
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={onUseAI}
              className="h-6 text-xs text-purple-600 border-purple-200"
            >
              <Bot className="h-3 w-3 mr-1" />
              Use AI
            </Button>
          </>
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
            disabled={isUsingAI}
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

      {/* Show AI reasoning if available */}
      {hasOptimizedParams && model.optimizationReasoning && (
        <div className="mt-4">
          <ReasoningDisplay
            reasoning={model.optimizationReasoning}
            confidence={model.optimizationConfidence || 0}
            method="ai_optimal"
            expectedAccuracy={model.expectedAccuracy}
            factors={model.optimizationFactors}
            compact={true}
          />
        </div>
      )}
    </div>
  );
};
