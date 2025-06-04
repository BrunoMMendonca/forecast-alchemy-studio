import React, { useState, useEffect } from 'react';
import { SalesData, ChartData } from '@/types/sales';
import { OutlierDetection } from './OutlierDetection';
import { OutlierControls } from './OutlierControls';
import { OutlierChart } from './OutlierChart';
import { OutlierDataTable } from './OutlierDataTable';
import { OutlierStatistics } from './OutlierStatistics';
import { OutlierExportImport } from './OutlierExportImport';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DetectOutliersProps {
  data: SalesData[];
  setData: (data: SalesData[]) => void;
}

export const DetectOutliers: React.FC<DetectOutliersProps> = ({ data, setData }) => {
  const [threshold, setThreshold] = useState([2.5]);
  const [detectionMethod, setDetectionMethod] = useState('zscore');
  const [selectedSKUs, setSelectedSKUs] = useState<string[]>([]);
  const [selectedSKU, setSelectedSKU] = useState<string>('');

  const skus = Array.from(new Set(data.map(d => d.sku)));

  useEffect(() => {
    setSelectedSKUs(skus);
    if (skus.length > 0 && !selectedSKU) {
      setSelectedSKU(skus[0]);
    }
  }, [data, skus, selectedSKU]);

  // Convert SalesData to ChartData for the chart component
  const chartData: ChartData[] = data
    .filter(item => item.sku === selectedSKU)
    .map(item => ({
      ...item,
      originalSales: item.sales,
      cleanedSales: item.sales
    }));

  const handleThresholdChange = (newThreshold: number[]) => {
    setThreshold(newThreshold);
  };

  const detectOutliers = (
    data: SalesData[],
    threshold: number,
    method: string,
    selectedSKUs: string[]
  ): SalesData[] => {
    const skusToProcess = selectedSKUs.length > 0 ? selectedSKUs : Array.from(new Set(data.map(d => d.sku)));
  
    let updatedData = [...data];
  
    skusToProcess.forEach(sku => {
      const skuData = data.filter(d => d.sku === sku);
  
      if (skuData.length < 3) {
        console.warn(`Not enough data for SKU ${sku} to perform outlier detection.`);
        return;
      }
  
      const salesValues = skuData.map(d => d.sales);
  
      let outliers: number[] = [];
  
      if (method === 'zscore') {
        const mean = salesValues.reduce((a, b) => a + b, 0) / salesValues.length;
        const stdDev = Math.sqrt(salesValues.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / salesValues.length);
  
        if (stdDev === 0) {
          console.warn(`Standard deviation is zero for SKU ${sku}, skipping outlier detection.`);
          return;
        }
  
        outliers = salesValues.map((value, index) => Math.abs((value - mean) / stdDev) > threshold ? index : -1).filter(index => index !== -1);
      } else if (method === 'iqr') {
        const sortedValues = [...salesValues].sort((a, b) => a - b);
        const q1 = sortedValues[Math.floor((sortedValues.length / 4))];
        const q3 = sortedValues[Math.ceil((sortedValues.length * (3 / 4)))];
        const iqr = q3 - q1;
        const lowerBound = q1 - threshold * iqr;
        const upperBound = q3 + threshold * iqr;
  
        outliers = salesValues.map((value, index) => (value < lowerBound || value > upperBound) ? index : -1).filter(index => index !== -1);
      }
  
      updatedData = updatedData.map((item, index) => {
        if (item.sku === sku && outliers.includes(skuData.findIndex(d => d === item))) {
          return { ...item, isOutlier: true };
        }
        return item;
      });
    });
  
    return updatedData;
  };

  const handleDetectOutliers = () => {
    const updatedData = detectOutliers(data, threshold[0], detectionMethod, selectedSKUs);
    setData(updatedData);
  };

  // Calculate statistics
  const totalRecords = data.length;
  const outliersCount = data.filter(d => d.isOutlier).length;
  const cleanRecords = totalRecords - outliersCount;
  const outlierRate = totalRecords > 0 ? (outliersCount / totalRecords) * 100 : 0;

  const handleExport = () => {
    // Export functionality
    console.log('Exporting outlier data...');
  };

  const handleImportClick = () => {
    // Import functionality
    console.log('Importing outlier data...');
  };

  const handleSKUChange = (sku: string) => {
    setSelectedSKU(sku);
  };

  const handlePrevSKU = () => {
    const currentIndex = skus.indexOf(selectedSKU);
    if (currentIndex > 0) {
      setSelectedSKU(skus[currentIndex - 1]);
    }
  };

  const handleNextSKU = () => {
    const currentIndex = skus.indexOf(selectedSKU);
    if (currentIndex < skus.length - 1) {
      setSelectedSKU(skus[currentIndex + 1]);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Outlier Detection</CardTitle>
        </CardHeader>
        <CardContent>
          <OutlierControls
            selectedSKU={selectedSKU}
            skus={skus}
            threshold={threshold}
            onSKUChange={handleSKUChange}
            onThresholdChange={handleThresholdChange}
            onPrevSKU={handlePrevSKU}
            onNextSKU={handleNextSKU}
          />
        </CardContent>
      </Card>

      <Tabs defaultValue="chart" className="w-full">
        <TabsList>
          <TabsTrigger value="chart">Chart View</TabsTrigger>
          <TabsTrigger value="table">Data Table</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
          <TabsTrigger value="export">Export/Import</TabsTrigger>
        </TabsList>

        <TabsContent value="chart">
          <OutlierChart data={chartData} selectedSKU={selectedSKU} />
        </TabsContent>

        <TabsContent value="table">
          <OutlierDataTable data={data} onUpdateData={setData} />
        </TabsContent>

        <TabsContent value="stats">
          <OutlierStatistics 
            totalRecords={totalRecords}
            outliersCount={outliersCount}
            cleanRecords={cleanRecords}
            outlierRate={outlierRate}
          />
        </TabsContent>

        <TabsContent value="export">
          <OutlierExportImport 
            onExport={handleExport}
            onImportClick={handleImportClick}
            isExportDisabled={data.length === 0}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
