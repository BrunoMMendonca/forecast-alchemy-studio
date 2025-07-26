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
  const { processNewData, createAllJobs: originalCreateAllJobs, handleImportDataCleaning, handleManualEditDataCleaning } = useDataHandlers({
    setCurrentStep,
    setProcessedDataInfo,
    setForecastResults,
    aiForecastModelOptimizationEnabled: globalSettings?.aiForecastModelOptimizationEnabled,
    setAiError,
    onFileNameChange: () => {}, // Not used in this context
    lastImportFileName: null,
    lastImportTime: null,
    processedDataInfo // Add canonical datasetId access
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
    // Set the processed data info but don't automatically navigate to next step
    // This allows the CSV import wizard to stay on the upload step for multiple imports
    if (setProcessedDataInfo) {
      setProcessedDataInfo(result);
    }
    setForecastResults([]);
    
    // Only create jobs for new data uploads, not when loading existing data
    if (!isExistingData) {
      // Then create the jobs in the background
      const newBatchId = Date.now().toString();
      setBatchId(newBatchId);
      await originalCreateAllJobs(result, newBatchId);
    }
  }, [setProcessedDataInfo, setForecastResults, originalCreateAllJobs, setBatchId]);

  // Handle data cleaning - DO NOT update the canonical datasetId
  const handleDataCleaning = useCallback((data: any[], changedSKUs?: string[], datasetId?: number) => {
    // Keep the original processedDataInfo.datasetId as the canonical one
    // The datasetId parameter from data cleaning is only used for the cleaning operation itself
    // but should not replace the canonical datasetId for the dataset
    if (processedDataInfo) {
      // Only update other properties if needed, but keep the original datasetId
      setProcessedDataInfo({ ...processedDataInfo });
    }
    
    // Create jobs for changed SKUs
    if (changedSKUs && changedSKUs.length > 0) {
      changedSKUs.forEach(sku => {
        handleManualEditDataCleaning(sku, datasetId, data);
      });
    }
  }, [processedDataInfo, setProcessedDataInfo, handleManualEditDataCleaning]);
  
  // Add a useEffect to log when processedDataInfo changes
  useEffect(() => {
  }, [processedDataInfo]);

  const selectedSKU = useSKUStore(state => state.selectedSKU);
  const setSelectedSKU = useSKUStore(state => state.setSelectedSKU);

  // Add a wrapper for handleImportDataCleaning to accept the new data parameter
  const handleImportDataCleaningWrapper = useCallback((skus: string[], datasetId?: number, data?: any[]) => {
    handleImportDataCleaning(skus, datasetId, data);
  }, [handleImportDataCleaning]);

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
        onImportDataCleaning={handleImportDataCleaningWrapper}
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