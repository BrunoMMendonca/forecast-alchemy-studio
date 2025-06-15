import React, { useEffect, useCallback, useState } from 'react';
import { OptimizationQueuePopup } from '@/components/OptimizationQueuePopup';
import { MainLayout } from '@/components/MainLayout';
import { StepContent } from '@/components/StepContent';
import { useUnifiedState } from '@/hooks/useUnifiedState';
import { useOptimizationQueue } from '@/hooks/useOptimizationQueue';
import { ForecastPage } from './ForecastPage';
import { getDefaultModels, hasOptimizableParameters } from '@/utils/modelConfig';
import { useOptimizationCacheContext } from '@/context/OptimizationCacheContext';

export interface NormalizedSalesData {
  'Material Code': string;
  'Description'?: string;
  'Date': string;
  'Sales': number;
  [key: string]: string | number | undefined;
}

export interface ForecastResult {
  sku: string;
  model: string;
  predictions: { date: string; value: number }[];
  accuracy?: number;
}

const Index = () => {
  const {
    // State
    salesData,
    cleanedData,
    forecastResults,
    currentStep,
    settingsOpen,
    isQueuePopupOpen,
    selectedSKU,
    models,
    forecastPeriods,
    businessContext,
    grokApiEnabled,
    
    // Data management
    setSalesData,
    setCleanedData,
    setForecastResults,
    
    // UI state management
    setCurrentStep,
    setSettingsOpen,
    setIsQueuePopupOpen,
    
    // SKU management
    setSelectedSKU,
    
    // Model management
    setModels,
    updateModel,
    
    // Settings management
    setForecastPeriods,
    setBusinessContext,
    setGrokApiEnabled
  } = useUnifiedState();

  const {
    queue,
    addToQueue,
    removeFromQueue,
    updateProgress,
    setIsOptimizing,
    processQueue,
    setPaused
  } = useOptimizationQueue();

  const { clearAllCache } = useOptimizationCacheContext();

  const [lastImportFileName, setLastImportFileName] = useState<string | null>(null);
  const [lastImportTime, setLastImportTime] = useState<string | null>(null);

  // Listen for the global queue popup event
  useEffect(() => {
    const handleOpenGlobalQueuePopup = () => {
      setIsQueuePopupOpen(true);
    };

    window.addEventListener('openGlobalQueuePopup', handleOpenGlobalQueuePopup);
    
    return () => {
      window.removeEventListener('openGlobalQueuePopup', handleOpenGlobalQueuePopup);
    };
  }, [setIsQueuePopupOpen]);

  // Sync queue state with unified state
  useEffect(() => {
    console.log('🔄 INDEX: Syncing queue state');
    console.log('🔄 INDEX: - Queue items:', queue.items);
    console.log('🔄 INDEX: - Queue size:', queue.items.length);
    console.log('🔄 INDEX: - Is optimizing:', queue.isOptimizing);

    if (queue.items.length > 0 && !queue.isOptimizing) {
      console.log('🚀 INDEX: Starting queue processing');
      processQueue();
    }
  }, [queue.items, queue.isOptimizing, processQueue]);

  const handleGlobalSettingsChange = (changedSetting: 'forecastPeriods' | 'businessContext' | 'grokApiEnabled') => {
    if (cleanedData.length > 0) {
      const allSKUs = Array.from(new Set(cleanedData.map(d => d['Material Code'])));
      removeFromQueue(allSKUs);
      const optimizableModels = getDefaultModels().filter(hasOptimizableParameters);
      const jobs = allSKUs.flatMap(sku =>
        optimizableModels.flatMap(model => {
          const jobs = [];
          // Always add Grid job
          jobs.push({
            sku,
            modelId: model.id,
            reason: 'settings_change',
            method: 'grid',
            timestamp: Date.now()
          });
          // Add AI job if enabled
          if (grokApiEnabled) {
            jobs.push({
          sku,
          modelId: model.id,
              reason: 'settings_change',
              method: 'ai',
          timestamp: Date.now()
            });
          }
          return jobs;
        })
      );
      const existingPairs = new Set(queue.items.map(item => `${item.sku}__${item.modelId}__${item.reason}__${item.method}`));
      const newJobs = jobs.filter(job => !existingPairs.has(`${job.sku}__${job.modelId}__${job.reason}__${job.method}`));
      addToQueue(newJobs);
    }
  };

  const handleDataUpload = useCallback((data: NormalizedSalesData[], fileName?: string) => {
    console.log('📥 INDEX: Handling data upload');
    setSalesData(data);
    setCleanedData(data);
    setCurrentStep(1);
    if (fileName) setLastImportFileName(fileName);
    setLastImportTime(new Date().toLocaleString());
    
    const skusInOrder = Array.from(new Set(data.map(d => d['Material Code'])));
    const optimizableModels = getDefaultModels().filter(hasOptimizableParameters);
    const jobs = skusInOrder.flatMap(sku =>
      optimizableModels.flatMap(model => {
        const jobs = [];
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
    const existingPairs = new Set(queue.items.map(item => `${item.sku}__${item.modelId}__${item.reason}__${item.method}`));
    const newJobs = jobs.filter(job => !existingPairs.has(`${job.sku}__${job.modelId}__${job.reason}__${job.method}`));
    console.log('📥 INDEX: Adding jobs to queue:', newJobs);
    addToQueue(newJobs);
  }, [setSalesData, setCleanedData, setCurrentStep, addToQueue, queue.items, grokApiEnabled]);

  const handleDataCleaning = useCallback((data: NormalizedSalesData[], changedSKUs?: string[]) => {
    console.log('🧹 INDEX: Handling data cleaning');
    setCleanedData(data);
    
    // If specific SKUs were changed, only queue those
    if (changedSKUs && changedSKUs.length > 0) {
      const currentSKUs = Array.from(new Set(data.map(d => d['Material Code'])));
      const validChangedSKUs = changedSKUs.filter(sku => currentSKUs.includes(sku));
      
      if (validChangedSKUs.length > 0) {
        const optimizableModels = getDefaultModels().filter(hasOptimizableParameters);
        const jobs = validChangedSKUs.flatMap(sku =>
          optimizableModels.flatMap(model => {
            const jobs = [];
            // Always add Grid job
            jobs.push({
              sku,
              modelId: model.id,
              reason: 'manual_edit_data_cleaning',
              method: 'grid',
              timestamp: Date.now()
            });
            // Add AI job if enabled
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
          })
        );
        const existingPairs = new Set(queue.items.map(item => `${item.sku}__${item.modelId}__${item.reason}__${item.method}`));
        const newJobs = jobs.filter(job => !existingPairs.has(`${job.sku}__${job.modelId}__${job.reason}__${job.method}`));
        console.log('🧹 INDEX: Adding jobs to queue:', newJobs);
        addToQueue(newJobs);
      }
    }
  }, [setCleanedData, addToQueue, queue.items, grokApiEnabled]);

  const handleForecastGeneration = useCallback((results: ForecastResult[], sku: string) => {
    setForecastResults(results);
    setSelectedSKU(sku);
  }, [setForecastResults, setSelectedSKU]);

  useEffect(() => {
    const handleProceedToForecasting = () => {
      setCurrentStep(3);
    };

    window.addEventListener('proceedToForecasting', handleProceedToForecasting);
    
    return () => {
      window.removeEventListener('proceedToForecasting', handleProceedToForecasting);
    };
  }, [setCurrentStep]);

  const shouldStartOptimization = useCallback(() => {
    // Start optimization if:
    // 1. We have data
    // 2. We have items in the queue
    // 3. We're not already optimizing
    return cleanedData.length > 0 && 
           queue.items.length > 0 && 
           !queue.isOptimizing;
  }, [cleanedData.length, queue.items.length, queue.isOptimizing]);

  const handleOptimizationStarted = useCallback(() => {
    console.log('🚀 Optimization started');
    setIsOptimizing(true);
  }, [setIsOptimizing]);

  const handleImportDataCleaning = useCallback((importedSKUs: string[]) => {
    console.log('handleImportDataCleaning called with:', importedSKUs);
    const validSKUs = importedSKUs.filter(sku => !!sku && typeof sku === 'string');
    if (validSKUs.length > 0) {
      const optimizableModels = getDefaultModels().filter(hasOptimizableParameters);
      const jobs = validSKUs.flatMap(sku =>
        optimizableModels.flatMap(model => {
          const jobs = [];
          // Always add Grid job
          jobs.push({
            sku,
            modelId: model.id,
            reason: 'csv_upload_data_cleaning',
            method: 'grid',
            timestamp: Date.now()
          });
          // Add AI job if enabled
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
      const existingPairs = new Set(queue.items.map(item => `${item.sku}__${item.modelId}__${item.reason}__${item.method}`));
      const newJobs = jobs.filter(job => !existingPairs.has(`${job.sku}__${job.modelId}__${job.reason}__${job.method}`));
      console.log('Adding jobs to queue:', newJobs);
      addToQueue(newJobs);
    }
  }, [addToQueue, queue.items, grokApiEnabled]);

  // If we're on the forecast step, render the new ForecastPage
  if (currentStep === 3) {
    return (
      <>
      <MainLayout
        salesDataLength={salesData.length}
        queueSize={queue.items.length}
        uniqueSKUCount={new Set(queue.items.map(item => item.sku)).size}
        currentStep={currentStep}
        forecastResultsLength={forecastResults.length}
        onStepClick={setCurrentStep}
        onQueuePopupOpen={() => setIsQueuePopupOpen(true)}
        forecastPeriods={forecastPeriods}
        setForecastPeriods={setForecastPeriods}
        businessContext={businessContext}
        setBusinessContext={setBusinessContext}
        grokApiEnabled={grokApiEnabled}
        setGrokApiEnabled={setGrokApiEnabled}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        isOptimizing={queue.isOptimizing}
          paused={queue.paused}
      >
        <ForecastPage
          data={cleanedData.length > 0 ? cleanedData : salesData}
          businessContext={businessContext}
          grokApiEnabled={grokApiEnabled}
        />
      </MainLayout>
        <OptimizationQueuePopup
          isOpen={isQueuePopupOpen}
          onOpenChange={setIsQueuePopupOpen}
          queue={queue}
          models={models}
          onRemoveFromQueue={removeFromQueue}
          cleanedData={cleanedData}
          setPaused={setPaused}
          onClearCache={clearAllCache}
        />
      </>
    );
  }

  return (
    <>
      <MainLayout
        salesDataLength={salesData.length}
        queueSize={queue.items.length}
        uniqueSKUCount={new Set(queue.items.map(item => item.sku)).size}
        currentStep={currentStep}
        forecastResultsLength={forecastResults.length}
        onStepClick={setCurrentStep}
        onQueuePopupOpen={() => setIsQueuePopupOpen(true)}
        forecastPeriods={forecastPeriods}
        setForecastPeriods={setForecastPeriods}
        businessContext={businessContext}
        setBusinessContext={setBusinessContext}
        grokApiEnabled={grokApiEnabled}
        setGrokApiEnabled={setGrokApiEnabled}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        isOptimizing={queue.isOptimizing}
        paused={queue.paused}
      >
        <StepContent
          currentStep={currentStep}
          onDataUpload={handleDataUpload}
          onDataCleaning={handleDataCleaning}
          onForecastGeneration={handleForecastGeneration}
          salesData={salesData}
          cleanedData={cleanedData}
          forecastResults={forecastResults}
          selectedSKUForResults={selectedSKU}
          onSKUChange={setSelectedSKU}
          shouldStartOptimization={shouldStartOptimization}
          onOptimizationStarted={handleOptimizationStarted}
          grokApiEnabled={grokApiEnabled}
          optimizationQueue={{
            items: queue.items,
            queueSize: queue.items.length,
            uniqueSKUCount: new Set(queue.items.map(item => item.sku)).size
          }}
          forecastPeriods={forecastPeriods}
          onStepChange={setCurrentStep}
          queueSize={queue.items.length}
          onImportDataCleaning={handleImportDataCleaning}
          lastImportFileName={lastImportFileName}
          lastImportTime={lastImportTime}
        />
      </MainLayout>
      <OptimizationQueuePopup
        isOpen={isQueuePopupOpen}
        onOpenChange={setIsQueuePopupOpen}
        queue={queue}
        models={models}
        onRemoveFromQueue={removeFromQueue}
        cleanedData={cleanedData}
        setPaused={setPaused}
        onClearCache={clearAllCache}
      />
    </>
  );
};

export default Index;
