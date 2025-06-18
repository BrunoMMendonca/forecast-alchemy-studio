import React, { useState } from 'react';
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
import type { NormalizedSalesData, ForecastResult } from '@/pages/Index';
import { CsvImportWizard } from '@/components/CsvImportWizard';

interface StepContentProps {
  currentStep: number;
  salesData: NormalizedSalesData[];
  cleanedData: NormalizedSalesData[];
  forecastResults: ForecastResult[];
  selectedSKUForResults: string;
  queueSize: number;
  forecastPeriods: number;
  aiForecastModelOptimizationEnabled: boolean;
  onDataUpload: (data: NormalizedSalesData[], fileName?: string) => void;
  onDataCleaning: (cleaned: NormalizedSalesData[], changedSKUs?: string[]) => void;
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
  lastImportFileName?: string | null;
  lastImportTime?: string | null;
}

export const StepContent: React.FC<StepContentProps> = ({
  currentStep,
  salesData,
  cleanedData,
  forecastResults,
  selectedSKUForResults,
  queueSize,
  forecastPeriods,
  aiForecastModelOptimizationEnabled,
  onDataUpload,
  onDataCleaning,
  onImportDataCleaning,
  onForecastGeneration,
  onSKUChange,
  onStepChange,
  optimizationQueue,
  shouldStartOptimization,
  onOptimizationStarted,
  lastImportFileName,
  lastImportTime
}) => {
  const [localFileName, setLocalFileName] = useState<string | null>(null);

  if (currentStep === 0) {
    const handleCsvDataReady = (data: any[]) => {
      console.log('[StepContent] Data received from CsvImportWizard:', data);
      onDataUpload(data, localFileName || undefined);
    };
    const handleFileNameChange = (fileName: string) => {
      setLocalFileName(fileName);
    };
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
          {lastImportFileName && lastImportTime && (
            <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-start gap-3">
              <Upload className="h-5 w-5 text-blue-600 mt-1" />
              <div>
                <div className="font-semibold text-blue-800 mb-1">A file has already been loaded.</div>
                <div className="text-sm text-blue-900">File: <span className="font-mono">{lastImportFileName}</span></div>
                <div className="text-xs text-blue-700 mb-1">Imported on: {lastImportTime}</div>
                <div className="text-xs text-blue-700 italic">You do not need to upload again unless you want to load a new file.</div>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <CsvImportWizard onDataReady={handleCsvDataReady} onFileNameChange={handleFileNameChange} />
        </CardContent>
      </Card>
    );
  }

  if (currentStep === 1) {
    console.log('[StepContent] salesData in Clean & Prepare:', salesData);
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
            aiForecastModelOptimizationEnabled={aiForecastModelOptimizationEnabled}
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
