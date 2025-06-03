
import React from 'react';
import { SalesData } from '@/types/sales';
import { OutlierDetection } from '@/components/OutlierDetection';

interface DetectOutliersProps {
  data: SalesData[];
  setData: (data: SalesData[]) => void;
}

export const DetectOutliers: React.FC<DetectOutliersProps> = ({ data, setData }) => {
  return (
    <OutlierDetection 
      data={data}
      cleanedData={data}
      onDataCleaning={setData}
    />
  );
};
