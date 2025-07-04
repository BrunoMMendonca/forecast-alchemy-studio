import React, { useState, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Zap, Clock } from 'lucide-react';
import { NormalizedSalesData } from '@/pages/Index';
import { exportCleaningData, parseCleaningCSV, applyImportChanges, ImportPreview } from '@/utils/csvUtils';
import { ImportPreviewDialog } from '@/components/ImportPreviewDialog';
import { OutlierChart } from '@/components/OutlierChart';
import { OutlierStatistics } from '@/components/OutlierStatistics';
import { OutlierControls } from '@/components/OutlierControls';
import { OutlierExportImport } from '@/components/OutlierExportImport';
import { OutlierDataTable } from '@/components/OutlierDataTable';

interface OutlierDetectionProps {
  data: NormalizedSalesData[];
  cleanedData: NormalizedSalesData[];
  onDataCleaning: (cleanedData: NormalizedSalesData[], changedSKUs?: string[]) => void;
  onImportDataCleaning?: (importedSKUs: string[]) => void;
  queueSize?: number;
  onFileNameChange?: (fileName: string) => void;
}

interface OutlierDataPoint extends NormalizedSalesData {
  isOutlier: boolean;
  zScore: number;
  index: number;
  key: string;
  originalSales: number;
  note?: string;
  [key: string]: any; // Add index signature
}

export const OutlierDetection: React.FC<OutlierDetectionProps> = ({ 
  data, 
  cleanedData, 
  onDataCleaning, 
  onImportDataCleaning,
  queueSize = 0,
  onFileNameChange
}) => {
  const [selectedSKU, setSelectedSKU] = useState<string>('');
  const [threshold, setThreshold] = useState([2.5]);
  const [editingOutliers, setEditingOutliers] = useState<{ [key: string]: { value: number; note: string } }>({});
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importPreviews, setImportPreviews] = useState<ImportPreview[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importMetadata, setImportMetadata] = useState<{ threshold?: number; exportDate?: string; totalRecords?: number }>({});
  const [importFileName, setImportFileName] = useState('');
  const [highlightedDate, setHighlightedDate] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [treatZeroAsOutlier, setTreatZeroAsOutlier] = useState(true);

  const skus = useMemo(() => {
    return Array.from(new Set(data.map(d => d['Material Code']))).sort();
  }, [data]);

  const descriptions = useMemo(() => {
    const map: Record<string, string> = {};
    data.forEach(d => {
      const sku = String(d['Material Code']);
      if (d.Description && !map[sku]) map[sku] = String(d.Description);
    });
    return map;
  }, [data]);

  // Use cleanedData if available, otherwise fall back to data
  const effectiveCleanedData = cleanedData.length > 0 ? cleanedData : data;

  // Reset local state when data changes
  React.useEffect(() => {
    setSelectedSKU('');
    setThreshold([2.5]);
    setEditingOutliers({});
    setShowImportDialog(false);
    setImportPreviews([]);
    setImportErrors([]);
    setImportMetadata({});
    setImportFileName('');
    setHighlightedDate(undefined);
  }, [data]);

  // Auto-select first SKU when data changes
  React.useEffect(() => {
    if (skus.length > 0 && (!selectedSKU || !skus.includes(selectedSKU))) {
      setSelectedSKU(skus[0]);
    }
  }, [skus, selectedSKU]);

  const outlierData = useMemo((): OutlierDataPoint[] => {
    if (effectiveCleanedData.length === 0 || !selectedSKU) return [];
    const skuData = effectiveCleanedData.filter(d => d['Material Code'] === selectedSKU);
    if (skuData.length < 3) return skuData.map((item, index) => {
      const originalItem = data.find(d => d['Material Code'] === item['Material Code'] && d['Date'] === item['Date']);
      const isZero = treatZeroAsOutlier && Number(item.Sales) === 0;
      return {
        'Material Code': item['Material Code'],
        Description: item.Description,
        Date: item.Date,
        Sales: item.Sales,
        isOutlier: isZero,
        zScore: 0,
        index,
        key: `${selectedSKU}_${item['Date']}_${index}`,
        originalSales: originalItem?.Sales ?? item.Sales,
        note: typeof item.note === 'string' ? item.note : (item.note !== undefined ? String(item.note) : undefined)
      };
    });
    const sales = skuData.map(d => d.Sales);
    const mean = sales.reduce((sum, s) => sum + s, 0) / sales.length;
    const variance = sales.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / sales.length;
    const stdDev = Math.sqrt(variance);
    return skuData.map((item, index): OutlierDataPoint => {
      const zScore = stdDev > 0 ? Math.abs((item.Sales - mean) / stdDev) : 0;
      const isZero = treatZeroAsOutlier && Number(item.Sales) === 0;
      const isOutlier = isZero || zScore > threshold[0];
      const key = `${selectedSKU}_${item['Date']}_${index}`;
      const originalItem = data.find(d => d['Material Code'] === item['Material Code'] && d['Date'] === item['Date']);
      return {
        'Material Code': item['Material Code'],
        Description: item.Description,
        Date: item.Date,
        Sales: item.Sales,
        isOutlier,
        zScore,
        index,
        key,
        originalSales: originalItem?.Sales ?? item.Sales,
        note: typeof item.note === 'string' ? item.note : (item.note !== undefined ? String(item.note) : undefined)
      };
    });
  }, [effectiveCleanedData, selectedSKU, threshold, data, treatZeroAsOutlier]);

  const outliers = useMemo(() => {
    return outlierData.filter(d => d.isOutlier);
  }, [outlierData]);

  // Always show all data
  const filteredOutlierData = outlierData;

  const chartData = useMemo(() => {
    if (!selectedSKU || data.length === 0) return [];

    const originalSkuData = data.filter(d => d['Material Code'] === selectedSKU)
      .sort((a, b) => new Date(a['Date']).getTime() - new Date(b['Date']).getTime());
    const cleanedSkuData = effectiveCleanedData.filter(d => d['Material Code'] === selectedSKU)
      .sort((a, b) => new Date(a['Date']).getTime() - new Date(b['Date']).getTime());

    return originalSkuData.map((originalItem) => {
      const cleanedItem = cleanedSkuData.find(c => c['Date'] === originalItem['Date']);
      const outlierItem = outlierData.find(o => o['Date'] === originalItem['Date']);
      return {
        date: originalItem['Date'],
        originalSales: originalItem.Sales,
        cleanedSales: cleanedItem?.Sales ?? originalItem.Sales,
        outlier: outlierItem?.isOutlier ? originalItem.Sales : null
      };
    });
  }, [data, effectiveCleanedData, selectedSKU, outlierData]);

  const handleExportCleaning = () => {
    if (data.length === 0 || cleanedData.length === 0) {
      return;
    }

    try {
      exportCleaningData(data, cleanedData, threshold[0]);
    } catch (error) {
      console.error("Export Error:", error instanceof Error ? error.message : "Failed to export data");
    }
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target?.result as string;
        const { previews, errors, metadata } = parseCleaningCSV(csvText);
        
        // Filter previews to only include SKUs that exist in current data
        const currentSKUs = new Set(data.map(d => d['Material Code']));
        const validPreviews = previews.filter(p => {
          const skuExists = currentSKUs.has(p.sku);
          const dateExists = data.some(d => d['Material Code'] === p.sku && d['Date'] === p.date);
          return skuExists && dateExists;
        });

        const skuNotFoundErrors = previews
          .filter(p => !currentSKUs.has(p.sku))
          .map(p => `SKU "${p.sku}" not found in current dataset`);
        
        const dateNotFoundErrors = previews
          .filter(p => currentSKUs.has(p.sku) && !data.some(d => d['Material Code'] === p.sku && d['Date'] === p.date))
          .map(p => `Date "${p.date}" not found for SKU "${p.sku}"`);

        setImportPreviews(validPreviews);
        setImportErrors([...errors, ...skuNotFoundErrors, ...dateNotFoundErrors]);
        setImportMetadata(metadata);
        setImportFileName(file.name);
        setShowImportDialog(true);
        if (onFileNameChange) {
          onFileNameChange(file.name);
        }
      } catch (error) {
        console.error("Import Error:", error instanceof Error ? error.message : "Failed to parse CSV file");
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
      // Always apply corrections to the original data, not just cleanedData
      let baseData = cleanedData.length > 0 ? cleanedData : data;
      const updatedData = applyImportChanges(baseData, importPreviews);
      // Ensure all original rows are present, with corrections applied
      const allRows = data.map(orig => {
        const corrected = updatedData.find(u => u['Material Code'] === orig['Material Code'] && u['Date'] === orig['Date']);
        return corrected ? corrected : orig;
      });
      // Extract SKUs that were modified during import
      const modifiedSKUs = Array.from(new Set(
        importPreviews
          .filter(p => (p.action === 'modify' || p.action === 'add_note') && p.sku)
          .map(p => p.sku)
      ));
      onDataCleaning(allRows);
      // Notify parent about imported SKUs for optimization
      if (onImportDataCleaning && modifiedSKUs.length > 0) {
        onImportDataCleaning(modifiedSKUs);
      }
      const modifications = importPreviews.filter(p => p.action === 'modify');
      const noteAdditions = importPreviews.filter(p => p.action === 'add_note');
      setShowImportDialog(false);
      setImportPreviews([]);
      setImportErrors([]);
      setImportMetadata({});
      setImportFileName('');
    } catch (error) {
      console.error("Import Error:", error instanceof Error ? error.message : "Failed to apply changes");
    }
  };

  const handleDateClick = (date: string) => {
    setHighlightedDate(date);
    // Find the corresponding data point in all data, not just filtered
    const dataPoint = outlierData.find(d => d['Date'] === date);
    if (dataPoint) {
      // Clear any existing editing state
      setEditingOutliers({});
      
      // Temporarily show all data to ensure the element exists
      const wasHidden = false;
      
      // Use setTimeout to ensure the DOM has updated
      setTimeout(() => {
        const element = document.getElementById(dataPoint.key);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        // Restore the previous filter state
        if (wasHidden) {
          setEditingOutliers({});
        }
      }, 0);
      
      // Open the edit mode for this data point
      handleEditOutlier(dataPoint.key);
    }
  };

  const handleEditOutlier = (key: string) => {
    const parts = key.split('_');
    if (parts.length < 3) {
      console.error('Invalid key format:', key);
      return;
    }
    const date = parts[parts.length - 2];
    const sku = parts.slice(0, -2).join('_');
    // Search in effectiveCleanedData so editing always works
    const currentItem = effectiveCleanedData.find(item => item['Material Code'] === sku && item['Date'] === date);
    if (currentItem) {
      const note = typeof currentItem.note === 'number' ? String(currentItem.note) : (currentItem.note || '');
      // If we're already editing this row, close it
      if (editingOutliers[key]) {
        setEditingOutliers({});
        setHighlightedDate(undefined);
      } else {
        // Otherwise, close any open row and open this one
        setEditingOutliers({
          [key]: {
            value: currentItem.Sales,
            note
          }
        });
        setHighlightedDate(date);
      }
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

    console.log('🧹 EDIT: Saving changes for SKU:', sku, 'Date:', date, 'New value:', editData.value);

    const updatedData = cleanedData.map(item => {
      if (item['Material Code'] === sku && item['Date'] === date) {
        return { 
          ...item, 
          Sales: editData.value,
          note: editData.note || undefined
        };
      }
      return item;
    });
    
    // Notify parent with the changed SKU
    console.log('🧹 EDIT: SKU modified during manual editing, triggering optimization:', sku);
    onDataCleaning(updatedData, [sku]);
    
    setEditingOutliers(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });

    const noteText = editData.note ? ` (Note: ${editData.note})` : '';
    setHighlightedDate(undefined);
  };

  const handleCancelEdit = (key: string) => {
    setEditingOutliers(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
    setHighlightedDate(undefined);
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
        skus={Array.from(new Set(skus.filter(Boolean)))}
        threshold={threshold}
        onSKUChange={setSelectedSKU}
        onThresholdChange={setThreshold}
        onPrevSKU={handlePrevSKU}
        onNextSKU={handleNextSKU}
        treatZeroAsOutlier={treatZeroAsOutlier}
        setTreatZeroAsOutlier={setTreatZeroAsOutlier}
        descriptions={descriptions}
      />

      {/* Statistics */}
      <OutlierStatistics
        totalRecords={outlierData.length}
        outliersCount={outliers.length}
        cleanRecords={outlierData.length - outliers.length}
        outlierRate={outlierData.length > 0 ? ((outliers.length / outlierData.length) * 100) : 0}
      />

      {/* Chart */}
      <OutlierChart 
        data={chartData} 
        selectedSKU={selectedSKU} 
        onDateClick={handleDateClick}
        highlightedDate={highlightedDate}
      />

      {/* Data Editing Table */}
      <OutlierDataTable
        filteredData={filteredOutlierData}
        selectedSKU={selectedSKU}
        editingOutliers={editingOutliers}
        onEditOutlier={handleEditOutlier}
        onSaveEdit={handleSaveEdit}
        onCancelEdit={handleCancelEdit}
        onEditValueChange={(key, value) => setEditingOutliers({
          ...editingOutliers,
          [key]: { ...editingOutliers[key], value }
        })}
        onEditNoteChange={(key, note) => setEditingOutliers(prev => {
          const updated = { ...prev };
          updated[key] = { ...updated[key], note: String(note) };
          return updated;
        })}
        highlightedDate={highlightedDate}
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
