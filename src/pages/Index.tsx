
import React, { useEffect } from 'react';
import { OptimizationQueuePopup } from '@/components/OptimizationQueuePopup';
import { MainLayout } from '@/components/MainLayout';
import { StepContent } from '@/components/StepContent';
import { useOptimizationQueue } from '@/hooks/useOptimizationQueue';
import { useManualAIPreferences } from '@/hooks/useManualAIPreferences';
import { useGlobalForecastSettings } from '@/hooks/useGlobalForecastSettings';
import { useAppState } from '@/hooks/useAppState';
import { useDataHandlers } from '@/hooks/useDataHandlers';
import { useToast } from '@/hooks/use-toast';

export interface SalesData {
  date: string;
  sku: string;
  sales: number;
  isOutlier?: boolean;
  note?: string;
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
    salesData,
    setSalesData,
    cleanedData,
    setCleanedData,
    forecastResults,
    setForecastResults,
    selectedSKUForResults,
    setSelectedSKUForResults,
    currentStep,
    setCurrentStep,
    settingsOpen,
    setSettingsOpen,
    isQueuePopupOpen,
    setIsQueuePopupOpen
  } = useAppState();

  const { 
    addSKUsToQueue, 
    removeSKUsFromQueue, 
    removeSKUModelPairsFromQueue, 
    getSKUsInQueue, 
    queueSize, 
    uniqueSKUCount, 
    getQueuedCombinations, 
    getModelsForSKU, 
    clearQueue 
  } = useOptimizationQueue();
  
  const { clearManualAIPreferences } = useManualAIPreferences();

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
      const allSKUs = Array.from(new Set(cleanedData.map(d => d.sku)));
      
      clearManualAIPreferences();
      addSKUsToQueue(allSKUs, 'csv_upload');
      
      toast({
        title: "Global Settings Changed",
        description: `${allSKUs.length} SKU${allSKUs.length > 1 ? 's' : ''} queued for re-optimization due to ${changedSetting === 'forecastPeriods' ? 'forecast periods' : changedSetting === 'businessContext' ? 'business context' : 'Grok API'} change`,
      });
    }
  };

  const {
    forecastPeriods,
    setForecastPeriods,
    businessContext,
    setBusinessContext,
    grokApiEnabled,
    setGrokApiEnabled
  } = useGlobalForecastSettings({
    onSettingsChange: handleGlobalSettingsChange
  });

  const {
    handleDataUpload,
    handleDataCleaning,
    handleImportDataCleaning,
    handleForecastGeneration
  } = useDataHandlers({
    setSalesData,
    setCleanedData,
    setCurrentStep,
    setForecastResults,
    setSelectedSKUForResults,
    cleanedData,
    addSKUsToQueue,
    clearManualAIPreferences,
    clearQueue
  });

  useEffect(() => {
    const handleProceedToForecasting = () => {
      setCurrentStep(3);
    };

    window.addEventListener('proceedToForecasting', handleProceedToForecasting);
    
    return () => {
      window.removeEventListener('proceedToForecasting', handleProceedToForecasting);
    };
  }, [setCurrentStep]);

  const optimizationQueue = {
    getSKUsInQueue,
    getQueuedCombinations,
    getModelsForSKU,
    removeSKUsFromQueue,
    removeSKUModelPairsFromQueue,
    removeUnnecessarySKUs: removeSKUsFromQueue,
    queueSize,
    uniqueSKUCount
  };

  return (
    <>
      <MainLayout
        salesDataLength={salesData.length}
        queueSize={queueSize}
        uniqueSKUCount={uniqueSKUCount}
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
          salesData={salesData}
          cleanedData={cleanedData}
          forecastResults={forecastResults}
          selectedSKUForResults={selectedSKUForResults}
          queueSize={queueSize}
          forecastPeriods={forecastPeriods}
          grokApiEnabled={grokApiEnabled}
          onDataUpload={handleDataUpload}
          onDataCleaning={handleDataCleaning}
          onImportDataCleaning={handleImportDataCleaning}
          onForecastGeneration={handleForecastGeneration}
          onSKUChange={setSelectedSKUForResults}
          onStepChange={setCurrentStep}
          optimizationQueue={optimizationQueue}
        />
      </MainLayout>

      {/* Global Optimization Queue Popup */}
      <OptimizationQueuePopup
        optimizationQueue={optimizationQueue}
        models={[]} // Empty models array when no data
        isOptimizing={false}
        progress={null}
        isOpen={isQueuePopupOpen}
        onOpenChange={setIsQueuePopupOpen}
      />
    </>
  );
};

export default Index;
