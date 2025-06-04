
import React from 'react';
import { SalesData } from '@/types/sales';
import { OutlierDetection } from './OutlierDetection';

interface DetectOutliersProps {
  data: SalesData[];
  setData: (data: SalesData[]) => void;
}

export const DetectOutliers: React.FC<DetectOutliersProps> = ({ data, setData }) => {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Detect and Manage Outliers</h2>
      <OutlierDetection data={data} setData={setData} />
    </div>
  );
};
