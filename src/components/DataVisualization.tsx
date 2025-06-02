
import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { SalesData } from '@/pages/Index';

interface DataVisualizationProps {
  data: SalesData[];
}

export const DataVisualization: React.FC<DataVisualizationProps> = ({ data }) => {
  const [selectedSKU, setSelectedSKU] = useState<string>('all');

  const skus = useMemo(() => {
    return Array.from(new Set(data.map(d => d.sku))).sort();
  }, [data]);

  const chartData = useMemo(() => {
    const filteredData = selectedSKU === 'all' 
      ? data 
      : data.filter(d => d.sku === selectedSKU);

    if (selectedSKU === 'all') {
      // Aggregate data by date
      const aggregated = filteredData.reduce((acc, curr) => {
        const existing = acc.find(item => item.date === curr.date);
        if (existing) {
          existing.sales += curr.sales;
        } else {
          acc.push({ date: curr.date, sales: curr.sales });
        }
        return acc;
      }, [] as { date: string; sales: number }[]);
      
      return aggregated.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } else {
      return filteredData
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(d => ({ date: d.date, sales: d.sales }));
    }
  }, [data, selectedSKU]);

  const stats = useMemo(() => {
    if (data.length === 0) return null;
    
    const filteredData = selectedSKU === 'all' 
      ? data 
      : data.filter(d => d.sku === selectedSKU);
    
    const sales = filteredData.map(d => d.sales);
    const totalSales = sales.reduce((sum, s) => sum + s, 0);
    const avgSales = totalSales / sales.length;
    const maxSales = Math.max(...sales);
    const minSales = Math.min(...sales);
    
    return {
      total: totalSales,
      average: avgSales,
      max: maxSales,
      min: minSales,
      records: filteredData.length
    };
  }, [data, selectedSKU]);

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        No data to visualize. Please upload a CSV file first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-slate-700">
            Select SKU:
          </label>
          <Select value={selectedSKU} onValueChange={setSelectedSKU}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All SKUs (Aggregated)</SelectItem>
              {skus.map(sku => (
                <SelectItem key={sku} value={sku}>{sku}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center space-x-2">
          <Badge variant="secondary">{skus.length} SKUs</Badge>
          <Badge variant="secondary">{data.length} Records</Badge>
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <div className="text-sm text-blue-600 font-medium">Total Sales</div>
            <div className="text-lg font-bold text-blue-800">
              {stats.total.toLocaleString()}
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-sm text-green-600 font-medium">Average</div>
            <div className="text-lg font-bold text-green-800">
              {stats.average.toFixed(1)}
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <div className="text-sm text-purple-600 font-medium">Maximum</div>
            <div className="text-lg font-bold text-purple-800">
              {stats.max.toLocaleString()}
            </div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 text-center">
            <div className="text-sm text-orange-600 font-medium">Minimum</div>
            <div className="text-lg font-bold text-orange-800">
              {stats.min.toLocaleString()}
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <div className="text-sm text-slate-600 font-medium">Records</div>
            <div className="text-lg font-bold text-slate-800">
              {stats.records}
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white rounded-lg p-4 border">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">
          Sales Trend - {selectedSKU === 'all' ? 'All SKUs (Aggregated)' : selectedSKU}
        </h3>
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
                formatter={(value: number) => [value.toLocaleString(), 'Sales']}
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
              <Line 
                type="monotone" 
                dataKey="sales" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
