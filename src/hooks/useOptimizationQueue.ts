import { useState, useCallback, useEffect, useRef } from 'react';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useManualAIPreferences } from '@/hooks/useManualAIPreferences';
import { getDefaultModels, hasOptimizableParameters } from '@/utils/modelConfig';
import { OptimizationQueue, OptimizationQueueItem, OptimizationProgress } from '@/types/optimization';
import { useToast } from '@/hooks/use-toast';
import { useOptimizationStore } from '@/store/optimizationStore';
import { runGridOptimization } from '@/utils/gridOptimization';
import { runAIOptimization } from '@/utils/aiOptimization';
import { OptimizationType, OptimizationStatus, OptimizationResult } from '@/types/optimization';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/types/forecast';
import { BusinessContext } from '@/types/businessContext';

interface OptimizationJob {
  sku: string;
  modelId: string;
  type: OptimizationType;
  model: ModelConfig;
  skuData: SalesData[];
  businessContext?: BusinessContext;
  grokApiEnabled?: boolean;
}

export const useOptimizationQueue = () => {
  const { toast } = useToast();
  const [queue, setQueue] = useState<OptimizationQueue>({
    items: [],
    progress: {},
    isOptimizing: false,
  });
  const { clearCacheForSKU } = useOptimizationCache();
  const { loadManualAIPreferences, saveManualAIPreferences } = useManualAIPreferences();
  const queueRef = useRef<OptimizationJob[]>([]);
  const isProcessingRef = useRef(false);
  const {
    setStatus,
    setResult,
    setError,
  } = useOptimizationStore();

  // Load queue from localStorage on mount
  useEffect(() => {
    const savedQueue = localStorage.getItem('optimizationQueue');
    if (savedQueue) {
      try {
        const parsed = JSON.parse(savedQueue);
        setQueue(parsed);
      } catch (error) {
        // Silent error handling
      }
    }
  }, []);

  // Save queue to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('optimizationQueue', JSON.stringify(queue));
  }, [queue]);

  const clearCacheAndPreferencesForSKU = useCallback((sku: string) => {
    clearCacheForSKU(sku);
    
    const preferences = loadManualAIPreferences();
    const updatedPreferences = Object.keys(preferences).reduce((acc, key) => {
      if (!key.startsWith(`${sku}:`)) {
        acc[key] = preferences[key];
      }
      return acc;
    }, {} as Record<string, any>);
    
    saveManualAIPreferences(updatedPreferences);
  }, [clearCacheForSKU, loadManualAIPreferences, saveManualAIPreferences]);

  const addToQueue = useCallback((items: OptimizationQueueItem[]) => {
    setQueue(prev => ({
      ...prev,
      items: [...prev.items, ...items.map(item => ({
        ...item,
        timestamp: Date.now(),
      }))],
    }));
  }, []);

  const removeFromQueue = useCallback((skus: string[]) => {
    setQueue(prev => ({
      ...prev,
      items: prev.items.filter(item => !skus.includes(item.sku)),
      progress: Object.fromEntries(
        Object.entries(prev.progress).filter(([sku]) => !skus.includes(sku))
      ),
    }));
  }, []);

  const updateProgress = useCallback((progress: OptimizationProgress) => {
    setQueue(prev => ({
      ...prev,
      progress: {
        ...prev.progress,
        [progress.sku]: progress.progress,
      },
    }));

    if (progress.status === 'completed') {
      toast({
        title: 'Optimization Complete',
        description: `Successfully optimized SKU: ${progress.sku}`,
      });
    } else if (progress.status === 'failed') {
      toast({
        title: 'Optimization Failed',
        description: `Failed to optimize SKU: ${progress.sku}. ${progress.error}`,
        variant: 'destructive',
      });
    }
  }, [toast]);

  const setIsOptimizing = useCallback((isOptimizing: boolean) => {
    setQueue(prev => ({ ...prev, isOptimizing }));
  }, []);

  const addSKUsToQueue = useCallback((
    skus: string[],
    modelIds: string[],
    reason: 'csv_upload' | 'manual' | 'settings_change' = 'manual',
    onlySpecifiedSKUs: boolean = false
  ) => {
    console.log('🚀 QUEUE: Adding SKUs to queue:', skus);
    console.log('🚀 QUEUE: Models to optimize:', modelIds);
    
    const newItems = skus.flatMap(sku => 
      modelIds.map(modelId => ({
        sku,
        modelId,
        reason,
        timestamp: Date.now(),
      }))
    );
    
    setQueue(prevQueue => {
      let filteredQueue = prevQueue.items;
      
      if (onlySpecifiedSKUs) {
        filteredQueue = prevQueue.items.filter(item => !skus.includes(item.sku));
        console.log(`🗑️ QUEUE: Removed entries only for affected SKUs: ${skus.join(', ')}`);
      } else {
        filteredQueue = prevQueue.items.filter(item => !skus.includes(item.sku));
      }
      
      console.log('🚀 QUEUE: Created', newItems.length, 'SKU/model combinations');
      const newQueue = {
        ...prevQueue,
        items: [...filteredQueue, ...newItems],
      };
      
      if (newItems.length > 0) {
        console.log('🚀 QUEUE: Triggering optimization due to queue changes');
        setTimeout(() => {
          setIsOptimizing(true);
        }, 100);
      }
      
      return newQueue;
    });
  }, [setIsOptimizing]);

  const removeSKUModelPairsFromQueue = useCallback((pairs: Array<{sku: string, modelId: string}>) => {
    console.log('🗑️ QUEUE: Removing SKU/model pairs from queue:', pairs);
    setQueue(prevQueue => {
      const newQueue = {
        ...prevQueue,
        items: prevQueue.items.filter(item => 
          !pairs.some(pair => pair.sku === item.sku && pair.modelId === item.modelId)
        ),
      };
      console.log('🗑️ QUEUE: Queue after pair removal:', newQueue.items.length, 'combinations remaining');
      return newQueue;
    });
  }, []);

  const clearQueue = useCallback(() => {
    console.log('🗑️ QUEUE: Clearing entire queue');
    setQueue({
      items: [],
      progress: {},
      isOptimizing: false,
    });
  }, []);

  const getSKUsInQueue = useCallback(() => {
    const uniqueSKUs = Array.from(new Set(queue.items.map(item => item.sku)));
    return uniqueSKUs;
  }, [queue.items]);

  const getQueuedCombinations = useCallback(() => {
    return queue.items.map(item => ({ sku: item.sku, modelId: item.modelId }));
  }, [queue.items]);

  const getModelsForSKU = useCallback((sku: string) => {
    return queue.items.filter(item => item.sku === sku).map(item => item.modelId);
  }, [queue.items]);

  const removeUnnecessarySKUs = useCallback((skusToRemove: string[]) => {
    console.log('🧹 QUEUE: Removing unnecessary SKUs:', skusToRemove);
    removeFromQueue(skusToRemove);
  }, [removeFromQueue]);

  const isQueueEmpty = queue.items.length === 0;
  const queueSize = queue.items.length;
  const uniqueSKUCount = new Set(queue.items.map(item => item.sku)).size;

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    while (queueRef.current.length > 0) {
      const job = queueRef.current.shift();
      if (!job) break;
      const { sku, modelId, type, model, skuData, businessContext, grokApiEnabled } = job;
      setStatus(sku, modelId, type, 'running');
      try {
        let result: OptimizationResult | null = null;
        if (type === 'grid') {
          const gridResult = await runGridOptimization(model, skuData, sku);
          result = {
            parameters: gridResult.parameters,
            accuracy: gridResult.accuracy,
            confidence: gridResult.confidence,
            reasoning: gridResult.reasoning,
            updatedAt: new Date().toISOString(),
          };
        } else if (type === 'ai') {
          const aiResult = await runAIOptimization(model, skuData, sku, businessContext, undefined, grokApiEnabled);
          if (aiResult) {
            result = {
              parameters: aiResult.parameters,
              accuracy: aiResult.accuracy,
              confidence: aiResult.confidence,
              reasoning: aiResult.reasoning,
              updatedAt: new Date().toISOString(),
            };
          }
        }
        if (result) {
          setResult(sku, modelId, type, result);
        } else {
          setError(sku, modelId, type, 'No result returned');
        }
      } catch (err: any) {
        setError(sku, modelId, type, err?.message || 'Unknown error');
      }
    }
    isProcessingRef.current = false;
  }, [setStatus, setResult, setError]);

  const addJobs = useCallback((jobs: OptimizationJob[]) => {
    queueRef.current.push(...jobs);
    jobs.forEach(job => setStatus(job.sku, job.modelId, job.type, 'queued'));
    processQueue();
  }, [processQueue, setStatus]);

  return {
    queue,
    addToQueue,
    removeFromQueue,
    removeSKUModelPairsFromQueue,
    clearQueue,
    getSKUsInQueue,
    getQueuedCombinations,
    getModelsForSKU,
    isQueueEmpty,
    queueSize,
    uniqueSKUCount,
    clearCacheAndPreferencesForSKU,
    removeUnnecessarySKUs,
    updateProgress,
    setIsOptimizing,
    addJobs,
    getQueue: () => queueRef.current.slice(),
    isProcessing: () => isProcessingRef.current,
  };
};
