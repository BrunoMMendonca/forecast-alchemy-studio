import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, BarChart3, Settings, RefreshCw, Calendar } from 'lucide-react';
import { ModelParameterPanel } from '../ModelParameterPanel';
import { useForecastWizardStore } from '@/store/forecastWizardStore';
import { useOptimizationStatusContext } from '@/contexts/OptimizationStatusContext';
import { useBestResultsMapping } from '@/hooks/useBestResultsMapping';
import { useSKUStore } from '@/store/skuStore';
import { useForecastStore } from '@/store/forecastStore';
import { ChartModal } from './ChartModal';
import { ModelConfig } from '@/types/forecast';
import { generateForecasts, storeForecast } from '@/services/forecastService';

interface ReviewTuneStepProps {
  data: any[];
  models: any[];
  updateModel: (modelId: string, updates: any) => void;
  aiForecastModelOptimizationEnabled: boolean;
  isOptimizing?: boolean;
  processedDataInfo?: any;
  datasetId?: number;
  companyId?: string; // New: company identifier
}

export const ReviewTuneStep: React.FC<ReviewTuneStepProps> = ({
  data,
  models,
  updateModel,
  aiForecastModelOptimizationEnabled,
  isOptimizing,
  processedDataInfo,
  datasetId,
  companyId = 'default_company' // Default company ID
}) => {
  const { setOptimizationResults, selectedModel, setSelectedModel } = useForecastWizardStore();
  const { skuGroups } = useOptimizationStatusContext();
  const selectedSKU = useSKUStore(state => state.selectedSKU);
  
  // Forecast store integration
  const {
    setForecast,
    getForecast,
    setLoading,
    setError,
    clearError,
    getIsLoading,
    getError
  } = useForecastStore();
  
  // Chart modal state
  const [chartModalOpen, setChartModalOpen] = useState(false);
  const [selectedModelForChart, setSelectedModelForChart] = useState<string>('');
  const [selectedModelNameForChart, setSelectedModelNameForChart] = useState<string>('');
  const [selectedPeriodForChart, setSelectedPeriodForChart] = useState<number>(12);
  
  // Forecast periods configuration
  const [forecastPeriods, setForecastPeriods] = useState<number[]>([6, 12, 24]); // 6, 12, 24 months
  const [selectedPeriods, setSelectedPeriods] = useState<number[]>([12]); // Default to 12 months
  
  // Get optimization results for the current SKU
  const skuGroup = skuGroups.find(group => group.sku === selectedSKU);
  const effectiveDatasetId = datasetId || processedDataInfo?.datasetId || 0;
  const effectiveUUID = processedDataInfo?.optimizationId || processedDataInfo?.uuid || 'default';

  // Use the best results mapping hook
  const { bestResults, refreshBestResults } = useBestResultsMapping(
    models,
    selectedSKU || '',
    updateModel,
    effectiveDatasetId,
    undefined, // jobs parameter not needed
    selectedSKU || '',
    effectiveDatasetId
  );

  // Update wizard store with optimization results
  useEffect(() => {
    if (bestResults && bestResults.length > 0) {
      setOptimizationResults(bestResults);
    }
  }, [bestResults, setOptimizationResults]);

  // Generate historical data (same for all models)
  const { historicalData } = useMemo(() => {
    if (!selectedSKU || !data || data.length === 0) {
      return { historicalData: [] };
    }

    try {
      // Get historical data for the selected SKU
      const skuData = data
        .filter(d => d['Material Code'] === selectedSKU)
        .sort((a, b) => new Date(a['Date']).getTime() - new Date(b['Date']).getTime());

      if (skuData.length === 0) {
        return { historicalData: [] };
      }

      // Convert to historical data format
      const historicalData = skuData.map(d => ({
        date: d['Date'],
        value: d['Sales']
      }));

      return { historicalData };
    } catch (error) {
      console.error('Error processing historical data:', error);
      return { historicalData: [] };
    }
  }, [selectedSKU, data]);

  // Generate forecast for specific model when chart is opened
  const generateForecastForModel = useCallback(async (modelId: string, periods: number[] = [12]) => {
    if (!selectedSKU || !data || data.length === 0 || !bestResults || bestResults.length === 0) {
      return;
    }

    try {
      // Set loading state
      setLoading(companyId, effectiveDatasetId, selectedSKU, modelId, true);
      clearError(companyId, effectiveDatasetId, selectedSKU, modelId);

      // Find the best result for the specific model
      const selectedBestResult = bestResults.find(r => r.modelType === modelId);
      
      if (!selectedBestResult) {
        throw new Error(`No optimization results found for model: ${modelId}`);
      }

      // Get the best method result (prefer AI over grid)
      const bestMethodResult = selectedBestResult.methods.find(m => m.method === 'ai') || 
                              selectedBestResult.methods.find(m => m.method === 'grid') ||
                              selectedBestResult.methods[0];

      if (!bestMethodResult?.bestResult?.parameters) {
        throw new Error(`No optimized parameters found for model: ${modelId}`);
      }

      // Create a temporary model config with optimized parameters
      const tempModel: ModelConfig = {
        id: selectedBestResult.modelType,
        name: selectedBestResult.displayName,
        displayName: selectedBestResult.displayName,
        enabled: true,
        parameters: bestMethodResult.bestResult.parameters,
        manualParameters: {},
        category: selectedBestResult.category,
        description: selectedBestResult.description,
        isSeasonal: selectedBestResult.isSeasonal
      };

      // Generate forecast using the enhanced backend API
      const response = await generateForecasts({
        sku: selectedSKU,
        data: data,
        models: [tempModel],
        forecastPeriods: periods,
        datasetId: effectiveDatasetId,
        companyId: companyId,
        method: bestMethodResult.method || 'manual'
      });

      if (response && response.length > 0) {
        // Transform the response to match our forecast store structure
        const forecastResult = response[0];
        
        // Store the forecast in the forecast store
        const storeData = {
          sku: selectedSKU,
          modelId: modelId,
          modelName: selectedBestResult.displayName,
          datasetId: effectiveDatasetId,
          companyId: companyId,
          methods: [{
            methodId: `${bestMethodResult.method}_${Date.now()}`,
            methodType: (bestMethodResult.method || 'manual') as 'grid' | 'ai' | 'manual',
            periods: periods.map(period => ({
              periodId: `period_${period}_${Date.now()}`,
              periods: period,
              parameters: bestMethodResult.bestResult.parameters,
              generatedAt: new Date().toISOString(),
              predictions: forecastResult.predictions.map(p => ({
                date: p.date,
                value: p.value,
                lowerBound: Math.max(0, p.value * 0.8),
                upperBound: p.value * 1.2
              }))
            }))
          }],
          generatedAt: new Date().toISOString()
        };

        setForecast(companyId, effectiveDatasetId, selectedSKU, modelId, storeData);

        // Also store in backend for persistence
        try {
          await storeForecast({
            companyId,
            datasetId: effectiveDatasetId,
            sku: selectedSKU,
            modelId,
            methodId: storeData.methods[0].methodId,
            periodId: storeData.methods[0].periods[0].periodId,
            data: storeData
          });
        } catch (storeError) {
          console.warn('Failed to store forecast in backend:', storeError);
          // Continue anyway - forecast is cached locally
        }
      }
    } catch (error) {
      console.error(`Error generating forecast for model ${modelId}:`, error);
      setError(companyId, effectiveDatasetId, selectedSKU, modelId, error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(companyId, effectiveDatasetId, selectedSKU, modelId, false);
    }
  }, [selectedSKU, data, bestResults, effectiveDatasetId, companyId, setForecast, setLoading, setError, clearError]);

  // Get cached forecast data
  const getCachedForecast = useCallback((modelId: string, period: number = 12) => {
    const forecast = getForecast(companyId, effectiveDatasetId, selectedSKU, modelId);
    if (!forecast) return null;

    // Find the method and period
    const method = forecast.methods.find(m => m.methodType === 'ai' || m.methodType === 'grid' || m.methodType === 'manual');
    if (!method) return null;

    const periodData = method.periods.find(p => p.periods === period);
    return periodData || null;
  }, [companyId, effectiveDatasetId, selectedSKU, getForecast]);

  const handleToggleModel = (modelId: string) => {
    const model = models.find(m => m.id === modelId);
    if (model) {
      updateModel(modelId, { enabled: !model.enabled });
    }
  };

  const handleUpdateParameter = (modelId: string, parameter: string, value: number) => {
    const model = models.find(m => m.id === modelId);
    if (model) {
      const updatedParameters = { ...model.parameters, [parameter]: value };
      updateModel(modelId, { parameters: updatedParameters });
    }
  };

  const handleResetModel = (modelId: string) => {
    // Reset model to default parameters
    const model = models.find(m => m.id === modelId);
    if (model) {
      // TODO: Get default parameters from model metadata
      updateModel(modelId, { parameters: {} });
    }
  };

  const handleRegenerateOptimization = () => {
    refreshBestResults();
  };

  const handleViewChart = async (modelId: string) => {
    setSelectedModelForChart(modelId);
    const model = models.find(m => m.id === modelId);
    setSelectedModelNameForChart(model?.displayName || model?.name || modelId);
    
    // Check if we have cached forecast data
    const cachedForecast = getCachedForecast(modelId, selectedPeriodForChart);
    
    if (!cachedForecast) {
      // Generate forecast for the selected period
      await generateForecastForModel(modelId, [selectedPeriodForChart]);
    }
    
    setChartModalOpen(true);
  };

  const handlePeriodChange = (period: number) => {
    setSelectedPeriodForChart(period);
  };

  const handleGenerateMultiplePeriods = async (modelId: string) => {
    await generateForecastForModel(modelId, selectedPeriods);
  };

  const getModelPerformanceCards = () => {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Model Performance</h3>
        </div>
        <ModelParameterPanel
          models={models}
          data={data}
          onToggleModel={handleToggleModel}
          onUpdateParameter={handleUpdateParameter}
          onResetModel={handleResetModel}
          isOptimizing={isOptimizing || false}
          optimizingModel={null}
          aiForecastModelOptimizationEnabled={aiForecastModelOptimizationEnabled}
          datasetId={effectiveDatasetId}
          uuid={effectiveUUID}
          onViewChart={handleViewChart}
        />
      </div>
    );
  };

  const getDiagnosticCharts = () => {
    if (!bestResults || bestResults.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No diagnostic charts available.</p>
          <p className="text-sm">Complete optimization to view model diagnostics.</p>
        </div>
      );
    }

    return (
      <Tabs defaultValue={bestResults[0]?.modelType || ""} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          {bestResults.map((result, index) => (
            <TabsTrigger key={result.modelType || `model-${index}`} value={result.modelType || `model-${index}`}>
              {result.displayName || `Model ${index + 1}`}
            </TabsTrigger>
          ))}
        </TabsList>
        {bestResults.map((result, index) => (
          <TabsContent key={result.modelType || `model-${index}`} value={result.modelType || `model-${index}`} className="mt-4">
            <Card>
              <CardContent className="p-6">
                <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                  <div className="text-center text-gray-500">
                    <BarChart3 className="h-8 w-8 mx-auto mb-2" />
                    <p>Diagnostic charts coming soon</p>
                    <p className="text-sm">Residuals, forecasts vs actuals, etc.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    );
  };

  const getParameterTuningPanel = () => {
    if (!selectedModel) {
      return (
        <div className="text-center py-8 text-gray-500">
          <Settings className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>Select a model to tune parameters</p>
        </div>
      );
    }

    const selectedModelConfig = models.find(m => m.id === selectedModel);
    if (!selectedModelConfig) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Parameter Tuning - {selectedModelConfig.displayName || selectedModelConfig.name}
          </CardTitle>
          <CardDescription>
            Adjust parameters and regenerate optimization for better results.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Model:</span>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bestResults?.map((result, index) => (
                    <SelectItem key={result.modelType || `model-${index}`} value={result.modelType || `model-${index}`}>
                      {result.displayName || `Model ${index + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Optimization Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Optimization Results
          </CardTitle>
          <CardDescription>
            Review model performance and fine-tune parameters for better forecasts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {getModelPerformanceCards()}
        </CardContent>
      </Card>

      {/* Chart Modal */}
      <ChartModal
        isOpen={chartModalOpen}
        onClose={() => setChartModalOpen(false)}
        modelId={selectedModelForChart}
        modelName={selectedModelNameForChart}
        historicalData={historicalData}
        forecastData={getCachedForecast(selectedModelForChart, selectedPeriodForChart)?.predictions || []}
        datasetId={effectiveDatasetId}
        sku={selectedSKU || ''}
        onPeriodChange={handlePeriodChange}
        selectedPeriod={selectedPeriodForChart}
        forecastPeriods={forecastPeriods}
        onGenerateMultiplePeriods={handleGenerateMultiplePeriods}
        isLoading={getIsLoading(companyId, effectiveDatasetId, selectedSKU, selectedModelForChart)}
        error={getError(companyId, effectiveDatasetId, selectedSKU, selectedModelForChart)}
      />
    </div>
  );
};