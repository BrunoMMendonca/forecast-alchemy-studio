import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { SalesData, ForecastResult, ModelConfig } from '@/types/forecast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Loader2, CheckCircle, AlertCircle, RefreshCw, Play, Pause, Square, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { ProductSelector } from './ProductSelector';
import { ModelParameterPanel } from './ModelParameterPanel';
import { useBestResultsMapping } from '@/hooks/useBestResultsMapping';
import { BusinessContext } from '@/types/businessContext';
import { useOptimizationStatusContext } from '@/contexts/OptimizationStatusContext';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSKUStore } from '@/store/skuStore';
import { fetchModelMetadata } from '@/services/settingsProvider';
import { useBackendForecastGeneration } from '@/hooks/useBackendForecastGeneration';
import isEqual from 'lodash.isequal';
import { useForecastResultsStore } from '@/store/forecastResultsStore';
import { generateForecasts } from '@/services/forecastService';
import { ForecastResults } from './ForecastResults';
import { Progress } from '@/components/ui/progress';

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
  processedDataInfo?: { 
    filePath?: string; 
    optimizationId?: string; 
    uuid?: string;
    columnRoles?: string[];
    columns?: string[];
  } | null;
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
  const { toast } = useToast();
  const { skuGroups, summary } = useOptimizationStatusContext();
  
  // Use global SKU store
  const selectedSKU = useSKUStore(state => state.selectedSKU);
  const setSelectedSKU = useSKUStore(state => state.setSelectedSKU);
  
  // Only initialize hooks with valid SKU to prevent cache calls with empty SKU
  const validSKU = selectedSKU && selectedSKU.toString().trim() !== '';
  
  // Ensure we have a valid selectedSKU using column mapping if available
  const availableSKUs = React.useMemo(() => {
    // Try to get column mapping from processedDataInfo if available
    let skuColumnName = 'Material Code'; // Default fallback
    
    // If we have processedDataInfo with column mapping, use it
    if (processedDataInfo?.columnRoles && processedDataInfo?.columns) {
      const materialCodeIndex = processedDataInfo.columnRoles.indexOf('Material Code');
      if (materialCodeIndex !== -1) {
        skuColumnName = processedDataInfo.columns[materialCodeIndex];
      }
    }
    
    return Array.from(new Set(data.map(d => String(d[skuColumnName] || d.sku || d['Material Code'])))).sort();
  }, [data, processedDataInfo]);
  
  const effectiveSelectedSKU = selectedSKU || (availableSKUs.length > 0 ? availableSKUs[0] : '');

  // Determine filePath for dataset-specific best results
  const effectiveFilePath = filePath || processedDataInfo?.filePath || undefined;
  // Determine uuid/optimizationId for this dataset (plumb from processedDataInfo if available)
  const effectiveUUID = processedDataInfo?.optimizationId || processedDataInfo?.uuid || 'default';
  
  // Get optimization for the current SKU and filePath
  const skuGroup = skuGroups.find(group => group.sku === effectiveSelectedSKU);
  const skuOptimization = skuGroup; // For compatibility with the rest of your code
  
  const hasActiveJobs = skuOptimization?.isOptimizing || false;
  const hasCompletedJobs = (skuOptimization?.completedJobs || 0) > 0;
  const hasFailedJobs = (skuOptimization?.failedJobs || 0) > 0;

  // Auto-select first SKU if none selected
  React.useEffect(() => {
    if (!selectedSKU && availableSKUs.length > 0) {
      setSelectedSKU(availableSKUs[0]);
    }
  }, [selectedSKU, availableSKUs, setSelectedSKU]);

  // Use the best results mapping hook with global updateModel
  const { isLoading: bestResultsLoading, hasRecentData, refreshBestResults, bestResults } = useBestResultsMapping(
    models,
    effectiveSelectedSKU,
    updateModel,
    effectiveFilePath,
    skuOptimization?.jobs || [],
    effectiveSelectedSKU,
    effectiveFilePath
  );

  // Use backend forecast generation only for manual mode or when optimization results are not available
  const { generateForecasts: generateBackendForecasts, isGenerating: isGeneratingForecasts } = useBackendForecastGeneration({
    selectedSKU: effectiveSelectedSKU,
    data,
    models,
    forecastPeriods,
    setForecastResults,
    optimizationResults: bestResults, // Pass the optimization results
    hasCompletedJobs,
    isOptimizing
  });

  useEffect(() => {
  });

  useEffect(() => {
  }, [effectiveSelectedSKU, effectiveFilePath, models, skuOptimization?.jobs]);

  // Clear results on SKU or filePath change
  useEffect(() => {
    setForecastResults([]);
  }, [effectiveSelectedSKU, effectiveFilePath, setForecastResults]);

  // Zustand forecast results store
  const forecastResultsStore = useForecastResultsStore();
  const { setResult, getResult, clear, pending, clearPending, addPending, setOptimizationCompleted, getOptimizationCompleted } = forecastResultsStore;

  // Read from Zustand for UI
  const selectedMethod = 'manual'; // or 'grid'/'ai' based on UI state
  const forecastResults = useMemo(() => {
    return models
      .filter(model => model.enabled)
      .map(model => getResult(effectiveFilePath, effectiveSelectedSKU, model.id, selectedMethod))
      .filter(Boolean);
  }, [models, effectiveSelectedSKU, selectedMethod, getResult, effectiveFilePath]);

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

  // Determine eligible models for the selected SKU (same logic as left panel)
  const eligibleModels = useMemo(() => {
    return models.filter(m => {
      if (!m.enabled) return false;
      const req = requirements[m.id];
      if (!req) return true; // If no requirements, assume eligible
      const validationRatio = 0.2; // Match backend default
      const minTrain = Number(req.minObservations);
      const requiredTotal = Math.ceil(minTrain / (1 - validationRatio));
      
      // Use column mapping if available for SKU filtering
      let skuColumnName = 'Material Code'; // Default fallback
      if (processedDataInfo?.columnRoles && processedDataInfo?.columns) {
        const materialCodeIndex = processedDataInfo.columnRoles.indexOf('Material Code');
        if (materialCodeIndex !== -1) {
          skuColumnName = processedDataInfo.columns[materialCodeIndex];
        }
      }
      
      const skuData = data.filter(d => String(d[skuColumnName] || d.sku || d['Material Code']) === effectiveSelectedSKU);
      return skuData.length >= requiredTotal;
    });
  }, [models, requirements, data, effectiveSelectedSKU, processedDataInfo]);

  const requiredMethods = aiForecastModelOptimizationEnabled ? ['grid', 'ai'] : ['grid'];

  const requiredPairs = eligibleModels.flatMap(model =>
    requiredMethods.map(method => ({ modelId: model.id, method }))
  );

  // Check if all eligible results are available in Zustand
  const allReady = requiredPairs.every(({ modelId, method }) =>
    !!forecastResultsStore.results[effectiveFilePath]?.[effectiveSelectedSKU]?.[modelId]?.[method]
  );



  // Build forecastResults array for the right panel
  const forecastResultsRightPanel = useMemo(() => {
    if (!allReady) return [];
    return requiredPairs.map(({ modelId, method }) =>
      forecastResultsStore.results[effectiveFilePath]?.[effectiveSelectedSKU]?.[modelId]?.[method]
    ).filter(Boolean);
  }, [allReady, requiredPairs, forecastResultsStore.results, effectiveSelectedSKU, effectiveFilePath]);

  // Update parent's forecastResults state when Zustand store changes
  const lastResultsRef = React.useRef<any[]>([]);
  useEffect(() => {
    const prev = lastResultsRef.current;
    const next = forecastResultsRightPanel;
    const isSame = prev.length === next.length && prev.every((item, i) => item === next[i]);
    if (!isSame) {
      setForecastResults(next);
      lastResultsRef.current = next;
    }
  }, [forecastResultsRightPanel, setForecastResults]);

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
    // Only reset to defaults if the user explicitly requests it (e.g., via a Reset button)
    const model = models.find(m => m.id === modelId);
    if (model) {
      updateModel(modelId, {
        manualParameters: { ...model.defaultParameters },
        parameters: { ...model.defaultParameters },
        // Optionally reset other optimization fields if needed
        gridParameters: undefined,
        aiParameters: undefined,
        bestSource: undefined,
        optimizationConfidence: undefined,
        optimizationReasoning: undefined,
        optimizationMethod: undefined,
        isWinner: false
      });
    }
  };

  const handleMethodSelection = (modelId: string, method: 'ai' | 'grid' | 'manual') => {
    const model = models.find(m => m.id === modelId);
    if (!model) return;

    if (method === 'grid' && model.gridParameters) {
      // Apply grid search parameters
      console.log(`🎯 Applying grid search parameters for ${modelId}:`, model.gridParameters);
      Object.entries(model.gridParameters).forEach(([parameter, value]) => {
        // Convert value to number to ensure type safety
        const numericValue = typeof value === 'number' ? value : parseFloat(value as string);
        if (!isNaN(numericValue)) {
          updateParameter(modelId, parameter, numericValue);
        }
      });
      updateModel(modelId, { optimizationMethod: 'grid', parameters: { ...model.gridParameters } });
    } else if (method === 'manual') {
      // Switch to manual mode, but do NOT reset parameters
      updateModel(modelId, {
        optimizationMethod: 'manual',
        parameters: { ...model.manualParameters }
      });
    } else if (method === 'ai' && model.aiParameters) {
      updateModel(modelId, { optimizationMethod: 'ai', parameters: { ...model.aiParameters } });
    }
    // For AI method, we don't apply parameters yet as they come from the backend
  };

  const updateModelOptimization = (modelId: string, optimizationData: any) => {
    updateModel(modelId, optimizationData);
  };

  // Helper to get all jobs for the selected SKU
  const allSkuJobs = Object.values(skuOptimization?.batches || {}).flatMap(batch =>
    Object.values(batch.optimizations).flatMap(opt => opt.jobs || [])
  );

  // Calculate SKU-specific progress
  const totalSkuJobs = allSkuJobs.length;
  const completedSkuJobs = allSkuJobs.filter(job => job.status === 'completed').length;
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
  }, [bestResultsLoading, bestResults, eligibleModels, requiredMethods]);

  useEffect(() => {
  }, [bestResultsLoading, bestResults]);

  const [modelMetadata, setModelMetadata] = useState<any[]>([]);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch model metadata on mount
  useEffect(() => {
    fetchModelMetadata().then(setModelMetadata).catch(() => setModelMetadata([]));
  }, []);

  function getDefaultParameters(modelType: string) {
    const meta = modelMetadata.find(m => m.id === modelType);
    return meta ? meta.defaultParameters : {};
  }

  function isDefaultResults(results: any[]) {
    if (!modelMetadata.length) return true; // If metadata not loaded, assume default

    // Polling continues as long as any model is still default and not ineligible/failed
    return results.some(r => {
      const defaults = getDefaultParameters(r.model);
      let params = r.parameters;
      if (typeof params === 'string') {
        try { params = JSON.parse(params); } catch {}
      }
      // If it's ineligible/failed, treat as "done"
      if (r.status === 'ineligible' || r.isDefault === true || r.reason) return false;
      // If it's optimized, treat as "done"
      if (typeof r.compositeScore === 'number' && !isEqual(params, defaults)) return false;
      // Otherwise, still waiting
      return true;
    });
  }

  useEffect(() => {
    if (hasCompletedJobs && (forecastResults.length === 0 || isDefaultResults(forecastResults))) {
      if (!pollingRef.current) {
        pollingRef.current = setInterval(() => {
          refreshBestResults();
        }, 3000); // Increased from 1500ms to reduce console noise
      }
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
    }
    };
  }, [hasCompletedJobs, forecastResults, refreshBestResults, modelMetadata]);

  // Batch request pending forecasts every 4 seconds (increased to reduce console noise)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (pending.length === 0) return;
      // Group by SKU and filePath
      const grouped = pending.reduce((acc, item) => {
        const key = item.filePath + '|' + item.sku;
        acc[key] = acc[key] || [];
        acc[key].push(item);
        return acc;
      }, {});
      for (const groupKey in grouped) {
        const [filePath, sku] = groupKey.split('|');
        const groupItems = grouped[groupKey];
        const models = groupItems.map(({ modelId, method, parameters }) => ({
          id: modelId,
          method,
          parameters,
          enabled: true,
        }));
        // Add 'data' to the request
        const results = await generateForecasts({ sku, data, models, forecastPeriods, filePath });
        if (results && Array.isArray(results)) {
          // Inject method from pending queue into each result
          groupItems.forEach((pendingItem) => {
            const match = results.find(r => r.model === pendingItem.modelId);
            if (match) {
              setResult(filePath, sku, match.model, pendingItem.method, { ...match, method: pendingItem.method });
            }
          });
        }
      }
      clearPending();
    }, 2000);
    return () => clearInterval(interval);
  }, [pending, setResult, clearPending, forecastPeriods, data]);

  // Set optimizationCompleted flag in Zustand when jobs complete
  useEffect(() => {
    if (hasCompletedJobs) {
      setOptimizationCompleted(effectiveFilePath, effectiveSelectedSKU, true);
    }
  }, [hasCompletedJobs, effectiveFilePath, effectiveSelectedSKU, setOptimizationCompleted]);

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
        <div className={`flex flex-col items-center justify-center ${getOptimizationCompleted(effectiveFilePath, effectiveSelectedSKU) ? 'py-1' : 'py-9'}`}>
          {hasActiveJobs ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
              <div className="text-blue-700 font-medium text-lg">Optimizing models...</div>
              <div className="text-blue-700 text-sm mt-1">{skuProgress}% complete</div>
            </>
          ) : getOptimizationCompleted(effectiveFilePath, effectiveSelectedSKU) ? (
            <div className="flex items-center gap-2 py-1 px-2 bg-transparent justify-start w-full">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-green-700 font-medium text-sm">Optimization complete</span>
            </div>
          ) : null}
        </div>

        {/* Model Selection and Results */}
        {!hasActiveJobs && (
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
                filePath={effectiveFilePath}
                uuid={effectiveUUID}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};