import React, { useState, useRef } from 'react';
import { SalesData, ForecastResult } from '@/pages/Index';
import { useToast } from '@/hooks/use-toast';
import { detectDateFrequency, generateForecastDates } from '@/utils/dateUtils';
import { 
  generateSeasonalMovingAverage, 
  generateHoltWinters, 
  generateSeasonalNaive 
} from '@/utils/seasonalUtils';
import { 
  generateMovingAverage, 
  generateSimpleExponentialSmoothing, 
  generateDoubleExponentialSmoothing,
  generateLinearTrend 
} from '@/utils/forecastAlgorithms';
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
  const [models, setModels] = useState<ModelConfig[]>(getDefaultModels());
  const { toast } = useToast();
  const optimizationStarted = useRef(false);
  
  const {
    cache,
    cacheStats,
    generateDataHash,
    getCachedParameters,
    setCachedParameters,
    isCacheValid,
    getSKUsNeedingOptimization
  } = useOptimizationCache();
  
  const { isOptimizing, progress, optimizeAllSKUs } = useBatchOptimization();

  // Auto-select first SKU when data changes
  React.useEffect(() => {
    const skus = Array.from(new Set(data.map(d => d.sku))).sort();
    if (skus.length > 0 && !selectedSKU) {
      onSKUChange(skus[0]);
    }
  }, [data, selectedSKU, onSKUChange]);

  // Start AI optimization once when component loads with data
  React.useEffect(() => {
    if (data.length > 0 && !optimizationStarted.current) {
      optimizationStarted.current = true;
      handleInitialOptimization();
    }
  }, [data]);

  // Load cached parameters and generate forecasts when SKU changes
  React.useEffect(() => {
    if (!selectedSKU) return;

    const skuData = data.filter(d => d.sku === selectedSKU);
    const currentDataHash = generateDataHash(skuData);

    // Load cached parameters immediately
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

    // Generate forecasts immediately with available data
    setTimeout(() => generateForecastsForSelectedSKU(), 100);
  }, [selectedSKU, data, getCachedParameters, isCacheValid, generateDataHash]);

  const handleInitialOptimization = async () => {
    const enabledModels = models.filter(m => m.enabled);
    
    console.log(`Starting optimization check. Cache stats: ${cacheStats.hits} hits, ${cacheStats.misses} misses`);
    
    await optimizeAllSKUs(
      data, 
      enabledModels, 
      (sku, modelId, parameters, confidence) => {
        const skuData = data.filter(d => d.sku === sku);
        const dataHash = generateDataHash(skuData);
        setCachedParameters(sku, modelId, parameters, dataHash, confidence);
        
        // Update models state if this is for the currently selected SKU
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
      },
      getSKUsNeedingOptimization
    );

    // Generate forecasts after optimization
    if (selectedSKU) {
      setTimeout(() => generateForecastsForSelectedSKU(), 100);
    }
  };

  const generateForecastsForSelectedSKU = async () => {
    if (!selectedSKU) return;

    const enabledModels = models.filter(m => m.enabled);
    if (enabledModels.length === 0) return;

    try {
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
          case 'simple_exponential_smoothing':
            predictions = generateSimpleExponentialSmoothing(skuData, effectiveParameters?.alpha || 0.3, forecastPeriods);
            break;
          case 'double_exponential_smoothing':
            predictions = generateDoubleExponentialSmoothing(
              skuData, 
              effectiveParameters?.alpha || 0.3, 
              effectiveParameters?.beta || 0.1, 
              forecastPeriods
            );
            break;
          case 'exponential_smoothing':
            // Backward compatibility - treat as simple exponential smoothing
            predictions = generateSimpleExponentialSmoothing(skuData, effectiveParameters?.alpha || 0.3, forecastPeriods);
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
      console.log(`Generated forecasts for SKU: ${selectedSKU}`);

    } catch (error) {
      toast({
        title: "Forecast Error",
        description: "Failed to generate forecasts. Please try again.",
        variant: "destructive",
      });
      console.error('Forecast generation error:', error);
    }
  };

  const toggleModel = (modelId: string) => {
    setModels(prev => prev.map(model => 
      model.id === modelId ? { ...model, enabled: !model.enabled } : model
    ));
    
    // Regenerate forecasts after model toggle
    setTimeout(() => generateForecastsForSelectedSKU(), 100);
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

    // Regenerate forecasts after parameter change
    setTimeout(() => generateForecastsForSelectedSKU(), 100);
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
      
      // Regenerate forecasts after switching to AI
      setTimeout(() => generateForecastsForSelectedSKU(), 100);
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
    
    // Regenerate forecasts after switching to manual
    setTimeout(() => generateForecastsForSelectedSKU(), 100);
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

      {isOptimizing && progress && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm font-medium text-blue-800">
              AI Optimizing Parameters...
            </span>
          </div>
          <p className="text-sm text-blue-600">
            Processing {progress.currentSKU} ({progress.completedSKUs + 1}/{progress.totalSKUs})
          </p>
          <p className="text-xs text-blue-500">
            Optimized: {progress.optimized} | From Cache: {progress.skipped}
          </p>
        </div>
      )}

      {cacheStats.hits + cacheStats.misses > 0 && (
        <div className="text-xs text-slate-500 bg-slate-50 rounded p-2">
          Cache: {cacheStats.hits} hits, {cacheStats.misses} misses 
          ({Math.round((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100)}% hit rate)
        </div>
      )}
    </div>
  );
};
