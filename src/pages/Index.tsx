
import React, { useState, useCallback } from 'react';
import { SalesData, ForecastResult } from '@/types/sales';
import { ModelConfig } from '@/types/forecast';
import { ForecastModels } from '@/components/ForecastModels';
import { ForecastResults } from '@/components/ForecastResults';
import { ForecastControls } from '@/components/ForecastControls';
import { UploadData } from '@/components/UploadData';
import { DetectOutliers } from '@/components/DetectOutliers';
import { FinalizeData } from '@/components/FinalizeData';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

const Index = () => {
  const [data, setData] = useState<SalesData[]>([]);
  const [forecastResults, setForecastResults] = useState<ForecastResult[]>([]);
  const [forecastPeriods, setForecastPeriods] = useState<number>(12);
  const [selectedSKU, setSelectedSKU] = useState<string>('');
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [activeTab, setActiveTab] = React.useState("upload")

  const handleDataUpload = (uploadedData: SalesData[]) => {
    console.log('Data uploaded:', uploadedData.length, 'records');
    setData(uploadedData);
    setForecastResults([]);
    setSelectedSKU('');
    
    // Auto-switch to outliers tab after successful upload
    if (uploadedData.length > 0) {
      setActiveTab("outliers");
    }
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
      <div className="bg-white py-6 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-slate-900">Sales Forecasting Tool</h1>
          <p className="mt-2 text-slate-600">
            Upload sales data, detect outliers, and generate forecasts using various models.
          </p>
          {data.length > 0 && (
            <div className="mt-3 text-sm text-slate-500">
              Loaded {data.length} records from {Array.from(new Set(data.map(d => d.sku))).length} SKUs
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="upload">Upload Data</TabsTrigger>
            <TabsTrigger value="outliers" disabled={data.length === 0}>Detect Outliers</TabsTrigger>
            <TabsTrigger value="forecast" disabled={data.length === 0}>Generate Forecast</TabsTrigger>
            <TabsTrigger value="finalize" disabled={data.length === 0}>Finalize Results</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-6">
            <UploadData onDataUpload={handleDataUpload} />
          </TabsContent>

          <TabsContent value="outliers" className="mt-6">
            <DetectOutliers data={data} setData={setData} />
          </TabsContent>

          <TabsContent value="forecast" className="mt-6">
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
                  periods={forecastPeriods}
                  onPeriodsChange={setForecastPeriods}
                />

                <ForecastResults 
                  results={forecastResults} 
                  selectedSKU={selectedSKU}
                  enabledModels={models}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="finalize" className="mt-6">
            <FinalizeData data={data} forecastResults={forecastResults} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
