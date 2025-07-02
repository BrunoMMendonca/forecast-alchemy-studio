import React, { useEffect, useState } from 'react';
import { SalesData } from '@/types/forecast';
import { ModelConfig } from '@/types/forecast';
import { ProductSelector } from './ProductSelector';
import { QueueStatusDisplay } from './QueueStatusDisplay';
import { OptimizationProgress } from './OptimizationProgress';
import { ModelCard } from './ModelCard';
import { useSKUStore } from '@/store/skuStore';

// NOTE: Model enable/disable logic based on data requirements is now handled in ModelParameterPanel.tsx for full backend consistency. Do not duplicate this logic here. See ModelParameterPanel.tsx for details.

interface ForecastModelsContentProps {
  data: SalesData[];
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
  aiForecastModelOptimizationEnabled: boolean;
}

export const ForecastModelsContent: React.FC<ForecastModelsContentProps> = ({
  data,
  optimizationQueue,
  isOptimizing,
  progress,
  hasTriggeredOptimization,
  models,
  onToggleModel,
  onUpdateParameter,
  onResetToManual,
  onMethodSelection,
  aiForecastModelOptimizationEnabled
}) => {
  const [requirements, setRequirements] = useState<Record<string, any>>({});
  const [loadingReqs, setLoadingReqs] = useState(true);
  const selectedSKU = useSKUStore(state => state.selectedSKU);
  const setSelectedSKU = useSKUStore(state => state.setSelectedSKU);

  useEffect(() => {
    const fetchRequirements = async () => {
      setLoadingReqs(true);
      try {
        const res = await fetch('/api/models/data-requirements');
        const reqs = await res.json();
        setRequirements(reqs);
      } catch (err) {
        setRequirements({});
      } finally {
        setLoadingReqs(false);
      }
    };
    fetchRequirements();
  }, []);

  // Get data for selected SKU
  const skuData = React.useMemo(() => {
    if (!selectedSKU) return [];
    return data.filter(d => String(d.sku || d['Material Code']) === selectedSKU);
  }, [data, selectedSKU]);

  return (
    <div className="space-y-6">
      <ProductSelector
        data={data}
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
          let disableToggle = false;
          let disableReason = '';
          if (!loadingReqs && requirements[model.id]) {
            // Use total number of time points for the selected SKU
            const timePoints = skuData.length;
            let minObs = requirements[model.id].minObservations;
            minObs = Number(minObs);
            if (timePoints < minObs) {
              disableToggle = true;
              disableReason = requirements[model.id].description + ` (You have ${timePoints})`;
            }
          }
          return (
            <ModelCard
              key={model.id}
              model={model}
              selectedSKU={selectedSKU}
              data={data}
              onToggle={onToggleModel}
              onUpdateParameter={onUpdateParameter}
              onResetToManual={onResetToManual}
              onMethodSelection={onMethodSelection}
              aiForecastModelOptimizationEnabled={aiForecastModelOptimizationEnabled}
              disableToggle={disableToggle}
              disableReason={disableReason}
            />
          );
        })}
      </div>
    </div>
  );
};
