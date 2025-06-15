import { useCallback } from 'react';
import { NormalizedSalesData, ForecastResult } from '@/pages/Index';
import { useToast } from '@/hooks/use-toast';
import { useUnifiedState } from '@/hooks/useUnifiedState';
import { getDefaultModels, hasOptimizableParameters } from '@/utils/modelConfig';
import { OptimizationQueueItem } from '@/types/optimization';

export const useDataHandlers = () => {
  const { toast } = useToast();
  const { 
    setCleanedData, 
    setModels, 
    setForecastResults, 
    setSelectedSKU,
    addToQueue,
    optimizationQueue,
    grokApiEnabled
  } = useUnifiedState();

  // RAW SALES DATA CSV UPLOAD
  const handleDataUpload = useCallback((data: NormalizedSalesData[]) => {
    setCleanedData(data);
    setForecastResults([]);
    setModels([]);
    const skusInOrder: string[] = [];
    const seenSKUs = new Set<string>();
    for (const item of data) {
      const sku = item['Material Code'];
      if (!seenSKUs.has(sku)) {
        skusInOrder.push(sku);
        seenSKUs.add(sku);
      }
    }
    const allModels = getDefaultModels().filter(hasOptimizableParameters);
    const allJobs: OptimizationQueueItem[] = skusInOrder.flatMap(sku =>
      allModels.flatMap(model => {
        const jobs: OptimizationQueueItem[] = [];
        // Always add Grid job
        jobs.push({
          sku,
          modelId: model.id,
          reason: 'csv_upload_sales_data',
          method: 'grid',
          timestamp: Date.now()
        });
        // Add AI job if enabled
        if (grokApiEnabled) {
          jobs.push({
            sku,
            modelId: model.id,
            reason: 'csv_upload_sales_data',
            method: 'ai',
            timestamp: Date.now()
          });
        }
        return jobs;
      })
    );
    // Filter out jobs already in the queue (by sku, modelId, reason, method)
    const existingPairs = new Set(optimizationQueue.items.map(item => `${item.sku}__${item.modelId}__${item.reason}__${item.method}`));
    const newJobs = allJobs.filter(job => !existingPairs.has(`${job.sku}__${job.modelId}__${job.reason}__${job.method}`));
    addToQueue(newJobs);
  }, [setCleanedData, setForecastResults, setModels, addToQueue, optimizationQueue.items, grokApiEnabled]);

  // DATA CLEANING CSV UPLOAD
  const handleImportDataCleaning = useCallback((importedSKUs: string[]) => {
    console.log('handleImportDataCleaning called with:', importedSKUs);
    const validSKUs = importedSKUs.filter(sku => !!sku && typeof sku === 'string');
    if (validSKUs.length > 0) {
      const optimizableModels = getDefaultModels().filter(hasOptimizableParameters);
      const allJobs: OptimizationQueueItem[] = validSKUs.flatMap(sku =>
        optimizableModels.flatMap(model => {
          const jobs: OptimizationQueueItem[] = [];
          jobs.push({
            sku,
            modelId: model.id,
            reason: 'csv_upload_data_cleaning',
            method: 'grid',
            timestamp: Date.now()
          });
          if (grokApiEnabled) {
            jobs.push({
              sku,
              modelId: model.id,
              reason: 'csv_upload_data_cleaning',
              method: 'ai',
              timestamp: Date.now()
            });
          }
          return jobs;
        })
      );
      const existingPairs = new Set(optimizationQueue.items.map(item => `${item.sku}__${item.modelId}__${item.reason}__${item.method}`));
      const newJobs = allJobs.filter(job => !existingPairs.has(`${job.sku}__${job.modelId}__${job.reason}__${job.method}`));
      console.log('Adding jobs to queue:', newJobs);
      addToQueue(newJobs);
      toast({
        title: "Import Optimization Triggered",
        description: `${validSKUs.length} SKU${validSKUs.length > 1 ? 's' : ''} queued for optimization after import. Optimization starting automatically...`,
      });
    }
  }, [addToQueue, optimizationQueue.items, grokApiEnabled, toast]);

  // MANUAL DATA CLEANING EDIT
  const handleManualEditDataCleaning = useCallback((sku: string) => {
    if (!sku) return;
    const optimizableModels = getDefaultModels().filter(hasOptimizableParameters);
    const allJobs: OptimizationQueueItem[] = optimizableModels.flatMap(model => {
      const jobs: OptimizationQueueItem[] = [];
      jobs.push({
        sku,
        modelId: model.id,
        reason: 'manual_edit_data_cleaning',
        method: 'grid',
        timestamp: Date.now()
      });
      if (grokApiEnabled) {
        jobs.push({
          sku,
          modelId: model.id,
          reason: 'manual_edit_data_cleaning',
          method: 'ai',
          timestamp: Date.now()
        });
      }
      return jobs;
    });
    const existingPairs = new Set(optimizationQueue.items.map(item => `${item.sku}__${item.modelId}__${item.reason}__${item.method}`));
    const newJobs = allJobs.filter(job => !existingPairs.has(`${job.sku}__${job.modelId}__${job.reason}__${job.method}`));
    addToQueue(newJobs);
  }, [addToQueue, optimizationQueue.items, grokApiEnabled]);

  const handleForecastGeneration = useCallback((results: ForecastResult[], selectedSKU?: string) => {
    setForecastResults(results);
    if (selectedSKU) {
      setSelectedSKU(selectedSKU);
    }
  }, [setForecastResults, setSelectedSKU]);

  return {
    handleDataUpload,
    handleImportDataCleaning,
    handleManualEditDataCleaning,
    handleForecastGeneration
  };
};
