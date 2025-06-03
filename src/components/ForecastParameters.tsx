
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface ForecastParametersProps {
  forecastPeriods: number;
  setForecastPeriods: (periods: number) => void;
  optimizationProgress: string;
}

export const ForecastParameters: React.FC<ForecastParametersProps> = ({
  forecastPeriods,
  setForecastPeriods,
  optimizationProgress
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Forecast Parameters</CardTitle>
        <CardDescription>Configure the forecasting settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="forecast-periods">Forecast Periods</Label>
          <Input
            id="forecast-periods"
            type="number"
            value={forecastPeriods}
            onChange={(e) => setForecastPeriods(Math.max(1, parseInt(e.target.value) || 1))}
            min={1}
            max={365}
            className="w-32"
          />
          <p className="text-sm text-slate-500">
            Number of future periods to forecast (automatically detects your data frequency)
          </p>
        </div>

        {optimizationProgress && (
          <div className="flex items-center gap-2 text-purple-700 p-3 bg-purple-50 rounded-lg border border-purple-200">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{optimizationProgress}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
