import React from 'react';
import { SalesData } from '@/types/sales';

interface OutlierDetectionProps {
  data: SalesData[];
  setData: (data: SalesData[]) => void;
}

export const OutlierDetection: React.FC<OutlierDetectionProps> = ({ data, setData }) => {
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

  return null;
};
