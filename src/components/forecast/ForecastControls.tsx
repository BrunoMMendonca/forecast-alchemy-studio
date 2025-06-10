import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';

interface ForecastControlsProps {
  onBack: () => void;
  forecastPeriods: number;
  onForecastPeriodsChange: (periods: number) => void;
}

export const ForecastControls: React.FC<ForecastControlsProps> = ({
  onBack,
  forecastPeriods,
  onForecastPeriodsChange,
}) => {
  const handlePeriodsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0) {
      onForecastPeriodsChange(value);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Button
        variant="outline"
        size="sm"
        onClick={onBack}
        className="flex items-center gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <div className="flex items-center gap-2">
        <label htmlFor="forecastPeriods" className="text-sm font-medium">
          Forecast Periods:
        </label>
        <Input
          id="forecastPeriods"
          type="number"
          min="1"
          max="52"
          value={forecastPeriods}
          onChange={handlePeriodsChange}
          className="w-20"
        />
      </div>
    </div>
  );
}; 