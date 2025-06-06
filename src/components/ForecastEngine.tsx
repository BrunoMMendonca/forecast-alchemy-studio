
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
}

export const ForecastEngine: React.FC<ForecastEngineProps> = ({
  data,
  forecastPeriods,
  onForecastGeneration,
  selectedSKU,
  onSKUChange,
  businessContext
}) => {
  const { models, toggleModel, updateParameter, updateModelOptimization, resetModel } = useModelParameters();
  const { results, isGenerating } = useForecastEngine(selectedSKU, data, models, forecastPeriods);
  const { isOptimizing, optimizingModel, optimizeModel } = useOptimization(selectedSKU, data, businessContext);

  // Pass results to parent when they change
  React.useEffect(() => {
    if (results.length > 0 && selectedSKU) {
      onForecastGeneration(results, selectedSKU);
    }
  }, [results, selectedSKU, onForecastGeneration]);

  const handleOptimizeModel = async (modelId: string, method: 'ai' | 'grid') => {
    const model = models.find(m => m.id === modelId);
    if (!model) return;

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
          selectedSKU={selectedSKU}
          onSKUChange={onSKUChange}
        />

        {isGenerating && (
          <div className="text-center py-4 text-slate-600">
            Generating forecasts...
          </div>
        )}

        <ModelParameterPanel
          models={models}
          selectedSKU={selectedSKU}
          onToggleModel={toggleModel}
          onUpdateParameter={updateParameter}
          onOptimizeModel={handleOptimizeModel}
          onResetModel={resetModel}
          isOptimizing={isOptimizing}
          optimizingModel={optimizingModel}
        />
      </CardContent>
    </Card>
  );
};
