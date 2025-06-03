
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { ForecastResult } from '@/pages/Index';

interface ForecastChartProps {
  chartData: any[];
  selectedSKU: string;
  selectedSKUResults: ForecastResult[];
}

const modelColors = {
  'Simple Moving Average': '#3b82f6',
  'Simple Exponential Smoothing': '#10b981',
  'Double Exponential Smoothing': '#f59e0b',
  'Linear Trend': '#ef4444',
  'Seasonal Moving Average': '#8b5cf6',
  'Holt-Winters (Triple Exponential)': '#06b6d4',
  'Seasonal Naive': '#84cc16'
};

export const ForecastChart: React.FC<ForecastChartProps> = ({
  chartData,
  selectedSKU,
  selectedSKUResults
}) => {
  // Find the best model for highlighting, but handle empty arrays
  const bestModel = selectedSKUResults.length > 0 
    ? selectedSKUResults.reduce((best, current) => 
        (current.accuracy || 0) > (best.accuracy || 0) ? current : best
      )
    : null;

  return (
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
                fontSize={10}
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
                fontSize={10}
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
              <Legend 
                wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }}
                iconSize={10}
              />
              
              {selectedSKUResults.map((result) => {
                const isBestModel = bestModel && result.model === bestModel.model;
                
                return (
                  <Line
                    key={result.model}
                    type="monotone"
                    dataKey={result.model}
                    stroke={modelColors[result.model as keyof typeof modelColors] || '#64748b'}
                    strokeWidth={isBestModel ? 3 : 2}
                    dot={false}
                    connectNulls={false}
                    strokeDasharray={isBestModel ? "0" : "0"}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
