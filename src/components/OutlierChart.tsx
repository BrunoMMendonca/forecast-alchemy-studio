import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { getBlueTone } from '@/utils/colors';

interface ChartData {
  date: string;
  originalSales: number;
  cleanedSales: number;
  outlier: number | null;
}

interface OutlierChartProps {
  data: ChartData[];
  selectedSKU: string;
  onDateClick?: (date: string) => void;
  highlightedDate?: string;
}

export const OutlierChart: React.FC<OutlierChartProps> = ({ 
  data, 
  selectedSKU, 
  onDateClick,
  highlightedDate 
}) => {
  const handleClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0] && onDateClick) {
      onDateClick(data.activePayload[0].payload.date);
    }
  };

  return (
    <div className="bg-white rounded-lg p-4 border h-full min-h-0 flex flex-col">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">
        Outlier Detection - {selectedSKU}
      </h3>
      <div className="flex-grow min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={data}
            onClick={handleClick}
          >
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
              formatter={(value: number, name: string, props) => {
                if (name === 'Outlier') {
                  // Show the actual outlier value (dot value)
                  return [value?.toLocaleString() || '0', 'Outlier'];
                }
                return [value?.toLocaleString() || '0', name];
              }}
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
              stroke={getBlueTone(1, 2)} 
              strokeWidth={1}
              name="Actuals"
              dot={false}
              connectNulls={false}
              activeDot={false}
              className="no-dot"
            />
            <Line 
              type="monotone" 
              dataKey="cleanedSales" 
              stroke={getBlueTone(0, 2)} 
              strokeWidth={2}
              name="Cleaned Sales"
              dot={false}
              connectNulls={false}
              activeDot={false}
              className="no-dot"
            />
            <Line 
              type="monotone" 
              dataKey="outlier" 
              stroke="red" 
              strokeWidth={0}
              name="Outlier"
              dot={{ r: 3, fill: 'red' }}
              connectNulls={false}
              activeDot={{ r: 8, fill: 'red', fillOpacity: 0.3 }}
              className="outlier-dot"
            />
            {highlightedDate && (
              <ReferenceLine
                x={highlightedDate}
                stroke="#94a3b8"
                strokeWidth={3}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
