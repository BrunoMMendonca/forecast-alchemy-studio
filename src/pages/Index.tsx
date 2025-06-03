
import React, { useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { DataVisualization } from '@/components/DataVisualization';
import { OutlierDetection } from '@/components/OutlierDetection';
import { ForecastModels } from '@/components/ForecastModels';
import { ForecastResults } from '@/components/ForecastResults';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, TrendingUp, Upload, Zap } from 'lucide-react';

export interface SalesData {
  date: string;
  sku: string;
  sales: number;
  isOutlier?: boolean;
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
  ];

  const handleDataUpload = (data: SalesData[]) => {
    setSalesData(data);
    setCleanedData(data);
    setCurrentStep(1);
  };

  const handleDataCleaning = (cleaned: SalesData[]) => {
    setCleanedData(cleaned);
    setCurrentStep(3);
  };

  const handleForecastGeneration = (results: ForecastResult[]) => {
    setForecastResults(results);
  };

  const handleTabChange = (value: string) => {
    const stepIndex = steps.findIndex(step => step.id === value);
    if (stepIndex !== -1) {
      setCurrentStep(stepIndex);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-4">
            Sales Forecast Analytics
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Upload your historical sales data, clean outliers, and generate accurate forecasts using multiple predictive models.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center mb-8">
          <div className="flex space-x-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index <= currentStep;
              const isCurrent = index === currentStep;
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className={`
                    flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300
                    ${isActive 
                      ? 'bg-blue-600 border-blue-600 text-white shadow-lg' 
                      : 'bg-white border-slate-300 text-slate-400'
                    }
                    ${isCurrent ? 'ring-4 ring-blue-200' : ''}
                  `}>
                    <Icon size={20} />
                  </div>
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
        <Tabs value={steps[currentStep]?.id} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isDisabled = index > Math.max(currentStep, salesData.length > 0 ? 1 : 0);
              return (
                <TabsTrigger 
                  key={step.id} 
                  value={step.id}
                  disabled={isDisabled}
                  className="flex items-center gap-2"
                >
                  <Icon size={16} />
                  {step.title}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
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
                <FileUpload onDataUpload={handleDataUpload} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="visualize" className="space-y-6">
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
          </TabsContent>

          <TabsContent value="clean" className="space-y-6">
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
                  onDataCleaning={handleDataCleaning}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="forecast" className="space-y-6">
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
