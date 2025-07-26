import { useCallback, useState, useMemo } from 'react';
import { ForecastResult } from '@/types/forecast';
import { useToast } from '@/hooks/use-toast';
import { useUnifiedState } from '@/hooks/useUnifiedState';
import { fetchAvailableModels } from '@/utils/modelConfig';
import { CsvUploadResult } from '@/components/CsvImportWizard';
import { generateOptimizationHash, getMetricWeightsFromSettings } from '@/utils/optimizationHash';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import { v4 as uuidv4 } from 'uuid';

interface DataHandlerSetters {
  setCurrentStep: (step: number) => void;
  setProcessedDataInfo?: (result: CsvUploadResult | null) => void;
  setForecastResults: (results: ForecastResult[]) => void;
  aiForecastModelOptimizationEnabled?: boolean;
  setAiError: (error: string | null) => void;
  onFileNameChange?: (fileName: string) => void;
  lastImportFileName?: string | null;
  lastImportTime?: string | null;
  processedDataInfo?: CsvUploadResult | null;
  setSalesData?: (data: any[]) => void;
  setCleanedData?: (data: any[]) => void;
}

export const useDataHandlers = ({
  setCurrentStep,
  setProcessedDataInfo,
  setForecastResults,
  aiForecastModelOptimizationEnabled,
  setAiError,
  onFileNameChange,
  lastImportFileName,
  lastImportTime,
  processedDataInfo,
}: DataHandlerSetters) => {
  const { toast } = useToast();
  const { models } = useUnifiedState();
  const globalSettings = useGlobalSettings();
  const [batchId, setBatchId] = useState<string | null>(null);

  const validationRatio = 0.2; // Match backend default
  const isDebug = process.env.NODE_ENV === 'development';

  // Move useMemo calls to top level of hook
  const metricWeights = useMemo(() => getMetricWeightsFromSettings(globalSettings), [globalSettings]);
  const seasonalPeriod = useMemo(
    () =>
      globalSettings.frequency
        ? globalSettings.frequency === 'weekly'
          ? 52
          : globalSettings.frequency === 'monthly'
          ? 12
          : globalSettings.frequency === 'quarterly'
          ? 4
          : globalSettings.frequency === 'yearly'
          ? 1
          : 12
        : 12,
    [globalSettings.frequency]
  );

  const createJobs = useCallback(
    async ({
      data,
      skus,
      reason,
      datasetId,
      batchId,
      batchTimestamp,
    }: {
      data?: any[];
      skus?: string[];
      reason: string;
      datasetId: number;
      batchId?: string;
      batchTimestamp?: number;
    }) => {
      if (!datasetId) {
        toast({
          title: 'Error',
          description: 'datasetId is required for job creation.',
          variant: 'destructive',
        });
        throw new Error('datasetId is required for job creation');
      }

      let modelsToProcess = models.length > 0 ? models : [];
      if (!modelsToProcess.length) {
        try {
          modelsToProcess = await fetchAvailableModels();
        } catch (error) {
          console.error('Failed to fetch models:', error);
          toast({
            title: 'Error',
            description: 'Could not fetch available models from backend',
            variant: 'destructive',
        });
        return;
        }
      }

    let requirements: Record<string, any> = {};
    try {
      const res = await fetch('/api/models/data-requirements');
      requirements = await res.json();
    } catch (err) {
      requirements = {};
    }

      if (isDebug) {
        console.log('[createJobs] Called with:', JSON.stringify({ reason, datasetId, batchId, batchTimestamp }, null, 2));
      }

    const eligibleModelsPerSKU: Record<string, string[]> = {};
    let anyEligible = false;
      if (skus && skus.length > 0) {
        for (const sku of skus) {
          const skuData = data?.filter((d) => String(d.sku || d['Material Code']) === sku) || [];
          if (isDebug) {
            console.log(`[createJobs] SKU: ${sku}, skuData.length:`, skuData.length, 'Sample:', skuData.slice(0, 2));
          }
          const eligible = modelsToProcess
            .filter((m) => {
              const req = requirements[m.id] || {};
              const minTrain = Number(req.minObservations) || 0;
          const requiredTotal = Math.ceil(minTrain / (1 - validationRatio));
          const isEligible = skuData.length >= requiredTotal;
              if (isDebug) {
          console.log('[createJobs] Model', m.id, 'requirements:', req, 'minTrain:', minTrain, 'requiredTotal:', requiredTotal, 'isEligible:', isEligible);
              }
          return isEligible;
            })
            .map((m) => m.id);
        if (eligible.length > 0) {
          eligibleModelsPerSKU[sku] = eligible;
          anyEligible = true;
        }
      }
    }

      if (isDebug) {
    console.log('[createJobs] eligibleModelsPerSKU:', eligibleModelsPerSKU);
      }

    if (!anyEligible) {
      toast({
          title: 'No Eligible Models',
          description: 'No enabled models meet the data requirements for any SKU.',
          variant: 'destructive',
      });
      return;
    }

    const methodsToRun = ['grid'];
      if (aiForecastModelOptimizationEnabled) methodsToRun.push('ai');

    let totalJobsCreated = 0;
      let totalJobsMerged = 0;
      const errors: string[] = [];
      const optimizationIds: string[] = [];
    
    for (const method of methodsToRun) {
      for (const sku of Object.keys(eligibleModelsPerSKU)) {
        const eligibleModels = eligibleModelsPerSKU[sku];
        for (const modelId of eligibleModels) {
            const optimizationHash = generateOptimizationHash(sku, modelId, method, `dataset_${datasetId}`, { seasonalPeriod }, metricWeights);
        const payload = { 
          skus: [sku], 
              models: [modelId],
          method, 
              batchId,
              optimizationHash,
              metricWeights,
              batchTimestamp,
              datasetId,
              data,
              reason,
            };

            if (isDebug) {
          console.log(`[createJobs] Sending payload for SKU: ${sku}, Model: ${modelId}, Hash: ${optimizationHash.slice(0, 8)}...`);
            }
          
      try {
        const response = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`[${method.toUpperCase()}] ${errorData.error || 'Failed to create jobs'}`);
        }
        const result = await response.json();
        totalJobsCreated += result.jobsCreated || 0;
              totalJobsMerged += result.jobsMerged || 0;
        const newOptimizationId = result.optimizationId || (result.jobs && result.jobs[0]?.optimizationId);
              if (newOptimizationId) optimizationIds.push(newOptimizationId);
      } catch (error: any) {
              errors.push(`[${method.toUpperCase()}] Failed for SKU ${sku}, Model ${modelId}: ${error.message}`);
            }
          }
        }
      }

      if (optimizationIds.length > 0 && setProcessedDataInfo && processedDataInfo) {
        setProcessedDataInfo({
          ...processedDataInfo,
          optimizationId: optimizationIds[optimizationIds.length - 1], // Use the latest ID
        } as CsvUploadResult);
      }

    if (totalJobsCreated > 0) {
      toast({
          title: 'Backend Optimization Started',
        description: `Successfully created ${totalJobsCreated} optimization jobs on the server.`,
          variant: 'default',
      });
    }
    
      if (totalJobsMerged > 0) {
      toast({
          title: 'Jobs Merged',
          description: `${totalJobsMerged} optimization job(s) were merged because they already exist or are in progress.`,
          variant: 'default',
      });
    }

      if (errors.length > 0) {
        toast({
          title: 'Partial Failure in Job Creation',
          description: errors.join('\n'),
          variant: 'destructive',
        });
      }
    },
    [models, aiForecastModelOptimizationEnabled, toast, globalSettings, setProcessedDataInfo, processedDataInfo, isDebug, metricWeights, seasonalPeriod]
  );

  const processNewData = useCallback(
    (result: CsvUploadResult) => {
    if (!setProcessedDataInfo || typeof setForecastResults !== 'function' || typeof setCurrentStep !== 'function') {
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
    },
    [setProcessedDataInfo, setForecastResults, setCurrentStep]
  );

  const createAllJobs = useCallback(
    async (result: CsvUploadResult, batchIdOverride?: string) => {
    if (!result || !result.success || !result.skuList || result.skuList.length === 0) {
      toast({
          title: 'Job Creation Merged',
          description: 'No valid data or SKUs found to create optimization jobs.',
          variant: 'default',
      });
      return;
    }

    const batchTimestamp = Date.now();
    const useBatchId = batchIdOverride || `${uuidv4()}-${batchTimestamp}`;
    setBatchId(useBatchId);

      let data = undefined;
      if (result.datasetId) {
        try {
          const response = await fetch(`/api/load-processed-data?datasetId=${result.datasetId}`);
          if (response.ok) {
            data = (await response.json()).data;
          } else {
            throw new Error('Failed to load data from database');
          }
        } catch (err) {
          toast({
            title: 'Error',
            description: `Could not load data for datasetId ${result.datasetId}: ${err.message}`,
            variant: 'destructive',
          });
          return;
        }
      } else {
        toast({
          title: 'Error',
          description: 'No datasetId provided',
          variant: 'destructive',
        });
        return;
      }

      try {
        if (isDebug) {
          console.log('[createAllJobs] Submitting SKUs from processed file to create optimization jobs...');
        }
        await createJobs({ skus: result.skuList, data, reason: 'dataset_upload', datasetId: result.datasetId, batchId: useBatchId, batchTimestamp });
    } catch (error) {
        console.error('[createAllJobs] Error during job creation process:', error);
    }
    },
    [createJobs, toast, isDebug]
  );

  const handleDataUpload = useCallback(
    async (result: CsvUploadResult) => {
    if (!result || !result.success) {
      toast({
          title: 'Error',
          description: 'The data upload was not successful.',
          variant: 'destructive',
      });
      return;
    }

    processNewData(result);
    },
    [processNewData, toast]
  );

  const handleImportDataCleaning = useCallback(
    async (importedSKUs: string[], datasetId?: number, data?: any[]) => {
      if (isDebug) {
    console.log('handleImportDataCleaning called with:', importedSKUs, 'datasetId:', datasetId);
      }
      const validSKUs = importedSKUs.filter((sku) => !!sku && typeof sku === 'string');
    
    if (validSKUs.length > 0 && processedDataInfo?.datasetId) {
        const validSKUsData = Array.isArray(data) ? data.filter((d) => validSKUs.includes(String(d.sku || d['Material Code']))) : [];
      
      if (validSKUsData.length > 0) {
        const batchTimestamp = Date.now();
        const useBatchId = `${uuidv4()}-${batchTimestamp}`;
          await createJobs({
            skus: validSKUs,
            data: validSKUsData,
            reason: 'csv_upload_data_cleaning',
            datasetId: processedDataInfo.datasetId,
            batchId: useBatchId,
            batchTimestamp,
          });
      }
    }
    },
    [createJobs, processedDataInfo, isDebug]
  );

  const handleManualEditDataCleaning = useCallback(
    async (sku: string, datasetId?: number, data?: any[]) => {
      if (!processedDataInfo?.datasetId) {
        console.error('[handleManualEditDataCleaning] No canonical datasetId available from processedDataInfo');
        return;
      }

      let skuData: any[] = [];
      
      // If data is provided, filter it for the specific SKU
      if (Array.isArray(data)) {
        skuData = data.filter((d) => String(d.sku || d['Material Code']) === sku);
      }
      
      // If no data provided or no data found for SKU, try to load from database
      if (skuData.length === 0 && processedDataInfo?.datasetId) {
        try {
          if (isDebug) {
            console.log(`[handleManualEditDataCleaning] Loading data for SKU ${sku} from database dataset ${processedDataInfo.datasetId}`);
          }
          const response = await fetch(`/api/load-processed-data?datasetId=${processedDataInfo.datasetId}&sku=${encodeURIComponent(sku)}`);
          if (response.ok) {
            const result = await response.json();
            skuData = result.data || [];
            if (isDebug) {
              console.log(`[handleManualEditDataCleaning] Loaded ${skuData.length} records for SKU ${sku}`);
            }
          } else {
            console.warn(`[handleManualEditDataCleaning] Failed to load data for SKU ${sku} from database`);
          }
        } catch (err) {
          console.error(`[handleManualEditDataCleaning] Error loading data for SKU ${sku}:`, err);
        }
      }

      if (skuData.length >= 10) {
      const batchTimestamp = Date.now();
      const useBatchId = `${uuidv4()}-${batchTimestamp}`;
        if (isDebug) {
          console.log(`[handleManualEditDataCleaning] Creating optimization job for SKU ${sku} with ${skuData.length} data points`);
        }
        await createJobs({
          skus: [sku],
          data: skuData,
          reason: 'manual_edit_data_cleaning',
          datasetId: processedDataInfo.datasetId,
          batchId: useBatchId,
          batchTimestamp,
        });
      } else {
        console.warn(`[handleManualEditDataCleaning] Insufficient data for SKU ${sku}: ${skuData.length} records (minimum 10 required)`);
    }
    },
    [createJobs, processedDataInfo, isDebug]
  );

  const handleDataReady = useCallback(
    (result: CsvUploadResult) => {
    if (setProcessedDataInfo) {
      setProcessedDataInfo(result);
    }
    },
    [setProcessedDataInfo]
  );

  const handleConfirm = useCallback(
    async (result: CsvUploadResult) => {
    if (setProcessedDataInfo) {
      setProcessedDataInfo(result);
    }
    setCurrentStep(1); // Move to Forecast Engine step
    },
    [setProcessedDataInfo, setCurrentStep]
  );
  
  const handleForecastComplete = useCallback(
    (results: ForecastResult[]) => {
    setForecastResults(results);
    setCurrentStep(2); // Move to Finalization step
    },
    [setForecastResults, setCurrentStep]
  );

  const handleAIFailure = useCallback(
    (errorMessage: string) => {
    setAiError(errorMessage);
      toast({
        title: 'AI Error',
        description: errorMessage,
        variant: 'destructive',
      });
    },
    [setAiError, toast]
  );

  return {
    handleDataUpload,
    processNewData,
    createAllJobs,
    handleImportDataCleaning,
    handleManualEditDataCleaning,
    handleDataReady,
    handleConfirm,
    handleForecastComplete,
    handleAIFailure,
    batchId,
  };
};