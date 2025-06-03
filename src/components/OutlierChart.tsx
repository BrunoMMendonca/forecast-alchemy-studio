
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ChartData {
  date: string;
  originalSales: number;
  cleanedSales: number;
}

interface OutlierChartProps {
  data: ChartData[];
  selectedSKU: string;
}

export const OutlierChart: React.FC<OutlierChartProps> = ({ data, selectedSKU }) => {
  return (
    <div className="bg-white rounded-lg p-4 border">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">
        Outlier Detection - {selectedSKU}
      </h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis 
              dataKey="date" 
              stroke="#64748b"
              fontSize={12}
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
              fontSize={12}
              tickFormatter={(value) => value.toLocaleString()}
            />
            <Tooltip 
              formatter={(value: number, name: string) => [
                value?.toLocaleString() || '0', 
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
            <Line 
              type="monotone" 
              dataKey="originalSales" 
              stroke="#94a3b8" 
              strokeWidth={2}
              name="Original Sales"
              dot={{ r: 3 }}
              connectNulls={false}
            />
            <Line 
              type="monotone" 
              dataKey="cleanedSales" 
              stroke="#3b82f6" 
              strokeWidth={2}
              name="Cleaned Sales"
              dot={{ r: 3 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center space-x-6 mt-4 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-slate-400 rounded-full"></div>
          <span>Original Data</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span>Cleaned Data</span>
        </div>
      </div>
    </div>
  );
};
