import React, { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { ModelScoreCards } from './ModelScoreCards';
import { ForecastChart } from './ForecastChart';
import { useSKUStore } from '@/store/skuStore';

interface ForecastResultsProps {
  forecastResults: any[];
  bestResults: any[];
  filePath: string;
}

export const ForecastResults: React.FC<ForecastResultsProps> = ({ forecastResults, bestResults = [], filePath }) => {
  // Get selected SKU from global state
  const selectedSKU = useSKUStore(state => state.selectedSKU);
  // Defensive: ensure bestResults is always an array
  const safeBestResults = Array.isArray(bestResults) ? bestResults : [];

  // Build the results for the selected SKU using the optimization results
  const selectedSKUResults = useMemo(() => {
    console.log(`[ForecastResults] Mapping for SKU: ${selectedSKU}, filePath: ${filePath}`);
    console.log(`[ForecastResults] bestResults count: ${safeBestResults.length}, forecastResults count: ${forecastResults.length}`);
    
    return forecastResults
      .filter(r => r && r.sku === selectedSKU && r.predictions && r.predictions.length > 0)
      .map(result => {
        // Calculate average value from predictions
        const avgValue = result.predictions.length > 0 
          ? result.predictions.reduce((sum, p) => sum + p.value, 0) / result.predictions.length 
          : null;
        const model = result.model || result.modelId || '';
        const method = result.method || 'unknown';
        const modelId = `${model}-${method}`;
        const displayName = result.displayName || model || '';
        
        // Use filePath from prop for matching
        const bestResult = safeBestResults
          .find(opt =>
            opt.modelType === model &&
            opt.sku === selectedSKU &&
            opt.filePath === filePath
          );
        
        if (bestResult) {
          console.log(`[ForecastResults] Found bestResult for ${model}-${method}:`, {
            compositeScore: bestResult.methods?.find(m => m.method === method)?.bestResult?.compositeScore
          });
        } else {
          console.log(`[ForecastResults] No bestResult found for ${model}-${method}`);
        }
        
        const methodResult = bestResult?.methods?.find(m => m.method === method);
        const compositeScore = methodResult?.bestResult?.compositeScore ?? null;
        return {
          model,
          modelId,
          displayName,
          method,
          parameters: result.parameters || {},
          compositeScore,
          predictions: result.predictions,
          avgValue,
          isWinner: false, // This will be determined by the component logic
          sku: result.sku,
          filePath // keep for reference
        };
      });
  }, [forecastResults, selectedSKU, safeBestResults, filePath]);

  // Build chart data
  const chartData = useMemo(() => {
    if (!selectedSKU) return [];
    if (selectedSKUResults.length === 0) return [];
    const allDates = Array.from(new Set(
      selectedSKUResults.flatMap(r => r.predictions.map(p => p.date))
    )).sort();
    return allDates.map(date => {
      const dataPoint: any = { date };
      selectedSKUResults.forEach(result => {
        const prediction = result.predictions.find(p => p.date === date);
        if (prediction) {
          dataPoint[result.modelId] = prediction.value;
        }
      });
      return dataPoint;
    });
  }, [selectedSKUResults, selectedSKU]);

  if (selectedSKUResults.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <TrendingUp className="h-12 w-12 mx-auto mb-4 text-slate-300" />
        <p>No forecast results yet.</p>
        <p className="text-sm">Generate forecasts to see predictions here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ModelScoreCards selectedSKUResults={selectedSKUResults} />
      <ForecastChart
        chartData={chartData}
        selectedSKU={selectedSKU}
        selectedSKUResults={selectedSKUResults}
      />
    </div>
  );
};

