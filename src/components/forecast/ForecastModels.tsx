import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { SalesData } from '@/types/forecast';

interface ForecastModelsProps {
  data: SalesData[];
  selectedSKU: string;
  forecastPeriods: number;
  isGenerating: boolean;
  onSKUChange: (sku: string) => void;
  onGenerateForecast: (sku: string) => void;
}

export const ForecastModels: React.FC<ForecastModelsProps> = ({
  data,
  selectedSKU,
  forecastPeriods,
  isGenerating,
  onSKUChange,
  onGenerateForecast,
}) => {
  // Get unique SKUs from data
  const uniqueSKUs = Array.from(new Set(data.map(item => item['Material Code'])));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Select
          value={selectedSKU}
          onValueChange={onSKUChange}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select a product" />
          </SelectTrigger>
          <SelectContent>
            {uniqueSKUs.map(sku => (
              <SelectItem key={sku} value={sku}>
                {sku}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={() => onGenerateForecast(selectedSKU)}
          disabled={!selectedSKU || isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            'Generate Forecast'
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Moving Average</h3>
          <p className="text-sm text-gray-500">
            Simple moving average forecast using a window of 3 periods
          </p>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-2">Simple Exponential Smoothing</h3>
          <p className="text-sm text-gray-500">
            Forecast using exponential smoothing with alpha = 0.3
          </p>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-2">Double Exponential Smoothing</h3>
          <p className="text-sm text-gray-500">
            Forecast using double exponential smoothing with alpha = 0.3 and beta = 0.1
          </p>
        </Card>
      </div>
    </div>
  );
}; 