
import React from 'react';
import { SalesData, ForecastResult } from '@/pages/Index';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { ProductSelector } from './ProductSelector';
import { ModelParameterPanel } from './ModelParameterPanel';
import { useForecastEngine } from '@/hooks/useForecastEngine';
import { useModelParameters } from '@/hooks/useModelParameters';
import { useOptimization } from '@/hooks/useOptimization';
import { BusinessContext } from '@/types/businessContext';

interface ForecastEngineProps {
  data: SalesData[];
  forecastPeriods: number;
  onForecastGeneration: (results: ForecastResult[], selectedSKU: string) => void;
  selectedSKU: string;
  onSKUChange: (sku: string) => void;
  businessContext?: BusinessContext;
  aiForecastModelOptimizationEnabled: boolean;
}

export const ForecastEngine: React.FC<ForecastEngineProps> = ({
  data,
  forecastPeriods,
  onForecastGeneration,
  selectedSKU,
  onSKUChange,
  businessContext,
  aiForecastModelOptimizationEnabled
}) => {
  const { models, toggleModel, updateParameter, updateModelOptimization, resetModel } = useModelParameters(aiForecastModelOptimizationEnabled);
  
  // Only initialize hooks with valid SKU to prevent cache calls with empty SKU
  const validSKU = selectedSKU && selectedSKU.trim() !== '';
  const { results, isGenerating } = useForecastEngine(
    validSKU ? selectedSKU : '', 
    data, 
    models, 
    forecastPeriods,
    aiForecastModelOptimizationEnabled
  );
  const { isOptimizing, optimizingModel } = useOptimization(
    validSKU ? selectedSKU : '', 
    data, 
    businessContext
  );

  // Pass results to parent when they change
  React.useEffect(() => {
    if (results.length > 0 && validSKU) {
      console.log('ForecastEngine: Passing results to parent for SKU:', selectedSKU);
      onForecastGeneration(results, selectedSKU);
    }
  }, [results, validSKU, selectedSKU, onForecastGeneration]);

  // Ensure we have a valid selectedSKU
  const availableSKUs = Array.from(new Set(data.map(d => d.sku))).sort();
  const effectiveSelectedSKU = selectedSKU || (availableSKUs.length > 0 ? availableSKUs[0] : '');

  // Auto-select first SKU if none selected
  React.useEffect(() => {
    if (!selectedSKU && availableSKUs.length > 0) {
      console.log('ForecastEngine: Auto-selecting first SKU:', availableSKUs[0]);
      onSKUChange(availableSKUs[0]);
    }
  }, [selectedSKU, availableSKUs, onSKUChange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          Forecast Models
        </CardTitle>
        <CardDescription>
          Forecasts are generated automatically. Use grid or AI optimization for better accuracy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ProductSelector
          data={data}
          selectedSKU={effectiveSelectedSKU}
          onSKUChange={onSKUChange}
        />

        {isGenerating && (
          <div className="text-center py-4 text-slate-600">
            Generating forecasts...
          </div>
        )}

        {effectiveSelectedSKU && effectiveSelectedSKU.trim() !== '' && (
          <ModelParameterPanel
            models={models}
            selectedSKU={effectiveSelectedSKU}
            data={data}
            onToggleModel={toggleModel}
            onUpdateParameter={updateParameter}
            onResetModel={resetModel}
            isOptimizing={isOptimizing}
            optimizingModel={optimizingModel}
            aiForecastModelOptimizationEnabled={aiForecastModelOptimizationEnabled}
          />
        )}
      </CardContent>
    </Card>
  );
};
