import React, { useMemo, useState, useEffect } from 'react';
import { SalesData, ForecastResult, ModelConfig } from '@/types/forecast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { ProductSelector } from './ProductSelector';
import { ModelParameterPanel } from './ModelParameterPanel';
import { useBestResultsMapping } from '@/hooks/useBestResultsMapping';
import { BusinessContext } from '@/types/businessContext';
import { useBackendJobStatus } from '@/hooks/useBackendJobStatus';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSKUStore } from '@/store/skuStore';

interface ForecastEngineProps {
  data: SalesData[];
  forecastPeriods: number;
  onForecastGeneration: (results: ForecastResult[], selectedSKU: string) => void;
  businessContext?: BusinessContext;
  aiForecastModelOptimizationEnabled: boolean;
  isOptimizing?: boolean;
  batchId?: string | null;
  models: ModelConfig[];
  updateModel: (modelId: string, updates: Partial<ModelConfig>) => void;
  processedDataInfo?: { filePath?: string } | null;
  filePath?: string;
  setForecastResults: (results: ForecastResult[]) => void;
}

export const ForecastEngine: React.FC<ForecastEngineProps> = ({
  data,
  forecastPeriods,
  onForecastGeneration,
  businessContext,
  aiForecastModelOptimizationEnabled,
  isOptimizing,
  batchId,
  models,
  updateModel,
  processedDataInfo,
  filePath,
  setForecastResults
}) => {
  const { jobs, summary, isPaused, resumePolling } = useBackendJobStatus(batchId);
  const { toast } = useToast();
  
  // Use global SKU store
  const selectedSKU = useSKUStore(state => state.selectedSKU);
  const setSelectedSKU = useSKUStore(state => state.setSelectedSKU);
  
  // Only initialize hooks with valid SKU to prevent cache calls with empty SKU
  const validSKU = selectedSKU && selectedSKU.toString().trim() !== '';
  
  // Ensure we have a valid selectedSKU
  const availableSKUs = Array.from(new Set(data.map(d => String(d.sku || d['Material Code'])))).sort();
  const effectiveSelectedSKU = selectedSKU || (availableSKUs.length > 0 ? availableSKUs[0] : '');

  // Determine filePath for dataset-specific best results
  const effectiveFilePath = filePath || processedDataInfo?.filePath || undefined;
  
  // Get jobs for the current SKU and filePath
  const skuJobs = jobs.filter(job => {
    let jobFilePath = job.filePath;
    if (!jobFilePath && job.data) {
      try {
        const parsed = typeof job.data === 'string' ? JSON.parse(job.data) : job.data;
        jobFilePath = parsed.filePath;
      } catch {}
    }
    const skuMatch = job.sku === effectiveSelectedSKU;
    const filePathMatch = !effectiveFilePath || jobFilePath === effectiveFilePath;
    
    console.log('[ForecastEngine] Job filter check:', {
      jobId: job.id,
      jobSku: job.sku,
      effectiveSelectedSKU,
      skuMatch,
      jobFilePath,
      effectiveFilePath,
      filePathMatch,
      status: job.status
    });
    
    return skuMatch && filePathMatch;
  });
  const hasActiveJobs = skuJobs.some(job => job.status === 'pending' || job.status === 'running');
  const hasCompletedJobs = skuJobs.some(job => job.status === 'completed');
  const hasFailedJobs = skuJobs.some(job => job.status === 'failed');


  useEffect(() => {
    console.log('[ForecastEngine] Rendered with selectedSKU:', selectedSKU);
    console.log('[ForecastEngine] Available jobs:', jobs.map(job => ({
      id: job.id,
      sku: job.sku,
      status: job.status,
      method: job.method,
      modelId: job.modelId,
      filePath: job.filePath || (job.data ? JSON.parse(job.data).filePath : 'no data')
    })));
  });

  // Auto-select first SKU if none selected
  React.useEffect(() => {
    if (!selectedSKU && availableSKUs.length > 0) {
      console.log('ForecastEngine: Auto-selecting first SKU:', availableSKUs[0]);
      setSelectedSKU(availableSKUs[0]);
    }
  }, [selectedSKU, availableSKUs, setSelectedSKU]);

  // Use the best results mapping hook with global updateModel
  const { isLoading: bestResultsLoading, hasRecentData, refreshBestResults, bestResults } = useBestResultsMapping(
    models,
    effectiveSelectedSKU,
    updateModel,
    effectiveFilePath,
    jobs,
    effectiveSelectedSKU,
    effectiveFilePath
  );

  useEffect(() => {
    //console.log('[ForecastEngine] useBestResultsMapping called with:', {
    //  effectiveSelectedSKU,
    //  effectiveFilePath,
    //  models,
    //  jobs
    //});
  }, [effectiveSelectedSKU, effectiveFilePath, models, jobs]);

  // Clear results on SKU or filePath change
  useEffect(() => {
    setForecastResults([]);
  }, [effectiveSelectedSKU, effectiveFilePath, setForecastResults]);

  // Map bestResults to ForecastResult[] for the current SKU and filePath
  const forecastResults = useMemo(() => {
    if (!Array.isArray(bestResults)) return [];
    return bestResults.flatMap(modelResult =>
      modelResult.methods
        .filter(method => !!method.bestResult) // Only skip if truly no result at all
        .map(method => ({
          sku: effectiveSelectedSKU,
          model: modelResult.displayName || modelResult.modelType,
          predictions: method.bestResult?.predictions || [],
          accuracy: method.bestResult?.accuracy, // can be null/undefined
          parameters: method.bestResult?.parameters,
          method: method.method
        }))
    );
  }, [bestResults, effectiveSelectedSKU, effectiveFilePath]);

  // Debug logging
  useEffect(() => {
  }, [forecastResults, bestResults, effectiveSelectedSKU, effectiveFilePath]);

  // Fetch model requirements from backend
  const [requirements, setRequirements] = useState<Record<string, any>>({});

  useEffect(() => {
    fetch('/api/models/data-requirements')
      .then(res => res.json())
      .then(setRequirements)
      .catch(() => setRequirements({}));
  }, []);

  // Use backend-matching eligibility logic for optimizable models
  const eligibleOptimizableModels = useMemo(() => {
    return models.filter(m => {
      if (!m.enabled) return false;
      const req = requirements[m.id];
      if (!req) return true; // If no requirements, assume eligible
      const validationRatio = 0.2; // Match backend default
      const minTrain = Number(req.minObservations);
      const requiredTotal = Math.ceil(minTrain / (1 - validationRatio));
      const skuData = data.filter(d => String(d.sku || d['Material Code']) === effectiveSelectedSKU);
      return skuData.length >= requiredTotal;
    });
  }, [models, requirements, data, effectiveSelectedSKU]);

  // Identify ineligible models for UI display (enabled but not enough data)
  const ineligibleModels = models.filter(m => {
    if (!m.enabled) return false;
    const req = requirements[m.id];
    if (!req) return false; // If no requirements, can't determine
    const validationRatio = 0.2;
    const minTrain = Number(req.minObservations);
    const requiredTotal = Math.ceil(minTrain / (1 - validationRatio));
    const skuData = data.filter(d => String(d.sku || d['Material Code']) === effectiveSelectedSKU);
    return skuData.length < requiredTotal;
    });

  // Determine which methods are required based on settings
  const requiredMethods = aiForecastModelOptimizationEnabled ? ['grid', 'ai'] : ['grid'];

  // Check if all eligible/optimizable models have required method results
  const allResultsReady = useMemo(() => {
    if (!Array.isArray(bestResults)) return false;
    return eligibleOptimizableModels.every(model => {
      const result = bestResults.find(r => r.modelType === model.id);
      if (!result) return false;
      // Check that all required methods are present with a bestResult
      return requiredMethods.every(method =>
        result.methods && result.methods.some(m => m.method === method && m.bestResult)
      );
    });
  }, [eligibleOptimizableModels, bestResults, requiredMethods]);

  // Helper functions for model operations
  const toggleModel = (modelId: string) => {
    const model = models.find(m => m.id === modelId);
    if (model) {
      updateModel(modelId, { enabled: !model.enabled });
    }
  };

  const updateParameter = (modelId: string, parameter: string, value: number) => {
    const model = models.find(m => m.id === modelId);
    if (model) {
      const updatedParameters = { ...model.parameters, [parameter]: value };
      updateModel(modelId, { parameters: updatedParameters });
    }
  };

  const resetModel = (modelId: string) => {
    // This would reset to default parameters - implement as needed
    console.log('Reset model:', modelId);
  };

  const updateModelOptimization = (modelId: string, optimizationData: any) => {
    updateModel(modelId, optimizationData);
  };

  // Calculate SKU-specific progress
  const totalSkuJobs = skuJobs.length;
  const completedSkuJobs = skuJobs.filter(job => job.status === 'completed').length;
  const skuProgress = totalSkuJobs > 0 ? Math.round((completedSkuJobs / totalSkuJobs) * 100) : 0;

  const getStatusDisplay = () => {
    if (hasActiveJobs) {
      return (
        <div className="flex items-center gap-2 text-orange-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Optimizing models...</span>
          <Badge variant="outline">{summary.progress}%</Badge>
        </div>
      );
    }

    if (hasCompletedJobs) {
      return (
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span>Optimization complete</span>
          {hasRecentData && (
            <Badge variant="secondary" className="ml-2">
              Results loaded
            </Badge>
          )}
        </div>
      );
    }

    if (hasFailedJobs) {
      return (
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-4 w-4" />
          <span>Some optimizations failed</span>
        </div>
      );
    }

    return (
      <div className="text-slate-600">
        Ready to generate forecasts
      </div>
    );
  };

  useEffect(() => {
    if (bestResultsLoading) {
      // Find which eligible models are missing required results
      const waitingFor: { modelId: string, modelName: string, missingMethods: string[] }[] = eligibleOptimizableModels.map(model => {
        const result = bestResults?.find(r => r.modelType === model.id);
        const missingMethods = requiredMethods.filter(method => {
          if (!result) return true;
          return !result.methods || !result.methods.some(m => m.method === method && m.bestResult);
        });
        return missingMethods.length > 0 ? { modelId: model.id, modelName: model.displayName || model.id, missingMethods } : null;
      }).filter(Boolean) as { modelId: string, modelName: string, missingMethods: string[] }[];
      if (waitingFor.length > 0) {
        //console.log('[ForecastEngine] UI is waiting for the following models/methods:', waitingFor);
      } else {
        //console.log('[ForecastEngine] UI is waiting for model optimization results from backend (spinner shown), but could not determine missing models.');
      }
    } else {
      //console.log('[ForecastEngine] UI has received and acknowledged all available model results:', bestResults);
    }
  }, [bestResultsLoading, bestResults, eligibleOptimizableModels, requiredMethods]);

  useEffect(() => {
    if (!bestResultsLoading && bestResults) {
      console.log('[ForecastEngine] Backend bestResults response:', bestResults);
    }
  }, [bestResultsLoading, bestResults]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          Forecast Models
        </CardTitle>
        <CardDescription>
          Select models and start optimization to generate accurate forecasts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ProductSelector
          data={data}
        />

        {/* Status Display - Unified Centered Spinner/Status */}
        <div className="flex flex-col items-center justify-center py-8">
          {isPaused ? (
            <>
              <AlertCircle className="h-10 w-10 text-orange-600 mb-4" />
              <div className="text-orange-700 font-medium text-lg">Backend connection lost</div>
              <div className="text-orange-600 text-sm mt-1 mb-3">Polling paused due to connection errors</div>
              <Button 
                onClick={resumePolling}
                variant="outline"
                size="sm"
                className="text-orange-600 border-orange-600 hover:bg-orange-50"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry Connection
              </Button>
            </>
          ) : hasActiveJobs ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
              <div className="text-blue-700 font-medium text-lg">Optimizing models...</div>
              <div className="text-blue-700 text-sm mt-1">{skuProgress}% complete</div>
            </>
          ) : hasCompletedJobs ? (
            <>
              <CheckCircle className="h-10 w-10 text-green-600 mb-4" />
              <div className="text-green-700 font-medium text-lg">Optimization complete</div>
              {hasRecentData && (
                <Badge variant="secondary" className="mt-2">
                  Results loaded
                </Badge>
              )}
            </>
          ) : null}
        </div>

        {/* Model Selection and Results */}
        {!hasActiveJobs && !hasCompletedJobs && forecastResults.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            <p>No optimization jobs found for this SKU and dataset.</p>
            <p className="text-sm">
              Please run optimization for this SKU first. You can start optimization from the main workflow page.
            </p>
            <div className="mt-4 text-xs text-slate-400">
              <p>Debug info:</p>
              <p>SKU: {effectiveSelectedSKU}</p>
              <p>File: {effectiveFilePath || 'None'}</p>
              <p>Total jobs: {jobs.length}</p>
              <p>Best results: {bestResults?.length || 0}</p>
              <p>Forecast results: {forecastResults.length}</p>
            </div>
          </div>
        ) : null}
        {!hasActiveJobs && hasCompletedJobs && forecastResults.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            <p>No model results available for this SKU and dataset.</p>
            <p className="text-sm">
              Jobs completed but no valid results found. This might indicate that all models failed or were ineligible.
            </p>
            <Button onClick={refreshBestResults} className="mt-2">Retry</Button>
            <div className="mt-4 text-xs text-slate-400">
              <p>Debug info:</p>
              <p>SKU: {effectiveSelectedSKU}</p>
              <p>File: {effectiveFilePath || 'None'}</p>
              <p>Completed jobs: {completedSkuJobs}</p>
              <p>Best results: {bestResults?.length || 0}</p>
              <p>Forecast results: {forecastResults.length}</p>
            </div>
          </div>
        )}

        {!hasActiveJobs && forecastResults.length > 0 && (
          <div key={effectiveSelectedSKU + (effectiveFilePath || '')}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Available Models</h3>
              </div>
              {/* Always show the ModelParameterPanel */}
              <ModelParameterPanel
                models={models}
                data={data}
                onToggleModel={toggleModel}
                onUpdateParameter={updateParameter}
                onResetModel={resetModel}
                isOptimizing={hasActiveJobs}
                optimizingModel={null}
                aiForecastModelOptimizationEnabled={aiForecastModelOptimizationEnabled}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};