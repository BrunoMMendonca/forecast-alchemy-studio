
import React, { useState, useRef } from 'react';
import { SalesData } from '@/types/sales';
import { ModelConfig } from '@/types/forecast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UploadData } from '@/components/UploadData';
import { DetectOutliers } from '@/components/DetectOutliers';
import { FinalizeData } from '@/components/FinalizeData';
import { ForecastModels } from '@/components/ForecastModels';
import { ForecastResults } from '@/components/ForecastResults';
import { ForecastControls } from '@/components/ForecastControls';
import { ForecastFinalization } from '@/components/ForecastFinalization';

export interface ForecastResult {
  sku: string;
  model: string;
  predictions: { date: Date; value: number }[];
  accuracy: number;
}

const Index = () => {
  const [data, setData] = useState<SalesData[]>([]);
  const [cleanedData, setCleanedData] = useState<SalesData[]>([]);
  const [forecastResults, setForecastResults] = useState<ForecastResult[]>([]);
  const [selectedSKU, setSelectedSKU] = useState<string>('');
  const [forecastPeriods, setForecastPeriods] = useState(12);
  const finalizedDataRef = useRef<SalesData[]>([]);

  const handleDataUpload = (uploadedData: SalesData[]) => {
    console.log('Data uploaded:', uploadedData.length, 'records');
    setData(uploadedData);
    setCleanedData([]);
    setForecastResults([]);
  };

  const handleOutlierDetection = (detectedData: SalesData[]) => {
    console.log('Outliers detected, data updated:', detectedData.length, 'records');
    setCleanedData(detectedData);
  };

  const handleDataFinalization = (finalData: SalesData[]) => {
    console.log('Data finalized:', finalData.length, 'records');
    finalizedDataRef.current = finalData;
    setCleanedData(finalData);
  };

  const handleForecastGeneration = (results: ForecastResult[], sku: string) => {
    console.log('Forecasts generated:', results.length, 'results for SKU:', sku);
    setForecastResults(results);
  };

  const currentData = cleanedData.length > 0 ? cleanedData : data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        <Card className="mb-8">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-slate-800">
              AI-Powered Sales Forecasting Platform
            </CardTitle>
            <CardDescription className="text-lg text-slate-600">
              Upload your sales data, detect outliers, and generate accurate forecasts with advanced AI optimization
            </CardDescription>
          </CardHeader>
        </Card>

        <Tabs defaultValue="upload" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="upload">Upload Data</TabsTrigger>
            <TabsTrigger value="outliers">Detect Outliers</TabsTrigger>
            <TabsTrigger value="finalize">Finalize Data</TabsTrigger>
            <TabsTrigger value="forecast">Generate Forecasts</TabsTrigger>
            <TabsTrigger value="results">View Results</TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
            <UploadData onDataUpload={handleDataUpload} />
          </TabsContent>

          <TabsContent value="outliers">
            <DetectOutliers 
              data={data} 
              onOutlierDetection={handleOutlierDetection}
            />
          </TabsContent>

          <TabsContent value="finalize">
            <FinalizeData 
              data={currentData}
              onDataFinalization={handleDataFinalization}
            />
          </TabsContent>

          <TabsContent value="forecast">
            <div className="space-y-6">
              <ForecastModels
                data={currentData}
                forecastPeriods={forecastPeriods}
                onForecastGeneration={handleForecastGeneration}
                selectedSKU={selectedSKU}
                onSKUChange={setSelectedSKU}
              />
              
              <ForecastControls 
                onForecastPeriodsChange={setForecastPeriods}
              />
            </div>
          </TabsContent>

          <TabsContent value="results">
            {forecastResults.length > 0 ? (
              <div className="space-y-6">
                <ForecastResults 
                  results={forecastResults}
                  historicalData={currentData}
                  selectedSKU={selectedSKU}
                />
                
                <ForecastFinalization
                  historicalData={data}
                  cleanedData={currentData}
                  forecastResults={forecastResults}
                />
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-slate-500">No forecast results yet. Generate forecasts to view results.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
