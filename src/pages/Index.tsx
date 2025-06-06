import React, { useState, useEffect, useRef } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { DataVisualization } from '@/components/DataVisualization';
import { OutlierDetection } from '@/components/OutlierDetection';
import { ForecastModels } from '@/components/ForecastModels';
import { ForecastResults } from '@/components/ForecastResults';
import { ForecastFinalization } from '@/components/ForecastFinalization';
import { StepNavigation } from '@/components/StepNavigation';
import { FloatingSettingsButton } from '@/components/FloatingSettingsButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, Upload, Zap, Eye } from 'lucide-react';
import { useOptimizationQueue } from '@/hooks/useOptimizationQueue';
import { useManualAIPreferences } from '@/hooks/useManualAIPreferences';
import { useGlobalForecastSettings } from '@/hooks/useGlobalForecastSettings';
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
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [cleanedData, setCleanedData] = useState<SalesData[]>([]);
  const [forecastResults, setForecastResults] = useState<ForecastResult[]>([]);
  const [selectedSKUForResults, setSelectedSKUForResults] = useState<string>('');
  const [currentStep, setCurrentStep] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { toast } = useToast();

  const { addSKUsToQueue, removeSKUsFromQueue, getSKUsInQueue, queueSize, clearQueue } = useOptimizationQueue();
  const { clearManualAIPreferences } = useManualAIPreferences();

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

  useEffect(() => {
    if (cleanedData.length > 0) {
      const skus = Array.from(new Set(cleanedData.map(d => d.sku))).sort();
      if (skus.length > 0 && (!selectedSKUForResults || !skus.includes(selectedSKUForResults))) {
        console.log('🎯 INDEX: Auto-selecting first SKU:', skus[0]);
        setSelectedSKUForResults(skus[0]);
      }
    }
  }, [cleanedData, selectedSKUForResults]);

  useEffect(() => {
    const handleProceedToForecasting = () => {
      setCurrentStep(3);
    };

    window.addEventListener('proceedToForecasting', handleProceedToForecasting);
    
    return () => {
      window.removeEventListener('proceedToForecasting', handleProceedToForecasting);
    };
  }, []);

  const handleDataUpload = (data: SalesData[]) => {
    clearManualAIPreferences();
    clearQueue();
    
    setSalesData(data);
    setCleanedData(data);
    setCurrentStep(1);
    
    setForecastResults([]);
    
    const skusInOrder: string[] = [];
    const seenSKUs = new Set<string>();
    
    for (const item of data) {
      if (!seenSKUs.has(item.sku)) {
        skusInOrder.push(item.sku);
        seenSKUs.add(item.sku);
      }
    }
    
    if (skusInOrder.length > 0) {
      console.log('🎯 INDEX: Setting initial SKU on upload:', skusInOrder[0]);
      setSelectedSKUForResults(skusInOrder[0]);
    }
    
    addSKUsToQueue(skusInOrder, 'csv_upload');
    
    toast({
      title: "Data Uploaded",
      description: `${skusInOrder.length} SKU${skusInOrder.length > 1 ? 's' : ''} ready for optimization`,
    });
  };

  const handleDataCleaning = (cleaned: SalesData[], changedSKUs?: string[]) => {
    setCleanedData(cleaned);
    
    if (changedSKUs && changedSKUs.length > 0) {
      const currentSKUs = Array.from(new Set(cleaned.map(d => d.sku)));
      const validChangedSKUs = changedSKUs.filter(sku => currentSKUs.includes(sku));
      
      if (validChangedSKUs.length > 0) {
        addSKUsToQueue(validChangedSKUs, 'data_cleaning');
        
        toast({
          title: "Optimization Triggered",
          description: `${validChangedSKUs.length} SKU${validChangedSKUs.length > 1 ? 's' : ''} queued for re-optimization due to data changes`,
        });
      }
    }
  };

  const handleImportDataCleaning = (importedSKUs: string[]) => {
    const currentSKUs = Array.from(new Set(cleanedData.map(d => d.sku)));
    const validImportedSKUs = importedSKUs.filter(sku => currentSKUs.includes(sku));
    
    if (validImportedSKUs.length > 0) {
      addSKUsToQueue(validImportedSKUs, 'csv_import');
      
      toast({
        title: "Import Optimization Triggered",
        description: `${validImportedSKUs.length} SKU${validImportedSKUs.length > 1 ? 's' : ''} queued for optimization after import`,
      });
    }
  };

  const handleForecastGeneration = (results: ForecastResult[], selectedSKU?: string) => {
    setForecastResults(results);
    if (selectedSKU) {
      setSelectedSKUForResults(selectedSKU);
    }
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
          {salesData.length > 0 && queueSize > 0 && (
            <div className="mt-4 text-sm text-blue-600 bg-blue-50 rounded-lg px-4 py-2 inline-block">
              📋 {queueSize} SKU{queueSize !== 1 ? 's' : ''} queued for optimization
            </div>
          )}
          {/* DEBUG INFO */}
          {cleanedData.length > 0 && (
            <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded px-2 py-1 inline-block">
              Debug: Selected SKU = "{selectedSKUForResults}" | Available SKUs: {Array.from(new Set(cleanedData.map(d => d.sku))).length}
            </div>
          )}
        </div>

        {/* Floating Settings Button */}
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

        {/* Progress Steps */}
        <StepNavigation
          currentStep={currentStep}
          salesDataLength={salesData.length}
          forecastResultsLength={forecastResults.length}
          onStepClick={setCurrentStep}
        />

        {/* Main Content */}
        <div className="w-full">
          {currentStep === 0 && (
            <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-blue-600" />
                  Upload Historical Sales Data
                </CardTitle>
                <CardDescription>
                  Upload a CSV file containing your historical sales data with columns: Date, SKU, Sales
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUpload 
                  onDataUpload={handleDataUpload}
                  hasExistingData={salesData.length > 0}
                  dataCount={salesData.length}
                  skuCount={new Set(salesData.map(d => d.sku)).size}
                />
              </CardContent>
            </Card>
          )}

          {currentStep === 1 && (
            <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  Data Visualization
                </CardTitle>
                <CardDescription>
                  Explore your historical sales data across different SKUs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataVisualization data={salesData} />
                {salesData.length > 0 && (
                  <div className="mt-6 flex justify-end">
                    <Button onClick={() => setCurrentStep(2)}>
                      Proceed to Data Cleaning
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {currentStep === 2 && (
            <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-600" />
                  Outlier Detection & Cleaning
                </CardTitle>
                <CardDescription>
                  Identify and remove outliers from your data to improve forecast accuracy
                </CardDescription>
              </CardHeader>
              <CardContent>
                <OutlierDetection 
                  data={salesData}
                  cleanedData={cleanedData}
                  onDataCleaning={handleDataCleaning}
                  onImportDataCleaning={handleImportDataCleaning}
                  queueSize={queueSize}
                />
              </CardContent>
            </Card>
          )}

          {currentStep === 3 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    Forecast Models
                  </CardTitle>
                  <CardDescription>
                    Generate forecasts using multiple predictive models with AI optimization
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ForecastModels 
                    data={cleanedData}
                    forecastPeriods={forecastPeriods}
                    onForecastGeneration={handleForecastGeneration}
                    selectedSKU={selectedSKUForResults}
                    onSKUChange={setSelectedSKUForResults}
                    shouldStartOptimization={queueSize > 0}
                    optimizationQueue={{
                      getSKUsInQueue,
                      removeSKUsFromQueue
                    }}
                  />
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
                <CardHeader>
                  <CardTitle>Forecast Results</CardTitle>
                  <CardDescription>
                    Compare predictions from different models for {selectedSKUForResults || 'selected product'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ForecastResults 
                    results={forecastResults} 
                    selectedSKU={selectedSKUForResults}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {currentStep === 4 && (
            <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-blue-600" />
                  Finalize & Export Forecasts
                </CardTitle>
                <CardDescription>
                  Review, edit, and export your forecasts for Sales & Operations Planning
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ForecastFinalization 
                  historicalData={salesData}
                  cleanedData={cleanedData}
                  forecastResults={forecastResults}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
