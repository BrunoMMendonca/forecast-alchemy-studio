
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TrendingUp } from 'lucide-react';
import { SalesData, ForecastResult } from '@/pages/Index';
import { useToast } from '@/hooks/use-toast';
import { detectDateFrequency, generateForecastDates } from '@/utils/dateUtils';
import { 
  generateSeasonalMovingAverage, 
  generateHoltWinters, 
  generateSeasonalNaive 
} from '@/utils/seasonalUtils';
import { generateMovingAverage, generateExponentialSmoothing, generateLinearTrend } from '@/utils/forecastAlgorithms';
import { getDefaultModels } from '@/utils/modelConfig';
import { useParameterOptimization } from '@/hooks/useParameterOptimization';
import { ForecastParameters } from './ForecastParameters';
import { ModelSelection } from './ModelSelection';
import { ModelConfig } from '@/types/forecast';

interface ForecastModelsProps {
  data: SalesData[];
  onForecastGeneration: (results: ForecastResult[]) => void;
}

export const ForecastModels: React.FC<ForecastModelsProps> = ({ data, onForecastGeneration }) => {
  const [forecastPeriods, setForecastPeriods] = useState(12);
  const [isGenerating, setIsGenerating] = useState(false);
  const [models, setModels] = useState<ModelConfig[]>(getDefaultModels());
  const { toast } = useToast();
  const { optimizeModelParameters, optimizationProgress, setOptimizationProgress } = useParameterOptimization();

  const toggleModel = (modelId: string) => {
    setModels(prev => prev.map(model => 
      model.id === modelId ? { ...model, enabled: !model.enabled } : model
    ));
  };

  const updateParameter = (modelId: string, parameter: string, value: number) => {
    setModels(prev => prev.map(model => 
      model.id === modelId 
        ? { 
            ...model, 
            parameters: { ...model.parameters, [parameter]: value }
          }
        : model
    ));
  };

  const generateForecasts = async () => {
    if (data.length === 0) {
      toast({
        title: "No Data",
        description: "Please upload and clean data before generating forecasts",
        variant: "destructive",
      });
      return;
    }

    const enabledModels = models.filter(m => m.enabled);
    if (enabledModels.length === 0) {
      toast({
        title: "No Models Selected",
        description: "Please select at least one forecasting model",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setOptimizationProgress('');

    try {
      const skus = Array.from(new Set(data.map(d => d.sku)));
      const results: ForecastResult[] = [];

      for (const sku of skus) {
        const skuData = data
          .filter(d => d.sku === sku)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (skuData.length < 3) continue;

        const frequency = detectDateFrequency(skuData.map(d => d.date));
        const lastDate = new Date(Math.max(...skuData.map(d => new Date(d.date).getTime())));
        const forecastDates = generateForecastDates(lastDate, forecastPeriods, frequency);

        for (const model of enabledModels) {
          let effectiveParameters = model.parameters;

          // Always optimize parameters with AI for models that have parameters
          if (model.parameters && Object.keys(model.parameters).length > 0) {
            const optimizedParams = await optimizeModelParameters(model, skuData, frequency);
            effectiveParameters = optimizedParams || model.parameters;
          }

          let predictions: number[] = [];

          switch (model.id) {
            case 'moving_average':
              predictions = generateMovingAverage(skuData, effectiveParameters?.window || 3, forecastPeriods);
              break;
            case 'exponential_smoothing':
              predictions = generateExponentialSmoothing(skuData, effectiveParameters?.alpha || 0.3, forecastPeriods);
              break;
            case 'linear_trend':
              predictions = generateLinearTrend(skuData, forecastPeriods);
              break;
            case 'seasonal_moving_average':
              predictions = generateSeasonalMovingAverage(
                skuData.map(d => d.sales),
                effectiveParameters?.window || 3,
                frequency.seasonalPeriod,
                forecastPeriods
              );
              break;
            case 'holt_winters':
              predictions = generateHoltWinters(
                skuData.map(d => d.sales),
                frequency.seasonalPeriod,
                forecastPeriods,
                effectiveParameters?.alpha || 0.3,
                effectiveParameters?.beta || 0.1,
                effectiveParameters?.gamma || 0.1
              );
              break;
            case 'seasonal_naive':
              predictions = generateSeasonalNaive(
                skuData.map(d => d.sales),
                frequency.seasonalPeriod,
                forecastPeriods
              );
              break;
          }

          const recentActual = skuData.slice(-5).map(d => d.sales);
          const recentPredicted = predictions.slice(0, 5);
          const mape = recentActual.reduce((sum, actual, i) => {
            const predicted = recentPredicted[i] || predictions[0];
            return sum + Math.abs((actual - predicted) / actual);
          }, 0) / recentActual.length * 100;
          
          const accuracy = Math.max(0, 100 - mape);

          results.push({
            sku,
            model: model.name,
            predictions: forecastDates.map((date, i) => ({
              date,
              value: Math.round(predictions[i] || 0)
            })),
            accuracy
          });
        }
      }

      onForecastGeneration(results);
      
      toast({
        title: "Forecasts Generated",
        description: `Generated ${results.length} forecasts across ${skus.length} SKUs with AI optimization`,
      });

    } catch (error) {
      toast({
        title: "Forecast Error",
        description: "Failed to generate forecasts. Please try again.",
        variant: "destructive",
      });
      console.error('Forecast generation error:', error);
    } finally {
      setIsGenerating(false);
      setOptimizationProgress('');
    }
  };

  return (
    <div className="space-y-6">
      <ForecastParameters
        forecastPeriods={forecastPeriods}
        setForecastPeriods={setForecastPeriods}
        optimizationProgress={optimizationProgress}
      />

      <ModelSelection
        models={models}
        onToggleModel={toggleModel}
        onUpdateParameter={updateParameter}
      />

      {/* Generate Button */}
      <div className="flex justify-center pt-4">
        <Button 
          onClick={generateForecasts}
          disabled={isGenerating || data.length === 0}
          size="lg"
          className="w-full max-w-md"
        >
          {isGenerating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              {optimizationProgress || 'Generating Forecasts...'}
            </>
          ) : (
            <>
              <TrendingUp className="h-4 w-4 mr-2" />
              Generate AI-Optimized Forecasts
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
