
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ForecastResult } from '@/types/sales';

interface ModelAccuracyCardsProps {
  results: ForecastResult[];
  selectedSKU: string;
}

export const ModelAccuracyCards: React.FC<ModelAccuracyCardsProps> = ({
  results,
  selectedSKU
}) => {
  const skuResults = results.filter(r => r.sku === selectedSKU);

  if (skuResults.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Model Accuracies</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-500">No forecast results for selected SKU</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {skuResults.map((result) => (
        <Card key={result.model}>
          <CardHeader>
            <CardTitle>{result.model}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span>MAPE:</span>
                <span>{result.mape ? `${result.mape.toFixed(2)}%` : 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Accuracy:</span>
                <span>{result.accuracy ? `${result.accuracy.toFixed(2)}%` : 'N/A'}</span>
              </div>
              {result.confidence && (
                <div className="flex items-center justify-between">
                  <span>Confidence:</span>
                  <span>{result.confidence.toFixed(2)}</span>
                </div>
              )}
              {result.optimizedParameters && (
                <div className="flex items-center justify-between">
                  <span>Optimization:</span>
                  <Badge variant="secondary">AI Optimized</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
