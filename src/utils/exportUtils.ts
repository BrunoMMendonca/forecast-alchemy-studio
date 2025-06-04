import { SalesData, ForecastResult } from '@/types/sales';

export interface ExportOptions {
  format: 'csv' | 'excel' | 'json';
  mode: 'all_models' | 'single_forecast';
  selectedModel?: string;
  includeAccuracy: boolean;
  includeConfidenceIntervals: boolean;
}

export const exportForecastResults = (
  results: ForecastResult[],
  options: ExportOptions,
  filename?: string
) => {
  const timestamp = new Date().toISOString().split('T')[0];
  const baseFilename = filename || `forecast_${options.mode}_${timestamp}`;

  switch (options.format) {
    case 'csv':
      exportAsCSV(results, options, baseFilename);
      break;
    case 'json':
      exportAsJSON(results, options, baseFilename);
      break;
    default:
      exportAsCSV(results, options, baseFilename);
  }
};

const exportAsCSV = (results: ForecastResult[], options: ExportOptions, filename: string) => {
  let csvContent = '';
  
  if (options.mode === 'all_models') {
    // Export all models comparison
    const headers = ['SKU', 'Date', 'Model', 'Predicted_Value'];
    if (options.includeAccuracy) headers.push('Model_Accuracy_%');
    
    csvContent = headers.join(',') + '\n';
    
    results.forEach(result => {
      result.predictions.forEach(prediction => {
        const row = [
          result.sku,
          prediction.date,
          result.model,
          prediction.value
        ];
        if (options.includeAccuracy && result.accuracy) {
          row.push(result.accuracy.toFixed(2));
        }
        csvContent += row.join(',') + '\n';
      });
    });
  } else {
    // Export single forecast (S&OP format)
    const selectedResults = options.selectedModel 
      ? results.filter(r => r.model === options.selectedModel)
      : results;
    
    if (selectedResults.length === 0) return;
    
    // Group by SKU for S&OP format
    const skuGroups = selectedResults.reduce((acc, result) => {
      if (!acc[result.sku]) acc[result.sku] = [];
      acc[result.sku].push(result);
      return acc;
    }, {} as Record<string, ForecastResult[]>);
    
    const headers = ['SKU', 'Date', 'Forecast_Value', 'Model_Used'];
    if (options.includeAccuracy) headers.push('Accuracy_%');
    
    csvContent = headers.join(',') + '\n';
    
    Object.entries(skuGroups).forEach(([sku, skuResults]) => {
      // Use the best performing model for this SKU
      const bestResult = skuResults.reduce((best, current) => 
        (current.accuracy || 0) > (best.accuracy || 0) ? current : best
      );
      
      bestResult.predictions.forEach(prediction => {
        const row = [
          sku,
          prediction.date,
          prediction.value,
          bestResult.model
        ];
        if (options.includeAccuracy && bestResult.accuracy) {
          row.push(bestResult.accuracy.toFixed(2));
        }
        csvContent += row.join(',') + '\n';
      });
    });
  }
  
  downloadFile(csvContent, `${filename}.csv`, 'text/csv');
};

const exportAsJSON = (results: ForecastResult[], options: ExportOptions, filename: string) => {
  let exportData;
  
  if (options.mode === 'all_models') {
    exportData = {
      metadata: {
        export_date: new Date().toISOString(),
        export_type: 'all_models_comparison',
        total_models: results.length,
        skus: Array.from(new Set(results.map(r => r.sku)))
      },
      forecasts: results
    };
  } else {
    const selectedResults = options.selectedModel 
      ? results.filter(r => r.model === options.selectedModel)
      : results;
    
    const skuGroups = selectedResults.reduce((acc, result) => {
      if (!acc[result.sku]) acc[result.sku] = [];
      acc[result.sku].push(result);
      return acc;
    }, {} as Record<string, ForecastResult[]>);
    
    const sopForecasts = Object.entries(skuGroups).map(([sku, skuResults]) => {
      const bestResult = skuResults.reduce((best, current) => 
        (current.accuracy || 0) > (best.accuracy || 0) ? current : best
      );
      
      return {
        sku,
        model_used: bestResult.model,
        accuracy: bestResult.accuracy,
        forecast_periods: bestResult.predictions.length,
        predictions: bestResult.predictions
      };
    });
    
    exportData = {
      metadata: {
        export_date: new Date().toISOString(),
        export_type: 'single_forecast_sop',
        total_skus: sopForecasts.length,
        selected_model: options.selectedModel || 'best_performing'
      },
      forecasts: sopForecasts
    };
  }
  
  const jsonContent = JSON.stringify(exportData, null, 2);
  downloadFile(jsonContent, `${filename}.json`, 'application/json');
};

const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};

export const generateSOPSummary = (results: ForecastResult[]) => {
  const skuGroups = results.reduce((acc, result) => {
    if (!acc[result.sku]) acc[result.sku] = [];
    acc[result.sku].push(result);
    return acc;
  }, {} as Record<string, ForecastResult[]>);
  
  return Object.entries(skuGroups).map(([sku, skuResults]) => {
    const bestResult = skuResults.reduce((best, current) => 
      (current.accuracy || 0) > (best.accuracy || 0) ? current : best
    );
    
    const totalForecast = bestResult.predictions.reduce((sum, p) => sum + p.value, 0);
    const avgForecast = totalForecast / bestResult.predictions.length;
    
    return {
      sku,
      recommendedModel: bestResult.model,
      accuracy: bestResult.accuracy || 0,
      totalForecast,
      avgPeriodForecast: avgForecast,
      forecastPeriods: bestResult.predictions.length
    };
  });
};

export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => row[header]).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};
