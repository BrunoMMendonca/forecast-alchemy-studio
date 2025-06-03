
import React, { useState, useCallback } from 'react';
import { SalesData } from '@/types/sales';
import { ModelConfig } from '@/types/forecast';
import { ForecastModels } from '@/components/ForecastModels';
import { ForecastResults } from '@/components/ForecastResults';
import { ForecastControls } from '@/components/ForecastControls';
import { UploadData } from '@/components/UploadData';
import { DetectOutliers } from '@/components/DetectOutliers';
import { FinalizeData } from '@/components/FinalizeData';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

export interface ForecastResult {
  sku: string;
  model: string;
  predictions: { date: Date; value: number }[];
  accuracy: number;
}

const Index = () => {
  const [data, setData] = useState<SalesData[]>([]);
  const [forecastResults, setForecastResults] = useState<ForecastResult[]>([]);
  const [forecastPeriods, setForecastPeriods] = useState<number>(12);
  const [selectedSKU, setSelectedSKU] = useState<string>('');
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [activeTab, setActiveTab] = React.useState("upload")

  const handleDataUpload = (uploadedData: SalesData[]) => {
    setData(uploadedData);
    setForecastResults([]);
    setSelectedSKU('');
  };

  const handleForecastGeneration = useCallback((results: ForecastResult[], sku: string) => {
    console.log(`Received forecast results for SKU ${sku}:`, results);
    setForecastResults(prevResults => {
      // Filter out any existing results for the same SKU and model
      const filteredResults = prevResults.filter(existingResult =>
        !(existingResult.sku === sku && results.some(newResult => newResult.model === existingResult.model))
      );
  
      // Add the new results
      const updatedResults = [...filteredResults, ...results];
      console.log('Updated forecast results:', updatedResults);
      return updatedResults;
    });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white py-6 shadow-md rounded-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold text-slate-900">Forecasting Tool</h1>
          <p className="mt-1 text-sm text-slate-500">
            Upload sales data, detect outliers, and generate forecasts using various models.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="upload" className="w-full">
          <TabsList>
            <TabsTrigger value="upload" onClick={() => setActiveTab("upload")}>Upload</TabsTrigger>
            <TabsTrigger value="outliers" onClick={() => setActiveTab("outliers")}>Outliers</TabsTrigger>
            <TabsTrigger value="forecast" onClick={() => setActiveTab("forecast")}>Forecast</TabsTrigger>
            <TabsTrigger value="finalize" onClick={() => setActiveTab("finalize")}>Finalize</TabsTrigger>
          </TabsList>
          <TabsContent value="upload">
            <div className="space-y-6">
              <UploadData onDataUpload={handleDataUpload} />
            </div>
          </TabsContent>
          <TabsContent value="outliers">
            <div className="space-y-6">
              <DetectOutliers data={data} setData={setData} />
            </div>
          </TabsContent>
          <TabsContent value="forecast">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <ForecastModels
                  data={data}
                  forecastPeriods={forecastPeriods}
                  onForecastGeneration={handleForecastGeneration}
                  selectedSKU={selectedSKU}
                  onSKUChange={setSelectedSKU}
                />
              </div>

              <div className="space-y-6">
                <ForecastControls
                  forecastPeriods={forecastPeriods}
                  onForecastPeriodsChange={setForecastPeriods}
                />

                <ForecastResults 
                  results={forecastResults} 
                  selectedSKU={selectedSKU}
                  enabledModels={models}
                />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="finalize">
            <div className="space-y-6">
              <FinalizeData data={data} forecastResults={forecastResults} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
