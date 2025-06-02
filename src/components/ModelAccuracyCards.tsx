
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target } from 'lucide-react';
import { ForecastResult } from '@/pages/Index';

interface ModelAccuracyCardsProps {
  selectedSKUResults: ForecastResult[];
}

const modelColors = {
  'Simple Moving Average': '#3b82f6',
  'Exponential Smoothing': '#10b981',
  'Linear Trend': '#f59e0b'
};

export const ModelAccuracyCards: React.FC<ModelAccuracyCardsProps> = ({
  selectedSKUResults
}) => {
  if (selectedSKUResults.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {selectedSKUResults.map((result) => (
        <Card key={result.model} className="bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" style={{ color: modelColors[result.model as keyof typeof modelColors] }} />
              {result.model}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Accuracy:</span>
                <Badge variant={result.accuracy && result.accuracy > 80 ? "default" : "secondary"}>
                  {result.accuracy ? `${result.accuracy.toFixed(1)}%` : 'N/A'}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Predictions:</span>
                <span className="text-sm font-medium">{result.predictions.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Avg. Value:</span>
                <span className="text-sm font-medium">
                  {Math.round(result.predictions.reduce((sum, p) => sum + p.value, 0) / result.predictions.length).toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
