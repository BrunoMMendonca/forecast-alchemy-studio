
import React, { useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Settings } from 'lucide-react';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
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
  grokApiEnabled?: boolean;
}

export const ParameterControlContainer: React.FC<ParameterControlContainerProps> = ({
  model,
  selectedSKU,
  data,
  onParameterUpdate,
  onResetToManual,
  onMethodSelection,
  disabled = false,
  grokApiEnabled = true,
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
  } = useParameterControlLogic(model, selectedSKU, data);

  const handleParameterChange = useCallback((parameter: string, values: number[]) => {
    const newValue = values[0];
    console.log(`🎚️ SLIDER CHANGE: ${parameter} = ${newValue} (manual: ${isManual})`);
    onParameterUpdate(parameter, newValue);
  }, [onParameterUpdate, isManual]);

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
  }, [localSelectedMethod, model.id, onMethodSelection, onResetToManual, setLocalSelectedMethod]);

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
            
            <ParameterBadges
              canOptimize={canOptimize}
              grokApiEnabled={grokApiEnabled}
              localSelectedMethod={localSelectedMethod}
              cacheVersion={cacheVersion}
              onMethodChange={handlePreferenceChange}
            />
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
