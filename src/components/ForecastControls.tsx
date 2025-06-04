import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ForecastControlsProps {
  periods: number;
  onPeriodsChange: (periods: number) => void;
}

export const ForecastControls: React.FC<ForecastControlsProps> = ({
  periods,
  onPeriodsChange
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Forecast Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="space-y-1">
          <Label htmlFor="periods">Forecast Periods</Label>
          <Input
            type="number"
            id="periods"
            value={periods}
            onChange={(e) => onPeriodsChange(Number(e.target.value))}
          />
        </div>
      </CardContent>
    </Card>
  );
};
