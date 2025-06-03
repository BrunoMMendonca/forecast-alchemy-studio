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
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useBatchOptimization } from '@/hooks/useBatchOptimization';
import { ModelSelection } from './ModelSelection';
import { ProductSelector } from './ProductSelector';
import { ModelConfig } from '@/types/forecast';

interface ForecastModelsProps {
  data: SalesData[];
  forecastPeriods: number;
  onForecastGeneration: (results: ForecastResult[], selectedSKU: string) => void;
  selectedSKU: string;
  onSKUChange: (sku: string) => void;
}

export const ForecastModels: React.FC<ForecastModelsProps> = ({ 
  data, 
  forecastPeriods,
  onForecastGeneration,
  selectedSKU,
  onSKUChange
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [models, setModels] = useState<ModelConfig[]>(getDefaultModels());
  const { toast } = useToast();
  
  const {
    cache,
    generateDataHash,
    getCachedParameters,
    setCachedParameters,
    isCacheValid
  } = useOptimizationCache();
  
  const { isOptimizing, progress, optimizeAllSKUs } = useBatchOptimization();

  // Auto-select first SKU when data changes
  React.useEffect(() => {
    const skus = Array.from(new Set(data.map(d => d.sku))).sort();
    if (skus.length > 0 && !selectedSKU) {
      onSKUChange(skus[0]);
    }
  }, [data, selectedSKU, onSKUChange]);

  // Load cached parameters when SKU changes
  React.useEffect(() => {
    if (!selectedSKU) return;

    const skuData = data.filter(d => d.sku === selectedSKU);
    const currentDataHash = generateDataHash(skuData);

    setModels(prev => prev.map(model => {
      const cached = getCachedParameters(selectedSKU, model.id);
      
      if (cached && isCacheValid(selectedSKU, model.id, currentDataHash)) {
        return {
          ...model,
          optimizedParameters: cached.parameters,
          optimizationConfidence: cached.confidence
        };
      } else {
        return {
          ...model,
          optimizedParameters: undefined,
          optimizationConfidence: undefined
        };
      }
    }));
  }, [selectedSKU, data, getCachedParameters, isCacheValid, generateDataHash]);

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
            parameters: { ...model.parameters, [parameter]: value },
            optimizedParameters: undefined,
            optimizationConfidence: undefined
          }
        : model
    ));

    recalculateSingleModelForecast(modelId, { [parameter]: value });
  };

  const recalculateSingleModelForecast = async (modelId: string, updatedParams?: Record<string, number>) => {
    if (!selectedSKU) return;

    const model = models.find(m => m.id === modelId);
    if (!model?.enabled) return;

    const skuData = data
      .filter(d => d.sku === selectedSKU)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const frequency = detectDateFrequency(skuData.map(d => d.date));
    const lastDate = new Date(Math.max(...skuData.map(d => new Date(d.date).getTime())));
    const forecastDates = generateForecastDates(lastDate, forecastPeriods, frequency);

    const effectiveParameters = updatedParams || model.optimizedParameters || model.parameters;
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

    const singleResult: ForecastResult = {
      sku: selectedSKU,
      model: model.name,
      predictions: forecastDates.map((date, i) => ({
        date,
        value: Math.round(predictions[i] || 0)
      })),
      accuracy
    };

    onForecastGeneration([singleResult], selectedSKU);
  };

  const useAIOptimization = (modelId: string) => {
    const cached = getCachedParameters(selectedSKU, modelId);
    if (cached) {
      setModels(prev => prev.map(model => 
        model.id === modelId 
          ? { 
              ...model, 
              optimizedParameters: cached.parameters,
              optimizationConfidence: cached.confidence
            }
          : model
      ));
      recalculateSingleModelForecast(modelId);
    }
  };

  const resetToManual = (modelId: string) => {
    setModels(prev => prev.map(model => 
      model.id === modelId 
        ? { 
            ...model, 
            optimizedParameters: undefined,
            optimizationConfidence: undefined
          }
        : model
    ));
  };

  const handleBatchOptimization = async () => {
    const enabledModels = models.filter(m => m.enabled);
    
    await optimizeAllSKUs(data, enabledModels, (sku, modelId, parameters, confidence) => {
      const skuData = data.filter(d => d.sku === sku);
      const dataHash = generateDataHash(skuData);
      setCachedParameters(sku, modelId, parameters, dataHash, confidence);
      
      if (sku === selectedSKU) {
        setModels(prev => prev.map(model => 
          model.id === modelId 
            ? { 
                ...model, 
                optimizedParameters: parameters,
                optimizationConfidence: confidence
              }
            : model
        ));
      }
    });
  };

  const generateForecasts = async () => {
    if (!selectedSKU) {
      toast({
        title: "No Product Selected",
        description: "Please select a product/SKU to generate forecasts for",
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

    try {
      await handleBatchOptimization();

      const skuData = data
        .filter(d => d.sku === selectedSKU)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (skuData.length < 3) {
        toast({
          title: "Insufficient Data",
          description: `Not enough data points for ${selectedSKU}. Need at least 3 data points.`,
          variant: "destructive",
        });
        return;
      }

      const frequency = detectDateFrequency(skuData.map(d => d.date));
      const lastDate = new Date(Math.max(...skuData.map(d => new Date(d.date).getTime())));
      const forecastDates = generateForecastDates(lastDate, forecastPeriods, frequency);
      const results: ForecastResult[] = [];

      for (const model of enabledModels) {
        const effectiveParameters = model.optimizedParameters || model.parameters;
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
          sku: selectedSKU,
          model: model.name,
          predictions: forecastDates.map((date, i) => ({
            date,
            value: Math.round(predictions[i] || 0)
          })),
          accuracy
        });
      }

      onForecastGeneration(results, selectedSKU);
      
      toast({
        title: "Forecasts Generated",
        description: `Generated ${results.length} forecasts for ${selectedSKU} with AI optimization`,
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
    }
  };

  return (
    <div className="space-y-6">
      <ProductSelector
        data={data}
        selectedSKU={selectedSKU}
        onSKUChange={onSKUChange}
      />

      <ModelSelection
        models={models}
        onToggleModel={toggleModel}
        onUpdateParameter={updateParameter}
        onUseAI={useAIOptimization}
        onResetToManual={resetToManual}
      />

      <div className="space-y-3 pt-4">
        <Button 
          onClick={generateForecasts}
          disabled={isGenerating || isOptimizing || !selectedSKU}
          size="lg"
          className="w-full"
        >
          {isGenerating || isOptimizing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              {progress 
                ? `Optimizing ${progress.currentSKU} (${progress.completedSKUs + 1}/${progress.totalSKUs})`
                : `Generating Forecasts for ${selectedSKU}...`
              }
            </>
          ) : (
            <>
              <TrendingUp className="h-4 w-4 mr-2" />
              Generate Optimized Forecasts for {selectedSKU || 'Selected Product'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
