
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings } from 'lucide-react';

interface GlobalForecastParametersProps {
  forecastPeriods: number;
  setForecastPeriods: (periods: number) => void;
}

export const GlobalForecastParameters: React.FC<GlobalForecastParametersProps> = ({
  forecastPeriods,
  setForecastPeriods
}) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings className="h-5 w-5 text-blue-600" />
          Global Forecast Settings
        </CardTitle>
        <CardDescription>
          These settings apply to all forecast models
        </CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
};
