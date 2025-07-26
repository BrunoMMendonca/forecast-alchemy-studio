import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, Star } from 'lucide-react';

interface ModelScoreCardsProps {
  selectedSKUResults: Array<{
    modelId: string;
    displayName: string;
    method: string;
    parameters: any;
    compositeScore: number | null;
    predictions: any[];
    avgValue: number | null;
    isWinner: boolean;
    sku: string;
  }>;
}

export const ModelScoreCards: React.FC<ModelScoreCardsProps> = ({
  selectedSKUResults
}) => {
  if (selectedSKUResults.length === 0) return null;

  // Find the best model (highest compositeScore)
  const bestModel = selectedSKUResults.reduce((best, current) =>
    (current.compositeScore || 0) > (best.compositeScore || 0) ? current : best
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {selectedSKUResults.map((result) => {
        const isBestModel = result.modelId === bestModel.modelId;
        return (
          <Card 
            key={result.modelId} 
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
                {result.displayName}
                <Badge variant="outline" className="ml-2 text-xs">
                  {result.method}
                </Badge>
                {isBestModel && (
                  <Badge variant="default" className="ml-auto text-xs">
                    Best
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div key="score" className="grid grid-cols-2 gap-2">
                  <span className="text-sm text-slate-600">Score:</span>
                  <Badge variant={result.compositeScore && result.compositeScore > 0.8 ? "default" : "secondary"} className="justify-self-end">
                    {typeof result.compositeScore === 'number' ? `${(result.compositeScore * 100).toFixed(1)}%` : 'N/A'}
                  </Badge>
                </div>
                <div key="predictions" className="grid grid-cols-2 gap-2">
                  <span className="text-sm text-slate-600">Predictions:</span>
                  <span className="text-sm font-medium justify-self-end">{result.predictions.length}</span>
                </div>
                <div key="avgValue" className="grid grid-cols-2 gap-2">
                  <span className="text-sm text-slate-600">Avg. Value:</span>
                  <span className="text-sm font-medium justify-self-end">
                    {result.avgValue !== null && result.avgValue !== undefined
                      ? Math.round(result.avgValue).toLocaleString()
                      : (result.predictions.length > 0
                        ? Math.round(result.predictions.reduce((sum, p) => sum + p.value, 0) / result.predictions.length).toLocaleString()
                        : 'N/A')}
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
 
 
 