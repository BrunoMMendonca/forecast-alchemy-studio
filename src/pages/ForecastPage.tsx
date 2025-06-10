import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ForecastModels } from '@/components/forecast/ForecastModels';
import { ForecastResults } from '@/components/forecast/ForecastResults';
import { ForecastControls } from '@/components/forecast/ForecastControls';
import { ForecastSummaryStats } from '@/components/forecast/ForecastSummaryStats';
import { OptimizeForecast } from '@/components/forecast/OptimizeForecast';
import { TuneForecast } from '@/components/forecast/TuneForecast';
import { useModelController } from '@/hooks/useModelController';
import { useToast } from '@/hooks/use-toast';
import type { SalesData, ForecastResult, ModelConfig } from '@/types/forecast';
import { BusinessContext } from '@/types/businessContext';

interface ForecastPageProps {
  data: SalesData[];
  onBack: () => void;
  businessContext: BusinessContext;
  grokApiEnabled: boolean;
}

export const ForecastPage: React.FC<ForecastPageProps> = ({
  data,
  onBack,
  businessContext,
  grokApiEnabled,
}) => {
  const { toast } = useToast();
  const [selectedSKU, setSelectedSKU] = useState<string>('');
  const [forecastPeriods, setForecastPeriods] = useState<number>(12);
  const [activeTab, setActiveTab] = useState<string>('forecast');
  const [optimizedModels, setOptimizedModels] = useState<Record<string, ModelConfig>>({});
  const [results, setResults] = useState<ForecastResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const {
    models,
    toggleModel,
    updateParameter,
    resetToManual,
    handleMethodSelection,
    generateForecasts
  } = useModelController(
    selectedSKU,
    data,
    forecastPeriods,
    businessContext,
    (newResults, sku) => {
      setResults(newResults);
      setSelectedSKU(sku);
    }
  );

  const handleOptimizationComplete = (modelId: string, parameters: Record<string, number>, method: string) => {
    const model = models.find(m => m.id === modelId);
    if (model) {
      const updatedModel = {
        ...model,
        optimizedParameters: parameters,
        optimizationMethod: method,
      };
      setOptimizedModels(prev => ({
        ...prev,
        [modelId]: updatedModel
      }));
      // Update each parameter individually
      Object.entries(parameters).forEach(([parameter, value]) => {
        updateParameter(modelId, parameter, value);
      });
    }
  };

  const handleTuneComplete = (modelId: string, predictions: number[]) => {
    // Update the results with the manually tuned predictions
    const updatedResults = results.map(result => {
      if (result.model === modelId) {
        return {
          ...result,
          predictions: result.predictions.map((pred, index) => ({
            ...pred,
            value: predictions[index] || pred.value
          }))
        };
      }
      return result;
    });
    setResults(updatedResults);
  };

  const handleGenerateForecast = async (sku: string) => {
    try {
      setIsGenerating(true);
      await generateForecasts();
      toast({
        title: "Forecast Generated",
        description: `Successfully generated forecast for ${sku}`,
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to generate forecast. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <ForecastControls
        onBack={onBack}
        forecastPeriods={forecastPeriods}
        onForecastPeriodsChange={setForecastPeriods}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="optimize">Optimize</TabsTrigger>
          <TabsTrigger value="tune">Tune</TabsTrigger>
        </TabsList>

        <TabsContent value="optimize">
          <OptimizeForecast
            data={data}
            selectedSKU={selectedSKU}
            models={models}
            businessContext={businessContext}
            grokApiEnabled={grokApiEnabled}
            onOptimizationComplete={handleOptimizationComplete}
            onSKUChange={setSelectedSKU}
          />
        </TabsContent>

        <TabsContent value="tune">
          <TuneForecast
            results={results}
            selectedSKU={selectedSKU}
            onTuneComplete={handleTuneComplete}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}; 