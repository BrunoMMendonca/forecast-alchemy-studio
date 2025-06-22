import React, { useCallback, useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { StepContent } from '@/components/StepContent';
import { useUnifiedState } from '@/hooks/useUnifiedState';
import { toast } from '@/components/ui/use-toast';
import { useDataHandlers } from '@/hooks/useDataHandlers';
import { JobSummary } from '@/hooks/useBackendJobStatus';
import { GlobalSettings } from '@/hooks/useGlobalSettings';
import { NormalizedSalesData, ForecastResult } from '@/types/forecast';

interface WorkflowPageContext {
  summary: JobSummary;
  globalSettings: GlobalSettings & { [key: string]: any };
  currentStep: number;
  setCurrentStep: (step: number) => void;
  salesData: NormalizedSalesData[];
  setSalesData: (data: NormalizedSalesData[]) => void;
  cleanedData: NormalizedSalesData[];
  setCleanedData: (data: NormalizedSalesData[]) => void;
  forecastResults: ForecastResult[];
  setForecastResults: (results: ForecastResult[]) => void;
  selectedSKU: string | null;
  setSelectedSKU: (sku: string | null) => void;
  aiError: string | null;
  setAiError: (error: string | null) => void;
}

const WorkflowPage = () => {
  const context = useOutletContext<WorkflowPageContext>();
  
  // Get ALL page state from parent layout
  const {
    currentStep,
    setCurrentStep,
    salesData,
    setSalesData,
    cleanedData,
    setCleanedData,
    forecastResults,
    setForecastResults,
    selectedSKU,
    setSelectedSKU,
    aiError,
    setAiError,
    summary,
    globalSettings
  } = context;

  // State hooks
  const [lastImportFileName, setLastImportFileName] = useState<string | null>(null);
  const [lastImportTime, setLastImportTime] = useState<string | null>(null);
  
  const uniqueSKUCount = useMemo(() => {
    if (!cleanedData || cleanedData.length === 0) return 0;
    const skuKey = Object.keys(cleanedData[0]).find(key => key.toLowerCase().includes('sku'));
    if (!skuKey) return 0;
    const skuSet = new Set(cleanedData.map(item => item[skuKey]));
    return skuSet.size;
  }, [cleanedData]);
  
  // Data handlers now get all setters from context
  const { handleDataUpload, handleImportDataCleaning, handleManualEditDataCleaning } = useDataHandlers({
    setCurrentStep,
    setSalesData,
    setCleanedData,
    setForecastResults,
  });

  // This wrapper function will now handle both updating the data and kicking off the backend job.
  const handleDataCleaning = (data: NormalizedSalesData[], changedSKUs?: string[]) => {
    setCleanedData(data);
    if (changedSKUs && changedSKUs.length > 0) {
      changedSKUs.forEach(sku => handleManualEditDataCleaning(sku));
    }
  };

  const handleAIFailure = useCallback((errorMessage: string) => {
    toast({
      variant: "destructive",
      title: "AI Processing Failed",
      description: `${errorMessage}. Falling back to manual import.`,
    });
    setAiError(errorMessage);
  }, [setAiError]);
  
  return (
      <StepContent
        currentStep={currentStep}
        salesData={salesData}
        cleanedData={cleanedData}
        forecastResults={forecastResults}
        selectedSKUForResults={selectedSKU}
        queueSize={summary?.total ?? 0}
        forecastPeriods={globalSettings?.forecastPeriods ?? 12}
        aiForecastModelOptimizationEnabled={globalSettings?.aiForecastModelOptimizationEnabled ?? false}
        onDataUpload={handleDataUpload}
        onDataCleaning={handleDataCleaning}
        onImportDataCleaning={handleImportDataCleaning}
        onForecastGeneration={setForecastResults}
        onSKUChange={setSelectedSKU}
        onStepChange={setCurrentStep}
        onAIFailure={handleAIFailure}
        lastImportFileName={lastImportFileName}
        lastImportTime={lastImportTime}
      />
  );
};

export default WorkflowPage; 