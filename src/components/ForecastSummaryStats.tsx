
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ForecastResult } from '@/types/sales';

interface ForecastSummaryStatsProps {
  results: ForecastResult[];
  selectedSKU: string;
}

export const ForecastSummaryStats: React.FC<ForecastSummaryStatsProps> = ({
  results,
  selectedSKU
}) => {
  const skuResults = results.filter(r => r.sku === selectedSKU);

  if (!selectedSKU || skuResults.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Forecast Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-500">No forecasts generated for the selected SKU.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forecast Summary for {selectedSKU}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skuResults.map(result => (
            <div key={result.model} className="border rounded-md p-4">
              <h3 className="text-lg font-semibold">{result.model}</h3>
              <p>
                <strong>MAPE:</strong> {result.mape ? result.mape.toFixed(2) : 'N/A'}%
              </p>
              <p>
                <strong>Accuracy:</strong> {result.accuracy ? result.accuracy.toFixed(2) : 'N/A'}%
              </p>
              {result.parameters && Object.keys(result.parameters).length > 0 && (
                <div>
                  <p>
                    <strong>Parameters:</strong>
                  </p>
                  <ul>
                    {Object.entries(result.parameters).map(([key, value]) => (
                      <li key={key}>
                        {key}: {typeof value === 'number' ? value.toFixed(2) : value}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
