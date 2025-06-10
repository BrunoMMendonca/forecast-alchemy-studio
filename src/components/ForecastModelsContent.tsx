import React from 'react';
import { SalesData } from '@/pages/Index';
import { ModelConfig } from '@/types/forecast';
import { ProductSelector } from './ProductSelector';
import { QueueStatusDisplay } from './QueueStatusDisplay';
import { ModelSelection } from './ModelSelection';
import { OptimizationProgress } from './OptimizationProgress';
import { ModelCard } from './ModelCard';

interface ForecastModelsContentProps {
  data: SalesData[];
  selectedSKU: string;
  onSKUChange: (sku: string) => void;
  optimizationQueue: {
    items: Array<{
      sku: string;
      modelId: string;
      reason: string;
      timestamp: number;
    }>;
    queueSize: number;
    uniqueSKUCount: number;
  };
  isOptimizing: boolean;
  progress: number;
  hasTriggeredOptimization: boolean;
  models: any[];
  onToggleModel: (modelId: string) => void;
  onUpdateParameter: (modelId: string, paramName: string, value: any) => void;
  onResetToManual: (modelId: string) => void;
  onMethodSelection: (modelId: string, method: string) => void;
  grokApiEnabled: boolean;
}

export const ForecastModelsContent: React.FC<ForecastModelsContentProps> = ({
  data,
  selectedSKU,
  onSKUChange,
  optimizationQueue,
  isOptimizing,
  progress,
  hasTriggeredOptimization,
  models,
  onToggleModel,
  onUpdateParameter,
  onResetToManual,
  onMethodSelection,
  grokApiEnabled
}) => {
  return (
    <div className="space-y-6">
      <ProductSelector
        data={data}
        selectedSKU={selectedSKU}
        onSKUChange={onSKUChange}
      />
      
      <OptimizationProgress
        queueSize={optimizationQueue.queueSize}
        uniqueSKUCount={optimizationQueue.uniqueSKUCount}
        isOptimizing={isOptimizing}
        progress={progress}
        hasTriggeredOptimization={hasTriggeredOptimization}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {models.map((model) => {
          const enabledModels = models.filter(m => m.enabled);
          const disableToggle = enabledModels.length === 1 && model.enabled;
          return (
            <ModelCard
              key={model.id}
              model={model}
              onToggle={onToggleModel}
              onUpdateParameter={onUpdateParameter}
              onResetToManual={onResetToManual}
              onMethodSelection={onMethodSelection}
              grokApiEnabled={grokApiEnabled}
              disableToggle={disableToggle}
            />
          );
        })}
      </div>
    </div>
  );
};
