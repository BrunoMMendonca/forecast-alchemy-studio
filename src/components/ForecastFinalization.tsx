import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Download, Edit2, Save, X } from 'lucide-react';
import { ForecastSummaryStats } from './ForecastSummaryStats';
import { SalesData, ForecastResult, EditableForecast } from '@/types/sales';
import { exportToCSV } from '@/utils/exportUtils';

interface ForecastFinalizationProps {
  data: SalesData[];
  forecastResults: ForecastResult[];
}

export const ForecastFinalization: React.FC<ForecastFinalizationProps> = ({
  data,
  forecastResults
}) => {
  const [editingForecasts, setEditingForecasts] = useState<Record<string, EditableForecast[]>>({});
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'excel' | 'json'>('csv');

  const skus = Array.from(new Set(forecastResults.map(r => r.sku))).sort();

  const handleEditForecast = (resultKey: string) => {
    const result = forecastResults.find(r => `${r.sku}-${r.model}` === resultKey);
    if (!result) return;

    const editableForecasts = result.predictions.map(p => ({
      date: p.date.toISOString().split('T')[0],
      value: p.value,
      isEdited: false
    }));

    setEditingForecasts(prev => ({
      ...prev,
      [resultKey]: editableForecasts
    }));
  };

  const handleSaveEdit = (resultKey: string) => {
    setEditingForecasts(prev => {
      const newState = { ...prev };
      delete newState[resultKey];
      return newState;
    });
  };

  const handleCancelEdit = (resultKey: string) => {
    setEditingForecasts(prev => {
      const newState = { ...prev };
      delete newState[resultKey];
      return newState;
    });
  };

  const handleValueChange = (resultKey: string, index: number, newValue: number) => {
    setEditingForecasts(prev => ({
      ...prev,
      [resultKey]: prev[resultKey].map((forecast, i) => 
        i === index 
          ? { ...forecast, value: newValue, isEdited: true }
          : forecast
      )
    }));
  };

  const handleExportAll = () => {
    if (forecastResults.length === 0) return;

    const headers = ['SKU', 'Model', 'Date', 'Forecast Value', 'Accuracy %'];
    const rows = forecastResults.flatMap(result => 
      result.predictions.map(prediction => [
        result.sku,
        result.model,
        prediction.date.toISOString().split('T')[0],
        prediction.value.toString(),
        result.accuracy.toFixed(2)
      ])
    );

    exportToCSV([headers, ...rows], 'all_forecasts');
  };

  const handleExportBySKU = (sku: string) => {
    const skuResults = forecastResults.filter(r => r.sku === sku);
    if (skuResults.length === 0) return;

    const headers = ['Model', 'Date', 'Forecast Value', 'Accuracy %'];
    const rows = skuResults.flatMap(result => 
      result.predictions.map(prediction => [
        result.model,
        prediction.date.toISOString().split('T')[0],
        prediction.value.toString(),
        result.accuracy.toFixed(2)
      ])
    );

    exportToCSV([headers, ...rows], `${sku}_forecasts`);
  };

  return (
    <div className="space-y-6">
      <ForecastSummaryStats results={forecastResults} skus={skus} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Forecast Review & Export</span>
            <div className="flex items-center gap-2">
              <Select value={selectedFormat} onValueChange={(value: 'csv' | 'excel' | 'json') => setSelectedFormat(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="excel">Excel</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleExportAll} className="gap-2">
                <Download className="h-4 w-4" />
                Export All
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {skus.length === 0 ? (
            <p className="text-center text-slate-500 py-8">
              No forecasts available for export. Generate forecasts first.
            </p>
          ) : (
            <div className="space-y-6">
              {skus.map(sku => {
                const skuResults = forecastResults.filter(r => r.sku === sku);
                return (
                  <div key={sku} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">{sku}</h3>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleExportBySKU(sku)}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Export SKU
                      </Button>
                    </div>
                    
                    <div className="grid gap-4">
                      {skuResults.map(result => {
                        const resultKey = `${result.sku}-${result.model}`;
                        const isEditing = editingForecasts[resultKey];
                        
                        return (
                          <div key={resultKey} className="border rounded p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{result.model}</span>
                                <Badge variant="secondary">
                                  {result.accuracy.toFixed(1)}% accuracy
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1">
                                {isEditing ? (
                                  <>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => handleSaveEdit(resultKey)}
                                      className="gap-1"
                                    >
                                      <Save className="h-3 w-3" />
                                      Save
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => handleCancelEdit(resultKey)}
                                      className="gap-1"
                                    >
                                      <X className="h-3 w-3" />
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleEditForecast(resultKey)}
                                    className="gap-1"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                    Edit
                                  </Button>
                                )}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-6 gap-2 text-sm">
                              {isEditing ? (
                                isEditing.map((forecast, index) => (
                                  <div key={index} className="space-y-1">
                                    <div className="text-xs text-slate-500">{forecast.date}</div>
                                    <Input
                                      type="number"
                                      value={forecast.value}
                                      onChange={(e) => handleValueChange(resultKey, index, parseFloat(e.target.value) || 0)}
                                      className={`h-8 ${forecast.isEdited ? 'border-orange-300 bg-orange-50' : ''}`}
                                    />
                                  </div>
                                ))
                              ) : (
                                result.predictions.slice(0, 6).map((prediction, index) => (
                                  <div key={index} className="text-center">
                                    <div className="text-xs text-slate-500">
                                      {prediction.date.toISOString().split('T')[0]}
                                    </div>
                                    <div className="font-medium">{prediction.value}</div>
                                  </div>
                                ))
                              )}
                            </div>
                            
                            {result.predictions.length > 6 && !isEditing && (
                              <div className="text-xs text-slate-500 mt-2 text-center">
                                ... and {result.predictions.length - 6} more periods
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
