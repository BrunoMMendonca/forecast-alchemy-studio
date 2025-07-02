import React, { useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Settings } from 'lucide-react';
import { ModelConfig, SalesData } from '@/types/forecast';
import { useParameterControlLogic } from '@/hooks/useParameterControlLogic';
import { ParameterBadges } from './ParameterBadges';
import { ParameterSliders } from './ParameterSliders';
import { ParameterStatusDisplay } from './ParameterStatusDisplay';

interface ParameterControlContainerProps {
  model: ModelConfig;
  selectedSKU: string;
  data: SalesData[];
  onParameterUpdate: (parameter: string, value: number) => void;
  onResetToManual: () => void;
  onMethodSelection?: (method: 'ai' | 'grid' | 'manual') => void;
  disabled?: boolean;
  aiForecastModelOptimizationEnabled?: boolean;
}

export const ParameterControlContainer: React.FC<ParameterControlContainerProps> = ({
  model,
  selectedSKU,
  data,
  onParameterUpdate,
  onResetToManual,
  onMethodSelection,
  disabled = false,
  aiForecastModelOptimizationEnabled = true,
}) => {
  const {
    isReasoningExpanded,
    setIsReasoningExpanded,
    localSelectedMethod,
    setLocalSelectedMethod,
    optimizationData,
    isManual,
    getParameterValue,
    canOptimize,
    hasParameters,
    hasOptimizationResults,
    cacheVersion
  } = useParameterControlLogic(model, selectedSKU, data, onParameterUpdate);

  const handleParameterChange = useCallback((parameter: string, values: number[]) => {
    const newValue = values[0];
    onParameterUpdate(parameter, newValue);
  }, [onParameterUpdate]);

  // Handle badge clicks with immediate local state update
  const handlePreferenceChange = useCallback((newMethod: 'manual' | 'ai' | 'grid') => {
    // Prevent duplicate calls by checking if we're already in this method
    if (localSelectedMethod === newMethod) {
      return;
    }
    
    // Update local state immediately for visual feedback
    setLocalSelectedMethod(newMethod);
    
    if (onMethodSelection) {
      onMethodSelection(newMethod);
    } else {
      if (newMethod === 'manual') {
        onResetToManual();
      }
    }
  }, [localSelectedMethod, onMethodSelection, onResetToManual, setLocalSelectedMethod]);

  // Helper to determine if best parameters differ from manualParameters
  const bestParams = model.bestSource === 'ai' ? model.aiParameters : model.gridParameters;
  const canCopyBestToManual = !!model.bestSource && bestParams && JSON.stringify(bestParams) !== JSON.stringify(model.manualParameters);

  // Handler for copying best to manual
  const handleCopyBestToManual = useCallback(() => {
    if (!bestParams) return;
    // Update each parameter in manualParameters and parameters
    Object.entries(bestParams).forEach(([param, value]) => {
      onParameterUpdate(param, value as number);
    });
    // Switch to manual mode
    setLocalSelectedMethod('manual');
    if (onMethodSelection) {
      onMethodSelection('manual');
    } else {
      onResetToManual();
    }
  }, [bestParams, onParameterUpdate, setLocalSelectedMethod, onMethodSelection, onResetToManual]);

  // If model has no parameters, don't render anything
  if (!hasParameters) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header with badges - always visible */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Settings className="h-4 w-4" />
              <span className="font-medium">Parameters</span>
            </div>
            <div className="flex items-center gap-2">
              <ParameterBadges
                canOptimize={canOptimize}
                aiForecastModelOptimizationEnabled={aiForecastModelOptimizationEnabled}
                localSelectedMethod={localSelectedMethod}
                cacheVersion={cacheVersion}
                onMethodChange={handlePreferenceChange}
                hasGridParameters={!!model.gridParameters}
                bestMethod={model.bestMethod}
                winnerMethod={model.winnerMethod}
                isWinner={model.isWinner}
              />
              {/* Copy Best to Manual Button */}
              {canCopyBestToManual && (
                <button
                  className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded border border-blue-300 hover:bg-blue-200"
                  onClick={handleCopyBestToManual}
                  disabled={!canCopyBestToManual}
                  title="Copy the best (Grid/AI) parameters to Manual for further tuning"
                >
                  Copy Best to Manual
                </button>
              )}
            </div>
          </div>

          {/* Parameter sliders - always visible */}
          <ParameterSliders
            model={model}
            isManual={isManual}
            disabled={disabled}
            getParameterValue={getParameterValue}
            onParameterChange={handleParameterChange}
          />

          {/* Optimization reasoning - collapsible */}
          {hasOptimizationResults && (
            <Collapsible open={isReasoningExpanded} onOpenChange={setIsReasoningExpanded}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
                  {isReasoningExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span className="text-sm font-medium">Optimization Details</span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pt-2">
                  <ParameterStatusDisplay
                    canOptimize={canOptimize}
                    isManual={isManual}
                    optimizationData={optimizationData}
                    hasOptimizationResults={hasOptimizationResults}
                    localSelectedMethod={localSelectedMethod}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
