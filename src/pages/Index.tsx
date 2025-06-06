import React, { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { List } from 'lucide-react';
import { FileUpload } from '@/components/FileUpload';
import { OutlierDetection } from '@/components/OutlierDetection';
import { ForecastModels } from '@/components/ForecastModels';
import { ForecastResults } from '@/components/ForecastResults';
import { StepNavigation } from '@/components/StepNavigation';
import { useOptimizationQueue } from '@/hooks/useOptimizationQueue';
import { useManualAIPreferences } from '@/hooks/useManualAIPreferences';
import { FloatingSettingsButton } from '@/components/FloatingSettingsButton';
import { OptimizationQueuePopup } from '@/components/OptimizationQueuePopup';
import { DEFAULT_BUSINESS_CONTEXT } from '@/types/businessContext';

export interface SalesData {
  sku: string;
  date: string;
  sales: number;
  note?: string;
  isOutlier?: boolean;
}

export interface ForecastPrediction {
  date: string;
  value: number;
}

export interface ForecastResult {
  sku: string;
  model: string;
  predictions: ForecastPrediction[];
  accuracy?: number;
  modelId: string;
  confidenceIntervalLower?: number;
  confidenceIntervalUpper?: number;
  date?: string;
  forecast?: number;
}

const Index = () => {
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [cleanedData, setCleanedData] = useState<SalesData[]>([]);
  const [forecastResults, setForecastResults] = useState<ForecastResult[]>([]);
  const [selectedSKU, setSelectedSKU] = useState<string>('');
  const [selectedSKUForResults, setSelectedSKUForResults] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [forecastPeriods, setForecastPeriods] = useState<number>(12);
  const [shouldStartOptimization, setShouldStartOptimization] = useState<boolean>(false);
  const [isQueuePopupOpen, setIsQueuePopupOpen] = useState<boolean>(false);
  const [businessContext, setBusinessContext] = useState(DEFAULT_BUSINESS_CONTEXT);
  const [grokApiEnabled, setGrokApiEnabled] = useState<boolean>(true);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);

  const { 
    addSKUsToQueue, 
    removeSKUsFromQueue, 
    removeSKUModelPairsFromQueue,
    getSKUsInQueue, 
    getQueuedCombinations,
    getModelsForSKU,
    queueSize, 
    uniqueSKUCount, 
    clearQueue,
    removeUnnecessarySKUs
  } = useOptimizationQueue();
  const { clearManualAIPreferences } = useManualAIPreferences();

  const handleGlobalSettingsChange = useCallback((newForecastPeriods: number) => {
    setForecastPeriods(newForecastPeriods);
  }, []);

  useEffect(() => {
    const savedSettings = localStorage.getItem('globalForecastSettings');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        if (typeof parsedSettings.forecastPeriods === 'number') {
          setForecastPeriods(parsedSettings.forecastPeriods);
        }
      } catch (error) {
        console.error("Error parsing global forecast settings from localStorage", error);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('globalForecastSettings', JSON.stringify({ forecastPeriods }));
  }, [forecastPeriods]);

  const handleDataUpload = (data: SalesData[]) => {
    clearManualAIPreferences();
    clearQueue();
    
    setSalesData(data);
    setCleanedData(data);
    setCurrentStep(1);
    
    setForecastResults([]);
    setSelectedSKUForResults('');
    
    const skusInOrder: string[] = [];
    const seenSKUs = new Set<string>();
    
    for (const item of data) {
      if (!seenSKUs.has(item.sku)) {
        skusInOrder.push(item.sku);
        seenSKUs.add(item.sku);
      }
    }
    
    addSKUsToQueue(skusInOrder, 'csv_upload');
    
    toast(
      `Data Uploaded - ${skusInOrder.length} SKU${skusInOrder.length > 1 ? 's' : ''} with optimizable models queued for optimization`
    );
  };

  const handleDataCleaning = (cleanedData: SalesData[]) => {
    setCleanedData(cleanedData);
    setCurrentStep(2);
    setForecastResults([]);
    setSelectedSKUForResults('');
    
    const skus = Array.from(new Set(cleanedData.map(d => d.sku)));
    addSKUsToQueue(skus, 'data_cleaning');
    
    toast(
      `Data Cleaned - ${skus.length} SKU${skus.length > 1 ? 's' : ''} queued for optimization after data cleaning`
    );
  };

  const handleImportDataCleaning = (importedSKUs: string[]) => {
    addSKUsToQueue(importedSKUs, 'csv_import');
    
    toast(
      `Data Imported - ${importedSKUs.length} SKU${importedSKUs.length > 1 ? 's' : ''} queued for optimization after data import`
    );
  };

  const handleForecastGeneration = (results: ForecastResult[], selectedSKU: string) => {
    setForecastResults(results);
    setSelectedSKUForResults(selectedSKU);
    setCurrentStep(3);
    
    toast(
      `Forecast Generated - Forecast results generated for ${results.length} periods`
    );
  };

  const handleStepClick = (stepIndex: number) => {
    // Allow navigation to any step if data is uploaded
    if (stepIndex === 0 || salesData.length > 0) {
      // Don't allow finalization step without forecasts
      if (stepIndex === 4 && forecastResults.length === 0) return;
      setCurrentStep(stepIndex);
    }
  };

  // Create complete optimization queue object
  const optimizationQueueObject = {
    getSKUsInQueue,
    getQueuedCombinations,
    getModelsForSKU,
    removeSKUsFromQueue,
    removeSKUModelPairsFromQueue,
    removeUnnecessarySKUs,
    queueSize,
    uniqueSKUCount
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-4">
            AI-Powered Sales Forecast Analytics
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Upload your historical sales data, leverage AI for optimization, and generate enterprise-ready forecasts for S&OP planning.
          </p>
          <div className="mt-4 flex items-center justify-center gap-4">
            {salesData.length > 0 && queueSize > 0 && (
              <div className="text-sm text-blue-600 bg-blue-50 rounded-lg px-4 py-2">
                📋 {queueSize} optimization combinations queued ({uniqueSKUCount} SKUs)
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsQueuePopupOpen(true)}
              className="gap-2"
            >
              <List className="h-4 w-4" />
              View Queue
            </Button>
          </div>
        </div>

        <FloatingSettingsButton
          forecastPeriods={forecastPeriods}
          setForecastPeriods={setForecastPeriods}
          businessContext={businessContext}
          setBusinessContext={setBusinessContext}
          grokApiEnabled={grokApiEnabled}
          setGrokApiEnabled={setGrokApiEnabled}
          settingsOpen={settingsOpen}
          setSettingsOpen={setSettingsOpen}
        />

        <StepNavigation 
          currentStep={currentStep}
          salesDataLength={salesData.length}
          forecastResultsLength={forecastResults.length}
          onStepClick={handleStepClick}
        />

        {/* Step 1: Data Upload */}
        {currentStep === 0 && (
          <FileUpload onDataUpload={handleDataUpload} />
        )}

        {/* Step 2: Data Quality & Outlier Detection */}
        {currentStep === 1 && salesData.length > 0 && (
          <OutlierDetection
            data={salesData}
            cleanedData={cleanedData}
            onDataCleaning={handleDataCleaning}
            onImportDataCleaning={handleImportDataCleaning}
            queueSize={queueSize}
          />
        )}

        {/* Step 3: Model Selection & Forecasting */}
        {currentStep === 2 && cleanedData.length > 0 && (
          <ForecastModels
            data={cleanedData}
            forecastPeriods={forecastPeriods}
            onForecastGeneration={handleForecastGeneration}
            selectedSKU={selectedSKU}
            onSKUChange={setSelectedSKU}
            shouldStartOptimization={shouldStartOptimization}
            onOptimizationStarted={() => setShouldStartOptimization(false)}
            optimizationQueue={optimizationQueueObject}
          />
        )}

        {/* Step 4: Results & Analysis */}
        {currentStep === 3 && forecastResults.length > 0 && (
          <ForecastResults
            results={forecastResults}
            selectedSKU={selectedSKUForResults}
          />
        )}

        {/* Global Optimization Queue Popup */}
        <OptimizationQueuePopup
          optimizationQueue={optimizationQueueObject}
          models={[]} // Empty models array when no data
          isOptimizing={false}
          progress={null}
          isOpen={isQueuePopupOpen}
          onOpenChange={setIsQueuePopupOpen}
        />
      </div>
    </div>
  );
};

export default Index;
