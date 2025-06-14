import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ProductSelector } from '@/components/ProductSelector';
import type { SalesData, ModelConfig } from '@/types/forecast';
import { BusinessContext } from '@/types/businessContext';

interface OptimizeForecastProps {
  data: SalesData[];
  selectedSKU: string;
  models: ModelConfig[];
  businessContext: BusinessContext;
  grokApiEnabled: boolean;
  onSKUChange: (sku: string) => void;
}

export const OptimizeForecast: React.FC<OptimizeForecastProps> = ({
  data,
  selectedSKU,
  models,
  businessContext,
  grokApiEnabled,
  onSKUChange,
}) => {
  const [optimizationMethod, setOptimizationMethod] = React.useState<'grid' | 'ai'>('grid');

  return (
    <div className="space-y-4">
      <ProductSelector
        data={data}
        selectedSKU={selectedSKU}
        onSKUChange={onSKUChange}
      />

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Optimize Forecast</h2>
          <p className="text-muted-foreground">
            View model configurations and optimization status
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Label htmlFor="optimization-method">Optimization Method</Label>
          <Switch
            id="optimization-method"
            checked={optimizationMethod === 'ai'}
            onCheckedChange={(checked) => setOptimizationMethod(checked ? 'ai' : 'grid')}
            disabled={!grokApiEnabled}
          />
          <Label htmlFor="optimization-method">
            {optimizationMethod === 'ai' ? 'AI' : 'Grid Search'}
          </Label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {models.map((model) => (
          <Card key={model.id} className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {model.icon}
                {model.name}
              </CardTitle>
              <CardDescription>{model.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {model.parameters && Object.entries(model.parameters).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label className="capitalize">{key}</Label>
                    <span className="text-sm text-gray-500">{value}</span>
                  </div>
                ))}
                {model.optimizationMethod && (
                  <div className="mt-4 p-2 bg-gray-50 rounded-md">
                    <div className="text-sm text-gray-600">
                      Last optimized with: {model.optimizationMethod}
                    </div>
                    {model.optimizationConfidence && (
                      <div className="text-sm text-gray-600">
                        Confidence: {model.optimizationConfidence}%
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}; 