
import React, { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { ForecastResult } from '@/types/forecast';
import { ModelAccuracyCards } from './ModelAccuracyCards';
import { ForecastChart } from './ForecastChart';

interface ForecastResultsProps {
  results: ForecastResult[];
  selectedSKU: string;
}

export const ForecastResults: React.FC<ForecastResultsProps> = ({ results, selectedSKU }) => {
  const chartData = useMemo(() => {
    if (!selectedSKU) return [];

    const skuResults = results.filter(r => r.sku === selectedSKU);
    if (skuResults.length === 0) return [];

    const allDates = Array.from(new Set(
      skuResults.flatMap(r => r.predictions.map(p => p.date))
    )).sort();

    return allDates.map(date => {
      const dataPoint: any = { date };
      
      skuResults.forEach(result => {
        const prediction = result.predictions.find(p => p.date === date);
        if (prediction) {
          dataPoint[result.model] = prediction.value;
        }
      });
      
      return dataPoint;
    });
  }, [results, selectedSKU]);

  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <TrendingUp className="h-12 w-12 mx-auto mb-4 text-slate-300" />
        <p>No forecast results yet.</p>
        <p className="text-sm">Generate forecasts to see predictions here.</p>
      </div>
    );
  }

  const selectedSKUResults = results.filter(r => r.sku === selectedSKU);

  return (
    <div className="space-y-6">
      <ModelAccuracyCards selectedSKUResults={selectedSKUResults} />

      <ForecastChart
        chartData={chartData}
        selectedSKU={selectedSKU}
        selectedSKUResults={selectedSKUResults}
      />
    </div>
  );
};
