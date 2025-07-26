
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ForecastResult } from '@/pages/Index';

interface ForecastSummaryStatsProps {
  results: ForecastResult[];
  skus: string[];
}

export const ForecastSummaryStats: React.FC<ForecastSummaryStatsProps> = ({
  results,
  skus
}) => {
  return (
    <Card className="bg-slate-50">
      <CardHeader>
        <CardTitle className="text-lg">Forecast Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">{skus.length}</div>
            <div className="text-sm text-slate-600">SKUs Forecasted</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {results.length}
            </div>
            <div className="text-sm text-slate-600">Total Forecasts</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">
              {results[0]?.predictions.length || 0}
            </div>
            <div className="text-sm text-slate-600">Forecast Periods</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">
              {results.filter(r => r.&& r.> 80).length}
            </div>
            <div className="text-sm text-slate-600">High Performance</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
