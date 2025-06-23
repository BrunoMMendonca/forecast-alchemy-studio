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
import type { NormalizedSalesData, ForecastResult } from '@/types/forecast';
import { CsvImportWizard, CsvUploadResult } from '@/components/CsvImportWizard';
import { useOutletContext } from 'react-router-dom';

interface StepContentProps {
  currentStep: number;
  processedDataInfo: CsvUploadResult | null;
  forecastResults: ForecastResult[];
  selectedSKUForResults: string;
  queueSize: number;
  forecastPeriods: number;
  aiForecastModelOptimizationEnabled: boolean;
  onDataUpload?: (result: CsvUploadResult) => void;
  onConfirm: (result: CsvUploadResult) => Promise<void>;
  onDataCleaning: (data: NormalizedSalesData[]) => void;
  onImportDataCleaning: (skus: string[]) => void;
  onForecastGeneration: (results: ForecastResult[]) => void;
  onSKUChange: (sku: string) => void;
  onStepChange: (step: number) => void;
  onAIFailure: (errorMessage: string) => void;
  lastImportFileName: string | null;
  lastImportTime: string | null;
}

interface OutletContextType {
  processedDataInfo: CsvUploadResult | null;
  forecastResults: ForecastResult[];
  selectedSKUForResults: string | null;
}

export const StepContent: React.FC<StepContentProps> = ({
  currentStep,
  processedDataInfo,
  forecastResults,
  selectedSKUForResults,
  queueSize,
  forecastPeriods,
  aiForecastModelOptimizationEnabled,
  onDataUpload,
  onConfirm,
  onDataCleaning,
  onImportDataCleaning,
  onForecastGeneration,
  onSKUChange,
  onStepChange,
  onAIFailure,
  lastImportFileName,
  lastImportTime
}) => {
  const [localFileName, setLocalFileName] = useState<string | null>(null);

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
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
            </CardHeader>
            <CardContent>
              <CsvImportWizard 
                onDataReady={() => {}} 
                onConfirm={onConfirm}
                onFileNameChange={handleFileNameChange} 
                lastImportFileName={lastImportFileName} 
                lastImportTime={lastImportTime}
                onAIFailure={onAIFailure}
              />
            </CardContent>
          </Card>
        );
      case 1:
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
                data={[]}
                cleanedData={[]}
                onDataCleaning={onDataCleaning}
                onImportDataCleaning={onImportDataCleaning}
                queueSize={queueSize}
              />
              {processedDataInfo && (
                <div className="mt-6 flex justify-end">
                  <Button onClick={() => onStepChange(2)}>
                    Proceed to Explore
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      case 2:
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
              <DataVisualization data={[]} />
              {processedDataInfo && (
                <div className="mt-6 flex justify-end">
                  <Button onClick={() => onStepChange(3)}>
                    Proceed to Forecasting
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      case 3:
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white/80 backdrop-blur-sm shadow-xl border-0 rounded-lg">
              <ForecastModels
                data={[]}
                forecastPeriods={forecastPeriods}
                onForecastGeneration={onForecastGeneration}
                selectedSKUForResults={selectedSKUForResults}
                onSKUChange={onSKUChange}
                aiForecastModelOptimizationEnabled={aiForecastModelOptimizationEnabled}
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
      case 4:
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
                historicalData={[]}
                cleanedData={[]}
                forecastResults={forecastResults}
              />
            </CardContent>
          </Card>
        );
      default:
        return <div>Invalid step</div>;
    }
  };

  return <div className="w-full">{renderStepContent()}</div>;
};
