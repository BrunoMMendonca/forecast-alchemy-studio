import React, { useState, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Zap } from 'lucide-react';
import { SalesData } from '@/pages/Index';
import { useToast } from '@/hooks/use-toast';
import { exportCleaningData, parseCleaningCSV, applyImportChanges, ImportPreview } from '@/utils/csvUtils';
import { ImportPreviewDialog } from '@/components/ImportPreviewDialog';
import { OutlierChart } from '@/components/OutlierChart';
import { OutlierStatistics } from '@/components/OutlierStatistics';
import { OutlierControls } from '@/components/OutlierControls';
import { OutlierExportImport } from '@/components/OutlierExportImport';
import { OutlierDataTable } from '@/components/OutlierDataTable';

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
      <OutlierExportImport
        onExport={handleExportCleaning}
        onImportClick={() => fileInputRef.current?.click()}
        isExportDisabled={cleanedData.length === 0}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleImportFile}
        className="hidden"
      />

      {/* Controls */}
      <OutlierControls
        selectedSKU={selectedSKU}
        skus={skus}
        threshold={threshold}
        onSKUChange={setSelectedSKU}
        onThresholdChange={setThreshold}
        onPrevSKU={handlePrevSKU}
        onNextSKU={handleNextSKU}
      />

      {/* Statistics */}
      <OutlierStatistics
        totalRecords={outlierData.length}
        outliersCount={outliers.length}
        cleanRecords={outlierData.length - outliers.length}
        outlierRate={outlierData.length > 0 ? ((outliers.length / outlierData.length) * 100) : 0}
      />

      {/* Chart */}
      <OutlierChart data={chartData} selectedSKU={selectedSKU} />

      {/* Data Editing Table */}
      <OutlierDataTable
        filteredData={filteredOutlierData}
        selectedSKU={selectedSKU}
        hideCleanData={hideCleanData}
        editingOutliers={editingOutliers}
        onHideCleanDataChange={setHideCleanData}
        onEditOutlier={handleEditOutlier}
        onSaveEdit={handleSaveEdit}
        onCancelEdit={handleCancelEdit}
        onEditValueChange={(key, value) => setEditingOutliers({
          ...editingOutliers,
          [key]: { ...editingOutliers[key], value }
        })}
        onEditNoteChange={(key, note) => setEditingOutliers({
          ...editingOutliers,
          [key]: { ...editingOutliers[key], note }
        })}
      />

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
