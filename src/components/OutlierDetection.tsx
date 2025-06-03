import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertTriangle, Zap, Edit3, Save, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { SalesData } from '@/pages/Index';
import { useToast } from '@/hooks/use-toast';

interface OutlierDetectionProps {
  data: SalesData[];
  onDataCleaning: (cleanedData: SalesData[]) => void;
}

interface OutlierDataPoint extends SalesData {
  isOutlier: boolean;
  zScore: number;
  index: number;
  key: string;
}

export const OutlierDetection: React.FC<OutlierDetectionProps> = ({ data, onDataCleaning }) => {
  const [selectedSKU, setSelectedSKU] = useState<string>('');
  const [threshold, setThreshold] = useState([2.5]);
  const [editingOutliers, setEditingOutliers] = useState<{ [key: string]: number }>({});
  const [cleanedData, setCleanedData] = useState<SalesData[]>(data);
  const [hideCleanData, setHideCleanData] = useState(false);
  const { toast } = useToast();

  // Update cleaned data when original data changes
  React.useEffect(() => {
    setCleanedData(data);
  }, [data]);

  const skus = useMemo(() => {
    return Array.from(new Set(data.map(d => d.sku))).sort();
  }, [data]);

  // Auto-select first SKU when data changes
  React.useEffect(() => {
    if (skus.length > 0 && !selectedSKU) {
      setSelectedSKU(skus[0]);
    }
  }, [skus, selectedSKU]);

  const outlierData = useMemo((): OutlierDataPoint[] => {
    if (cleanedData.length === 0 || !selectedSKU) return [];

    const skuData = cleanedData.filter(d => d.sku === selectedSKU);
    if (skuData.length < 3) return skuData.map((item, index) => ({
      ...item,
      isOutlier: false,
      zScore: 0,
      index,
      key: `${item.sku}-${item.date}`
    }));

    const sales = skuData.map(d => d.sales);
    const mean = sales.reduce((sum, s) => sum + s, 0) / sales.length;
    const variance = sales.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / sales.length;
    const stdDev = Math.sqrt(variance);

    return skuData.map((item, index): OutlierDataPoint => {
      const zScore = stdDev > 0 ? Math.abs((item.sales - mean) / stdDev) : 0;
      const isOutlier = zScore > threshold[0];
      const key = `${item.sku}-${item.date}`;
      
      return {
        ...item,
        isOutlier,
        zScore,
        index,
        key
      };
    });
  }, [cleanedData, selectedSKU, threshold]);

  const outliers = useMemo(() => {
    return outlierData.filter(d => d.isOutlier);
  }, [outlierData]);

  const filteredOutlierData = useMemo(() => {
    if (hideCleanData) {
      return outlierData.filter(d => d.isOutlier);
    }
    return outlierData;
  }, [outlierData, hideCleanData]);

  const chartData = useMemo(() => {
    if (!selectedSKU || data.length === 0) return [];

    const originalSkuData = data.filter(d => d.sku === selectedSKU)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const cleanedSkuData = cleanedData.filter(d => d.sku === selectedSKU)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return originalSkuData.map((originalItem) => {
      const cleanedItem = cleanedSkuData.find(c => c.date === originalItem.date);
      
      return {
        date: originalItem.date,
        originalSales: originalItem.sales,
        cleanedSales: cleanedItem?.sales || originalItem.sales
      };
    });
  }, [data, cleanedData, selectedSKU]);

  const handleEditOutlier = (key: string) => {
    // Find the current value from cleanedData, not the original data
    const [sku, date] = key.split('-');
    const currentItem = cleanedData.find(item => item.sku === sku && item.date === date);
    if (currentItem) {
      setEditingOutliers({ ...editingOutliers, [key]: currentItem.sales });
    }
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

  const handlePrevSKU = () => {
    const currentIndex = skus.indexOf(selectedSKU);
    if (currentIndex > 0) {
      setSelectedSKU(skus[currentIndex - 1]);
    }
  };

  const handleNextSKU = () => {
    const currentIndex = skus.indexOf(selectedSKU);
    if (currentIndex < skus.length - 1) {
      setSelectedSKU(skus[currentIndex + 1]);
    }
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
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePrevSKU}
              disabled={skus.indexOf(selectedSKU) === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select value={selectedSKU} onValueChange={setSelectedSKU}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select SKU" />
              </SelectTrigger>
              <SelectContent>
                {skus.map(sku => (
                  <SelectItem key={sku} value={sku}>{sku}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleNextSKU}
              disabled={skus.indexOf(selectedSKU) === skus.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
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
                  value?.toLocaleString() || 'N/A', 
                  name === 'originalSales' ? 'Original Sales' : 'Cleaned Sales'
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
              <Line 
                type="monotone" 
                dataKey="originalSales" 
                stroke="#94a3b8" 
                strokeWidth={2}
                name="Original Data"
                dot={false}
                connectNulls={false}
              />
              <Line 
                type="monotone" 
                dataKey="cleanedSales" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Cleaned Data"
                dot={false}
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

      {/* Data Editing Table */}
      <div className="bg-white rounded-lg p-4 border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">
            Edit Data Values - {selectedSKU}
          </h3>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="hide-clean" 
              checked={hideCleanData}
              onCheckedChange={(checked) => setHideCleanData(checked === true)}
            />
            <label htmlFor="hide-clean" className="text-sm text-slate-700 cursor-pointer">
              Hide clean data
            </label>
          </div>
        </div>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredOutlierData.map((dataPoint) => {
            const isEditing = editingOutliers.hasOwnProperty(dataPoint.key);
            const badgeVariant = dataPoint.isOutlier ? "destructive" : "secondary";
            const badgeColor = dataPoint.isOutlier ? "text-red-800" : "text-green-800";
            
            return (
              <div key={dataPoint.key} className={`flex items-center justify-between p-3 rounded-lg ${dataPoint.isOutlier ? 'bg-red-50' : 'bg-green-50'}`}>
                <div className="flex items-center space-x-4">
                  <div className="text-sm text-slate-600">{dataPoint.date}</div>
                  <div className="text-sm font-medium">
                    Current: {dataPoint.sales.toLocaleString()}
                  </div>
                  <Badge variant={badgeVariant} className={`text-xs ${badgeColor}`}>
                    Z-Score: {dataPoint.zScore.toFixed(2)}
                  </Badge>
                  {!dataPoint.isOutlier && (
                    <Badge variant="secondary" className="text-xs text-green-800 bg-green-100">
                      Clean
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  {isEditing ? (
                    <>
                      <Input
                        type="number"
                        value={editingOutliers[dataPoint.key]}
                        onChange={(e) => setEditingOutliers({
                          ...editingOutliers,
                          [dataPoint.key]: parseFloat(e.target.value) || 0
                        })}
                        className="w-32"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSaveEdit(dataPoint.key, editingOutliers[dataPoint.key])}
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCancelEdit(dataPoint.key)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditOutlier(dataPoint.key)}
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
