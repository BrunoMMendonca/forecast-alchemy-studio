import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Calendar, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

interface ModelDiagnosticChartProps {
  modelId: string;
  modelName: string;
  historicalData: Array<{
    date: string;
    value: number;
  }>;
  forecastData: Array<{
    date: string;
    forecast: number;
    lowerBound?: number;
    upperBound?: number;
  }>;
  onClose: () => void;
}

export const ModelDiagnosticChart: React.FC<ModelDiagnosticChartProps> = ({
  modelId,
  modelName,
  historicalData,
  forecastData,
  onClose
}) => {
  // Combine historical and forecast data for the chart
  const chartData = React.useMemo(() => {
    const combined = [
      // Historical data
      ...historicalData.map(item => ({
        date: item.date,
        historical: item.value,
        forecast: null,
        lowerBound: null,
        upperBound: null,
        type: 'historical'
      })),
      // Forecast data
      ...forecastData.map(item => ({
        date: item.date,
        historical: null,
        forecast: item.forecast,
        lowerBound: item.lowerBound || null,
        upperBound: item.upperBound || null,
        type: 'forecast'
      }))
    ];

    // Sort by date
    return combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [historicalData, forecastData]);

  // Find the last historical data point to draw the separation line
  const lastHistoricalIndex = chartData.findIndex(item => item.type === 'forecast');
  const separationDate = lastHistoricalIndex > 0 ? chartData[lastHistoricalIndex - 1].date : null;

  // Calculate some basic statistics
  const historicalValues = historicalData.map(d => d.value);
  const forecastValues = forecastData.map(d => d.forecast);
  
  const historicalMean = historicalValues.reduce((sum, val) => sum + val, 0) / historicalValues.length;
  const forecastMean = forecastValues.reduce((sum, val) => sum + val, 0) / forecastValues.length;
  
  const historicalStd = Math.sqrt(
    historicalValues.reduce((sum, val) => sum + Math.pow(val - historicalMean, 2), 0) / historicalValues.length
  );

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <CardTitle>Diagnostic Chart - {modelName}</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            Model ID: {modelId}
          </Badge>
        </div>
        <CardDescription>
          Historical data with forecast projection. The vertical line separates historical (left) from forecast (right).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Chart */}
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
                formatter={(value, name) => [
                  typeof value === 'number' ? value.toFixed(2) : 'N/A', 
                  name === 'historical' ? 'Historical' : name === 'forecast' ? 'Forecast' : name
                ]}
              />
              <Legend />
              
              {/* Historical data line */}
              <Line
                type="monotone"
                dataKey="historical"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ fill: '#2563eb', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
                name="Historical Data"
              />
              
              {/* Forecast line */}
              <Line
                type="monotone"
                dataKey="forecast"
                stroke="#dc2626"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#dc2626', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
                name="Forecast"
              />
              
              {/* Confidence interval (if available) */}
              {forecastData.some(d => d.lowerBound && d.upperBound) && (
                <>
                  <Line
                    type="monotone"
                    dataKey="upperBound"
                    stroke="#dc2626"
                    strokeWidth={1}
                    strokeOpacity={0.3}
                    dot={false}
                    name="Upper Bound"
                  />
                  <Line
                    type="monotone"
                    dataKey="lowerBound"
                    stroke="#dc2626"
                    strokeWidth={1}
                    strokeOpacity={0.3}
                    dot={false}
                    name="Lower Bound"
                  />
                </>
              )}
              
              {/* Separation line between historical and forecast */}
              {separationDate && (
                <ReferenceLine
                  x={separationDate}
                  stroke="#6b7280"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  label={{ value: "Forecast Start", position: "top" }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded">
            <div className="text-2xl font-bold text-blue-600">{historicalValues.length}</div>
            <div className="text-sm text-blue-600">Historical Points</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded">
            <div className="text-2xl font-bold text-red-600">{forecastValues.length}</div>
            <div className="text-sm text-red-600">Forecast Points</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded">
            <div className="text-2xl font-bold text-green-600">{historicalMean.toFixed(1)}</div>
            <div className="text-sm text-green-600">Historical Mean</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded">
            <div className="text-2xl font-bold text-purple-600">{forecastMean.toFixed(1)}</div>
            <div className="text-sm text-purple-600">Forecast Mean</div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-blue-600"></div>
            <span>Historical Data</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-red-600 border-dashed border-red-600"></div>
            <span>Forecast</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-gray-600 border-dashed border-gray-600"></div>
            <span>Forecast Start</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Calendar, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

interface ModelDiagnosticChartProps {
  modelId: string;
  modelName: string;
  historicalData: Array<{
    date: string;
    value: number;
  }>;
  forecastData: Array<{
    date: string;
    forecast: number;
    lowerBound?: number;
    upperBound?: number;
  }>;
  onClose: () => void;
}

export const ModelDiagnosticChart: React.FC<ModelDiagnosticChartProps> = ({
  modelId,
  modelName,
  historicalData,
  forecastData,
  onClose
}) => {
  // Combine historical and forecast data for the chart
  const chartData = React.useMemo(() => {
    const combined = [
      // Historical data
      ...historicalData.map(item => ({
        date: item.date,
        historical: item.value,
        forecast: null,
        lowerBound: null,
        upperBound: null,
        type: 'historical'
      })),
      // Forecast data
      ...forecastData.map(item => ({
        date: item.date,
        historical: null,
        forecast: item.forecast,
        lowerBound: item.lowerBound || null,
        upperBound: item.upperBound || null,
        type: 'forecast'
      }))
    ];

    // Sort by date
    return combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [historicalData, forecastData]);

  // Find the last historical data point to draw the separation line
  const lastHistoricalIndex = chartData.findIndex(item => item.type === 'forecast');
  const separationDate = lastHistoricalIndex > 0 ? chartData[lastHistoricalIndex - 1].date : null;

  // Calculate some basic statistics
  const historicalValues = historicalData.map(d => d.value);
  const forecastValues = forecastData.map(d => d.forecast);
  
  const historicalMean = historicalValues.reduce((sum, val) => sum + val, 0) / historicalValues.length;
  const forecastMean = forecastValues.reduce((sum, val) => sum + val, 0) / forecastValues.length;
  
  const historicalStd = Math.sqrt(
    historicalValues.reduce((sum, val) => sum + Math.pow(val - historicalMean, 2), 0) / historicalValues.length
  );

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <CardTitle>Diagnostic Chart - {modelName}</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            Model ID: {modelId}
          </Badge>
        </div>
        <CardDescription>
          Historical data with forecast projection. The vertical line separates historical (left) from forecast (right).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Chart */}
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
                formatter={(value, name) => [
                  typeof value === 'number' ? value.toFixed(2) : 'N/A', 
                  name === 'historical' ? 'Historical' : name === 'forecast' ? 'Forecast' : name
                ]}
              />
              <Legend />
              
              {/* Historical data line */}
              <Line
                type="monotone"
                dataKey="historical"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ fill: '#2563eb', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
                name="Historical Data"
              />
              
              {/* Forecast line */}
              <Line
                type="monotone"
                dataKey="forecast"
                stroke="#dc2626"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#dc2626', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
                name="Forecast"
              />
              
              {/* Confidence interval (if available) */}
              {forecastData.some(d => d.lowerBound && d.upperBound) && (
                <>
                  <Line
                    type="monotone"
                    dataKey="upperBound"
                    stroke="#dc2626"
                    strokeWidth={1}
                    strokeOpacity={0.3}
                    dot={false}
                    name="Upper Bound"
                  />
                  <Line
                    type="monotone"
                    dataKey="lowerBound"
                    stroke="#dc2626"
                    strokeWidth={1}
                    strokeOpacity={0.3}
                    dot={false}
                    name="Lower Bound"
                  />
                </>
              )}
              
              {/* Separation line between historical and forecast */}
              {separationDate && (
                <ReferenceLine
                  x={separationDate}
                  stroke="#6b7280"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  label={{ value: "Forecast Start", position: "top" }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded">
            <div className="text-2xl font-bold text-blue-600">{historicalValues.length}</div>
            <div className="text-sm text-blue-600">Historical Points</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded">
            <div className="text-2xl font-bold text-red-600">{forecastValues.length}</div>
            <div className="text-sm text-red-600">Forecast Points</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded">
            <div className="text-2xl font-bold text-green-600">{historicalMean.toFixed(1)}</div>
            <div className="text-sm text-green-600">Historical Mean</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded">
            <div className="text-2xl font-bold text-purple-600">{forecastMean.toFixed(1)}</div>
            <div className="text-sm text-purple-600">Forecast Mean</div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-blue-600"></div>
            <span>Historical Data</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-red-600 border-dashed border-red-600"></div>
            <span>Forecast</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-gray-600 border-dashed border-gray-600"></div>
            <span>Forecast Start</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}; 