
import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileUpload } from '@/components/FileUpload';
import { DataVisualization } from '@/components/DataVisualization';
import { ForecastEngine } from '@/components/ForecastEngine';
import { ForecastResults } from '@/components/ForecastResults';
import { ForecastSettings } from '@/components/ForecastSettings';
import { FloatingSettingsButton } from '@/components/FloatingSettingsButton';
import { OutlierDetection } from '@/components/OutlierDetection';
import { StepNavigation } from '@/components/StepNavigation';
import { useGlobalForecastSettings } from '@/hooks/useGlobalForecastSettings';
import { Upload, BarChart3, Target, Settings2, AlertTriangle } from 'lucide-react';
import { ForecastResult } from '@/types/forecast';

export interface SalesData {
  date: string;
  sku: string;
  sales: number;
  price?: number;
  promotion?: boolean;
  seasonality?: string;
  isOutlier?: boolean;
  note?: string;
}

const Index = () => {
  const [data, setData] = useState<SalesData[]>([]);
  const [selectedSKU, setSelectedSKU] = useState<string>('');
  const [forecastResults, setForecastResults] = useState<ForecastResult[]>([]);
  const [currentStep, setCurrentStep] = useState<'upload' | 'visualize' | 'outliers' | 'forecast' | 'results'>('upload');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Use global settings hook
  const {
    forecastPeriods,
    setForecastPeriods,
    businessContext,
    setBusinessContext,
    grokApiEnabled,
    setGrokApiEnabled
  } = useGlobalForecastSettings();

  const handleDataUpload = useCallback((uploadedData: SalesData[]) => {
    setData(uploadedData);
    setCurrentStep('visualize');
    
    // Auto-select first SKU if none selected
    if (uploadedData.length > 0) {
      const firstSKU = uploadedData[0].sku;
      if (!selectedSKU) {
        setSelectedSKU(firstSKU);
      }
    }
  }, [selectedSKU]);

  const handleForecastGeneration = useCallback((results: ForecastResult[], sku: string) => {
    console.log('Index: Received forecast results for SKU:', sku, 'Results:', results.length);
    setForecastResults(results);
    if (results.length > 0) {
      setCurrentStep('results');
    }
  }, []);

  const handleSKUChange = useCallback((sku: string) => {
    console.log('Index: SKU changed to:', sku);
    setSelectedSKU(sku);
    // Clear previous results when SKU changes
    setForecastResults([]);
  }, []);

  const handleStepChange = useCallback((step: 'upload' | 'visualize' | 'outliers' | 'forecast' | 'results') => {
    setCurrentStep(step);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center py-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Sales Forecasting Platform
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Upload your sales data, detect outliers, and generate accurate forecasts using advanced machine learning models
          </p>
        </div>

        <StepNavigation 
          currentStep={currentStep} 
          onStepChange={handleStepChange}
          hasData={data.length > 0}
          hasResults={forecastResults.length > 0}
        />

        <Tabs value={currentStep} onValueChange={(value) => handleStepChange(value as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload Data
            </TabsTrigger>
            <TabsTrigger value="visualize" disabled={data.length === 0} className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Visualize
            </TabsTrigger>
            <TabsTrigger value="outliers" disabled={data.length === 0} className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Outliers
            </TabsTrigger>
            <TabsTrigger value="forecast" disabled={data.length === 0} className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Forecast
            </TabsTrigger>
            <TabsTrigger value="results" disabled={forecastResults.length === 0} className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Results
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
            <FileUpload onDataUpload={handleDataUpload} />
          </TabsContent>

          <TabsContent value="visualize" className="space-y-6">
            {data.length > 0 && (
              <DataVisualization 
                data={data} 
              />
            )}
          </TabsContent>

          <TabsContent value="outliers" className="space-y-6">
            {data.length > 0 && (
              <OutlierDetection 
                data={data}
                cleanedData={data}
                onDataCleaning={setData}
              />
            )}
          </TabsContent>

          <TabsContent value="forecast" className="space-y-6">
            {data.length > 0 && (
              <ForecastEngine
                data={data}
                forecastPeriods={forecastPeriods}
                onForecastGeneration={handleForecastGeneration}
                selectedSKU={selectedSKU}
                onSKUChange={handleSKUChange}
                businessContext={businessContext}
                grokApiEnabled={grokApiEnabled}
              />
            )}
          </TabsContent>

          <TabsContent value="results" className="space-y-6">
            {forecastResults.length > 0 && (
              <ForecastResults
                results={forecastResults}
                selectedSKU={selectedSKU}
              />
            )}
          </TabsContent>
        </Tabs>

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
      </div>
    </div>
  );
};

export default Index;
