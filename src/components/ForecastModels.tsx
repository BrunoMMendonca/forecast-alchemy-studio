import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Calculator, Target, Calendar, Activity, BarChart3, Loader2 } from 'lucide-react';
import { SalesData, ForecastResult } from '@/pages/Index';
import { useToast } from '@/hooks/use-toast';
import { detectDateFrequency, generateForecastDates } from '@/utils/dateUtils';
import { 
  calculateSeasonalDecomposition, 
  generateSeasonalMovingAverage, 
  generateHoltWinters, 
  generateSeasonalNaive 
} from '@/utils/seasonalUtils';
import { optimizeParametersWithGrok } from '@/utils/grokApiUtils';

interface ForecastModelsProps {
  data: SalesData[];
  onForecastGeneration: (results: ForecastResult[]) => void;
}

interface ModelConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  parameters?: Record<string, number>;
  isSeasonal?: boolean;
  optimizedParameters?: Record<string, number>;
  optimizationConfidence?: number;
}

// Pre-configured Grok API key - replace with your actual API key
const GROK_API_KEY = 'your-grok-api-key-here';

export const ForecastModels: React.FC<ForecastModelsProps> = ({ data, onForecastGeneration }) => {
  const [forecastPeriods, setForecastPeriods] = useState(12);
  const [isGenerating, setIsGenerating] = useState(false);
  const [optimizationProgress, setOptimizationProgress] = useState<string>('');
  const { toast } = useToast();

  const [models, setModels] = useState<ModelConfig[]>([
    {
      id: 'moving_average',
      name: 'Simple Moving Average',
      description: 'Uses the average of the last N data points to predict future values',
      icon: <Calculator className="h-4 w-4" />,
      enabled: true,
      parameters: { window: 3 }
    },
    {
      id: 'exponential_smoothing',
      name: 'Exponential Smoothing',
      description: 'Gives more weight to recent observations while smoothing out fluctuations',
      icon: <TrendingUp className="h-4 w-4" />,
      enabled: true,
      parameters: { alpha: 0.3 }
    },
    {
      id: 'linear_trend',
      name: 'Linear Trend',
      description: 'Fits a linear regression line to historical data and extrapolates',
      icon: <Target className="h-4 w-4" />,
      enabled: true,
      parameters: {}
    },
    {
      id: 'seasonal_moving_average',
      name: 'Seasonal Moving Average',
      description: 'Moving average that accounts for seasonal patterns in your data',
      icon: <Calendar className="h-4 w-4" />,
      enabled: true,
      parameters: { window: 3 },
      isSeasonal: true
    },
    {
      id: 'holt_winters',
      name: 'Holt-Winters (Triple Exponential)',
      description: 'Advanced model that handles trend and seasonality simultaneously',
      icon: <Activity className="h-4 w-4" />,
      enabled: true,
      parameters: { alpha: 0.3, beta: 0.1, gamma: 0.1 },
      isSeasonal: true
    },
    {
      id: 'seasonal_naive',
      name: 'Seasonal Naive',
      description: 'Uses the same period from the previous season as the forecast',
      icon: <BarChart3 className="h-4 w-4" />,
      enabled: true,
      parameters: {},
      isSeasonal: true
    }
  ]);

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

  const optimizeModelParameters = async (model: ModelConfig, skuData: SalesData[], frequency: any) => {
    if (!model.parameters || Object.keys(model.parameters).length === 0) {
      return model.parameters;
    }

    try {
      setOptimizationProgress(`Optimizing ${model.name} parameters with AI...`);
      
      const result = await optimizeParametersWithGrok({
        modelType: model.id,
        historicalData: skuData.map(d => d.sales),
        currentParameters: model.parameters,
        seasonalPeriod: frequency.seasonalPeriod,
        targetMetric: 'mape'
      }, GROK_API_KEY);

      // Update model with optimized parameters
      setModels(prev => prev.map(m => 
        m.id === model.id 
          ? { 
              ...m, 
              optimizedParameters: result.optimizedParameters,
              optimizationConfidence: result.confidence
            }
          : m
      ));

      return result.optimizedParameters;
    } catch (error) {
      console.error(`Failed to optimize ${model.name}:`, error);
      toast({
        title: "Optimization Warning",
        description: `Failed to optimize ${model.name}, using manual parameters`,
        variant: "destructive",
      });
      return model.parameters;
    }
  };

  // Simple Moving Average implementation
  const generateMovingAverage = (salesData: SalesData[], window: number): number[] => {
    const values = salesData.map(d => d.sales);
    const predictions: number[] = [];
    
    for (let i = 0; i < forecastPeriods; i++) {
      const recentValues = values.slice(-window);
      const average = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
      predictions.push(average);
      values.push(average);
    }
    
    return predictions;
  };

  // Exponential Smoothing implementation
  const generateExponentialSmoothing = (salesData: SalesData[], alpha: number): number[] => {
    const values = salesData.map(d => d.sales);
    let lastSmoothed = values[values.length - 1];
    const predictions: number[] = [];
    
    for (let i = 0; i < forecastPeriods; i++) {
      predictions.push(lastSmoothed);
    }
    
    return predictions;
  };

  // Linear Trend implementation
  const generateLinearTrend = (salesData: SalesData[]): number[] => {
    const values = salesData.map(d => d.sales);
    const n = values.length;
    
    const xSum = (n * (n - 1)) / 2;
    const ySum = values.reduce((sum, val) => sum + val, 0);
    const xySum = values.reduce((sum, val, i) => sum + val * i, 0);
    const xSquaredSum = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * xySum - xSum * ySum) / (n * xSquaredSum - xSum * xSum);
    const intercept = (ySum - slope * xSum) / n;
    
    const predictions: number[] = [];
    for (let i = 0; i < forecastPeriods; i++) {
      const prediction = intercept + slope * (n + i);
      predictions.push(Math.max(0, prediction));
    }
    
    return predictions;
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
              predictions = generateMovingAverage(skuData, effectiveParameters?.window || 3);
              break;
            case 'exponential_smoothing':
              predictions = generateExponentialSmoothing(skuData, effectiveParameters?.alpha || 0.3);
              break;
            case 'linear_trend':
              predictions = generateLinearTrend(skuData);
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
            model: model.name + (model.optimizationConfidence ? ` (AI: ${model.optimizationConfidence.toFixed(0)}%)` : ''),
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
      {/* Forecast Parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Forecast Parameters</CardTitle>
          <CardDescription>Configure the forecasting settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="forecast-periods">Forecast Periods</Label>
            <Input
              id="forecast-periods"
              type="number"
              value={forecastPeriods}
              onChange={(e) => setForecastPeriods(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              max={365}
              className="w-32"
            />
            <p className="text-sm text-slate-500">
              Number of future periods to forecast (automatically detects your data frequency)
            </p>
          </div>

          {optimizationProgress && (
            <div className="flex items-center gap-2 text-purple-700 p-3 bg-purple-50 rounded-lg border border-purple-200">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">{optimizationProgress}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Model Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-800">Select Forecasting Models</h3>
        <p className="text-sm text-slate-500">
          Parameters are automatically optimized with AI for better accuracy
        </p>
        
        {/* Basic Models */}
        <div className="space-y-4">
          <h4 className="text-md font-medium text-slate-700">Basic Models</h4>
          {models.filter(m => !m.isSeasonal).map((model) => (
            <Card key={model.id} className={`transition-all ${model.enabled ? 'ring-2 ring-blue-200' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={model.enabled}
                    onCheckedChange={() => toggleModel(model.id)}
                  />
                  {model.icon}
                  <div className="flex-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      {model.name}
                      {model.optimizationConfidence && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                          AI: {model.optimizationConfidence.toFixed(0)}% confidence
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {model.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              {model.enabled && model.parameters && Object.keys(model.parameters).length > 0 && (
                <CardContent className="pt-0">
                  <div className="space-y-3 pl-8">
                    {Object.entries(model.optimizedParameters || model.parameters).map(([param, value]) => (
                      <div key={param} className="flex items-center space-x-3">
                        <Label className="w-20 text-sm capitalize">{param}:</Label>
                        <Input
                          type="number"
                          value={value}
                          onChange={(e) => updateParameter(model.id, param, parseFloat(e.target.value) || 0)}
                          className="w-24 h-8"
                          step={param === 'alpha' || param === 'beta' || param === 'gamma' ? 0.1 : 1}
                          min={param === 'alpha' || param === 'beta' || param === 'gamma' ? 0.1 : 1}
                          max={param === 'alpha' || param === 'beta' || param === 'gamma' ? 1 : 30}
                          disabled={!!model.optimizedParameters}
                        />
                        <span className="text-xs text-slate-500">
                          {param === 'window' && 'periods'}
                          {(param === 'alpha' || param === 'beta' || param === 'gamma') && '(0.1-1.0)'}
                          {model.optimizedParameters && <span className="text-purple-600 ml-1">(AI optimized)</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>

        {/* Seasonal Models */}
        <div className="space-y-4">
          <h4 className="text-md font-medium text-slate-700">Seasonal Models</h4>
          <p className="text-sm text-slate-500">
            These models automatically detect and account for seasonal patterns in your data
          </p>
          {models.filter(m => m.isSeasonal).map((model) => (
            <Card key={model.id} className={`transition-all ${model.enabled ? 'ring-2 ring-green-200' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={model.enabled}
                    onCheckedChange={() => toggleModel(model.id)}
                  />
                  {model.icon}
                  <div className="flex-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      {model.name}
                      {model.optimizationConfidence && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                          AI: {model.optimizationConfidence.toFixed(0)}% confidence
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {model.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              {model.enabled && model.parameters && Object.keys(model.parameters).length > 0 && (
                <CardContent className="pt-0">
                  <div className="space-y-3 pl-8">
                    {Object.entries(model.optimizedParameters || model.parameters).map(([param, value]) => (
                      <div key={param} className="flex items-center space-x-3">
                        <Label className="w-20 text-sm capitalize">{param}:</Label>
                        <Input
                          type="number"
                          value={value}
                          onChange={(e) => updateParameter(model.id, param, parseFloat(e.target.value) || 0)}
                          className="w-24 h-8"
                          step={param === 'alpha' || param === 'beta' || param === 'gamma' ? 0.1 : 1}
                          min={param === 'alpha' || param === 'beta' || param === 'gamma' ? 0.1 : 1}
                          max={param === 'alpha' || param === 'beta' || param === 'gamma' ? 1 : 30}
                          disabled={!!model.optimizedParameters}
                        />
                        <span className="text-xs text-slate-500">
                          {param === 'window' && 'periods'}
                          {(param === 'alpha' || param === 'beta' || param === 'gamma') && '(0.1-1.0)'}
                          {model.optimizedParameters && <span className="text-purple-600 ml-1">(AI optimized)</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </div>

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
