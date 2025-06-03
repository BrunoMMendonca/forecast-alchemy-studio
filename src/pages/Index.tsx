import React, { useState, useEffect } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { DataVisualization } from '@/components/DataVisualization';
import { OutlierDetection } from '@/components/OutlierDetection';
import { ForecastModels } from '@/components/ForecastModels';
import { ForecastResults } from '@/components/ForecastResults';
import { ForecastFinalization } from '@/components/ForecastFinalization';
import { ModelRecommendation } from '@/components/ModelRecommendation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, Upload, Zap, Eye } from 'lucide-react';

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
  const [currentStep, setCurrentStep] = useState(0);

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
    setSalesData(data);
    setCleanedData(data);
    setCurrentStep(1);
  };

  const handleDataCleaning = (cleaned: SalesData[]) => {
    console.log('Updating cleaned data:', cleaned.length, 'records');
    setCleanedData(cleaned);
  };

  const handleForecastGeneration = (results: ForecastResult[], selectedSKU?: string) => {
    setForecastResults(results);
    // If a specific SKU was selected, we can use it for auto-selection in results
    if (selectedSKU) {
      // Store selected SKU for results panel if needed
      console.log('Generated forecasts for SKU:', selectedSKU);
    }
    // Don't auto-proceed to finalization - let user review results first
    // User can manually navigate to finalization when ready
  };

  const handleStepClick = (stepIndex: number) => {
    // Allow navigation to any step if data is uploaded
    if (stepIndex === 0 || salesData.length > 0) {
      // Don't allow finalization step without forecasts
      if (stepIndex === 4 && forecastResults.length === 0) return;
      setCurrentStep(stepIndex);
    }
  };

  const handleProceedToDataCleaning = () => {
    setCurrentStep(2);
  };

  const handleProceedToForecasting = () => {
    setCurrentStep(3);
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
                    Generate forecasts using multiple predictive models
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ForecastModels 
                    data={cleanedData}
                    onForecastGeneration={handleForecastGeneration}
                  />
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
                <CardHeader>
                  <CardTitle>Forecast Results</CardTitle>
                  <CardDescription>
                    Compare predictions from different models
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ForecastResults results={forecastResults} />
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
