
import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, TrendingUp, Target } from 'lucide-react';
import { ForecastResult } from '@/pages/Index';
import { useToast } from '@/hooks/use-toast';

interface ForecastResultsProps {
  results: ForecastResult[];
}

export const ForecastResults: React.FC<ForecastResultsProps> = ({ results }) => {
  const [selectedSKU, setSelectedSKU] = useState<string>('');
  const { toast } = useToast();

  const skus = useMemo(() => {
    return Array.from(new Set(results.map(r => r.sku))).sort();
  }, [results]);

  // Auto-select first SKU when results change
  React.useEffect(() => {
    if (skus.length > 0 && !selectedSKU) {
      setSelectedSKU(skus[0]);
    }
  }, [skus, selectedSKU]);

  const chartData = useMemo(() => {
    if (!selectedSKU) return [];

    const skuResults = results.filter(r => r.sku === selectedSKU);
    if (skuResults.length === 0) return [];

    // Get all unique dates
    const allDates = Array.from(new Set(
      skuResults.flatMap(r => r.predictions.map(p => p.date))
    )).sort();

    return allDates.map(date => {
      const dataPoint: any = { date };
      
      skuResults.forEach(result => {
        const prediction = result.predictions.find(p => p.date === date);
        if (prediction) {
          dataPoint[result.model] = prediction.value;
        }
      });
      
      return dataPoint;
    });
  }, [results, selectedSKU]);

  const modelColors = {
    'Simple Moving Average': '#3b82f6',
    'Exponential Smoothing': '#10b981',
    'Linear Trend': '#f59e0b'
  };

  const exportResults = () => {
    if (results.length === 0) return;

    // Create CSV content
    const headers = ['SKU', 'Model', 'Date', 'Predicted Value', 'Accuracy %'];
    const rows = results.flatMap(result => 
      result.predictions.map(prediction => [
        result.sku,
        result.model,
        prediction.date,
        prediction.value,
        result.accuracy?.toFixed(1) || 'N/A'
      ])
    );

    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `forecast_results_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Forecast results have been downloaded as CSV",
    });
  };

  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <TrendingUp className="h-12 w-12 mx-auto mb-4 text-slate-300" />
        <p>No forecast results yet.</p>
        <p className="text-sm">Generate forecasts to see predictions here.</p>
      </div>
    );
  }

  const selectedSKUResults = results.filter(r => r.sku === selectedSKU);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-slate-700">
            Select SKU:
          </label>
          <Select value={selectedSKU} onValueChange={setSelectedSKU}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select SKU" />
            </SelectTrigger>
            <SelectContent>
              {skus.map(sku => (
                <SelectItem key={sku} value={sku}>{sku}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Button variant="outline" onClick={exportResults}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Model Accuracy Summary */}
      {selectedSKUResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {selectedSKUResults.map((result) => (
            <Card key={result.model} className="bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4" style={{ color: modelColors[result.model as keyof typeof modelColors] }} />
                  {result.model}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Accuracy:</span>
                    <Badge variant={result.accuracy && result.accuracy > 80 ? "default" : "secondary"}>
                      {result.accuracy ? `${result.accuracy.toFixed(1)}%` : 'N/A'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Predictions:</span>
                    <span className="text-sm font-medium">{result.predictions.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Avg. Value:</span>
                    <span className="text-sm font-medium">
                      {Math.round(result.predictions.reduce((sum, p) => sum + p.value, 0) / result.predictions.length).toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Forecast Chart */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Forecast Comparison - {selectedSKU}
          </CardTitle>
          <CardDescription>
            Compare predictions from different forecasting models
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  stroke="#64748b"
                  fontSize={12}
                  tickFormatter={(value) => {
                    try {
                      return new Date(value).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      });
                    } catch {
                      return value;
                    }
                  }}
                />
                <YAxis 
                  stroke="#64748b"
                  fontSize={12}
                  tickFormatter={(value) => value.toLocaleString()}
                />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    value.toLocaleString(), 
                    name
                  ]}
                  labelFormatter={(label) => {
                    try {
                      return new Date(label).toLocaleDateString();
                    } catch {
                      return label;
                    }
                  }}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend />
                
                {selectedSKUResults.map((result) => (
                  <Line
                    key={result.model}
                    type="monotone"
                    dataKey={result.model}
                    stroke={modelColors[result.model as keyof typeof modelColors]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          {/* Legend */}
          <div className="flex justify-center space-x-6 mt-4 text-sm">
            {selectedSKUResults.map((result) => (
              <div key={result.model} className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: modelColors[result.model as keyof typeof modelColors] }}
                ></div>
                <span>{result.model}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <Card className="bg-slate-50">
        <CardHeader>
          <CardTitle className="text-lg">Forecast Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">{skus.length}</div>
              <div className="text-sm text-slate-600">SKUs Forecasted</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {results.length}
              </div>
              <div className="text-sm text-slate-600">Total Forecasts</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {results[0]?.predictions.length || 0}
              </div>
              <div className="text-sm text-slate-600">Forecast Periods</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {results.filter(r => r.accuracy && r.accuracy > 80).length}
              </div>
              <div className="text-sm text-slate-600">High Accuracy (&gt;80%)</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
