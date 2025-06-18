import React, { useEffect, useCallback, useState } from 'react';
import { OptimizationQueuePopup } from '@/components/OptimizationQueuePopup';
import { MainLayout } from '@/components/MainLayout';
import { StepContent } from '@/components/StepContent';
import { useUnifiedState } from '@/hooks/useUnifiedState';
import { ForecastPage } from './ForecastPage';
import { getDefaultModels, hasOptimizableParameters } from '@/utils/modelConfig';
import { useOptimizationCacheContext } from '@/context/OptimizationCacheContext';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import type { OptimizationQueueItem } from '@/types/optimization';
import { useOptimizationQueue } from '@/hooks/useOptimizationQueue';
import { useAISettings } from '@/hooks/useAISettings';

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
  } = useUnifiedState();

  const { enabled: aiEnabled } = useAISettings();

  const {
    forecastPeriods: globalForecastPeriods,
    setForecastPeriods: setGlobalForecastPeriods,
    businessContext: globalBusinessContext,
    setBusinessContext: setGlobalBusinessContext,
    aiForecastModelOptimizationEnabled: globalaiForecastModelOptimizationEnabled,
    setaiForecastModelOptimizationEnabled: setGlobalaiForecastModelOptimizationEnabled,
    aiCsvImportEnabled,
    setAiCsvImportEnabled,
    aiFailureThreshold,
    setAiFailureThreshold,
    resetToDefaults
  } = useGlobalSettings();

  const {
    queue,
    addToQueue,
    removeFromQueue,
    updateProgress,
    setIsOptimizing,
    processQueue,
    setPaused
  } = useOptimizationQueue(cleanedData, salesData, aiEnabled, globalaiForecastModelOptimizationEnabled);

  const { clearAllCache } = useOptimizationCacheContext();

  const [lastImportFileName, setLastImportFileName] = useState<string | null>(null);
  const [lastImportTime, setLastImportTime] = useState<string | null>(null);
  const [pendingQueueJobs, setPendingQueueJobs] = useState<OptimizationQueueItem[] | null>(null);
  const [pendingUpload, setPendingUpload] = useState(false);

  const handleGlobalSettingsChange = useCallback((changedSetting: 'forecastPeriods' | 'businessContext' | 'aiForecastModelOptimizationEnabled' | 'aiFailureThreshold') => {
    if (cleanedData.length > 0) {
      const allSKUs = Array.from(new Set(cleanedData.map(d => d['Material Code'])));
      removeFromQueue(allSKUs);
      const optimizableModels = getDefaultModels().filter(hasOptimizableParameters);
      const jobs = allSKUs.flatMap(sku =>
        optimizableModels.flatMap(model => {
          const jobs = [];
          jobs.push({
            sku,
            modelId: model.id,
            reason: 'settings_change',
            method: 'grid',
            timestamp: Date.now()
          });
          console.log('[QUEUE] handleGlobalSettingsChange: AI Enabled:', aiEnabled, 'AI Optimization Enabled:', globalaiForecastModelOptimizationEnabled);
          if (aiEnabled && globalaiForecastModelOptimizationEnabled) {
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
      console.log(`[QUEUE] handleGlobalSettingsChange: Current queue size before update: ${queue.items.length}`);
      addToQueue(newJobs);
      console.log(`[QUEUE] handleGlobalSettingsChange: Current queue size after update: ${queue.items.length}`);
    }
  }, [cleanedData, removeFromQueue, addToQueue, aiEnabled, globalaiForecastModelOptimizationEnabled, queue.items]);

  // Use a ref to always have the latest handleGlobalSettingsChange
  const handleGlobalSettingsChangeRef = React.useRef(handleGlobalSettingsChange);
  useEffect(() => {
    handleGlobalSettingsChangeRef.current = handleGlobalSettingsChange;
  }, [handleGlobalSettingsChange]);

  // Set up the onSettingsChange handler in useGlobalForecastSettings
  useEffect(() => {
    // If your useGlobalForecastSettings supports dynamic handler assignment, do it here
    // Otherwise, you may need to refactor the hook to support this
    // Example (pseudo-code):
    // setOnSettingsChange(handleGlobalSettingsChangeRef.current);
  }, []);

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

  // Combined useEffect for queue state logging and auto-starting
  useEffect(() => {
    const dataReady = (cleanedData.length > 0 ? cleanedData : salesData).length > 0;
    if (
      queue.items.length > 0 &&
      !queue.isOptimizing &&
      !queue.paused &&
      dataReady
    ) {
      processQueue();
    }
  }, [queue.items, queue.isOptimizing, queue.paused, processQueue, cleanedData, salesData]);

  const handleDataUpload = useCallback((data: any, fileName?: string) => {
    console.log('[Index] handleDataUpload received:', Array.isArray(data) ? data.slice(0, 5) : data);
    // Convert 2D array to array of objects if needed
    let objects = data;
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const [headers, ...rows] = data;
      objects = rows.map(row => {
        const obj: Record<string, any> = {};
        headers.forEach((h, i) => { obj[h] = row[i]; });
        return obj;
      });
    }
    setSalesData(objects);
    setCleanedData(objects);
    console.log('✅ Data uploaded. salesData and cleanedData set:', objects.length);
    setCurrentStep(1);
    if (fileName) setLastImportFileName(fileName);
    setLastImportTime(new Date().toLocaleString());
    setPendingUpload(true);
  }, [setSalesData, setCleanedData, setCurrentStep]);

  useEffect(() => {
    if (pendingUpload && salesData.length > 0) {
      const skusInOrder = Array.from(new Set(salesData.map(d => d['Material Code'])));
      const optimizableModels = getDefaultModels().filter(hasOptimizableParameters);
      const jobs = skusInOrder.flatMap(sku =>
        optimizableModels.flatMap(model => {
          const jobs = [];
          jobs.push({ sku, modelId: model.id, reason: 'csv_upload_sales_data', method: 'grid', timestamp: Date.now() });
          if (aiEnabled && globalaiForecastModelOptimizationEnabled) {
            jobs.push({ sku, modelId: model.id, reason: 'csv_upload_sales_data', method: 'ai', timestamp: Date.now() });
          }
          return jobs;
        })
      );
      console.log(`[QUEUE] useEffect pendingUpload: Current queue size before update: ${queue.items.length}`);
      addToQueue(jobs);
      console.log(`[QUEUE] useEffect pendingUpload: Current queue size after update: ${queue.items.length}`);
      setPendingUpload(false);
    }
  }, [pendingUpload, salesData, addToQueue, aiEnabled, globalaiForecastModelOptimizationEnabled, queue.items]);

  const handleDataCleaning = useCallback((data: NormalizedSalesData[], changedSKUs?: string[]) => {
    console.log('🧹 INDEX: Handling data cleaning');
    setCleanedData(data);
    if (changedSKUs && changedSKUs.length > 0) {
      const currentSKUs = Array.from(new Set(data.map(d => d['Material Code'])));
      const validChangedSKUs = changedSKUs.filter(sku => currentSKUs.includes(sku));
      if (validChangedSKUs.length > 0) {
        const optimizableModels = getDefaultModels().filter(hasOptimizableParameters);
        const jobs = validChangedSKUs.flatMap(sku =>
          optimizableModels.flatMap(model => {
            const jobs = [];
            jobs.push({ sku, modelId: model.id, reason: 'data_cleaning', method: 'grid', timestamp: Date.now() });
            if (aiEnabled && globalaiForecastModelOptimizationEnabled) {
              jobs.push({ sku, modelId: model.id, reason: 'data_cleaning', method: 'ai', timestamp: Date.now() });
            }
            return jobs;
          })
        );
        console.log(`[QUEUE] handleDataCleaning: Current queue size before update: ${queue.items.length}`);
        addToQueue(jobs);
        console.log(`[QUEUE] handleDataCleaning: Current queue size after update: ${queue.items.length}`);
      }
    }
  }, [setCleanedData, addToQueue, aiEnabled, globalaiForecastModelOptimizationEnabled, queue.items]);

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
          jobs.push({
            sku,
            modelId: model.id,
            reason: 'csv_upload_data_cleaning',
            method: 'grid',
            timestamp: Date.now()
          });
          if (aiEnabled && globalaiForecastModelOptimizationEnabled) {
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
  }, [addToQueue, queue.items, aiEnabled, globalaiForecastModelOptimizationEnabled]);

  useEffect(() => {
    const handleGoToStep = (e) => {
      if (e.detail && typeof e.detail.step === 'number') {
        setCurrentStep(e.detail.step);
      }
    };
    window.addEventListener('goToStep', handleGoToStep);
    return () => window.removeEventListener('goToStep', handleGoToStep);
  }, [setCurrentStep]);

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
        forecastPeriods={globalForecastPeriods}
        setForecastPeriods={setGlobalForecastPeriods}
        businessContext={globalBusinessContext}
        setBusinessContext={setGlobalBusinessContext}
        aiForecastModelOptimizationEnabled={globalaiForecastModelOptimizationEnabled}
        setaiForecastModelOptimizationEnabled={setGlobalaiForecastModelOptimizationEnabled}
        aiCsvImportEnabled={aiCsvImportEnabled}
        setAiCsvImportEnabled={setAiCsvImportEnabled}
        aiFailureThreshold={aiFailureThreshold}
        setAiFailureThreshold={setAiFailureThreshold}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        isOptimizing={queue.isOptimizing}
          paused={queue.paused}
      >
        <ForecastPage
          data={cleanedData.length > 0 ? cleanedData : salesData}
          businessContext={globalBusinessContext}
          aiForecastModelOptimizationEnabled={globalaiForecastModelOptimizationEnabled}
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
        forecastPeriods={globalForecastPeriods}
        setForecastPeriods={setGlobalForecastPeriods}
        businessContext={globalBusinessContext}
        setBusinessContext={setGlobalBusinessContext}
        aiForecastModelOptimizationEnabled={globalaiForecastModelOptimizationEnabled}
        setaiForecastModelOptimizationEnabled={setGlobalaiForecastModelOptimizationEnabled}
        aiCsvImportEnabled={aiCsvImportEnabled}
        setAiCsvImportEnabled={setAiCsvImportEnabled}
        aiFailureThreshold={aiFailureThreshold}
        setAiFailureThreshold={setAiFailureThreshold}
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
          aiForecastModelOptimizationEnabled={globalaiForecastModelOptimizationEnabled}
          optimizationQueue={{
            items: queue.items,
            queueSize: queue.items.length,
            uniqueSKUCount: new Set(queue.items.map(item => item.sku)).size
          }}
          forecastPeriods={globalForecastPeriods}
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
