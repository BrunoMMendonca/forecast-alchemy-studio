import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ForecastModels } from '@/components/forecast/ForecastModels';
import { ForecastResults } from '@/components/forecast/ForecastResults';
import { ForecastSummaryStats } from '@/components/forecast/ForecastSummaryStats';
import { OptimizeForecast } from '@/components/forecast/OptimizeForecast';
import { TuneForecast } from '@/components/forecast/TuneForecast';
import { useModelController } from '@/hooks/useModelController';
import { useToast } from '@/hooks/use-toast';
import type { SalesData, ForecastResult, ModelConfig } from '@/types/forecast';
import { BusinessContext } from '@/types/businessContext';

interface ForecastPageProps {
  data: SalesData[];
  businessContext: BusinessContext;
  aiForecastModelOptimizationEnabled: boolean;
}

type TabValue = 'optimize' | 'tune';

export const ForecastPage: React.FC<ForecastPageProps> = ({
  data,
  businessContext,
  aiForecastModelOptimizationEnabled,
}) => {
  const { toast } = useToast();
  const [selectedSKU, setSelectedSKU] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabValue>('optimize');
  const [optimizedModels, setOptimizedModels] = useState<ModelConfig[]>([]);
  const [results, setResults] = useState<ForecastResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const {
    models,
    toggleModel,
    updateParameter,
    resetToManual,
    handleMethodSelection,
    generateForecasts,
    isLoading
  } = useModelController(
    selectedSKU,
    data,
    12,
    businessContext,
    (newResults, sku) => {
      setResults(newResults);
      setSelectedSKU(sku);
    }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const handleOptimizationComplete = (modelId: string, parameters: Record<string, number>, method: string) => {
    const model = models.find(m => m.id === modelId);
    if (model) {
      const updatedModel = {
        ...model,
        optimizedParameters: parameters,
        optimizationMethod: method,
      };
      setOptimizedModels(prev => [...prev, updatedModel]);
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
      <div className="flex space-x-4 mb-4">
        <button
          className={`px-4 py-2 rounded ${activeTab === 'optimize' ? 'bg-primary text-white' : 'bg-gray-200'}`}
          onClick={() => setActiveTab('optimize')}
        >
          Optimize
        </button>
        <button
          className={`px-4 py-2 rounded ${activeTab === 'tune' ? 'bg-primary text-white' : 'bg-gray-200'}`}
          onClick={() => setActiveTab('tune')}
        >
          Tune
        </button>
      </div>

      {activeTab === 'optimize' ? (
        <OptimizeForecast
          data={data}
          selectedSKU={selectedSKU}
          models={models}
          businessContext={businessContext}
          aiForecastModelOptimizationEnabled={aiForecastModelOptimizationEnabled}
          onSKUChange={setSelectedSKU}
          onUpdateParameter={updateParameter}
        />
      ) : (
        <TuneForecast
          results={results}
          selectedSKU={selectedSKU}
          onTuneComplete={handleTuneComplete}
        />
      )}
    </div>
  );
}; 