import { useCallback } from 'react';
import { NormalizedSalesData, ForecastResult } from '@/pages/Index';
import { useToast } from '@/hooks/use-toast';
import { useUnifiedState } from '@/hooks/useUnifiedState';

export const useDataHandlers = () => {
  const { toast } = useToast();
  const {
    setSalesData,
    setCleanedData,
    setCurrentStep,
    setForecastResults,
    setSelectedSKU,
    cleanedData,
    addToQueue,
    removeFromQueue,
    setModels,
    updateState,
    // If you have preferences in unified state, add them here
    // setManualAIPreferences,
    // clearManualAIPreferences,
    // clearQueue,
  } = useUnifiedState();

  const handleDataUpload = useCallback((data: NormalizedSalesData[]) => {
    // Reset all state
    setSalesData(data);
    setCleanedData(data); // Reset cleaned data to match new data
    setCurrentStep(1);
    setForecastResults([]);
    setSelectedSKU('');
    setModels([]); // Reset models
    // Clear optimization queue
    updateState({
      optimizationQueue: {
        items: [],
        isOptimizing: false,
        progress: 0
      }
    });
    
    const skusInOrder: string[] = [];
    const seenSKUs = new Set<string>();
    for (const item of data) {
      const sku = item['Material Code'];
      if (!seenSKUs.has(sku)) {
        skusInOrder.push(sku);
        seenSKUs.add(sku);
      }
    }
    // Add SKUs to queue - use 'Material Code' for the SKU
    addToQueue(skusInOrder.map(sku => ({ sku, modelId: '', reason: 'csv_upload' })));
    toast({
      title: "Data Uploaded",
      description: `${skusInOrder.length} SKU${skusInOrder.length > 1 ? 's' : ''} queued for optimization. Optimization starting automatically...`,
    });
  }, [setSalesData, setCleanedData, setCurrentStep, setForecastResults, setSelectedSKU, setModels, addToQueue, updateState, toast]);

  const handleDataCleaning = useCallback((cleaned: NormalizedSalesData[], changedSKUs?: string[]) => {
    setCleanedData(cleaned);
    if (changedSKUs && changedSKUs.length > 0) {
      const currentSKUs = Array.from(new Set(cleaned.map(d => d['Material Code'])));
      const validChangedSKUs = changedSKUs.filter(sku => currentSKUs.includes(sku));
      if (validChangedSKUs.length > 0) {
        addToQueue(validChangedSKUs.map(sku => ({ sku, modelId: '', reason: 'data_cleaning' })));
        toast({
          title: "Optimization Triggered",
          description: `${validChangedSKUs.length} SKU${validChangedSKUs.length > 1 ? 's' : ''} queued for re-optimization due to data changes. Optimization starting automatically...`,
        });
      }
    }
  }, [setCleanedData, addToQueue, toast]);

  const handleImportDataCleaning = useCallback((importedSKUs: string[]) => {
    const currentSKUs = Array.from(new Set(cleanedData.map(d => d['Material Code'])));
    const validImportedSKUs = importedSKUs.filter(sku => currentSKUs.includes(sku));
    if (validImportedSKUs.length > 0) {
      addToQueue(validImportedSKUs.map(sku => ({ sku, modelId: '', reason: 'csv_import' })));
      toast({
        title: "Import Optimization Triggered",
        description: `${validImportedSKUs.length} SKU${validImportedSKUs.length > 1 ? 's' : ''} queued for optimization after import. Optimization starting automatically...`,
      });
    }
  }, [cleanedData, addToQueue, toast]);

  const handleForecastGeneration = useCallback((results: ForecastResult[], selectedSKU?: string) => {
    setForecastResults(results);
    if (selectedSKU) {
      setSelectedSKU(selectedSKU);
    }
  }, [setForecastResults, setSelectedSKU]);

  return {
    handleDataUpload,
    handleDataCleaning,
    handleImportDataCleaning,
    handleForecastGeneration,
  };
};
