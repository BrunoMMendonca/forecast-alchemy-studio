import React from 'react';
import { Card } from '@/components/ui/card';
import type { ForecastResult } from '@/types/forecast';

interface ForecastSummaryStatsProps {
  results: ForecastResult[];
  selectedSKU: string;
}

export const ForecastSummaryStats: React.FC<ForecastSummaryStatsProps> = ({
  results,
  selectedSKU,
}) => {
  if (results.length === 0) {
    return null;
  }

  // Calculate average prediction for each period
  const averagePredictions = results[0].predictions.map((_, periodIndex) => {
    const sum = results.reduce((acc, result) => 
      acc + result.predictions[periodIndex].value, 0
    );
    return sum / results.length;
  });

  // Calculate statistics
  const latestPrediction = averagePredictions[averagePredictions.length - 1];
  const averagePrediction = averagePredictions.reduce((sum, val) => sum + val, 0) / averagePredictions.length;
  const maxPrediction = Math.max(...averagePredictions);
  const minPrediction = Math.min(...averagePredictions);

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-4">Forecast Summary</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-gray-500">Latest Prediction</p>
          <p className="text-lg font-bold">{latestPrediction.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Average Prediction</p>
          <p className="text-lg font-bold">{averagePrediction.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Maximum Prediction</p>
          <p className="text-lg font-bold">{maxPrediction.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Minimum Prediction</p>
          <p className="text-lg font-bold">{minPrediction.toFixed(0)}</p>
        </div>
      </div>
    </Card>
  );
}; 