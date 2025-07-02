import React, { useEffect, useState } from 'react';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/types/forecast';
import { ModelCard } from './ModelCard';
import { useSKUStore } from '@/store/skuStore';

interface ModelParameterPanelProps {
  models: ModelConfig[];
  data: SalesData[];
  onToggleModel: (modelId: string) => void;
  onUpdateParameter: (modelId: string, parameter: string, value: number) => void;
  onResetModel: (modelId: string) => void;
  isOptimizing: boolean;
  optimizingModel: string | null;
  aiForecastModelOptimizationEnabled?: boolean;
}

export const ModelParameterPanel: React.FC<ModelParameterPanelProps> = ({
  models,
  data,
  onToggleModel,
  onUpdateParameter,
  onResetModel,
  isOptimizing,
  optimizingModel,
  aiForecastModelOptimizationEnabled
}) => {
  const [requirements, setRequirements] = useState<Record<string, any>>({});
  const [loadingReqs, setLoadingReqs] = useState(true);
  const selectedSKU = useSKUStore(state => state.selectedSKU);

  // Get data for selected SKU
  const skuData = React.useMemo(() => {
    if (!selectedSKU) return [];
    return data.filter(d => String(d.sku || d['Material Code']) === selectedSKU);
  }, [data, selectedSKU]);

  // Create a hash of the data to detect changes
  const dataHash = React.useMemo(() => {
    return JSON.stringify(data.slice(0, 10).map(d => ({ sku: d.sku || d['Material Code'], date: d.date || d.Date })));
  }, [data]);

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
  }, [selectedSKU, dataHash]); // Re-fetch when SKU or data content changes

  const handleMethodSelection = (modelId: string, method: 'ai' | 'grid' | 'manual') => {
    const model = models.find(m => m.id === modelId);
    if (!model) return;

    if (method === 'grid' && model.gridParameters) {
      // Apply grid search parameters
      console.log(`🎯 Applying grid search parameters for ${modelId}:`, model.gridParameters);
      Object.entries(model.gridParameters).forEach(([parameter, value]) => {
        // Convert value to number to ensure type safety
        const numericValue = typeof value === 'number' ? value : parseFloat(value as string);
        if (!isNaN(numericValue)) {
          onUpdateParameter(modelId, parameter, numericValue);
        }
      });
    } else if (method === 'manual') {
      // Reset to manual parameters
      onResetModel(modelId);
    }
    // For AI method, we don't apply parameters yet as they come from the backend
  };

  return (
    <div className="space-y-4">
      {models.map((model) => {
        let disableToggle = false;
        let disableReason = '';
        
        if (!loadingReqs && requirements[model.id]) {
          // Use the same logic as backend: account for validation split
          const validationRatio = 0.2; // Match backend default
          const timePoints = skuData.length;
          const minTrain = Number(requirements[model.id].minObservations);
          const requiredTotal = Math.ceil(minTrain / (1 - validationRatio));
          
          if (timePoints < requiredTotal) {
            disableToggle = true;
            disableReason = `${requirements[model.id].description} (You have ${timePoints} points, need ${requiredTotal} for ${minTrain} training points)`;
          }
        }
        
        return (
        <ModelCard
          key={model.id}
          model={model}
          selectedSKU={selectedSKU}
          data={data}
          onToggle={() => onToggleModel(model.id)}
          onUpdateParameter={(parameter, value) => onUpdateParameter(model.id, parameter, typeof value === 'number' ? value : parseFloat(value as string) || 0)}
          onResetToManual={() => onResetModel(model.id)}
          onMethodSelection={handleMethodSelection}
          isOptimizing={isOptimizing && optimizingModel === model.id}
          aiForecastModelOptimizationEnabled={aiForecastModelOptimizationEnabled}
            disableToggle={disableToggle}
            disableReason={disableReason}
        />
        );
      })}
    </div>
  );
};
