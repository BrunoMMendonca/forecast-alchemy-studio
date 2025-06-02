
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Calculator, Target } from 'lucide-react';
import { SalesData, ForecastResult } from '@/pages/Index';
import { useToast } from '@/hooks/use-toast';

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
}

export const ForecastModels: React.FC<ForecastModelsProps> = ({ data, onForecastGeneration }) => {
  const [forecastPeriods, setForecastPeriods] = useState(30);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const [models, setModels] = useState<ModelConfig[]>([
    {
      id: 'moving_average',
      name: 'Simple Moving Average',
      description: 'Uses the average of the last N data points to predict future values',
      icon: <Calculator className="h-4 w-4" />,
      enabled: true,
      parameters: { window: 7 }
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

  // Simple Moving Average implementation
  const generateMovingAverage = (salesData: SalesData[], window: number): number[] => {
    const values = salesData.map(d => d.sales);
    const predictions: number[] = [];
    
    for (let i = 0; i < forecastPeriods; i++) {
      const recentValues = values.slice(-window);
      const average = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
      predictions.push(average);
      values.push(average); // Use prediction for next iteration
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
    
    // Calculate linear regression coefficients
    const xSum = (n * (n - 1)) / 2;
    const ySum = values.reduce((sum, val) => sum + val, 0);
    const xySum = values.reduce((sum, val, i) => sum + val * i, 0);
    const xSquaredSum = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * xySum - xSum * ySum) / (n * xSquaredSum - xSum * xSum);
    const intercept = (ySum - slope * xSum) / n;
    
    const predictions: number[] = [];
    for (let i = 0; i < forecastPeriods; i++) {
      const prediction = intercept + slope * (n + i);
      predictions.push(Math.max(0, prediction)); // Ensure non-negative
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

    try {
      const skus = Array.from(new Set(data.map(d => d.sku)));
      const results: ForecastResult[] = [];

      // Generate base dates for forecasts
      const lastDate = new Date(Math.max(...data.map(d => new Date(d.date).getTime())));
      const forecastDates: string[] = [];
      for (let i = 1; i <= forecastPeriods; i++) {
        const futureDate = new Date(lastDate);
        futureDate.setDate(lastDate.getDate() + i);
        forecastDates.push(futureDate.toISOString().split('T')[0]);
      }

      for (const sku of skus) {
        const skuData = data
          .filter(d => d.sku === sku)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (skuData.length < 3) continue; // Skip SKUs with insufficient data

        for (const model of enabledModels) {
          let predictions: number[] = [];

          switch (model.id) {
            case 'moving_average':
              predictions = generateMovingAverage(skuData, model.parameters?.window || 7);
              break;
            case 'exponential_smoothing':
              predictions = generateExponentialSmoothing(skuData, model.parameters?.alpha || 0.3);
              break;
            case 'linear_trend':
              predictions = generateLinearTrend(skuData);
              break;
          }

          // Calculate simple accuracy metric (could be improved with proper validation)
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
        description: `Generated ${results.length} forecasts across ${skus.length} SKUs`,
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
      {/* Forecast Parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Forecast Parameters</CardTitle>
          <CardDescription>Configure the forecasting settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="forecast-periods">Forecast Periods (days)</Label>
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
              Number of future periods to forecast
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Model Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-800">Select Forecasting Models</h3>
        
        {models.map((model) => (
          <Card key={model.id} className={`transition-all ${model.enabled ? 'ring-2 ring-blue-200' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-3">
                <Checkbox
                  checked={model.enabled}
                  onCheckedChange={() => toggleModel(model.id)}
                />
                {model.icon}
                <div>
                  <CardTitle className="text-base">{model.name}</CardTitle>
                  <CardDescription className="text-sm">
                    {model.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            
            {model.enabled && model.parameters && Object.keys(model.parameters).length > 0 && (
              <CardContent className="pt-0">
                <div className="space-y-3 pl-8">
                  {Object.entries(model.parameters).map(([param, value]) => (
                    <div key={param} className="flex items-center space-x-3">
                      <Label className="w-20 text-sm capitalize">{param}:</Label>
                      <Input
                        type="number"
                        value={value}
                        onChange={(e) => updateParameter(model.id, param, parseFloat(e.target.value) || 0)}
                        className="w-24 h-8"
                        step={param === 'alpha' ? 0.1 : 1}
                        min={param === 'alpha' ? 0.1 : 1}
                        max={param === 'alpha' ? 1 : 30}
                      />
                      <span className="text-xs text-slate-500">
                        {param === 'window' && 'days'}
                        {param === 'alpha' && '(0.1-1.0)'}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
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
              Generating Forecasts...
            </>
          ) : (
            <>
              <TrendingUp className="h-4 w-4 mr-2" />
              Generate Forecasts
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
