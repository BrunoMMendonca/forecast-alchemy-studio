
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
import { hasOptimizableParameters } from '@/utils/modelConfig';

interface ForecastEngineProps {
  data: SalesData[];
  forecastPeriods: number;
  onForecastGeneration: (results: ForecastResult[], selectedSKU: string) => void;
  selectedSKU: string;
  onSKUChange: (sku: string) => void;
  businessContext?: BusinessContext;
  grokApiEnabled?: boolean;
}

export const ForecastEngine: React.FC<ForecastEngineProps> = ({
  data,
  forecastPeriods,
  onForecastGeneration,
  selectedSKU,
  onSKUChange,
  businessContext,
  grokApiEnabled = true
}) => {
  const { models, toggleModel, updateParameter, updateModelOptimization, resetModel } = useModelParameters();
  
  // Only initialize hooks with valid SKU to prevent cache calls with empty SKU
  const validSKU = selectedSKU && selectedSKU.trim() !== '';
  const { results, isGenerating } = useForecastEngine(
    validSKU ? selectedSKU : '', 
    data, 
    models, 
    forecastPeriods,
    grokApiEnabled
  );
  const { isOptimizing, optimizingModel, optimizeModel } = useOptimization(
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

  const handleOptimizeModel = async (modelId: string, method: 'ai' | 'grid') => {
    if (!validSKU) {
      console.log('ForecastEngine: Cannot optimize without valid SKU');
      return;
    }

    // If AI method is requested but Grok API is disabled, use grid instead
    if (method === 'ai' && !grokApiEnabled) {
      console.log('ForecastEngine: Grok API disabled, falling back to grid optimization');
      method = 'grid';
    }

    const model = models.find(m => m.id === modelId);
    if (!model) return;

    // Check if model has optimizable parameters before attempting optimization
    if (!hasOptimizableParameters(model)) {
      console.log('ForecastEngine: Model has no optimizable parameters, skipping optimization:', modelId);
      return;
    }

    const result = await optimizeModel(model, method);
    if (result) {
      updateModelOptimization(
        modelId,
        result.parameters,
        result.confidence,
        result.reasoning,
        result.method
      );
    }
  };

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
            onToggleModel={toggleModel}
            onUpdateParameter={updateParameter}
            onOptimizeModel={handleOptimizeModel}
            onResetModel={resetModel}
            isOptimizing={isOptimizing}
            optimizingModel={optimizingModel}
            grokApiEnabled={grokApiEnabled}
          />
        )}
      </CardContent>
    </Card>
  );
};
