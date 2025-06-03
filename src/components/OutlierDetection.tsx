import React, { useState, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertTriangle, Zap, Edit3, Save, X, ChevronLeft, ChevronRight, Download, Upload } from 'lucide-react';
import { SalesData } from '@/pages/Index';
import { useToast } from '@/hooks/use-toast';
import { exportCleaningData, parseCleaningCSV, applyImportChanges, ImportPreview } from '@/utils/csvUtils';
import { ImportPreviewDialog } from '@/components/ImportPreviewDialog';

interface OutlierDetectionProps {
  data: SalesData[];
  cleanedData: SalesData[];
  onDataCleaning: (cleanedData: SalesData[]) => void;
}

interface OutlierDataPoint extends SalesData {
  isOutlier: boolean;
  zScore: number;
  index: number;
  key: string;
  originalSales: number;
  note?: string;
}

export const OutlierDetection: React.FC<OutlierDetectionProps> = ({ data, cleanedData, onDataCleaning }) => {
  const [selectedSKU, setSelectedSKU] = useState<string>('');
  const [threshold, setThreshold] = useState([2.5]);
  const [editingOutliers, setEditingOutliers] = useState<{ [key: string]: { value: number; note: string } }>({});
  const [hideCleanData, setHideCleanData] = useState(true);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importPreviews, setImportPreviews] = useState<ImportPreview[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importMetadata, setImportMetadata] = useState<{ threshold?: number; exportDate?: string; totalRecords?: number }>({});
  const [importFileName, setImportFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const outlierData = useMemo((): OutlierDataPoint[] => {
    if (cleanedData.length === 0 || !selectedSKU) return [];

    const skuData = cleanedData.filter(d => d.sku === selectedSKU);
    if (skuData.length < 3) return skuData.map((item, index) => {
      const originalItem = data.find(d => d.sku === item.sku && d.date === item.date);
      return {
        ...item,
        isOutlier: false,
        zScore: 0,
        index,
        key: `${selectedSKU}_${item.date}_${index}`,
        originalSales: originalItem?.sales ?? item.sales,
        note: item.note
      };
    });

    const sales = skuData.map(d => d.sales);
    const mean = sales.reduce((sum, s) => sum + s, 0) / sales.length;
    const variance = sales.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / sales.length;
    const stdDev = Math.sqrt(variance);

    return skuData.map((item, index): OutlierDataPoint => {
      const zScore = stdDev > 0 ? Math.abs((item.sales - mean) / stdDev) : 0;
      const isOutlier = zScore > threshold[0];
      const key = `${selectedSKU}_${item.date}_${index}`;
      const originalItem = data.find(d => d.sku === item.sku && d.date === item.date);
      
      return {
        ...item,
        isOutlier,
        zScore,
        index,
        key,
        originalSales: originalItem?.sales ?? item.sales,
        note: item.note
      };
    });
  }, [cleanedData, selectedSKU, threshold, data]);

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
        cleanedSales: cleanedItem?.sales ?? originalItem.sales
      };
    });
  }, [data, cleanedData, selectedSKU]);

  const handleExportCleaning = () => {
    if (data.length === 0 || cleanedData.length === 0) {
      toast({
        title: "Export Error",
        description: "No data available to export",
        variant: "destructive",
      });
      return;
    }

    try {
      exportCleaningData(data, cleanedData, threshold[0]);
      toast({
        title: "Export Successful",
        description: `Data cleaning exported for ${new Set(cleanedData.map(d => d.sku)).size} SKUs`,
      });
    } catch (error) {
      toast({
        title: "Export Error",
        description: error instanceof Error ? error.message : "Failed to export data",
        variant: "destructive",
      });
    }
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Invalid File",
        description: "Please select a CSV file",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target?.result as string;
        const { previews, errors, metadata } = parseCleaningCSV(csvText);
        
        // Filter previews to only include SKUs that exist in current data
        const currentSKUs = new Set(data.map(d => d.sku));
        const validPreviews = previews.filter(p => {
          const skuExists = currentSKUs.has(p.sku);
          const dateExists = data.some(d => d.sku === p.sku && d.date === p.date);
          return skuExists && dateExists;
        });

        const skuNotFoundErrors = previews
          .filter(p => !currentSKUs.has(p.sku))
          .map(p => `SKU "${p.sku}" not found in current dataset`);
        
        const dateNotFoundErrors = previews
          .filter(p => currentSKUs.has(p.sku) && !data.some(d => d.sku === p.sku && d.date === p.date))
          .map(p => `Date "${p.date}" not found for SKU "${p.sku}"`);

        setImportPreviews(validPreviews);
        setImportErrors([...errors, ...skuNotFoundErrors, ...dateNotFoundErrors]);
        setImportMetadata(metadata);
        setImportFileName(file.name);
        setShowImportDialog(true);
      } catch (error) {
        toast({
          title: "Import Error",
          description: error instanceof Error ? error.message : "Failed to parse CSV file",
          variant: "destructive",
        });
      }
    };
    
    reader.readAsText(file);
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = () => {
    try {
      const updatedData = applyImportChanges(cleanedData, importPreviews);
      onDataCleaning(updatedData);
      
      const modifications = importPreviews.filter(p => p.action === 'modify');
      const noteAdditions = importPreviews.filter(p => p.action === 'add_note');
      
      toast({
        title: "Import Successful",
        description: `Applied ${modifications.length} value changes and ${noteAdditions.length} note additions`,
      });
      
      setShowImportDialog(false);
      setImportPreviews([]);
      setImportErrors([]);
      setImportMetadata({});
      setImportFileName('');
    } catch (error) {
      toast({
        title: "Import Error",
        description: error instanceof Error ? error.message : "Failed to apply changes",
        variant: "destructive",
      });
    }
  };

  const handleEditOutlier = (key: string) => {
    console.log('Edit button clicked for key:', key);
    
    const parts = key.split('_');
    if (parts.length < 3) {
      console.error('Invalid key format:', key);
      return;
    }
    
    const date = parts[parts.length - 2];
    const sku = parts.slice(0, -2).join('_');
    
    console.log('Parsed key:', { sku, date });
    
    const currentItem = cleanedData.find(item => item.sku === sku && item.date === date);
    console.log('Found item:', currentItem);
    
    if (currentItem) {
      setEditingOutliers({ 
        ...editingOutliers, 
        [key]: { 
          value: currentItem.sales,
          note: currentItem.note || ''
        }
      });
      console.log('Set editing state for key:', key);
    } else {
      console.error('Could not find item for editing:', { sku, date });
    }
  };

  const handleSaveEdit = (key: string) => {
    const editData = editingOutliers[key];
    if (!editData) return;

    const parts = key.split('_');
    if (parts.length < 3) {
      console.error('Invalid key format for save:', key);
      return;
    }
    
    const date = parts[parts.length - 2];
    const sku = parts.slice(0, -2).join('_');

    const updatedData = cleanedData.map(item => {
      if (item.sku === sku && item.date === date) {
        return { 
          ...item, 
          sales: editData.value,
          note: editData.note || undefined
        };
      }
      return item;
    });
    
    onDataCleaning(updatedData);
    
    setEditingOutliers(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });

    const noteText = editData.note ? ` (Note: ${editData.note})` : '';
    toast({
      title: "Value Updated",
      description: `Sales value for ${sku} on ${date} updated to ${editData.value.toLocaleString()}${noteText}`,
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
    console.log('Proceed to forecasting clicked, cleaned data length:', cleanedData.length);
    onDataCleaning(cleanedData);
    
    // Dispatch a custom event that the parent Index component can listen to
    const event = new CustomEvent('proceedToForecasting');
    window.dispatchEvent(event);
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
      {/* Export/Import Section */}
      <div className="bg-slate-50 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-slate-800 mb-3">Data Cleaning Export/Import</h3>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={handleExportCleaning}
            disabled={cleanedData.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Cleaning Data
          </Button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportFile}
            className="hidden"
          />
          
          <Button 
            variant="outline" 
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import Cleaning Data
          </Button>
          
          <div className="text-sm text-slate-600">
            Export your cleaning changes or import previously saved cleaning data
          </div>
        </div>
      </div>

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
                  value?.toLocaleString() || '0', 
                  name === 'cleanedSales' ? 'Cleaned Sales' : 'Original Sales'
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
              <Line 
                type="monotone" 
                dataKey="cleanedSales" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Cleaned Sales"
                dot={{ r: 3 }}
                connectNulls={false}
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
            const hasBeenModified = dataPoint.sales !== dataPoint.originalSales;
            
            return (
              <div key={dataPoint.key} className={`p-3 rounded-lg ${dataPoint.isOutlier ? 'bg-red-50' : 'bg-green-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-4">
                    <div className="text-sm text-slate-600">{dataPoint.date}</div>
                    <div className="text-sm">
                      <span className="font-medium">Current: {dataPoint.sales.toLocaleString()}</span>
                      <span className="text-slate-500 ml-2">
                        (Original: {dataPoint.originalSales.toLocaleString()})
                      </span>
                    </div>
                    <Badge variant={badgeVariant} className={`text-xs ${badgeColor}`}>
                      Z-Score: {dataPoint.zScore.toFixed(2)}
                    </Badge>
                    {!dataPoint.isOutlier && (
                      <Badge variant="secondary" className="text-xs text-green-800 bg-green-100">
                        Clean
                      </Badge>
                    )}
                    {hasBeenModified && (
                      <Badge variant="outline" className="text-xs text-blue-800 bg-blue-50">
                        Modified
                      </Badge>
                    )}
                    {dataPoint.note && (
                      <Badge variant="outline" className="text-xs text-purple-800 bg-purple-50">
                        Note
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {!isEditing && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          console.log('Edit button clicked for:', dataPoint.key);
                          handleEditOutlier(dataPoint.key);
                        }}
                      >
                        <Edit3 className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                </div>

                {dataPoint.note && !isEditing && (
                  <div className="text-xs text-purple-700 bg-purple-50 p-2 rounded mt-2">
                    <strong>Note:</strong> {dataPoint.note}
                  </div>
                )}

                {isEditing && (
                  <div className="space-y-3 bg-white p-3 rounded border">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-600 mb-1 block">New Value</label>
                        <Input
                          type="number"
                          value={editingOutliers[dataPoint.key]?.value || 0}
                          onChange={(e) => setEditingOutliers({
                            ...editingOutliers,
                            [dataPoint.key]: {
                              ...editingOutliers[dataPoint.key],
                              value: parseFloat(e.target.value) || 0
                            }
                          })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveEdit(dataPoint.key);
                            }
                          }}
                          className="w-full"
                        />
                        <div className="text-xs text-slate-500 mt-1">
                          Original: {dataPoint.originalSales.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 mb-1 block">Note (optional)</label>
                        <Textarea
                          value={editingOutliers[dataPoint.key]?.note || ''}
                          onChange={(e) => setEditingOutliers({
                            ...editingOutliers,
                            [dataPoint.key]: {
                              ...editingOutliers[dataPoint.key],
                              note: e.target.value
                            }
                          })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveEdit(dataPoint.key);
                            }
                          }}
                          placeholder="Add a note about this change..."
                          className="w-full resize-none"
                          rows={2}
                        />
                        <div className="text-xs text-slate-500 mt-1">
                          Press Enter to save
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        onClick={() => handleSaveEdit(dataPoint.key)}
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCancelEdit(dataPoint.key)}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
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

      {/* Import Preview Dialog */}
      <ImportPreviewDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        previews={importPreviews}
        errors={importErrors}
        metadata={importMetadata}
        onConfirm={handleConfirmImport}
        fileName={importFileName}
      />
    </div>
  );
};
