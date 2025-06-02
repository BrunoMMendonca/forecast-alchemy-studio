
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlertTriangle, Zap } from 'lucide-react';
import { SalesData } from '@/pages/Index';
import { useToast } from '@/hooks/use-toast';

interface OutlierDetectionProps {
  data: SalesData[];
  onDataCleaning: (cleanedData: SalesData[]) => void;
}

export const OutlierDetection: React.FC<OutlierDetectionProps> = ({ data, onDataCleaning }) => {
  const [selectedSKU, setSelectedSKU] = useState<string>('all');
  const [threshold, setThreshold] = useState([2.5]);
  const [detectedOutliers, setDetectedOutliers] = useState<SalesData[]>([]);
  const { toast } = useToast();

  const skus = useMemo(() => {
    return Array.from(new Set(data.map(d => d.sku))).sort();
  }, [data]);

  const outlierData = useMemo(() => {
    if (data.length === 0) return [];

    const processData = (salesData: SalesData[]) => {
      if (salesData.length < 3) return salesData;

      const sales = salesData.map(d => d.sales);
      const mean = sales.reduce((sum, s) => sum + s, 0) / sales.length;
      const variance = sales.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / sales.length;
      const stdDev = Math.sqrt(variance);

      return salesData.map((item, index) => {
        const zScore = Math.abs((item.sales - mean) / stdDev);
        const isOutlier = zScore > threshold[0];
        
        return {
          ...item,
          isOutlier,
          zScore,
          index,
          date: item.date
        };
      });
    };

    if (selectedSKU === 'all') {
      // Process each SKU separately
      const allProcessed: any[] = [];
      skus.forEach(sku => {
        const skuData = data.filter(d => d.sku === sku);
        const processed = processData(skuData);
        allProcessed.push(...processed);
      });
      return allProcessed;
    } else {
      const skuData = data.filter(d => d.sku === selectedSKU);
      return processData(skuData);
    }
  }, [data, selectedSKU, threshold, skus]);

  const outliers = useMemo(() => {
    return outlierData.filter(d => d.isOutlier);
  }, [outlierData]);

  const chartData = useMemo(() => {
    return outlierData.map((item, index) => ({
      x: index,
      y: item.sales,
      isOutlier: item.isOutlier,
      date: item.date,
      sku: item.sku,
      zScore: item.zScore
    }));
  }, [outlierData]);

  const handleRemoveOutliers = () => {
    const cleanedData = data.filter(item => {
      const outlierItem = outlierData.find(o => 
        o.date === item.date && 
        o.sku === item.sku && 
        o.sales === item.sales
      );
      return !outlierItem?.isOutlier;
    });

    onDataCleaning(cleanedData);
    setDetectedOutliers(outliers);
    
    toast({
      title: "Data Cleaned",
      description: `Removed ${outliers.length} outliers from the dataset`,
    });
  };

  const handleProceedToForecasting = () => {
    // If no outliers were removed, just use original data
    const cleanedData = detectedOutliers.length > 0 ? 
      data.filter(item => {
        const outlierItem = outlierData.find(o => 
          o.date === item.date && 
          o.sku === item.sku && 
          o.sales === item.sales
        );
        return !outlierItem?.isOutlier;
      }) : data;

    onDataCleaning(cleanedData);
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        No data available for outlier detection. Please upload data first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            Select SKU:
          </label>
          <Select value={selectedSKU} onValueChange={setSelectedSKU}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All SKUs</SelectItem>
              {skus.map(sku => (
                <SelectItem key={sku} value={sku}>{sku}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            Z-Score Threshold: {threshold[0]}
          </label>
          <Slider
            value={threshold}
            onValueChange={setThreshold}
            max={4}
            min={1}
            step={0.1}
            className="w-full"
          />
          <p className="text-xs text-slate-500">
            Higher values = fewer outliers detected
          </p>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <div className="text-sm text-blue-600 font-medium">Total Records</div>
          <div className="text-lg font-bold text-blue-800">
            {outlierData.length}
          </div>
        </div>
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <div className="text-sm text-red-600 font-medium">Outliers Found</div>
          <div className="text-lg font-bold text-red-800">
            {outliers.length}
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <div className="text-sm text-green-600 font-medium">Clean Records</div>
          <div className="text-lg font-bold text-green-800">
            {outlierData.length - outliers.length}
          </div>
        </div>
        <div className="bg-orange-50 rounded-lg p-3 text-center">
          <div className="text-sm text-orange-600 font-medium">Outlier Rate</div>
          <div className="text-lg font-bold text-orange-800">
            {outlierData.length > 0 ? ((outliers.length / outlierData.length) * 100).toFixed(1) : 0}%
          </div>
        </div>
      </div>

      {/* Outlier Visualization */}
      <div className="bg-white rounded-lg p-4 border">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">
          Outlier Detection - {selectedSKU === 'all' ? 'All SKUs' : selectedSKU}
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis 
                dataKey="x" 
                stroke="#64748b"
                fontSize={12}
                name="Data Point"
              />
              <YAxis 
                dataKey="y" 
                stroke="#64748b"
                fontSize={12}
                name="Sales"
                tickFormatter={(value) => value.toLocaleString()}
              />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  name === 'y' ? value.toLocaleString() : value,
                  name === 'y' ? 'Sales' : 'Index'
                ]}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) {
                    const data = payload[0].payload;
                    return `${data.sku} - ${data.date}${data.isOutlier ? ' (OUTLIER)' : ''}`;
                  }
                  return label;
                }}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Scatter dataKey="y">
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.isOutlier ? '#ef4444' : '#3b82f6'} 
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center space-x-6 mt-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Normal Data Points</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Detected Outliers</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between bg-slate-50 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          {outliers.length > 0 ? (
            <>
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <span className="text-slate-700">
                {outliers.length} outlier{outliers.length !== 1 ? 's' : ''} detected
              </span>
              <Badge variant="destructive">{outliers.length}</Badge>
            </>
          ) : (
            <>
              <Zap className="h-5 w-5 text-green-500" />
              <span className="text-slate-700">No outliers detected</span>
              <Badge variant="secondary">Clean</Badge>
            </>
          )}
        </div>

        <div className="flex space-x-3">
          {outliers.length > 0 && (
            <Button variant="destructive" onClick={handleRemoveOutliers}>
              Remove {outliers.length} Outlier{outliers.length !== 1 ? 's' : ''}
            </Button>
          )}
          <Button onClick={handleProceedToForecasting}>
            Proceed to Forecasting
          </Button>
        </div>
      </div>
    </div>
  );
};
