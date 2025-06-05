import React, { useState, useEffect, useRef } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { DataVisualization } from '@/components/DataVisualization';
import { OutlierDetection } from '@/components/OutlierDetection';
import { ForecastModels } from '@/components/ForecastModels';
import { ForecastResults } from '@/components/ForecastResults';
import { ForecastFinalization } from '@/components/ForecastFinalization';
import { ForecastSettings } from '@/components/ForecastSettings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, Upload, Zap, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { useOptimizationQueue } from '@/hooks/useOptimizationQueue';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useManualAIPreferences } from '@/hooks/useManualAIPreferences';
import { useToast } from '@/hooks/use-toast';
import { BusinessContext, DEFAULT_BUSINESS_CONTEXT } from '@/types/businessContext';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
  const [forecastPeriods, setForecastPeriods] = useState(12);
  const [businessContext, setBusinessContext] = useState<BusinessContext>(DEFAULT_BUSINESS_CONTEXT);
  const [currentStep, setCurrentStep] = useState(0);
  const [shouldStartOptimization, setShouldStartOptimization] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const forecastModelsRef = useRef<any>(null);
  const { toast } = useToast();

  // Add optimization queue
  const { addSKUsToQueue, removeSKUsFromQueue, getSKUsInQueue, queueSize, clearQueue } = useOptimizationQueue();
  
  // Add cache clearing capabilities
  const { clearAllCache } = useOptimizationCache();
  const { clearManualAIPreferences } = useManualAIPreferences();

  const steps = [
    { id: 'upload', title: 'Upload Data', icon: Upload },
    { id: 'visualize', title: 'Visualize', icon: BarChart3 },
    { id: 'clean', title: 'Clean Data', icon: Zap },
    { id: 'forecast', title: 'Generate Forecasts', icon: TrendingUp },
    { id: 'finalize', title: 'Finalize & Export', icon: Eye },
  ];

  // Listen for the proceed to forecasting event
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
    console.log('📤 Data uploaded, clearing all caches and marking all SKUs for optimization');
    
    // Clear all existing caches and preferences to prevent stale data
    clearAllCache();
    clearManualAIPreferences();
    
    // Clear existing queue to avoid conflicts with old SKUs
    clearQueue();
    
    setSalesData(data);
    setCleanedData(data);
    setCurrentStep(1);
    
    // Clear any existing forecast results to prevent confusion
    setForecastResults([]);
    setSelectedSKUForResults('');
    
    // Mark all SKUs for optimization
    const skus = Array.from(new Set(data.map(d => d.sku)));
    console.log('📤 Adding new SKUs to queue:', skus);
    addSKUsToQueue(skus, 'csv_upload');
    
    // Start optimization with a small delay to allow state updates
    setTimeout(() => {
      setShouldStartOptimization(true);
      console.log('📤 Setting shouldStartOptimization to true');
    }, 500);
  };

  const handleDataCleaning = (cleaned: SalesData[], changedSKUs?: string[]) => {
    console.log('🧹 Data cleaned, updating cleaned data');
    setCleanedData(cleaned);
    
    // If specific SKUs were changed, mark only those for optimization
    if (changedSKUs && changedSKUs.length > 0) {
      console.log('🧹 Marking changed SKUs for re-optimization:', changedSKUs);
      
      // Validate that changed SKUs exist in current data
      const currentSKUs = Array.from(new Set(cleaned.map(d => d.sku)));
      const validChangedSKUs = changedSKUs.filter(sku => currentSKUs.includes(sku));
      
      if (validChangedSKUs.length > 0) {
        addSKUsToQueue(validChangedSKUs, 'data_cleaning');
        setTimeout(() => {
          setShouldStartOptimization(true);
          console.log('🧹 Setting shouldStartOptimization to true for data cleaning');
        }, 500);
        
        // Show toast notification about optimization being triggered
        toast({
          title: "Optimization Triggered",
          description: `${validChangedSKUs.length} SKU${validChangedSKUs.length > 1 ? 's' : ''} queued for re-optimization due to data changes`,
        });
      } else {
        console.warn('🧹 No valid SKUs found in changed SKUs list');
      }
    }
  };

  const handleImportDataCleaning = (importedSKUs: string[]) => {
    console.log('📥 CSV import detected, validating and marking imported SKUs for optimization:', importedSKUs);
    
    // Validate that imported SKUs exist in current data
    const currentSKUs = Array.from(new Set(cleanedData.map(d => d.sku)));
    const validImportedSKUs = importedSKUs.filter(sku => currentSKUs.includes(sku));
    
    if (validImportedSKUs.length > 0) {
      console.log('📥 Valid imported SKUs:', validImportedSKUs);
      addSKUsToQueue(validImportedSKUs, 'csv_import');
      setTimeout(() => {
        setShouldStartOptimization(true);
        console.log('📥 Setting shouldStartOptimization to true for import');
      }, 500);
      
      // Show toast notification about optimization being triggered
      toast({
        title: "Import Optimization Triggered",
        description: `${validImportedSKUs.length} SKU${validImportedSKUs.length > 1 ? 's' : ''} queued for optimization after import`,
      });
    } else {
      console.warn('📥 No valid SKUs found in imported data');
    }
  };

  const handleForecastGeneration = (results: ForecastResult[], selectedSKU?: string) => {
    setForecastResults(results);
    if (selectedSKU) {
      setSelectedSKUForResults(selectedSKU);
      console.log('Generated forecasts for SKU:', selectedSKU);
    }
  };

  const handleStepClick = (stepIndex: number) => {
    // Allow navigation to any step if data is uploaded
    if (stepIndex === 0 || salesData.length > 0) {
      // Don't allow finalization step without forecasts
      if (stepIndex === 4 && forecastResults.length === 0) return;
      setCurrentStep(stepIndex);
    }
  };

  const handleOptimizationStarted = () => {
    console.log('🏁 Optimization started, resetting shouldStartOptimization flag');
    setShouldStartOptimization(false);
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
          {queueSize > 0 && (
            <div className="mt-4 text-sm text-blue-600 bg-blue-50 rounded-lg px-4 py-2 inline-block">
              📋 {queueSize} SKU{queueSize !== 1 ? 's' : ''} queued for optimization
            </div>
          )}
        </div>

        {/* Global Settings Area */}
        <div className="mb-6">
          <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full justify-between bg-white/70 backdrop-blur-sm border-blue-200 hover:bg-white/90"
              >
                <span className="font-medium">Global Forecast Settings</span>
                {settingsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4">
              <ForecastSettings
                forecastPeriods={forecastPeriods}
                setForecastPeriods={setForecastPeriods}
                businessContext={businessContext}
                setBusinessContext={setBusinessContext}
              />
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center mb-8">
          <div className="flex space-x-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index <= currentStep;
              const isCurrent = index === currentStep;
              const isClickable = index === 0 || salesData.length > 0;
              
              return (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => handleStepClick(index)}
                    disabled={!isClickable}
                    className={`
                      flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300
                      ${isActive 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg' 
                        : 'bg-white border-slate-300 text-slate-400'
                      }
                      ${isCurrent ? 'ring-4 ring-blue-200' : ''}
                      ${isClickable ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed opacity-50'}
                    `}
                  >
                    <Icon size={20} />
                  </button>
                  <span className={`ml-2 font-medium ${isActive ? 'text-slate-800' : 'text-slate-400'}`}>
                    {step.title}
                  </span>
                  {index < steps.length - 1 && (
                    <div className={`w-8 h-0.5 ml-4 ${index < currentStep ? 'bg-blue-600' : 'bg-slate-300'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Hidden ForecastModels component for background optimization */}
        {salesData.length > 0 && (
          <div style={{ display: 'none' }}>
            <ForecastModels 
              ref={forecastModelsRef}
              data={cleanedData}
              forecastPeriods={forecastPeriods}
              onForecastGeneration={handleForecastGeneration}
              selectedSKU={selectedSKUForResults}
              onSKUChange={setSelectedSKUForResults}
              shouldStartOptimization={shouldStartOptimization}
              onOptimizationStarted={handleOptimizationStarted}
              optimizationQueue={{
                getSKUsInQueue,
                removeSKUsFromQueue
              }}
            />
          </div>
        )}

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
                  Explore your historical sales data across different SKUs (Optimization running in background)
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
                  Identify and remove outliers from your data to improve forecast accuracy (Optimization continues in background)
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
