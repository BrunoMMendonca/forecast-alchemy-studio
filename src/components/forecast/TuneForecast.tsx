import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ForecastResult } from '@/types/forecast';

interface TuneForecastProps {
  results: ForecastResult[];
  selectedSKU: string;
  onTuneComplete: (modelId: string, predictions: number[]) => void;
}

export const TuneForecast: React.FC<TuneForecastProps> = ({
  results,
  selectedSKU,
  onTuneComplete,
}) => {
  const { toast } = useToast();
  const [tuningModel, setTuningModel] = useState<string | null>(null);
  const [manualPredictions, setManualPredictions] = useState<Record<string, number[]>>({});

  const handlePredictionChange = (modelId: string, periodIndex: number, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setManualPredictions(prev => ({
        ...prev,
        [modelId]: {
          ...(prev[modelId] || []),
          [periodIndex]: numValue
        }
      }));
    }
  };

  const handleSave = async (modelId: string) => {
    try {
      setTuningModel(modelId);
      const predictions = manualPredictions[modelId] || [];
      
      if (predictions.length === 0) {
        toast({
          title: "No Changes",
          description: "Please enter some predictions before saving.",
          variant: "destructive",
        });
        return;
      }

      onTuneComplete(modelId, predictions);
      toast({
        title: "Changes Saved",
        description: "Your manual predictions have been saved.",
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save manual predictions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setTuningModel(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold">Tune Forecasts</h2>
        <p className="text-sm text-gray-500">
          Manually adjust forecast predictions for each model
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {results.map((result) => (
          <Card key={result.model} className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.model}
              </CardTitle>
              <CardDescription>
                Adjust predictions for {selectedSKU}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {result.predictions.map((prediction, index) => (
                    <div key={index} className="space-y-2">
                      <Label>Period {index + 1}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        defaultValue={prediction.value}
                        onChange={(e) => handlePredictionChange(result.model, index, e.target.value)}
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => handleSave(result.model)}
                  disabled={tuningModel === result.model}
                  className="w-full"
                >
                  {tuningModel === result.model ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
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