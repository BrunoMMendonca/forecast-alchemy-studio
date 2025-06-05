
import React from 'react';
import { CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BarChart3 } from 'lucide-react';
import { BusinessContext } from '@/types/businessContext';
import { BusinessContextSettings } from '@/components/BusinessContextSettings';

interface ForecastSettingsProps {
  forecastPeriods: number;
  setForecastPeriods: (periods: number) => void;
  businessContext: BusinessContext;
  setBusinessContext: (context: BusinessContext) => void;
}

export const ForecastSettings: React.FC<ForecastSettingsProps> = ({
  forecastPeriods,
  setForecastPeriods,
  businessContext,
  setBusinessContext
}) => {
  return (
    <div className="space-y-6">
      <div>
        <CardDescription>
          Configure global parameters that apply to all forecast models and AI optimization
        </CardDescription>
      </div>
      
      {/* Forecast Periods */}
      <div className="space-y-2">
        <Label htmlFor="forecast-periods" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Forecast Periods
        </Label>
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
          Number of future periods to forecast (auto-detects your data frequency)
        </p>
      </div>

      {/* Business Context */}
      <BusinessContextSettings
        businessContext={businessContext}
        setBusinessContext={setBusinessContext}
      />
    </div>
  );
};
