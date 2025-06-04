
import React, { useState, useEffect } from 'react';
import { SalesData } from '@/types/sales';
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
  const [threshold, setThreshold] = useState(2.5);
  const [detectionMethod, setDetectionMethod] = useState('zscore');
  const [selectedSKUs, setSelectedSKUs] = useState<string[]>([]);

  useEffect(() => {
    const skus = Array.from(new Set(data.map(d => d.sku)));
    setSelectedSKUs(skus);
  }, [data]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Outlier Detection</CardTitle>
        </CardHeader>
        <CardContent>
          <OutlierControls
            threshold={threshold}
            onThresholdChange={setThreshold}
            detectionMethod={detectionMethod}
            onMethodChange={setDetectionMethod}
            selectedSKUs={selectedSKUs}
            onSKUSelectionChange={setSelectedSKUs}
            data={data}
            onDetectOutliers={setData}
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
          <OutlierChart data={data} />
        </TabsContent>

        <TabsContent value="table">
          <OutlierDataTable data={data} onUpdateData={setData} />
        </TabsContent>

        <TabsContent value="stats">
          <OutlierStatistics data={data} />
        </TabsContent>

        <TabsContent value="export">
          <OutlierExportImport data={data} onDataImport={setData} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
