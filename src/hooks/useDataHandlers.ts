import { useCallback } from 'react';
import { ForecastResult } from '@/types/forecast';
import { useToast } from '@/hooks/use-toast';
import { useUnifiedState } from '@/hooks/useUnifiedState';
import { getDefaultModels, hasOptimizableParameters } from '@/utils/modelConfig';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import { CsvUploadResult } from '@/components/CsvImportWizard';

// Performance limit for optimization
// const MAX_SKUS_FOR_OPTIMIZATION = 50; // Limit optimization to first 50 SKUs

interface DataHandlerSetters {
  setCurrentStep: (step: number) => void;
  setProcessedDataInfo: (result: CsvUploadResult | null) => void;
  setForecastResults: (results: ForecastResult[]) => void;
}

export const useDataHandlers = ({
  setCurrentStep,
  setProcessedDataInfo,
  setForecastResults
}: DataHandlerSetters) => {
  const { toast } = useToast();
  const { models, setModels } = useUnifiedState();
  const { aiForecastModelOptimizationEnabled } = useGlobalSettings();

  const createJobs = useCallback(async (jobData: {data?: any[], skus?: string[], reason: string}) => {
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
          body: JSON.stringify({ ...jobData, models: modelsToProcess, method }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`[${method.toUpperCase()}] ${errorData.error || 'Failed to create jobs'}`);
        }
        
        const result = await response.json();
        totalJobsCreated += result.jobsCreated || 0;
        console.log(`[BACKEND] ${method.toUpperCase()} job creation successful:`, result);

      } catch (error) {
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

    // This function will be responsible for the final state update.
    const updateStateAndNavigate = () => {
      console.log('Setting processed data info and resetting state...');
      setProcessedDataInfo(result);
      setForecastResults([]);
      setModels([]);
      setCurrentStep(1); // DIRECTLY NAVIGATE
    };

    try {
      console.log('[BACKEND] Submitting SKUs from processed file to create optimization jobs...');
      
      // Use the skuList from the upload result to create jobs
      if (result.skuList && result.skuList.length > 0) {
        await createJobs({ skus: result.skuList, reason: 'dataset_upload' });
      } else {
        console.warn('[BACKEND] No SKUs found in the upload result to create jobs for.');
      }

    } catch (error) {
      console.error('[BACKEND] Error during job creation process:', error);
      // Even if jobs fail, we still want to navigate. The error is toasted inside createJobs.
    } finally {
      // ALWAYS update the frontend state after backend communication.
      // updateStateAndNavigate(); // <-- This is the problematic call.
    }
  }, [createJobs, setProcessedDataInfo, setForecastResults, setModels, toast, setCurrentStep]);

  // DATA CLEANING CSV UPLOAD
  const handleImportDataCleaning = useCallback(async (importedSKUs: string[]) => {
    console.log('handleImportDataCleaning called with:', importedSKUs);
    const validSKUs = importedSKUs.filter(sku => !!sku && typeof sku === 'string');
    
    if (validSKUs.length > 0) {
      await createJobs({ skus: validSKUs, reason: 'csv_upload_data_cleaning' });
    }
  }, [createJobs]);

  // MANUAL DATA CLEANING EDIT
  const handleManualEditDataCleaning = useCallback(async (sku: string) => {
    if (!sku) return;
    await createJobs({ skus: [sku], reason: 'manual_edit_data_cleaning' });
  }, [createJobs]);

  const handleForecastGeneration = useCallback((results: ForecastResult[]) => {
    setForecastResults(results);
  }, [setForecastResults]);

  return {
    handleDataUpload,
    handleImportDataCleaning,
    handleManualEditDataCleaning,
    handleForecastGeneration
  };
};
