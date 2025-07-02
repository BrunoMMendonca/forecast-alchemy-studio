import React, { useCallback, useState, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { StepContent } from '@/components/StepContent';
import { toast } from '@/components/ui/use-toast';
import { useDataHandlers } from '@/hooks/useDataHandlers';
import { JobSummary } from '@/hooks/useBackendJobStatus';
import { GlobalSettings } from '@/types/globalSettings';
import { CsvUploadResult } from '@/components/CsvImportWizard';
import { ForecastResult } from '@/types/forecast';
import { useSKUStore } from '@/store/skuStore';

interface ForecastPageContext {
  summary: JobSummary;
  globalSettings: GlobalSettings & { [key: string]: any };
  currentStep: number;
  setCurrentStep: (step: number) => void;
  processedDataInfo: CsvUploadResult | null;
  setProcessedDataInfo: (result: CsvUploadResult | null) => void;
  forecastResults: ForecastResult[];
  setForecastResults: (results: ForecastResult[]) => void;
  aiError: string | null;
  setAiError: (error: string | null) => void;
  batchId: string | null;
  setBatchId: (batchId: string | null) => void;
  isAutoLoading: boolean;
  models: any;
  updateModel: (model: any) => void;
}

const ForecastPage = () => {
  const context = useOutletContext<ForecastPageContext>();
  
  // Get ALL page state from parent layout
  const {
    currentStep,
    setCurrentStep,
    processedDataInfo,
    setProcessedDataInfo,
    forecastResults,
    setForecastResults,
    aiError,
    setAiError,
    summary,
    globalSettings,
    batchId,
    setBatchId,
    isAutoLoading,
    models,
    updateModel
  } = context;

  // State hooks
  const [lastImportFileName, setLastImportFileName] = useState<string | null>(null);
  const [lastImportTime, setLastImportTime] = useState<string | null>(null);
  
  const uniqueSKUCount = useMemo(() => {
    return processedDataInfo?.summary.skuCount ?? 0;
  }, [processedDataInfo]);
  
  // Data handlers now get all setters from context
  const { processNewData, createAllJobs: originalCreateAllJobs, handleImportDataCleaning } = useDataHandlers({
    setCurrentStep,
    setProcessedDataInfo,
    setForecastResults,
    aiForecastModelOptimizationEnabled: globalSettings?.aiForecastModelOptimizationEnabled,
    setAiError,
    onFileNameChange: () => {}, // Not used in this context
    lastImportFileName: null,
    lastImportTime: null
  });

  // Wrapper for createAllJobs that updates the global batchId and passes it to job creation
  const createAllJobs = useCallback(async (result: CsvUploadResult) => {
    const newBatchId = Date.now().toString();
    setBatchId(newBatchId);
    await originalCreateAllJobs(result, newBatchId);
  }, [originalCreateAllJobs, setBatchId]);

  const handleAIFailure = useCallback((errorMessage: string) => {
    toast({
      variant: "destructive",
      title: "AI Processing Failed",
      description: `${errorMessage}. Falling back to manual import.`,
    });
    setAiError(errorMessage);
  }, [setAiError]);

  // Wrapper function that handles both data processing and job creation
  const handleConfirm = useCallback(async (result: CsvUploadResult, isExistingData: boolean = false) => {
    // First process the data (sets processedDataInfo and navigates to step 1)
    processNewData(result);
    
    // Only create jobs for new data uploads, not when loading existing data
    if (!isExistingData) {
      // Then create the jobs in the background
      const newBatchId = Date.now().toString();
      setBatchId(newBatchId);
      await originalCreateAllJobs(result, newBatchId);
    }
  }, [processNewData, originalCreateAllJobs, setBatchId]);

  // Handle data cleaning and update processedDataInfo with new filePath
  const handleDataCleaning = useCallback((data: any[], changedSKUs?: string[], filePath?: string) => {
    if (filePath && processedDataInfo) {
      // Update processedDataInfo with the new filePath from the latest cleaning operation
      const updatedProcessedDataInfo = {
        ...processedDataInfo,
        filePath: filePath
      };
      setProcessedDataInfo(updatedProcessedDataInfo);
    } else if (processedDataInfo) {
      // No new filePath, but keep the current dataset loaded
      setProcessedDataInfo({ ...processedDataInfo });
    }
  }, [processedDataInfo, setProcessedDataInfo]);
  
  // Add a useEffect to log when processedDataInfo changes
  useEffect(() => {
  }, [processedDataInfo]);

  const selectedSKU = useSKUStore(state => state.selectedSKU);
  const setSelectedSKU = useSKUStore(state => state.setSelectedSKU);

  return (
      <StepContent
        currentStep={currentStep}
        processedDataInfo={processedDataInfo}
        forecastResults={forecastResults}
        setForecastResults={setForecastResults}
        selectedSKUForResults={selectedSKU}
        queueSize={summary?.total ?? 0}
        forecastPeriods={globalSettings?.forecastPeriods ?? 12}
        aiForecastModelOptimizationEnabled={globalSettings?.aiForecastModelOptimizationEnabled ?? false}
        onConfirm={handleConfirm}
        onDataCleaning={handleDataCleaning}
        onImportDataCleaning={handleImportDataCleaning}
        onForecastGeneration={setForecastResults}
        onStepChange={setCurrentStep}
        onAIFailure={handleAIFailure}
        lastImportFileName={lastImportFileName}
        lastImportTime={lastImportTime}
        isAutoLoading={isAutoLoading}
        isOptimizing={summary?.isOptimizing ?? false}
        batchId={batchId}
        models={models}
        updateModel={updateModel}
      />
  );
};

export default ForecastPage; 