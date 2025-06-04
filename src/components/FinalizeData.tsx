
import React from 'react';
import { SalesData } from '@/types/sales';
import { ForecastResult } from '@/pages/Index';
import { ForecastFinalization } from '@/components/ForecastFinalization';

interface FinalizeDataProps {
  data: SalesData[];
  forecastResults: ForecastResult[];
}

export const FinalizeData: React.FC<FinalizeDataProps> = ({ data, forecastResults }) => {
  return (
    <ForecastFinalization
      historicalData={data}
      cleanedData={data}
      forecastResults={forecastResults}
    />
  );
};
