
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
  'Exponential Smoothing': '#10b981',
  'Linear Trend': '#f59e0b'
};

export const ForecastChart: React.FC<ForecastChartProps> = ({
  chartData,
  selectedSKU,
  selectedSKUResults
}) => {
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
                  dot={false}
                  connectNulls={false}
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
  );
};
