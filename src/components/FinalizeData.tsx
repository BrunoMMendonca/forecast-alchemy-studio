
import React from 'react';
import { SalesData, ForecastResult } from '@/types/sales';
import { ForecastFinalization } from './ForecastFinalization';

interface FinalizeDataProps {
  data: SalesData[];
  forecastResults: ForecastResult[];
}

export const FinalizeData: React.FC<FinalizeDataProps> = ({ data, forecastResults }) => {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Finalize and Export</h2>
      <ForecastFinalization data={data} forecastResults={forecastResults} />
    </div>
  );
};
