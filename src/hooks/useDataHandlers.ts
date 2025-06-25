import { useCallback, useState } from 'react';
import { ForecastResult } from '@/types/forecast';
import { useToast } from '@/hooks/use-toast';
import { useUnifiedState } from '@/hooks/useUnifiedState';
import { getDefaultModels } from '@/utils/modelConfig';
import { CsvUploadResult } from '@/components/CsvImportWizard';

// Performance limit for optimization
// const MAX_SKUS_FOR_OPTIMIZATION = 50; // Limit optimization to first 50 SKUs

interface DataHandlerSetters {
  setCurrentStep: (step: number) => void;
  setProcessedDataInfo: (result: CsvUploadResult | null) => void;
  setForecastResults: (results: ForecastResult[]) => void;
  aiForecastModelOptimizationEnabled?: boolean;
  setAiError: (error: string | null) => void;
  onFileNameChange: (fileName: string) => void;
  lastImportFileName: string | null;
  lastImportTime: string | null;
}

export const useDataHandlers = ({
  setCurrentStep,
  setProcessedDataInfo,
  setForecastResults,
  aiForecastModelOptimizationEnabled,
  setAiError,
  onFileNameChange,
  lastImportFileName,
  lastImportTime
}: DataHandlerSetters) => {
  const { toast } = useToast();
  const { models } = useUnifiedState();
  const [batchId, setBatchId] = useState<string | null>(null);

  const createJobs = useCallback(async (jobData: {data?: any[], skus?: string[], reason: string, filePath?: string, batchId?: string}) => {
    const modelsToProcess = models.length > 0 ? models.map(m => m.id) : getDefaultModels().map(m => m.id);
    
    const methodsToRun = ['grid'];
    if (aiForecastModelOptimizationEnabled) {
      methodsToRun.push('ai');
    }

    let totalJobsCreated = 0;

    for (const method of methodsToRun) {
      try {
        const response = await fetch('http://localhost:3001/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...jobData, models: modelsToProcess, method, batchId: jobData.batchId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`[${method.toUpperCase()}] ${errorData.error || 'Failed to create jobs'}`);
        }

        const result = await response.json();
        totalJobsCreated += result.jobsCreated || 0;
        console.log(`[BACKEND] ${method.toUpperCase()} job creation successful:`, result);

      } catch (error: any) {
        console.error(`[BACKEND] Error creating ${method} jobs:`, error);
        toast({
          title: "Error",
          description: `Could not start backend optimization: ${error.message}`,
          variant: "destructive",
        });
        return; // Stop if one method fails
      }
    }

    if (totalJobsCreated > 0) {
      toast({
        title: "Backend Optimization Started",
        description: `Successfully created ${totalJobsCreated} optimization jobs on the server.`,
        variant: "default",
      });
    }
  }, [models, aiForecastModelOptimizationEnabled, toast]);

  const processNewData = useCallback((result: CsvUploadResult) => {
    console.log('[useDataHandlers] processNewData called with:', result);
    if (typeof setProcessedDataInfo !== 'function' || typeof setForecastResults !== 'function' || typeof setCurrentStep !== 'function') {
      console.error('[useDataHandlers] One or more state setters are not functions!', {
        setProcessedDataInfo: typeof setProcessedDataInfo,
        setForecastResults: typeof setForecastResults,
        setCurrentStep: typeof setCurrentStep,
      });
      return;
    }
    
    if (result) {
      setProcessedDataInfo(result);
      setForecastResults([]);
    }
    setCurrentStep(1); // Navigate to next step
  }, [setProcessedDataInfo, setForecastResults, setCurrentStep]);

  const createAllJobs = useCallback(async (result: CsvUploadResult, batchIdOverride?: string) => {
    console.log('[useDataHandlers] createAllJobs called with:', result);
    if (!result || !result.success || !result.skuList || result.skuList.length === 0) {
      toast({
        title: "Job Creation Skipped",
        description: "No valid data or SKUs found to create optimization jobs.",
        variant: "default",
      });
      return;
    }

    const useBatchId = batchIdOverride || Date.now().toString();
    setBatchId(useBatchId);
    try {
      console.log('[BACKEND] Submitting SKUs from processed file to create optimization jobs...');
      await createJobs({ skus: result.skuList, reason: 'dataset_upload', filePath: result.filePath, batchId: useBatchId });
    } catch (error) {
      console.error('[BACKEND] Error during job creation process:', error);
      // The error is toasted inside createJobs
    }
  }, [createJobs, toast]);

  // RAW SALES DATA CSV UPLOAD
  const handleDataUpload = useCallback(async (result: CsvUploadResult) => {
    if (!result || !result.success) {
      toast({
        title: "Error",
        description: "The data upload was not successful.",
        variant: "destructive",
      });
      return;
    }

    // This now only processes the data for the UI, no job creation
    processNewData(result);

  }, [processNewData, toast]);

  // DATA CLEANING CSV UPLOAD
  const handleImportDataCleaning = useCallback(async (importedSKUs: string[], filePath?: string) => {
    console.log('handleImportDataCleaning called with:', importedSKUs, 'filePath:', filePath);
    const validSKUs = importedSKUs.filter(sku => !!sku && typeof sku === 'string');
    
    if (validSKUs.length > 0) {
      await createJobs({ skus: validSKUs, reason: 'csv_upload_data_cleaning', filePath });
    }
  }, [createJobs]);

  // MANUAL DATA CLEANING EDIT
  const handleManualEditDataCleaning = useCallback(async (sku: string, filePath?: string) => {
    await createJobs({ skus: [sku], reason: 'manual_edit_data_cleaning', filePath });
  }, [createJobs]);

  const handleDataReady = useCallback((result: CsvUploadResult) => {
    setProcessedDataInfo(result);
  }, [setProcessedDataInfo]);

  const handleConfirm = useCallback(async (result: CsvUploadResult) => {
    setProcessedDataInfo(result);
    setCurrentStep(1); // Move to Forecast Engine step
  }, [setProcessedDataInfo, setCurrentStep]);
  
  const handleForecastComplete = useCallback((results: ForecastResult[]) => {
    setForecastResults(results);
    setCurrentStep(2); // Move to Finalization step
  }, [setForecastResults, setCurrentStep]);

  const handleAIFailure = useCallback((errorMessage: string) => {
    setAiError(errorMessage);
    // Optionally, you can also show a toast notification here
  }, [setAiError]);

  return { handleDataUpload, processNewData, createAllJobs, handleImportDataCleaning, handleManualEditDataCleaning, handleDataReady, handleConfirm, handleForecastComplete, handleAIFailure, batchId };
};
