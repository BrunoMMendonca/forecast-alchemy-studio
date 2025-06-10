import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileUpload } from '@/components/FileUpload';
import { DataVisualization } from '@/components/DataVisualization';
import { OutlierDetection } from '@/components/OutlierDetection';
import { ForecastModels } from '@/components/ForecastModels';
import { ForecastResults } from '@/components/ForecastResults';
import { ForecastFinalization } from '@/components/ForecastFinalization';
import { BarChart3, TrendingUp, Upload, Zap, Eye } from 'lucide-react';
import { Icon } from 'lucide-react';
import { broom } from '@lucide/lab';
import type { SalesData, ForecastResult } from '@/pages/Index';
import { CsvImportWizard } from '@/components/CsvImportWizard';

interface StepContentProps {
  currentStep: number;
  salesData: SalesData[];
  cleanedData: SalesData[];
  forecastResults: ForecastResult[];
  selectedSKUForResults: string;
  queueSize: number;
  forecastPeriods: number;
  grokApiEnabled: boolean;
  onDataUpload: (data: SalesData[]) => void;
  onDataCleaning: (cleaned: SalesData[], changedSKUs?: string[]) => void;
  onImportDataCleaning: (importedSKUs: string[]) => void;
  onForecastGeneration: (results: ForecastResult[], selectedSKU: string) => void;
  onSKUChange: (sku: string) => void;
  onStepChange: (step: number) => void;
  optimizationQueue: {
    items: Array<{
      sku: string;
      modelId: string;
      reason: string;
      timestamp: number;
    }>;
    queueSize: number;
    uniqueSKUCount: number;
  };
  shouldStartOptimization: () => boolean;
  onOptimizationStarted: () => void;
}

export const StepContent: React.FC<StepContentProps> = ({
  currentStep,
  salesData,
  cleanedData,
  forecastResults,
  selectedSKUForResults,
  queueSize,
  forecastPeriods,
  grokApiEnabled,
  onDataUpload,
  onDataCleaning,
  onImportDataCleaning,
  onForecastGeneration,
  onSKUChange,
  onStepChange,
  optimizationQueue,
  shouldStartOptimization,
  onOptimizationStarted
}) => {
  if (currentStep === 0) {
    return (
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
          <CsvImportWizard onDataReady={onDataUpload} />
        </CardContent>
      </Card>
    );
  }

  if (currentStep === 1) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon iconNode={broom} className="h-5 w-5 text-blue-600" />
            Clean & Prepare
          </CardTitle>
          <CardDescription>
            Identify and remove outliers from your data to improve forecast accuracy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OutlierDetection
            data={salesData}
            cleanedData={cleanedData}
            onDataCleaning={onDataCleaning}
            onImportDataCleaning={onImportDataCleaning}
            queueSize={queueSize}
          />
          {cleanedData.length > 0 && (
            <div className="mt-6 flex justify-end">
              <Button onClick={() => onStepChange(2)}>
                Proceed to Explore
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (currentStep === 2) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Explore
          </CardTitle>
          <CardDescription>
            Explore your cleaned sales data across different SKUs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataVisualization data={cleanedData} />
          {cleanedData.length > 0 && (
            <div className="mt-6 flex justify-end">
              <Button onClick={() => onStepChange(3)}>
                Proceed to Forecasting
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (currentStep === 3) {
    const forecastInputData = cleanedData.length > 0 ? cleanedData : salesData;
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/80 backdrop-blur-sm shadow-xl border-0 rounded-lg">
          <ForecastModels
            data={forecastInputData}
            forecastPeriods={forecastPeriods}
            onForecastGeneration={onForecastGeneration}
            selectedSKUForResults={selectedSKUForResults}
            onSKUChange={onSKUChange}
            shouldStartOptimization={shouldStartOptimization()}
            onOptimizationStarted={onOptimizationStarted}
            grokApiEnabled={grokApiEnabled}
            optimizationQueue={optimizationQueue}
          />
        </div>

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
    );
  }

  if (currentStep === 4) {
    return (
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
    );
  }

  return null;
};
