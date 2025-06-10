import React, { useEffect, useCallback, useState } from 'react';
import { OptimizationQueuePopup } from '@/components/OptimizationQueuePopup';
import { MainLayout } from '@/components/MainLayout';
import { StepContent } from '@/components/StepContent';
import { useUnifiedState } from '@/hooks/useUnifiedState';
import { useToast } from '@/hooks/use-toast';
import { useOptimizationQueue } from '@/hooks/useOptimizationQueue';
import { ForecastPage } from './ForecastPage';

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
  const { toast } = useToast();
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
    setIsOptimizing
  } = useOptimizationQueue();

  const [optimizationQueue, setOptimizationQueue] = useState<{
    items: Array<{
      sku: string;
      modelId: string;
      reason: string;
      timestamp: number;
    }>;
    queueSize: number;
    uniqueSKUCount: number;
  }>({
    items: [],
    queueSize: 0,
    uniqueSKUCount: 0
  });

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

  const handleGlobalSettingsChange = (changedSetting: 'forecastPeriods' | 'businessContext' | 'grokApiEnabled') => {
    if (cleanedData.length > 0) {
      const allSKUs = Array.from(new Set(cleanedData.map(d => d['Material Code'])));
      
      // Clear existing queue and add all SKUs
      removeFromQueue(allSKUs);
      addToQueue(allSKUs.map(sku => ({
        sku,
        modelId: '',
        reason: 'settings_change',
        timestamp: Date.now()
      })));
      
      toast({
        title: "Global Settings Changed",
        description: `${allSKUs.length} SKU${allSKUs.length > 1 ? 's' : ''} queued for re-optimization due to ${changedSetting === 'forecastPeriods' ? 'forecast periods' : changedSetting === 'businessContext' ? 'business context' : 'Grok API'} change`,
      });
    }
  };

  const handleDataUpload = useCallback((data: NormalizedSalesData[]) => {
    setSalesData(data);
    setCleanedData(data);
    setCurrentStep(1);
  }, [setSalesData, setCleanedData, setCurrentStep]);

  const handleDataCleaning = useCallback((data: NormalizedSalesData[]) => {
    setCleanedData(data);
  }, [setCleanedData]);

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

  const shouldStartOptimization = () => {
    // For now, always return false (or implement your logic here)
    return false;
  };

  const handleOptimizationStarted = () => {
    // Implementation of handleOptimizationStarted
  };

  // If we're on the forecast step, render the new ForecastPage
  if (currentStep === 3) {
    return (
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
      >
        <ForecastPage
          data={cleanedData.length > 0 ? cleanedData : salesData}
          onBack={() => setCurrentStep(2)}
        />
      </MainLayout>
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
          optimizationQueue={optimizationQueue}
          forecastPeriods={forecastPeriods}
          onStepChange={setCurrentStep}
          queueSize={queue.items.length}
          onImportDataCleaning={() => {}}
        />
      </MainLayout>

      <OptimizationQueuePopup
        isOpen={isQueuePopupOpen}
        onOpenChange={setIsQueuePopupOpen}
        queue={queue}
        models={models}
        onRemoveFromQueue={removeFromQueue}
      />
    </>
  );
};

export default Index;
