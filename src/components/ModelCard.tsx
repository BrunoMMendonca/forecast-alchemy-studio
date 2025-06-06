
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ModelConfig } from '@/types/forecast';
import { ModelParameterPanel } from './ModelParameterPanel';
import { ReasoningDisplay } from './ReasoningDisplay';
import { hasOptimizableParameters } from '@/utils/modelConfig';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';

interface ModelCardProps {
  model: ModelConfig;
  selectedSKU: string;
  onToggle: () => void;
  onParameterUpdate: (parameter: string, value: number) => void;
  onResetToManual: () => void;
  grokApiEnabled?: boolean;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  model,
  selectedSKU,
  onToggle,
  onParameterUpdate,
  onResetToManual,
  grokApiEnabled = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { getCachedParameters } = useOptimizationCache();

  // Get cached optimization results
  const cachedResults = useMemo(() => {
    if (!selectedSKU) return null;
    
    // Get the cached parameters (this will return the best available method)
    return getCachedParameters(selectedSKU, model.id);
  }, [selectedSKU, model.id, getCachedParameters]);

  const showOptimizationResults = hasOptimizableParameters(model) && cachedResults;

  return (
    <Card className={`${model.enabled ? 'ring-2 ring-blue-200' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Switch
              checked={model.enabled}
              onCheckedChange={onToggle}
            />
            <div>
              <CardTitle className="text-base">{model.name}</CardTitle>
              <p className="text-sm text-slate-600">{model.description}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {model.enabled && hasOptimizableParameters(model) && (
              <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Settings2 className="h-4 w-4 mr-1" />
                    Configure
                    {isExpanded ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>
            )}
          </div>
        </div>
      </CardHeader>

      {model.enabled && hasOptimizableParameters(model) && (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              <ModelParameterPanel
                model={model}
                selectedSKU={selectedSKU}
                onParameterUpdate={onParameterUpdate}
                grokApiEnabled={grokApiEnabled}
              />

              {showOptimizationResults && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Optimization Results</h4>

                  <ReasoningDisplay
                    reasoning={cachedResults.reasoning || 'Optimization completed successfully.'}
                    confidence={cachedResults.confidence || 0}
                    method={cachedResults.method || 'unknown'}
                    expectedAccuracy={cachedResults.expectedAccuracy}
                    factors={cachedResults.factors}
                    compact={true}
                  />
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      )}
    </Card>
  );
};
