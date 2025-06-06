
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Download, Settings } from 'lucide-react';
import { ModelSelection } from './ModelSelection';
import { ForecastResults } from './ForecastResults';
import { ForecastSummaryStats } from './ForecastSummaryStats';
import { ProductSelector } from './ProductSelector';
import { useUnifiedModelManagement } from '@/hooks/useUnifiedModelManagement';
import { useOptimizationHandler } from '@/hooks/useOptimizationHandler';
import { SalesData, ForecastResult } from '@/pages/Index';
import { BusinessContext } from '@/types/businessContext';
import { hasOptimizableParameters } from '@/utils/modelConfig';

interface ForecastEngineProps {
  data: SalesData[];
  results: ForecastResult[];
  onGenerate: (models: any[], sku: string) => void;
  onExportResults: () => void;
  businessContext?: BusinessContext;
  optimizationQueue?: any;
  onOptimizationComplete?: () => void;
}

export const ForecastEngine: React.FC<ForecastEngineProps> = ({
  data,
  results,
  onGenerate,
  onExportResults,
  businessContext,
  optimizationQueue,
  onOptimizationComplete
}) => {
  const [selectedSKU, setSelectedSKU] = useState<string>('');
  
  const skus = Array.from(new Set(data.map(d => d.sku))).sort();
  
  // Auto-select first SKU if none selected and data is available
  useEffect(() => {
    if (!selectedSKU && skus.length > 0) {
      setSelectedSKU(skus[0]);
    }
  }, [skus, selectedSKU]);

  const {
    models,
    toggleModel,
    updateParameter,
    useAIOptimization,
    useGridOptimization,
    resetToManual
  } = useUnifiedModelManagement(selectedSKU, data, businessContext);

  const { isOptimizing, progress, handleQueueOptimization } = useOptimizationHandler(
    data,
    selectedSKU,
    optimizationQueue,
    onOptimizationComplete
  );

  const handleOptimizeModel = async (modelId: string, method: 'ai' | 'grid') => {
    const model = models.find(m => m.id === modelId);
    
    // Add parameter check to prevent optimization of models without parameters
    if (!model || !hasOptimizableParameters(model)) {
      console.log(`⚠️ FORECAST: Skipping optimization for ${modelId} - no optimizable parameters`);
      return;
    }

    console.log(`🎯 FORECAST: Starting ${method} optimization for ${modelId}`);
    
    if (method === 'ai') {
      await useAIOptimization(modelId);
    } else if (method === 'grid') {
      await useGridOptimization(modelId);
    }
  };

  const handleGenerate = () => {
    if (!selectedSKU) return;
    const enabledModels = models.filter(m => m.enabled);
    onGenerate(enabledModels, selectedSKU);
  };

  const selectedSKUResults = results.filter(r => r.sku === selectedSKU);

  return (
    <div className="space-y-6">
      {/* SKU Selector - Always show when data is available */}
      {data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Product</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductSelector
              skus={skus}
              selectedSKU={selectedSKU}
              onSKUChange={setSelectedSKU}
            />
          </CardContent>
        </Card>
      )}

      {selectedSKU && (
        <>
          <ModelSelection
            models={models}
            selectedSKU={selectedSKU}
            onToggleModel={toggleModel}
            onUpdateParameter={updateParameter}
            onUseAI={(modelId) => handleOptimizeModel(modelId, 'ai')}
            onUseGrid={(modelId) => handleOptimizeModel(modelId, 'grid')}
            onResetToManual={resetToManual}
          />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Generate Forecasts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Button 
                  onClick={handleGenerate}
                  disabled={!models.some(m => m.enabled) || isOptimizing}
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Generate Forecasts for {selectedSKU}
                </Button>
                
                {optimizationQueue && (
                  <Button 
                    variant="outline"
                    onClick={handleQueueOptimization}
                    disabled={isOptimizing}
                    className="flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    Optimize Queue ({optimizationQueue.getSKUsInQueue?.()?.length || 0})
                  </Button>
                )}

                {results.length > 0 && (
                  <Button variant="outline" onClick={onExportResults}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Results
                  </Button>
                )}
              </div>

              {isOptimizing && progress && (
                <div className="text-sm text-muted-foreground">
                  Optimizing: {progress.currentSKU} - {progress.currentModel} 
                  ({progress.completed}/{progress.total})
                </div>
              )}
            </CardContent>
          </Card>

          {results.length > 0 && (
            <>
              <ForecastSummaryStats results={results} skus={skus} />
              <ForecastResults results={selectedSKUResults} selectedSKU={selectedSKU} />
            </>
          )}
        </>
      )}
    </div>
  );
};
