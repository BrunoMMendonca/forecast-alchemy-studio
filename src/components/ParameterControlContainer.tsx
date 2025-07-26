import React, { useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Settings } from 'lucide-react';
import { ModelConfig, SalesData } from '@/types/forecast';
import { ParameterBadges } from './ParameterBadges';
import { ParameterSliders } from './ParameterSliders';
import { ParameterStatusDisplay } from './ParameterStatusDisplay';
import { useModelUIStore, ModelMethod } from '@/store/optimizationStore';

interface ParameterControlContainerProps {
  model: ModelConfig;
  selectedSKU: string;
  data: SalesData[];
  onParameterUpdate: (parameter: string, value: number) => void;
  onResetToManual: () => void;
  onMethodSelection?: (method: 'ai' | 'grid' | 'manual') => void;
  disabled?: boolean;
  aiForecastModelOptimizationEnabled?: boolean;
  filePath: string;
  uuid: string;
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
  filePath,
  uuid,
}) => {
  console.log('[ParameterControlContainer] filePath:', filePath, 'uuid:', uuid, 'modelId:', model.id);
  const modelUI = useModelUIStore(state => state.getModelUIState(filePath, uuid, selectedSKU, model.id));
  const setSelectedMethod = useModelUIStore(state => state.setSelectedMethod);
  const setParameters = useModelUIStore(state => state.setParameters);

  // Use selectedMethod from Zustand, or default to grid/ai/manual based on available parameters
  const localSelectedMethod =
    modelUI?.selectedMethod ||
    (modelUI?.grid?.parameters ? 'grid' : modelUI?.ai?.parameters ? 'ai' : 'manual');

  // Get parameters for the selected method from Zustand
  const getParameterValue = (parameter: string): number | undefined => {
    const methodState = modelUI?.[localSelectedMethod as ModelMethod];
    return methodState?.parameters?.[parameter];
  };

  // Handle badge clicks
  const handlePreferenceChange = (newMethod: ModelMethod) => {
    console.log('[handlePreferenceChange] Attempting to set method:', newMethod, 'for', { filePath, uuid, selectedSKU, modelId: model.id });
    if (localSelectedMethod === newMethod) return;
    setSelectedMethod(filePath, uuid, selectedSKU, model.id, newMethod);
    setTimeout(() => {
      const updatedModelUI = useModelUIStore.getState().getModelUIState(filePath, uuid, selectedSKU, model.id);
      console.log('[handlePreferenceChange] After setSelectedMethod, modelUI:', updatedModelUI);
    }, 100);
    if (onMethodSelection) {
      onMethodSelection(newMethod);
    } else {
      if (newMethod === 'manual') {
        onResetToManual();
      }
    }
  };

  // Helper to determine if best parameters differ from manualParameters
  const bestParams = modelUI?.grid?.parameters || modelUI?.ai?.parameters;
  const manualParams = modelUI?.manual?.parameters;
  const canCopyBestToManual = bestParams && manualParams && JSON.stringify(bestParams) !== JSON.stringify(manualParams);

  // Handler for copying best to manual
  const handleCopyBestToManual = () => {
    if (!bestParams) return;
    setParameters(filePath, uuid, selectedSKU, model.id, 'manual', { parameters: { ...bestParams } });
    setSelectedMethod(filePath, uuid, selectedSKU, model.id, 'manual');
    if (onMethodSelection) {
      onMethodSelection('manual');
    } else {
      onResetToManual();
    }
  };

  // If model has no parameters, don't render anything
  const hasParameters = model.parameters && Object.keys(model.parameters).length > 0;
  if (!hasParameters) {
    return null;
  }

  // Winner/compositeScore from Zustand
  const isWinner = !!modelUI?.[localSelectedMethod as ModelMethod]?.isWinner;
  const compositeScore = modelUI?.[localSelectedMethod as ModelMethod]?.compositeScore;

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header with badges - always visible */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Settings className="h-4 w-4" />
              <span className="font-medium">Parameters</span>
              {/* {isWinner && <span className="ml-2 px-2 py-1 bg-yellow-300 text-yellow-900 rounded text-xs font-bold">Winner</span>} */}
            </div>
            <div className="flex items-center gap-2">
              <ParameterBadges
                canOptimize={hasParameters}
                aiForecastModelOptimizationEnabled={aiForecastModelOptimizationEnabled}
                localSelectedMethod={localSelectedMethod}
                cacheVersion={0}
                onMethodChange={handlePreferenceChange}
                hasGridParameters={!!modelUI?.grid?.parameters}
                bestMethod={undefined}
                winnerMethod={undefined}
                isWinner={isWinner}
              />
            </div>
          </div>

          {/* Parameter sliders - always visible */}
          <ParameterSliders
            model={model}
            modelId={model.id}
            isManual={localSelectedMethod === 'manual'}
            disabled={disabled || localSelectedMethod !== 'manual'}
            getParameterValue={getParameterValue}
            onParameterChange={(parameter, values) => {
              const v = Array.isArray(values) ? values[0] : values;
              setParameters(filePath, uuid, selectedSKU, model.id, localSelectedMethod, { parameters: { ...(modelUI?.[localSelectedMethod]?.parameters || {}), [parameter]: v } });
              if (typeof v === 'number') {
                onParameterUpdate(parameter, v);
              }
            }}
          />

          {/* Optimization reasoning - collapsible (if needed) */}
          {/* TODO: Reimplement optimization reasoning/expansion logic in new structure if needed */}
        </div>
      </CardContent>
    </Card>
  );
};
