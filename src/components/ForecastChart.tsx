import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TrendingUp, Maximize2 } from 'lucide-react';
import { ForecastResult } from '@/types/forecast';
import { getBlueTone } from '@/utils/colors';

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

const ChartContent: React.FC<{ chartData: any[], selectedSKUResults: ForecastResult[], height?: string }> = ({ 
  chartData, 
  selectedSKUResults, 
  height = "h-80" 
}) => {
  // Find the best model for highlighting, but handle empty arrays
  const bestModel = selectedSKUResults.length > 0 
    ? selectedSKUResults.reduce((best, current) => 
        (current.compositeScore || 0) > (best.compositeScore || 0) ? current : best
      )
    : null;

  return (
    <div className={height}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis 
            dataKey="date" 
            stroke="#64748b"
            fontSize={10}
            tickFormatter={(value) => {
              try {
                const date = new Date(value);
                return date.toLocaleDateString('en-US', { 
                  month: 'short', 
                  year: 'numeric' 
                });
              } catch {
                return value;
              }
            }}
          />
          <YAxis 
            stroke="#64748b"
            fontSize={10}
            tickFormatter={(value) => Math.round(value).toLocaleString()}
          />
          <Tooltip 
            formatter={(value: number, name: string) => [
              value.toLocaleString(), 
              name
            ]}
            labelFormatter={(label) => {
              try {
                const date = new Date(label);
                return date.toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric'
                });
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
          
          {selectedSKUResults.map((result, idx) => {
            const isBestModel = bestModel && result.modelId === bestModel.modelId;
            
            return (
              <Line
                key={result.modelId}
                type="monotone"
                dataKey={result.modelId}
                stroke={getBlueTone(idx, selectedSKUResults.length)}
                strokeWidth={isBestModel ? 3 : 2}
                dot={false}
                connectNulls={false}
                strokeDasharray={isBestModel ? "0" : "0"}
                activeDot={false}
                className="no-dot"
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const ForecastChart: React.FC<ForecastChartProps> = ({
  chartData,
  selectedSKU,
  selectedSKUResults
}) => {
  return (
    <Card className="bg-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Forecast Comparison - {selectedSKU}
            </CardTitle>
            <CardDescription>
              Compare predictions from different forecasting models
            </CardDescription>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Maximize2 className="h-4 w-4" />
                Expand
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Forecast Comparison - {selectedSKU}
                </DialogTitle>
              </DialogHeader>
              <ChartContent 
                chartData={chartData} 
                selectedSKUResults={selectedSKUResults} 
                height="h-[60vh]" 
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContent 
          chartData={chartData} 
          selectedSKUResults={selectedSKUResults} 
        />
      </CardContent>
    </Card>
  );
};
