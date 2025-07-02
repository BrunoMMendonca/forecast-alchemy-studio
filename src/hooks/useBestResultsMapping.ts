import { useState, useEffect, useCallback, useRef } from 'react';
import { ModelConfig } from '@/types/forecast';
import { useToast } from '@/hooks/use-toast';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import isEqual from 'lodash.isequal';

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
  filePath?: string;
  predictions?: any[];
  compositeScore?: number;
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
  methods: MethodResult[];
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
  filePath?: string,
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

  // Store the mapped best results for use in the UI
  const [bestResults, setBestResults] = useState<ModelBestResults[]>([]);

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
    console.debug('[useBestResultsMapping] fetchBestResults called', {
      selectedSKU,
      modelsSignature,
      filePath
    });
    if (!selectedSKU || models.length === 0) return;

    // Rate limiting check
    const now = Date.now();
    const timeSinceLastRequest = now - lastFetchTimeRef.current;
    const backoffDelay = getBackoffDelay();
    const requiredDelay = Math.max(MIN_REQUEST_INTERVAL, backoffDelay);
    
    // Skip rate limiting if this is a new SKU (user just switched SKUs)
    const isNewSKU = lastFetchTimeRef.current === 0 || selectedSKU !== lastSelectedSKURef.current;
    
    if (!isNewSKU && timeSinceLastRequest < requiredDelay) {
      console.debug('[useBestResultsMapping] Rate limited, skipping request', {
        timeSinceLastRequest: Math.round(timeSinceLastRequest / 1000) + 's',
        requiredDelay: Math.round(requiredDelay / 1000) + 's',
        consecutiveErrors: consecutiveErrorsRef.current,
        isNewSKU
      });
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
      });
      if (filePath) {
        params.append('filePath', filePath);
      }
      if (selectedSKU) {
        params.append('sku', selectedSKU);
      }
      const response = await fetch(`/api/jobs/best-results-per-model?${params.toString()}`);
      if (!response.ok) {
        if (response.status === 404) {
          // Silently handle 404 (no results yet)
          setBestResults([]);
          setIsLoading(false);
          consecutiveErrorsRef.current = 0; // Reset error count on 404
          setConsecutiveErrors(0);
          return;
        }
        throw new Error('Failed to fetch best results from backend');
      }

      const data: BestResultsResponse = await response.json();

      // Filter results to only show the currently selected SKU
      const filteredResults = data.bestResultsPerModelMethod;

      // Map best results to models (only for the selected SKU)
      setBestResults(filteredResults);
      console.debug('[useBestResultsMapping] setBestResults for SKU:', selectedSKU, filteredResults);
      const foundModelTypes = new Set(filteredResults.map(r => r.modelType));
      // Only warn for models that are optimizable (have at least one parameter)
      const missingModels = models.filter(m => {
        // Check for at least one parameter in the model's metadata
        const paramKeys = m.parameters ? Object.keys(m.parameters) : [];
        return !foundModelTypes.has(m.id) && paramKeys.length > 0;
      });
      if (missingModels.length > 0) {
        // eslint-disable-next-line no-console
       //console.warn('[useBestResultsMapping] No results for models:', missingModels.map(m => m.id), 'for SKU:', selectedSKU, 'filePath:', filePath);
      }
      // For each model, determine the best method
      let bestModelId: string | null = null;
      let bestModelMethod: string | null = null;
      let bestScore = -Infinity;
      filteredResults.forEach((modelResult) => {
        let modelBestScore = -Infinity;
        let modelBestMethod = null;
        modelResult.methods.forEach((methodResult) => {
          if (methodResult.bestResult && typeof methodResult.bestResult.accuracy === 'number') {
            if (methodResult.bestResult.accuracy > modelBestScore) {
              modelBestScore = methodResult.bestResult.accuracy;
              modelBestMethod = methodResult.method;
            }
          }
          // --- Set gridParameters and aiParameters in model state ---
          const model = models.find(m => m.id === modelResult.modelType);
          if (model && methodResult.bestResult) {
            if (methodResult.method === 'grid') {
              onModelUpdate(model.id, {
                gridParameters: methodResult.bestResult.parameters,
                gridCompositeScore: methodResult.bestResult.compositeScore,
                accuracy: methodResult.bestResult.accuracy
              });
            }
            if (methodResult.method === 'ai') {
              onModelUpdate(model.id, {
                aiParameters: methodResult.bestResult.parameters,
                aiCompositeScore: methodResult.bestResult.compositeScore,
                accuracy: methodResult.bestResult.accuracy
              });
            }
          }
        });
        // Store best method and score for this model
        const model = models.find(m => m.id === modelResult.modelType);
        if (model) {
          onModelUpdate(model.id, {
            bestMethod: modelBestMethod,
            bestMethodScore: modelBestScore
          });
        }
        // Track overall winner
        if (modelBestScore > bestScore) {
          bestScore = modelBestScore;
          bestModelId = modelResult.modelType;
          bestModelMethod = modelBestMethod;
        }
        // Compute best composite score for this model (across all methods)
        let bestCompositeScore = null;
        for (const methodResult of modelResult.methods) {
          if (typeof methodResult.bestResult?.compositeScore === 'number') {
            if (bestCompositeScore === null || methodResult.bestResult.compositeScore > bestCompositeScore) {
              bestCompositeScore = methodResult.bestResult.compositeScore;
            }
          }
        }
        if (model) {
          onModelUpdate(model.id, { bestCompositeScore });
        }
      });
      // Update models: only the best gets isWinner: true and winnerMethod
      models.forEach((model) => {
        onModelUpdate(model.id, {
          isWinner: model.id === bestModelId,
          winnerMethod: model.id === bestModelId ? bestModelMethod : undefined
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
      
      // Suppress error toast if jobs are still running or pending for this SKU/filePath
      let hasActiveJobs = false;
      if (jobs && effectiveSelectedSKU) {
        hasActiveJobs = jobs.some(job => {
          let jobFilePath = job.filePath;
          if (!jobFilePath && job.data) {
            try {
              const parsed = typeof job.data === 'string' ? JSON.parse(job.data) : job.data;
              jobFilePath = parsed.filePath;
            } catch {}
          }
          return job.sku === effectiveSelectedSKU && (!effectiveFilePath || jobFilePath === effectiveFilePath) && (job.status === 'pending' || job.status === 'running');
        });
      }
      
      // Only show error toast if:
      // 1. No active jobs AND
      // 2. Either first error OR haven't shown error in last 30 seconds
      const timeSinceLastError = now - lastErrorTimeRef.current;
      if (!hasActiveJobs && (newErrorCount === 1 || timeSinceLastError > 30000)) {
        toast({
          title: "Error",
          description: "Failed to fetch optimization results from backend",
          variant: "destructive",
        });
      }
      setBestResults([]); // Clear on error
      console.debug('[useBestResultsMapping] setBestResults([]) due to error for SKU:', selectedSKU);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSKU, modelsSignature, onModelUpdate, toast, globalSettings.mapeWeight, globalSettings.rmseWeight, globalSettings.maeWeight, globalSettings.accuracyWeight, filePath, jobs, effectiveSelectedSKU, effectiveFilePath]); // Remove rate limiting state from dependencies

  // Auto-fetch when SKU or modelsSignature changes
  useEffect(() => {
    if (selectedSKU && models.length > 0) {
      fetchBestResults();
    }
  }, [selectedSKU, modelsSignature, filePath]); // Remove fetchBestResults from dependencies

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