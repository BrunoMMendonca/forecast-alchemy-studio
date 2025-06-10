import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Brain, Grid } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { SalesData, ModelConfig } from '@/types/forecast';
import { runGridOptimization } from '@/utils/gridOptimization';
import { runAIOptimization } from '@/utils/aiOptimization';
import { BusinessContext } from '@/types/businessContext';
import { useOptimizationStore } from '@/store/optimizationStore';
import { useOptimizationQueue } from '@/hooks/useOptimizationQueue';
import { OptimizationQueueItem } from '@/types/optimization';
import { useOptimizationHandler } from '@/hooks/useOptimizationHandler';
import { ProductSelector } from '@/components/ProductSelector';

interface OptimizeForecastProps {
  data: SalesData[];
  selectedSKU: string;
  models: ModelConfig[];
  businessContext: BusinessContext;
  grokApiEnabled: boolean;
  onOptimizationComplete: (modelId: string, parameters: Record<string, number>, method: string) => void;
  onSKUChange: (sku: string) => void;
}

export const OptimizeForecast: React.FC<OptimizeForecastProps> = ({
  data,
  selectedSKU,
  models,
  businessContext,
  grokApiEnabled,
  onOptimizationComplete,
  onSKUChange,
}) => {
  const { toast } = useToast();
  const [optimizingModel, setOptimizingModel] = useState<string | null>(null);
  const [optimizationMethod, setOptimizationMethod] = useState<'grid' | 'ai'>('grid');
  const { state } = useOptimizationStore();
  const { addToQueue } = useOptimizationQueue();
  const { handleQueueOptimization } = useOptimizationHandler(data, selectedSKU, () => {
    if (onOptimizationComplete) {
      onOptimizationComplete(optimizingModel || '', {}, optimizationMethod);
    }
  }, grokApiEnabled);

  const handleOptimize = async (model: ModelConfig) => {
    console.log('DEBUG handleOptimize selectedSKU:', selectedSKU, 'data:', data);
    setOptimizingModel(model.id);
    try {
      // Always use selectedSKU for the queue item
      const sku = selectedSKU;
      const queueItem: OptimizationQueueItem = {
        sku,
        modelId: model.id,
        reason: 'manual',
        timestamp: Date.now()
      };
      await addToQueue([queueItem]);
      // Trigger the optimization process
      await handleQueueOptimization();
      toast({
        title: "Optimization Started",
        description: `Started optimizing ${model.name} for SKU ${sku}`,
      });
    } catch (error) {
      console.error('Error queueing optimization:', error);
      toast({
        title: "Optimization Error",
        description: "Failed to start optimization. Please try again.",
        variant: "destructive"
      });
    } finally {
      setOptimizingModel(null);
    }
  };

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
            Select optimization method and start the process
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

                <Button
                  onClick={() => handleOptimize(model)}
                  disabled={optimizingModel === model.id}
                  className="w-full"
                >
                  {optimizingModel === model.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Optimizing...
                    </>
                  ) : (
                    `Optimize with ${optimizationMethod === 'grid' ? 'Grid Search' : 'AI'}`
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}; 