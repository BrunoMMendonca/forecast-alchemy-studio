
import React from 'react';
import { SalesData } from '@/pages/Index';
import { ModelConfig } from '@/types/forecast';
import { ProductSelector } from './ProductSelector';
import { QueueStatusDisplay } from './QueueStatusDisplay';
import { ModelSelection } from './ModelSelection';

interface ForecastModelsContentProps {
  data: SalesData[];
  selectedSKU: string;
  onSKUChange: (sku: string) => void;
  optimizationQueue?: {
    getSKUsInQueue: () => string[];
    removeSKUsFromQueue: (skus: string[]) => void;
    queueSize: number;
    uniqueSKUCount: number;
  };
  isOptimizing: boolean;
  progress?: {
    currentSKU?: string;
    completedSKUs: number;
    totalSKUs: number;
  } | null;
  hasTriggeredOptimization: boolean;
  models: ModelConfig[];
  onToggleModel: (modelId: string) => void;
  onUpdateParameter: (modelId: string, parameter: string, value: number) => void;
  onResetToManual: (modelId: string) => void;
  onMethodSelection?: (modelId: string, method: 'ai' | 'grid' | 'manual') => void;
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
    <>
      <div className="space-y-4">
        <ProductSelector
          data={data}
          selectedSKU={selectedSKU}
          onSKUChange={onSKUChange}
        />

        {optimizationQueue && (
          <QueueStatusDisplay
            optimizationQueue={{
              getSKUsInQueue: optimizationQueue.getSKUsInQueue,
              removeSKUsFromQueue: optimizationQueue.removeSKUsFromQueue,
              queueSize: optimizationQueue.queueSize,
              uniqueSKUCount: optimizationQueue.uniqueSKUCount
            }}
            isOptimizing={isOptimizing}
            progress={progress}
            hasTriggeredOptimization={hasTriggeredOptimization}
            onOpenQueuePopup={() => {
              // Trigger the global queue popup via a custom event
              window.dispatchEvent(new CustomEvent('openGlobalQueuePopup'));
            }}
          />
        )}
      </div>

      <ModelSelection
        models={models}
        selectedSKU={selectedSKU}
        onToggleModel={onToggleModel}
        onUpdateParameter={onUpdateParameter}
        onResetToManual={onResetToManual}
        onMethodSelection={onMethodSelection}
        grokApiEnabled={grokApiEnabled}
      />
    </>
  );
};
