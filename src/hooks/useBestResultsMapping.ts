import { useState, useEffect, useCallback, useRef } from 'react';
import { ModelConfig } from '@/types/forecast';
import { useToast } from '@/hooks/use-toast';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import isEqual from 'lodash.isequal';
import { useForecastResultsStore } from '@/store/forecastResultsStore';
import { useModelUIStore, ModelMethod } from '@/store/optimizationStore';
import { useForecastStore } from '@/store/forecastStore';

interface BestResult {
  accuracy: number;
  parameters: Record<string, any>;
  mape: number;
  rmse: number;
  mae: number;
  jobId: number;
  sku: string;
  createdAt: string;
  completedAt: string;
  datasetId?: number;
  predictions?: any[];
  compositeScore?: number;
  optimizationId?: string;
}

interface MethodResult {
  method: 'grid' | 'ai';
  bestResult: BestResult | null;
  allResults: BestResult[];
}

interface ModelBestResults {
  modelType: string;
  displayName: string;
  category: string;
  description: string;
  isSeasonal: boolean;
  sku: string;
  batchId?: string;
  datasetId?: number;
  methods: MethodResult[];
  optimizationId?: string;
}

interface BestResultsResponse {
  totalJobs: number;
  bestResultsPerModelMethod: ModelBestResults[];
  timestamp: string;
}

export function useBestResultsMapping(
  models: ModelConfig[],
  selectedSKU: string,
  onModelUpdate: (modelId: string, updates: Partial<ModelConfig>) => void,
  datasetId?: number,
  jobs?: any[], // Pass jobs from ForecastEngine if available
  effectiveSelectedSKU?: string,
  effectiveFilePath?: string
) {
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [lastErrorTime, setLastErrorTime] = useState<number>(0);
  const [consecutiveErrors, setConsecutiveErrors] = useState<number>(0);
  const lastFetchTimeRef = useRef<number>(0);
  const lastErrorTimeRef = useRef<number>(0);
  const consecutiveErrorsRef = useRef<number>(0);
  const lastSelectedSKURef = useRef<string>('');
  const { toast } = useToast();
  const globalSettings = useGlobalSettings();
  const forecastResultsStore = useForecastResultsStore();
  const { addPending, getResult } = forecastResultsStore;
  const setParameters = useModelUIStore(state => state.setParameters);
  const { setForecast } = useForecastStore();

  // Store the mapped best results for use in the UI
  const [bestResults, setBestResults] = useState<ModelBestResults[]>([]);

  // Function to fetch and store optimization forecasts
  const fetchAndStoreOptimizationForecasts = useCallback(async (optimizationIds: string[], sku: string, datasetId: number) => {
    try {
      console.log(`[useBestResultsMapping] Fetching forecasts for ${optimizationIds.length} optimizations`);
      
      for (const optimizationId of optimizationIds) {
        try {
          const response = await fetch(`/api/forecast/optimization/${optimizationId}?sku=${sku}&datasetId=${datasetId}`);
          
          if (!response.ok) {
            if (response.status === 404) {
              console.log(`[useBestResultsMapping] No forecasts found for optimization ${optimizationId}`);
              continue;
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          
          if (data.success && data.forecasts && data.forecasts.length > 0) {
            console.log(`[useBestResultsMapping] Received ${data.forecasts.length} forecasts for optimization ${optimizationId}`);
            
            // Store forecasts in the forecast store
            data.forecasts.forEach((forecast: any) => {
              const { companyId, datasetId: forecastDatasetId, sku: forecastSku, modelId } = forecast;
              
              // Store in forecast store
              setForecast(companyId, forecastDatasetId, forecastSku, modelId, forecast);
              
              console.log(`[useBestResultsMapping] Stored forecast for ${forecastSku}/${modelId}`);
            });
          }
        } catch (error) {
          console.error(`[useBestResultsMapping] Error fetching forecasts for optimization ${optimizationId}:`, error);
        }
      }
    } catch (error) {
      console.error('[useBestResultsMapping] Error in fetchAndStoreOptimizationForecasts:', error);
    }
  }, [setForecast]);

  // Compute a stable signature for models (id:enabled for each model)
  const modelsSignature = models.map(m => `${m.id}:${m.enabled ? 1 : 0}`).join(',');

  // Rate limiting: minimum 500ms between requests, exponential backoff on errors
  const MIN_REQUEST_INTERVAL = 500; // 500ms
  const getBackoffDelay = () => {
    if (consecutiveErrorsRef.current === 0) return 0;
    return Math.min(30000, Math.pow(2, consecutiveErrorsRef.current) * 1000); // Max 30 seconds
  };

  // Fetch best results from backend
  const fetchBestResults = useCallback(async () => {
    
    if (!selectedSKU || models.length === 0) return;

    // Rate limiting check
    const now = Date.now();
    const timeSinceLastRequest = now - lastFetchTimeRef.current;
    const backoffDelay = getBackoffDelay();
    const requiredDelay = Math.max(MIN_REQUEST_INTERVAL, backoffDelay);
    
    // Skip rate limiting if this is a new SKU (user just switched SKUs)
    const isNewSKU = lastFetchTimeRef.current === 0 || selectedSKU !== lastSelectedSKURef.current;
    
    if (!isNewSKU && timeSinceLastRequest < requiredDelay) {
      
      return;
    }

    setIsLoading(true);
    try {
      // Read weights from global settings and convert to decimals
      const mapeWeight = (globalSettings.mapeWeight ?? 40) / 100;
      const rmseWeight = (globalSettings.rmseWeight ?? 30) / 100;
      const maeWeight = (globalSettings.maeWeight ?? 20) / 100;
      const accuracyWeight = (globalSettings.accuracyWeight ?? 10) / 100;
      const params = new URLSearchParams({
        mapeWeight: mapeWeight.toString(),
        rmseWeight: rmseWeight.toString(),
        maeWeight: maeWeight.toString(),
        accuracyWeight: accuracyWeight.toString(),
        method: 'all' // Get both grid and ai results
      });
      if (datasetId) {
        params.append('datasetId', datasetId.toString());
      }
      if (selectedSKU) {
        params.append('sku', selectedSKU);
      }
      const response = await fetch(`/api/jobs/best-results-per-model?${params.toString()}`);
      if (!response.ok) {
        if (response.status === 404) {
          // Silently handle 404 (no results yet), but do NOT clear bestResults
          setIsLoading(false);
          consecutiveErrorsRef.current = 0; // Reset error count on 404
          setConsecutiveErrors(0);
          return;
        }
        throw new Error('Failed to fetch best results from backend');
      }

      const data: BestResultsResponse = await response.json();

      // Handle empty results gracefully
      if (!data.bestResultsPerModelMethod || data.bestResultsPerModelMethod.length === 0) {
        console.log(`[useBestResultsMapping] No optimization results found for SKU: ${selectedSKU}, datasetId: ${datasetId} - this is normal for new datasets`);
        setBestResults([]);
        const now = Date.now();
        lastFetchTimeRef.current = now;
        lastSelectedSKURef.current = selectedSKU;
        setLastFetchTime(now);
        consecutiveErrorsRef.current = 0;
        setConsecutiveErrors(0);
        setIsLoading(false);
        return;
      }

      // Filter results to only show the currently selected SKU
      const filteredResults = data.bestResultsPerModelMethod;
      
      console.log(`[useBestResultsMapping] Received ${filteredResults.length} results for SKU: ${selectedSKU}, datasetId: ${datasetId}`);
      if (filteredResults.length > 0) {
        console.log(`[useBestResultsMapping] Sample result:`, {
          modelType: filteredResults[0].modelType,
          sku: filteredResults[0].sku,
          datasetId: filteredResults[0].datasetId,
          methods: filteredResults[0].methods?.map(m => ({
            method: m.method,
            hasBestResult: !!m.bestResult,
            accuracy: m.bestResult?.accuracy,
            compositeScore: m.bestResult?.compositeScore
          }))
        });
      }

      // Map best results to models (only for the selected SKU)
      setBestResults(filteredResults);

      // Track last copied bestParams per SKU/model
      const lastCopiedParamsRef = (window as any).__lastCopiedBestParamsRef = (window as any).__lastCopiedBestParamsRef || {};
      // Map: datasetId|uuid|sku|modelId -> JSON string of last copied bestParams

      // Track optimization IDs to fetch forecasts
      const optimizationIds = new Set<string>();

      filteredResults.forEach((modelResult) => {
        const modelId = modelResult.modelType;
        const sku = modelResult.sku;
        const fp = modelResult.datasetId ? `dataset_${modelResult.datasetId}` : (datasetId ? `dataset_${datasetId}` : '');
        const uuid = modelResult.optimizationId || 'default';
        let bestParams: any = undefined;
        let bestMethod: ModelMethod | undefined = undefined;
        
        // Collect optimization IDs for forecast fetching
        if (uuid && uuid !== 'default') {
          optimizationIds.add(uuid);
        }
        
        // Prefer AI over grid
        modelResult.methods.forEach((methodResult) => {
          const method = methodResult.method as ModelMethod;
          if (methodResult.bestResult) {
            setParameters(fp, uuid, sku, modelId, method, {
              parameters: methodResult.bestResult.parameters,
              compositeScore: methodResult.bestResult.compositeScore,
              isWinner: false // will be set below
            });
            if (!bestParams || method === 'ai') {
              bestParams = methodResult.bestResult.parameters;
              bestMethod = method;
            }
          }
        });
        // Auto-copy bestParams to manual if user hasn't tweaked manual and bestParams are new
        if (bestParams) {
          const modelUIState = useModelUIStore.getState().modelUIState;
          const manualParams = modelUIState?.[fp]?.[uuid]?.[sku]?.[modelId]?.manual?.parameters;
          const isManualUntouched = !manualParams || Object.keys(manualParams).length === 0;
          const key = `${fp}|${uuid}|${sku}|${modelId}`;
          const bestParamsStr = JSON.stringify(bestParams);
          const lastCopied = lastCopiedParamsRef[key];
          if (isManualUntouched && bestParamsStr !== lastCopied) {
            setParameters(fp, uuid, sku, modelId, 'manual', { parameters: { ...bestParams } });
            lastCopiedParamsRef[key] = bestParamsStr;
            console.log('[useBestResultsMapping] Auto-copied best', bestMethod, 'params to manual for', { fp, uuid, sku, modelId });
          }
        }
      });

      // Fetch and store forecasts for completed optimizations
      if (optimizationIds.size > 0 && selectedSKU && datasetId) {
        fetchAndStoreOptimizationForecasts(Array.from(optimizationIds), selectedSKU, datasetId);
      }

      const foundModelTypes = new Set(filteredResults.map(r => r.modelType));
      // Only warn for models that are optimizable (have at least one parameter)
      const missingModels = models.filter(m => {
        // Check for at least one parameter in the model's metadata
        const paramKeys = m.parameters ? Object.keys(m.parameters) : [];
        return !foundModelTypes.has(m.id) && paramKeys.length > 0;
      });
      if (missingModels.length > 0) {
        // eslint-disable-next-line no-console
       //console.warn('[useBestResultsMapping] No results for models:', missingModels.map(m => m.id), 'for SKU:', selectedSKU, 'datasetId:', datasetId);
      }
      // For each model, determine the best method and winner
      let bestModelId: string | null = null;
      let bestModelMethod: string | null = null;
      let bestScore = -Infinity;
      filteredResults.forEach((modelResult) => {
        let modelBestScore = -Infinity;
        let modelBestMethod = null;
        modelResult.methods.forEach((methodResult) => {
          if (methodResult.bestResult) {
            // Use compositeScore if available, otherwise fall back to accuracy
            const score = typeof methodResult.bestResult.compositeScore === 'number'
              ? methodResult.bestResult.compositeScore
              : (typeof methodResult.bestResult.accuracy === 'number' ? methodResult.bestResult.accuracy : -Infinity);
            if (score > modelBestScore) {
              modelBestScore = score;
              modelBestMethod = methodResult.method;
            }
          }
        });
        if (modelBestScore > bestScore) {
          bestScore = modelBestScore;
          bestModelId = modelResult.modelType;
          bestModelMethod = modelBestMethod;
        }
      });
      // Set isWinner true for the best model/method
      filteredResults.forEach((modelResult) => {
        const modelId = modelResult.modelType;
        const sku = modelResult.sku;
        const fp = modelResult.datasetId ? `dataset_${modelResult.datasetId}` : (datasetId ? `dataset_${datasetId}` : '');
        const uuid = modelResult.optimizationId || 'default';
        modelResult.methods.forEach((methodResult) => {
          const method = methodResult.method as ModelMethod;
          const isWinner = (modelId === bestModelId && method === bestModelMethod);
          setParameters(fp, uuid, sku, modelId, method, {
            isWinner
          });
        });
      });

      const now = Date.now();
      lastFetchTimeRef.current = now;
      lastSelectedSKURef.current = selectedSKU;
      setLastFetchTime(now);
      consecutiveErrorsRef.current = 0; // Reset error count on success
      setConsecutiveErrors(0);

    } catch (error) {
      // Increment consecutive error count
      const newErrorCount = consecutiveErrorsRef.current + 1;
      consecutiveErrorsRef.current = newErrorCount;
      setConsecutiveErrors(newErrorCount);
      
      const now = Date.now();
      lastErrorTimeRef.current = now;
      setLastErrorTime(now);
      
      // Suppress error toast if jobs are still running or pending for this SKU/datasetId
      let hasActiveJobs = false;
      if (jobs && effectiveSelectedSKU) {
        hasActiveJobs = jobs.some(job => {
          let jobDatasetId = job.datasetId;
          if (!jobDatasetId && job.data) {
            try {
              const parsed = typeof job.data === 'string' ? JSON.parse(job.data) : job.data;
              jobDatasetId = parsed.datasetId;
            } catch {}
          }
          return job.sku === effectiveSelectedSKU && (!datasetId || jobDatasetId === datasetId) && (job.status === 'pending' || job.status === 'running');
        });
      }
      
      // Only show error toast if:
      // 1. No active jobs AND
      // 2. Either first error OR haven't shown error in last 30 seconds
      // 3. AND it's not a new dataset (which is expected to have no results)
      const timeSinceLastError = now - lastErrorTimeRef.current;
      const isNewDataset = !hasActiveJobs && newErrorCount === 1; // First error with no active jobs might be a new dataset
      
      if (!hasActiveJobs && (newErrorCount === 1 || timeSinceLastError > 30000) && !isNewDataset) {
        console.warn(`[useBestResultsMapping] Showing error toast for SKU: ${selectedSKU}, datasetId: ${datasetId}, errorCount: ${newErrorCount}`);
        toast({
          title: "Error",
          description: "Failed to fetch optimization results from backend",
          variant: "destructive",
        });
      } else if (isNewDataset) {
        console.log(`[useBestResultsMapping] Suppressing error toast for new dataset - SKU: ${selectedSKU}, datasetId: ${datasetId}`);
      }
      setBestResults([]); // Clear on error

    } finally {
      setIsLoading(false);
    }
  }, [selectedSKU, modelsSignature, onModelUpdate, toast, globalSettings.mapeWeight, globalSettings.rmseWeight, globalSettings.maeWeight, globalSettings.accuracyWeight, datasetId, jobs, effectiveSelectedSKU, effectiveFilePath]); // Remove rate limiting state from dependencies

  // Auto-fetch when SKU or modelsSignature changes
  useEffect(() => {
    if (selectedSKU && models.length > 0) {
      fetchBestResults();
    }
  }, [selectedSKU, modelsSignature, datasetId]); // Remove fetchBestResults from dependencies

  // Manual refresh function
  const refreshBestResults = useCallback(() => {
    fetchBestResults();
  }, [fetchBestResults]);

  // Check if we have recent data (within last 30 seconds)
  const hasRecentData = Date.now() - lastFetchTime < 30000;

  return {
    isLoading,
    hasRecentData,
    refreshBestResults,
    lastFetchTime,
    bestResults
  };
} 