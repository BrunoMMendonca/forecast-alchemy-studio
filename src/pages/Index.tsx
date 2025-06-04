
import React, { useState, useEffect } from 'react';
import { SalesData, ForecastResult } from '@/types/sales';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataVisualization } from '@/components/DataVisualization';
import { FileUpload } from '@/components/FileUpload';
import { ForecastModels } from '@/components/ForecastModels';
import { ForecastResults } from '@/components/ForecastResults';
import { ForecastFinalization } from '@/components/ForecastFinalization';
import { OutlierDetection } from '@/components/OutlierDetection';

const Index = () => {
  const [data, setData] = useState<SalesData[]>([]);
  const [forecastResults, setForecastResults] = useState<ForecastResult[]>([]);
  const [forecastPeriods, setForecastPeriods] = useState(12);
  const [selectedSKU, setSelectedSKU] = useState<string>('');

  // Auto-select first SKU when data changes
  useEffect(() => {
    const skus = Array.from(new Set(data.map(d => d.sku))).sort();
    if (skus.length > 0 && !selectedSKU) {
      setSelectedSKU(skus[0]);
    }
  }, [data, selectedSKU]);

  const handleForecastGeneration = (results: ForecastResult[], sku: string) => {
    console.log(`📊 Received ${results.length} forecast results for ${sku}`);
    setForecastResults(results);
  };

  const handleDataUpdate = (newData: SalesData[]) => {
    console.log(`📊 Data updated with ${newData.length} rows`);
    setData(newData);
    
    // Clear forecast results when data changes
    setForecastResults([]);
    
    // Auto-select first SKU if no SKU is selected
    const skus = Array.from(new Set(newData.map(d => d.sku))).sort();
    if (skus.length > 0) {
      setSelectedSKU(skus[0]);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-800 mb-2">
          AI-Enhanced Sales Forecasting
        </h1>
        <p className="text-slate-600 text-lg">
          Upload your sales data and generate accurate forecasts using multiple AI-optimized models
        </p>
      </div>

      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-6">
          <TabsTrigger value="upload">Upload Data</TabsTrigger>
          <TabsTrigger value="outliers" disabled={data.length === 0}>
            Detect Outliers
          </TabsTrigger>
          <TabsTrigger value="models" disabled={data.length === 0}>
            Select Models
          </TabsTrigger>
          <TabsTrigger value="results" disabled={forecastResults.length === 0}>
            View Results
          </TabsTrigger>
          <TabsTrigger value="finalize" disabled={forecastResults.length === 0}>
            Finalize Forecasts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <FileUpload onDataUpload={handleDataUpdate} />
          {data.length > 0 && (
            <DataVisualization data={data} />
          )}
        </TabsContent>

        <TabsContent value="outliers">
          <OutlierDetection 
            data={data} 
            cleanedData={data}
            onDataCleaning={setData}
          />
        </TabsContent>

        <TabsContent value="models" className="space-y-6">
          <ForecastModels
            data={data}
            forecastPeriods={forecastPeriods}
            onForecastGeneration={handleForecastGeneration}
            selectedSKU={selectedSKU}
            onSKUChange={setSelectedSKU}
          />
        </TabsContent>

        <TabsContent value="results">
          <ForecastResults 
            results={forecastResults}
            selectedSKU={selectedSKU}
          />
        </TabsContent>

        <TabsContent value="finalize">
          <ForecastFinalization 
            results={forecastResults}
            data={data}
            selectedSKU={selectedSKU}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Index;
