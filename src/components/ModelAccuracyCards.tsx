
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, Star } from 'lucide-react';
import { ForecastResult } from '@/pages/Index';

interface ModelAccuracyCardsProps {
  selectedSKUResults: ForecastResult[];
}

export const ModelAccuracyCards: React.FC<ModelAccuracyCardsProps> = ({
  selectedSKUResults
}) => {
  if (selectedSKUResults.length === 0) return null;

  // Find the best model (highest accuracy)
  const bestModel = selectedSKUResults.reduce((best, current) => 
    (current.accuracy || 0) > (best.accuracy || 0) ? current : best
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {selectedSKUResults.map((result) => {
        const isBestModel = result.model === bestModel.model;
        
        return (
          <Card 
            key={result.model} 
            className={`bg-white transition-all ${
              isBestModel 
                ? 'ring-2 ring-blue-500 shadow-lg' 
                : 'hover:shadow-md'
            }`}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {isBestModel ? (
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                ) : (
                  <Target className="h-4 w-4 text-blue-500" />
                )}
                {result.model}
                {isBestModel && (
                  <Badge variant="default" className="ml-auto text-xs">
                    Best
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <span className="text-sm text-slate-600">Accuracy:</span>
                  <Badge variant={result.accuracy && result.accuracy > 80 ? "default" : "secondary"} className="justify-self-end">
                    {result.accuracy ? `${result.accuracy.toFixed(1)}%` : 'N/A'}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <span className="text-sm text-slate-600">Predictions:</span>
                  <span className="text-sm font-medium justify-self-end">{result.predictions.length}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <span className="text-sm text-slate-600">Avg. Value:</span>
                  <span className="text-sm font-medium justify-self-end">
                    {Math.round(result.predictions.reduce((sum, p) => sum + p.value, 0) / result.predictions.length).toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
