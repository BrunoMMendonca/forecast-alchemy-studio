
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Download, Edit3, Save, Trash2, Eye, TrendingUp } from 'lucide-react';
import { SalesData, ForecastResult } from '@/pages/Index';
import { useToast } from '@/hooks/use-toast';
import { exportForecastResults, generateSOPSummary, ExportOptions } from '@/utils/exportUtils';

interface ForecastFinalizationProps {
  historicalData: SalesData[];
  cleanedData: SalesData[];
  forecastResults: ForecastResult[];
}

interface EditableForecast {
  date: string;
  value: number;
  isEdited: boolean;
}

export const ForecastFinalization: React.FC<ForecastFinalizationProps> = ({
  historicalData,
  cleanedData,
  forecastResults
}) => {
  const [selectedSKU, setSelectedSKU] = useState<string>('');
  const [editMode, setEditMode] = useState(false);
  const [editableForecasts, setEditableForecasts] = useState<Record<string, EditableForecast[]>>({});
  const [exportMode, setExportMode] = useState<'all_models' | 'single_forecast'>('single_forecast');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const { toast } = useToast();

  const skus = useMemo(() => {
    return Array.from(new Set(forecastResults.map(r => r.sku))).sort();
  }, [forecastResults]);

  const models = useMemo(() => {
    return Array.from(new Set(forecastResults.map(r => r.model))).sort();
  }, [forecastResults]);

  // Auto-select first SKU when results change
  React.useEffect(() => {
    if (skus.length > 0 && !selectedSKU) {
      setSelectedSKU(skus[0]);
    }
  }, [skus, selectedSKU]);

  // Initialize editable forecasts
  React.useEffect(() => {
    const newEditableForecasts: Record<string, EditableForecast[]> = {};
    
    skus.forEach(sku => {
      const skuResults = forecastResults.filter(r => r.sku === sku);
      const bestResult = skuResults.reduce((best, current) => 
        (current.accuracy || 0) > (best.accuracy || 0) ? current : best
      );
      
      if (bestResult) {
        newEditableForecasts[sku] = bestResult.predictions.map(p => ({
          date: p.date,
          value: p.value,
          isEdited: false
        }));
      }
    });
    
    setEditableForecasts(newEditableForecasts);
  }, [forecastResults, skus]);

  const chartData = useMemo(() => {
    if (!selectedSKU) return [];

    const skuHistorical = cleanedData
      .filter(d => d.sku === selectedSKU)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(d => ({
        date: d.date,
        historical: d.sales,
        type: 'historical'
      }));

    const skuForecasts = editableForecasts[selectedSKU] || [];
    const forecastData = skuForecasts.map(f => ({
      date: f.date,
      forecast: f.value,
      type: 'forecast',
      isEdited: f.isEdited
    }));

    return [...skuHistorical, ...forecastData];
  }, [cleanedData, selectedSKU, editableForecasts]);

  const selectedSKUResults = forecastResults.filter(r => r.sku === selectedSKU);
  const bestModel = selectedSKUResults.reduce((best, current) => 
    (current.accuracy || 0) > (best.accuracy || 0) ? current : best
  );

  const handleEditForecast = (index: number, newValue: number) => {
    if (!selectedSKU) return;
    
    setEditableForecasts(prev => ({
      ...prev,
      [selectedSKU]: prev[selectedSKU].map((forecast, i) => 
        i === index 
          ? { ...forecast, value: newValue, isEdited: true }
          : forecast
      )
    }));
  };

  const handleRemoveForecastPoint = (index: number) => {
    if (!selectedSKU) return;
    
    setEditableForecasts(prev => ({
      ...prev,
      [selectedSKU]: prev[selectedSKU].filter((_, i) => i !== index)
    }));
    
    toast({
      title: "Forecast Point Removed",
      description: "The selected forecast point has been removed",
    });
  };

  const handleAddForecastPoint = () => {
    if (!selectedSKU || !editableForecasts[selectedSKU]) return;
    
    const lastForecast = editableForecasts[selectedSKU][editableForecasts[selectedSKU].length - 1];
    if (!lastForecast) return;
    
    const lastDate = new Date(lastForecast.date);
    const newDate = new Date(lastDate);
    newDate.setMonth(newDate.getMonth() + 1); // Add one month
    
    const newForecast: EditableForecast = {
      date: newDate.toISOString().split('T')[0],
      value: lastForecast.value,
      isEdited: true
    };
    
    setEditableForecasts(prev => ({
      ...prev,
      [selectedSKU]: [...prev[selectedSKU], newForecast]
    }));
    
    toast({
      title: "Forecast Point Added",
      description: "A new forecast point has been added",
    });
  };

  const handleExport = (format: 'csv' | 'json') => {
    if (forecastResults.length === 0) return;

    const exportOptions: ExportOptions = {
      format,
      mode: exportMode,
      selectedModel: exportMode === 'single_forecast' ? selectedModel : undefined,
      includeAccuracy: true,
      includeConfidenceIntervals: false
    };

    exportForecastResults(forecastResults, exportOptions);
    
    toast({
      title: "Export Complete",
      description: `Forecast data exported as ${format.toUpperCase()}`,
    });
  };

  const sopSummary = generateSOPSummary(forecastResults);

  if (forecastResults.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <TrendingUp className="h-12 w-12 mx-auto mb-4 text-slate-300" />
        <p>No forecast results to finalize.</p>
        <p className="text-sm">Generate forecasts first to proceed with finalization.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label>SKU:</Label>
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
          
          <Button
            variant={editMode ? "default" : "outline"}
            onClick={() => setEditMode(!editMode)}
          >
            <Edit3 className="h-4 w-4 mr-2" />
            {editMode ? 'Save Changes' : 'Edit Forecast'}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            Best Model: {bestModel?.model || 'N/A'}
          </Badge>
          {bestModel?.accuracy && (
            <Badge variant="outline">
              {bestModel.accuracy.toFixed(1)}% Accuracy
            </Badge>
          )}
        </div>
      </div>

      {/* Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Historical vs Forecast - {selectedSKU}
          </CardTitle>
          <CardDescription>
            Review and edit your final forecast before export
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-96">
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
                    name === 'historical' ? 'Historical Sales' : 'Forecast'
                  ]}
                  labelFormatter={(label) => {
                    try {
                      return new Date(label).toLocaleDateString();
                    } catch {
                      return label;
                    }
                  }}
                />
                <Legend />
                
                <Line
                  type="monotone"
                  dataKey="historical"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  name="Historical Sales"
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 3 }}
                  name="Forecast"
                />
                
                {/* Separation line between historical and forecast */}
                {chartData.length > 0 && (
                  <ReferenceLine 
                    x={cleanedData.filter(d => d.sku === selectedSKU).slice(-1)[0]?.date} 
                    stroke="#64748b" 
                    strokeDasharray="2 2"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Edit Forecast Table */}
      {editMode && selectedSKU && editableForecasts[selectedSKU] && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Forecast Values</CardTitle>
            <CardDescription>
              Modify individual forecast points or add/remove periods
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-60 overflow-y-auto">
                {editableForecasts[selectedSKU].map((forecast, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 border rounded">
                    <div className="flex-1">
                      <Label className="text-xs text-slate-500">{forecast.date}</Label>
                      <Input
                        type="number"
                        value={forecast.value}
                        onChange={(e) => handleEditForecast(index, parseFloat(e.target.value) || 0)}
                        className="h-8"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      {forecast.isEdited && (
                        <Badge variant="outline" className="text-xs">
                          Edited
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveForecastPoint(index)}
                        className="h-6 w-6 p-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              <Button onClick={handleAddForecastPoint} variant="outline" className="w-full">
                Add Forecast Period
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export Options */}
      <Card>
        <CardHeader>
          <CardTitle>Export Forecast</CardTitle>
          <CardDescription>
            Choose your export format and scope for S&OP or analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Export Mode</Label>
              <Select value={exportMode} onValueChange={(value: 'all_models' | 'single_forecast') => setExportMode(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_forecast">Single Forecast (S&OP)</SelectItem>
                  <SelectItem value="all_models">All Models Comparison</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {exportMode === 'single_forecast' && (
              <div className="space-y-2">
                <Label>Model Selection</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Auto-select best" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Auto-select Best Model</SelectItem>
                    {models.map(model => (
                      <SelectItem key={model} value={model}>{model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={() => handleExport('csv')} className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button onClick={() => handleExport('json')} variant="outline" className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* S&OP Summary */}
      <Card>
        <CardHeader>
          <CardTitle>S&OP Summary</CardTitle>
          <CardDescription>
            Overview of recommended forecasts for Sales & Operations Planning
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">SKU</th>
                  <th className="text-left p-2">Best Model</th>
                  <th className="text-left p-2">Accuracy</th>
                  <th className="text-right p-2">Total Forecast</th>
                  <th className="text-right p-2">Avg per Period</th>
                  <th className="text-center p-2">Periods</th>
                </tr>
              </thead>
              <tbody>
                {sopSummary.map((summary, index) => (
                  <tr key={index} className="border-b hover:bg-slate-50">
                    <td className="p-2 font-medium">{summary.sku}</td>
                    <td className="p-2">{summary.recommendedModel}</td>
                    <td className="p-2">
                      <Badge variant={summary.accuracy > 80 ? 'default' : 'secondary'}>
                        {summary.accuracy.toFixed(1)}%
                      </Badge>
                    </td>
                    <td className="p-2 text-right font-mono">
                      {summary.totalForecast.toLocaleString()}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {summary.avgPeriodForecast.toFixed(0)}
                    </td>
                    <td className="p-2 text-center">{summary.forecastPeriods}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
