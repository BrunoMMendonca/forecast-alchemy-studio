
import { useCallback } from 'react';
import { SalesData, ForecastResult } from '@/pages/Index';
import { useToast } from '@/hooks/use-toast';

interface UseDataHandlersProps {
  setSalesData: (data: SalesData[]) => void;
  setCleanedData: (data: SalesData[]) => void;
  setCurrentStep: (step: number) => void;
  setForecastResults: (results: ForecastResult[]) => void;
  setSelectedSKUForResults: (sku: string) => void;
  cleanedData: SalesData[];
  addSKUsToQueue: (skus: string[], source: string, skipCacheClear?: boolean, onlySpecifiedSKUs?: boolean) => void;
  clearManualAIPreferences: () => void;
  clearQueue: () => void;
  onStartOptimization?: () => void; // Keep for backward compatibility but no longer used
}

export const useDataHandlers = ({
  setSalesData,
  setCleanedData,
  setCurrentStep,
  setForecastResults,
  setSelectedSKUForResults,
  cleanedData,
  addSKUsToQueue,
  clearManualAIPreferences,
  clearQueue,
  onStartOptimization // Kept for compatibility but ignored
}: UseDataHandlersProps) => {
  const { toast } = useToast();

  const handleDataUpload = useCallback((data: SalesData[]) => {
    clearManualAIPreferences();
    clearQueue();
    
    setSalesData(data);
    setCleanedData(data);
    setCurrentStep(1);
    
    setForecastResults([]);
    setSelectedSKUForResults('');
    
    const skusInOrder: string[] = [];
    const seenSKUs = new Set<string>();
    
    for (const item of data) {
      if (!seenSKUs.has(item.sku)) {
        skusInOrder.push(item.sku);
        seenSKUs.add(item.sku);
      }
    }
    
    // Add SKUs to queue - optimization will start automatically
    addSKUsToQueue(skusInOrder, 'csv_upload', false, false);
    
    toast({
      title: "Data Uploaded",
      description: `${skusInOrder.length} SKU${skusInOrder.length > 1 ? 's' : ''} queued for optimization. Optimization starting automatically...`,
    });
  }, [setSalesData, setCleanedData, setCurrentStep, setForecastResults, setSelectedSKUForResults, addSKUsToQueue, clearManualAIPreferences, clearQueue, toast]);

  const handleDataCleaning = useCallback((cleaned: SalesData[], changedSKUs?: string[]) => {
    setCleanedData(cleaned);
    
    if (changedSKUs && changedSKUs.length > 0) {
      const currentSKUs = Array.from(new Set(cleaned.map(d => d.sku)));
      const validChangedSKUs = changedSKUs.filter(sku => currentSKUs.includes(sku));
      
      if (validChangedSKUs.length > 0) {
        // Only add the specifically changed SKUs to queue - optimization will start automatically
        addSKUsToQueue(validChangedSKUs, 'data_cleaning', false, true);
        
        toast({
          title: "Optimization Triggered",
          description: `${validChangedSKUs.length} SKU${validChangedSKUs.length > 1 ? 's' : ''} queued for re-optimization due to data changes. Optimization starting automatically...`,
        });
      }
    }
  }, [setCleanedData, addSKUsToQueue, toast]);

  const handleImportDataCleaning = useCallback((importedSKUs: string[]) => {
    const currentSKUs = Array.from(new Set(cleanedData.map(d => d.sku)));
    const validImportedSKUs = importedSKUs.filter(sku => currentSKUs.includes(sku));
    
    if (validImportedSKUs.length > 0) {
      // Only add the specifically imported SKUs - optimization will start automatically
      addSKUsToQueue(validImportedSKUs, 'csv_import', false, true);
      
      toast({
        title: "Import Optimization Triggered",
        description: `${validImportedSKUs.length} SKU${validImportedSKUs.length > 1 ? 's' : ''} queued for optimization after import. Optimization starting automatically...`,
      });
    }
  }, [cleanedData, addSKUsToQueue, toast]);

  const handleForecastGeneration = useCallback((results: ForecastResult[], selectedSKU?: string) => {
    setForecastResults(results);
    if (selectedSKU) {
      setSelectedSKUForResults(selectedSKU);
    }
  }, [setForecastResults, setSelectedSKUForResults]);

  return {
    handleDataUpload,
    handleDataCleaning,
    handleImportDataCleaning,
    handleForecastGeneration
  };
};
