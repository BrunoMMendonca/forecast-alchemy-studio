// This file has been moved to src/components/legacy/ModelSelection.tsx for archival purposes.

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { ModelCard } from './ModelCard';
import { useSKUStore } from '@/store/skuStore';

interface ModelSelectionProps {
  models: ModelConfig[];
  data: SalesData[];
  onToggleModel: (modelId: string) => void;
  onUpdateParameter: (modelId: string, parameter: string, value: number) => void;
  onResetToManual: (modelId: string) => void;
  onMethodSelection?: (modelId: string, method: 'ai' | 'grid' | 'manual') => void;
  aiForecastModelOptimizationEnabled?: boolean;
}

// Helper to get seasonal period from global frequency
function getSeasonalPeriodFromFrequency(frequency: string) {
  switch (frequency) {
    case 'daily': return 7;
    case 'weekly': return 52;
    case 'monthly': return 12;
    case 'quarterly': return 4;
    case 'yearly': return 1;
    default: return 12;
  }
}

export const ModelSelection: React.FC<ModelSelectionProps> = ({
  models,
  data,
  onToggleModel,
  onUpdateParameter,
  onResetToManual,
  onMethodSelection,
  aiForecastModelOptimizationEnabled,
}) => {
  const selectedSKU = useSKUStore(state => state.selectedSKU);

  // Filter data for the selected SKU
  const skuData = React.useMemo(() => {
    if (!selectedSKU) return [];
    return data.filter(d => String(d.sku || d['Material Code']) === selectedSKU);
  }, [data, selectedSKU]);

  // Get frequency from dataset summary if available (assume passed as prop or context)
  // For now, fallback to 'monthly' if not available
  const frequency = (data[0]?.frequency || data[0]?.Frequency || 'monthly') as string;
  const seasonalPeriod = getSeasonalPeriodFromFrequency(frequency);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forecasting Models</CardTitle>
        <CardDescription>
          Select and configure your forecasting models. Optimization happens automatically in the background.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {models.map((model) => {
          let disableToggle = false;
          let disableReason = '';
          if (model.isSeasonal) {
            // Count valid sales values for this SKU (case-insensitive)
            const validSales = skuData.filter(
              d => (d.Sales !== null && d.Sales !== undefined && !isNaN(d.Sales) && d.Sales !== 0) ||
                   (d.sales !== null && d.sales !== undefined && !isNaN(d.sales) && d.sales !== 0)
            );
            if (validSales.length < 2 * seasonalPeriod) {
              disableToggle = true;
              disableReason = `Requires at least 2 full seasons (${2 * seasonalPeriod} valid sales values) for this SKU (frequency: ${frequency}).`;
            }
          }
          return (
            <ModelCard
              key={model.id}
              model={model}
              selectedSKU={selectedSKU}
              data={data}
              onToggle={() => onToggleModel(model.id)}
              onParameterUpdate={(parameter, value) => onUpdateParameter(model.id, parameter, value)}
              onResetToManual={() => onResetToManual(model.id)}
              onMethodSelection={onMethodSelection ? (method) => onMethodSelection(model.id, method) : undefined}
              aiForecastModelOptimizationEnabled={aiForecastModelOptimizationEnabled}
              disableToggle={disableToggle}
              disableReason={disableReason}
            />
          );
        })}
      </CardContent>
    </Card>
  );
};
