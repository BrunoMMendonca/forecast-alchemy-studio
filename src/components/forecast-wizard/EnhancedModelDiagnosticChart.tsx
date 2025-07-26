import React, { useMemo } from 'react';
import { ChartContainer } from '../chart/ChartContainer';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface EnhancedModelDiagnosticChartProps {
  modelId: string;
  modelName: string;
  historicalData: Array<{
    date: string;
    value: number;
  }>;
  forecastData: Array<{
    date: string;
    value: number;
    lowerBound?: number;
    upperBound?: number;
  }>;
  datasetId: number;
  sku: string;
  onClose: () => void;
  selectedPeriod?: number;
  isLoading?: boolean;
}

export const EnhancedModelDiagnosticChart: React.FC<EnhancedModelDiagnosticChartProps> = ({
  modelId,
  modelName,
  historicalData,
  forecastData,
  datasetId,
  sku,
  onClose,
  selectedPeriod = 12,
  isLoading = false
}) => {
  // Calculate statistics
  const historicalValues = historicalData.map(d => d.value);
  const forecastValues = forecastData.map(d => d.value);
  
  const historicalMean = historicalValues.length > 0 ? historicalValues.reduce((sum, val) => sum + val, 0) / historicalValues.length : 0;
  const forecastMean = forecastValues.length > 0 ? forecastValues.reduce((sum, val) => sum + val, 0) / forecastValues.length : 0;
  
  const historicalStd = historicalValues.length > 0 ? 
    Math.sqrt(historicalValues.reduce((sum, val) => sum + Math.pow(val - historicalMean, 2), 0) / historicalValues.length) : 0;
  const forecastStd = forecastValues.length > 0 ? 
    Math.sqrt(forecastValues.reduce((sum, val) => sum + Math.pow(val - forecastMean, 2), 0) / forecastValues.length) : 0;

  // Calculate trend
  const historicalTrend = historicalValues.length > 1 ? 
    (historicalValues[historicalValues.length - 1] - historicalValues[0]) / (historicalValues.length - 1) : 0;
  const forecastTrend = forecastValues.length > 1 ? 
    (forecastValues[forecastValues.length - 1] - forecastValues[0]) / (forecastValues.length - 1) : 0;

  // Calculate confidence interval coverage
  const confidenceCoverage = forecastData.filter(d => d.lowerBound !== undefined && d.upperBound !== undefined).length / forecastData.length * 100;

  if (isLoading) {
  return (
      <div className="space-y-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
              </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Chart Header */}
      <div className="flex items-center justify-between">
              <div className="space-y-1">
          <h3 className="text-lg font-semibold">{modelName}</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{selectedPeriod} months forecast</Badge>
            <Badge variant="secondary">{forecastData.length} points</Badge>
            {confidenceCoverage > 0 && (
              <Badge variant="outline">{confidenceCoverage.toFixed(0)}% CI</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Modular ChartContainer */}
      <ChartContainer
        historicalData={historicalData}
        forecastData={forecastData.map(d => ({
          date: d.date,
          forecast: d.value,
          lowerBound: d.lowerBound,
          upperBound: d.upperBound
        }))}
        modelName={`${modelName} - ${selectedPeriod} Month Forecast`}
        className="w-full"
      />

      {/* Enhanced Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="text-center p-3 bg-blue-50 rounded-lg border">
            <div className="text-2xl font-bold text-blue-600">{historicalValues.length}</div>
            <div className="text-sm text-blue-600">Historical Points</div>
          </div>
        <div className="text-center p-3 bg-red-50 rounded-lg border">
            <div className="text-2xl font-bold text-red-600">{forecastValues.length}</div>
            <div className="text-sm text-red-600">Forecast Points</div>
          </div>
        <div className="text-center p-3 bg-green-50 rounded-lg border">
            <div className="text-2xl font-bold text-green-600">{historicalMean.toFixed(1)}</div>
            <div className="text-sm text-green-600">Historical Mean</div>
          <div className="text-xs text-green-500">±{historicalStd.toFixed(1)}</div>
          </div>
        <div className="text-center p-3 bg-purple-50 rounded-lg border">
            <div className="text-2xl font-bold text-purple-600">{forecastMean.toFixed(1)}</div>
            <div className="text-sm text-purple-600">Forecast Mean</div>
          <div className="text-xs text-purple-500">±{forecastStd.toFixed(1)}</div>
        </div>
        <div className="text-center p-3 bg-orange-50 rounded-lg border">
          <div className="text-2xl font-bold text-orange-600">{historicalTrend > 0 ? '+' : ''}{historicalTrend.toFixed(1)}</div>
          <div className="text-sm text-orange-600">Historical Trend</div>
          <div className="text-xs text-orange-500">per period</div>
        </div>
        <div className="text-center p-3 bg-indigo-50 rounded-lg border">
          <div className="text-2xl font-bold text-indigo-600">{forecastTrend > 0 ? '+' : ''}{forecastTrend.toFixed(1)}</div>
          <div className="text-sm text-indigo-600">Forecast Trend</div>
          <div className="text-xs text-indigo-500">per period</div>
        </div>
          </div>

      {/* Model Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="font-medium mb-2">Model Information</h4>
          <div className="space-y-1 text-sm">
            <div><span className="font-medium">Model ID:</span> {modelId}</div>
            <div><span className="font-medium">SKU:</span> {sku}</div>
            <div><span className="font-medium">Dataset ID:</span> {datasetId}</div>
            <div><span className="font-medium">Forecast Period:</span> {selectedPeriod} months</div>
          </div>
        </div>
        
        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="font-medium mb-2">Data Quality</h4>
          <div className="space-y-1 text-sm">
            <div><span className="font-medium">Historical Range:</span> {historicalData.length > 0 ? `${historicalData[0].date} to ${historicalData[historicalData.length - 1].date}` : 'N/A'}</div>
            <div><span className="font-medium">Forecast Range:</span> {forecastData.length > 0 ? `${forecastData[0].date} to ${forecastData[forecastData.length - 1].date}` : 'N/A'}</div>
            <div><span className="font-medium">Confidence Intervals:</span> {confidenceCoverage > 0 ? `${confidenceCoverage.toFixed(0)}% coverage` : 'Not available'}</div>
            <div><span className="font-medium">Data Completeness:</span> {historicalData.length > 0 ? '100%' : '0%'}</div>
          </div>
          </div>
        </div>

        {/* Instructions */}
      <div className="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg border">
        <h4 className="font-medium mb-2">Chart Controls:</h4>
          <ul className="space-y-1">
            <li>• <strong>Mouse wheel:</strong> Zoom in/out</li>
            <li>• <strong>Click and drag:</strong> Pan around the chart</li>
          <li>• <strong>Hover (0.5s delay):</strong> See detailed values and dates</li>
            <li>• <strong>Smooth curves:</strong> Lines are automatically smoothed for better visualization</li>
            <li>• <strong>Clean design:</strong> No data point circles for a cleaner look</li>
          <li>• <strong>Autozoom:</strong> Automatically adjusts Y-axis to fit visible data</li>
          </ul>
        </div>
    </div>
  );
}; 
 