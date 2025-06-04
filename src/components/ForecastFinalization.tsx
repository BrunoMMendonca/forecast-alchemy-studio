import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Edit3, Save, X, TrendingUp } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { exportToCSV } from '@/utils/exportUtils';
import { SalesData, ForecastResult, EditableForecast } from '@/types/sales';

interface ForecastComparison {
  model: string;
  originalValue: number;
  forecastValue: number;
  difference: number;
  percentageChange: number;
}

interface ForecastFinalizationProps {
  results: ForecastResult[];
  data: SalesData[];
  selectedSKU: string;
}

export const ForecastFinalization: React.FC<ForecastFinalizationProps> = ({ results, data, selectedSKU }) => {
  const [selectedModel, setSelectedModel] = useState<string>(results[0]?.model || '');
  const [editableForecasts, setEditableForecasts] = useState<Record<string, EditableForecast[]>>({});
  const [isEditing, setIsEditing] = useState(false);

  // Initialize editable forecasts when results change
  React.useEffect(() => {
    if (results.length > 0) {
      // Set initial selected model to the first result
      setSelectedModel(results[0].model);

      // Initialize editable forecasts for each model
      const initialEditableForecasts: Record<string, EditableForecast[]> = {};
      results.forEach(result => {
        initialEditableForecasts[result.model] = result.predictions.map(p => ({
          date: p.date.toISOString().split('T')[0], // Convert Date to string
          value: p.value,
          isEdited: false
        }));
      });
      setEditableForecasts(initialEditableForecasts);
    }
  }, [results]);

  const currentForecast = useMemo(() => {
    return results.find(r => r.model === selectedModel);
  }, [selectedModel, results]);

  const skuData = useMemo(() => {
    return data.filter(d => d.sku === selectedSKU);
  }, [data, selectedSKU]);

  const forecastComparison = useMemo<ForecastComparison[]>(() => {
    if (!currentForecast) return [];

    return currentForecast.predictions.map((forecast, index) => {
      const lastSales = skuData[skuData.length - currentForecast.predictions.length + index]?.sales || 0;
      const difference = forecast.value - lastSales;
      const percentageChange = lastSales !== 0 ? (difference / lastSales) * 100 : 0;

      return {
        model: currentForecast.model,
        originalValue: lastSales,
        forecastValue: forecast.value,
        difference: difference,
        percentageChange: percentageChange,
      };
    });
  }, [currentForecast, skuData]);

  const handleModelChange = (newModelName: string) => {
    console.log(`🔄 Switching to model: ${newModelName}`);
    setSelectedModel(newModelName);
    
    // Reset editable forecasts for new model
    const modelResult = results.find(r => r.model === newModelName);
    if (modelResult) {
      setEditableForecasts(prev => ({
        ...prev,
        [newModelName]: modelResult.predictions.map(p => ({
          date: p.date.toISOString().split('T')[0], // Convert Date to string
          value: p.value,
          isEdited: false
        }))
      }));
    }
  };

  const handleValueChange = (date: string, value: number) => {
    setEditableForecasts(prev => {
      const updatedModelForecasts = prev[selectedModel].map(item => {
        if (item.date === date) {
          return { ...item, value, isEdited: true };
        }
        return item;
      });
      return { ...prev, [selectedModel]: updatedModelForecasts };
    });
  };

  const handleToggleEdit = () => {
    setIsEditing(!isEditing);
  };

  const handleRevertValue = (date: string) => {
    setEditableForecasts(prev => {
      const modelResult = results.find(r => r.model === selectedModel);
      if (!modelResult) return prev;

      const originalValue = modelResult.predictions.find(p => p.date.toISOString().split('T')[0] === date)?.value || 0;

      const updatedModelForecasts = prev[selectedModel].map(item => {
        if (item.date === date) {
          return { ...item, value: originalValue, isEdited: false };
        }
        return item;
      });
      return { ...prev, [selectedModel]: updatedModelForecasts };
    });
  };

  const handleSaveChanges = () => {
    // Implement save logic here (e.g., send data to API)
    toast({
      title: "Forecasts Saved",
      description: "Your finalized forecasts have been successfully saved.",
    });
    setIsEditing(false);
  };

  const handleDownloadCSV = () => {
    if (!currentForecast) return;

    const csvData = [
      ["Date", "Original Value", "Forecast Value", "Difference", "Percentage Change"],
      ...forecastComparison.map(item => [
        item.model,
        item.originalValue.toString(),
        item.forecastValue.toString(),
        item.difference.toString(),
        item.percentageChange.toFixed(2) + "%",
      ]),
    ];

    exportToCSV(csvData, `forecast_comparison_${selectedSKU}_${selectedModel}.csv`);
  };

  if (!currentForecast) {
    return <div>No forecast results available for the selected SKU.</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Finalize Forecasts</CardTitle>
          <CardDescription>
            Review and finalize your sales forecasts for {selectedSKU}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={selectedModel} className="w-full">
            <TabsList>
              {results.map(result => (
                <TabsTrigger key={result.model} value={result.model} onClick={() => handleModelChange(result.model)}>
                  {result.model}
                </TabsTrigger>
              ))}
            </TabsList>
            {results.map(result => (
              <TabsContent key={result.model} value={result.model}>
                <div className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      {result.model} Forecasts
                    </h3>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">
                        Accuracy: {result.accuracy.toFixed(1)}%
                      </Badge>
                      <Button variant="outline" size="sm" onClick={handleToggleEdit}>
                        {isEditing ? (
                          <>
                            <X className="h-4 w-4 mr-2" />
                            Cancel Edit
                          </>
                        ) : (
                          <>
                            <Edit3 className="h-4 w-4 mr-2" />
                            Edit Forecasts
                          </>
                        )}
                      </Button>
                      {isEditing && (
                        <Button variant="secondary" size="sm" onClick={handleSaveChanges}>
                          <Save className="h-4 w-4 mr-2" />
                          Save Changes
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={handleDownloadCSV}>
                        <Download className="h-4 w-4 mr-2" />
                        Download CSV
                      </Button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">Date</TableHead>
                          <TableHead>Original Value</TableHead>
                          <TableHead>Forecast Value</TableHead>
                          <TableHead>Difference</TableHead>
                          <TableHead>Percentage Change</TableHead>
                          {isEditing && <TableHead className="text-right">Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {forecastComparison.map((item, index) => {
                          const forecastDate = currentForecast.predictions[index].date.toISOString().split('T')[0];
                          const editableValue = editableForecasts[selectedModel].find(ef => ef.date === forecastDate)?.value || item.forecastValue;
                          const isEdited = editableForecasts[selectedModel].find(ef => ef.date === forecastDate)?.isEdited || false;

                          return (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{forecastDate}</TableCell>
                              <TableCell>{item.originalValue}</TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <div className="flex items-center space-x-2">
                                    <Input
                                      type="number"
                                      value={editableValue}
                                      onChange={(e) => handleValueChange(forecastDate, parseFloat(e.target.value))}
                                      className="w-24 h-8"
                                    />
                                    {isEdited && (
                                      <Badge variant="outline">Edited</Badge>
                                    )}
                                  </div>
                                ) : (
                                  item.forecastValue
                                )}
                              </TableCell>
                              <TableCell>{item.difference}</TableCell>
                              <TableCell>{item.percentageChange.toFixed(2)}%</TableCell>
                              {isEditing && (
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRevertValue(forecastDate)}
                                  >
                                    <X className="h-4 w-4 mr-2" />
                                    Revert
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
