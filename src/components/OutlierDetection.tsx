
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlertTriangle, Zap, Edit3, Save, X } from 'lucide-react';
import { SalesData } from '@/pages/Index';
import { useToast } from '@/hooks/use-toast';

interface OutlierDetectionProps {
  data: SalesData[];
  onDataCleaning: (cleanedData: SalesData[]) => void;
}

export const OutlierDetection: React.FC<OutlierDetectionProps> = ({ data, onDataCleaning }) => {
  const [selectedSKU, setSelectedSKU] = useState<string>('');
  const [threshold, setThreshold] = useState([2.5]);
  const [editingOutliers, setEditingOutliers] = useState<{ [key: string]: number }>({});
  const [cleanedData, setCleanedData] = useState<SalesData[]>(data);
  const { toast } = useToast();

  const skus = useMemo(() => {
    return Array.from(new Set(data.map(d => d.sku))).sort();
  }, [data]);

  // Auto-select first SKU when data changes
  React.useEffect(() => {
    if (skus.length > 0 && !selectedSKU) {
      setSelectedSKU(skus[0]);
    }
  }, [skus, selectedSKU]);

  const outlierData = useMemo(() => {
    if (data.length === 0 || !selectedSKU) return [];

    const skuData = cleanedData.filter(d => d.sku === selectedSKU);
    if (skuData.length < 3) return skuData;

    const sales = skuData.map(d => d.sales);
    const mean = sales.reduce((sum, s) => sum + s, 0) / sales.length;
    const variance = sales.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / sales.length;
    const stdDev = Math.sqrt(variance);

    return skuData.map((item, index) => {
      const zScore = Math.abs((item.sales - mean) / stdDev);
      const isOutlier = zScore > threshold[0];
      const key = `${item.sku}-${item.date}`;
      
      return {
        ...item,
        isOutlier,
        zScore,
        index,
        date: item.date,
        key
      };
    });
  }, [cleanedData, selectedSKU, threshold]);

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
      zScore: item.zScore,
      key: item.key
    }));
  }, [outlierData]);

  const handleEditOutlier = (key: string, currentValue: number) => {
    setEditingOutliers({ ...editingOutliers, [key]: currentValue });
  };

  const handleSaveEdit = (key: string, newValue: number) => {
    const [sku, date] = key.split('-');
    const updatedData = cleanedData.map(item => {
      if (item.sku === sku && item.date === date) {
        return { ...item, sales: newValue };
      }
      return item;
    });
    
    setCleanedData(updatedData);
    setEditingOutliers(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });

    toast({
      title: "Value Updated",
      description: `Sales value for ${sku} on ${date} has been updated`,
    });
  };

  const handleCancelEdit = (key: string) => {
    setEditingOutliers(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  const handleProceedToForecasting = () => {
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
              <SelectValue placeholder="Select SKU" />
            </SelectTrigger>
            <SelectContent>
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
          Outlier Detection - {selectedSKU}
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

      {/* Outlier Editing Table */}
      {outliers.length > 0 && (
        <div className="bg-white rounded-lg p-4 border">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">
            Edit Outlier Values - {selectedSKU}
          </h3>
          <div className="space-y-3">
            {outliers.map((outlier) => {
              const isEditing = editingOutliers.hasOwnProperty(outlier.key);
              return (
                <div key={outlier.key} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="text-sm text-slate-600">{outlier.date}</div>
                    <div className="text-sm font-medium">
                      Current: {outlier.sales.toLocaleString()}
                    </div>
                    <Badge variant="destructive" className="text-xs">
                      Z-Score: {outlier.zScore.toFixed(2)}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {isEditing ? (
                      <>
                        <Input
                          type="number"
                          value={editingOutliers[outlier.key]}
                          onChange={(e) => setEditingOutliers({
                            ...editingOutliers,
                            [outlier.key]: parseFloat(e.target.value) || 0
                          })}
                          className="w-32"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(outlier.key, editingOutliers[outlier.key])}
                        >
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCancelEdit(outlier.key)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditOutlier(outlier.key, outlier.sales)}
                      >
                        <Edit3 className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between bg-slate-50 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          {outliers.length > 0 ? (
            <>
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <span className="text-slate-700">
                {outliers.length} outlier{outliers.length !== 1 ? 's' : ''} detected for {selectedSKU}
              </span>
              <Badge variant="destructive">{outliers.length}</Badge>
            </>
          ) : (
            <>
              <Zap className="h-5 w-5 text-green-500" />
              <span className="text-slate-700">No outliers detected for {selectedSKU}</span>
              <Badge variant="secondary">Clean</Badge>
            </>
          )}
        </div>

        <Button onClick={handleProceedToForecasting}>
          Proceed to Forecasting
        </Button>
      </div>
    </div>
  );
};
