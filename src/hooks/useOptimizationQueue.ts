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
import { useUnifiedState } from '@/hooks/useUnifiedState';
import { useOptimizationCacheContext } from '@/context/OptimizationCacheContext';
import { generateDataHash } from '@/utils/cacheUtils';
import { useGlobalForecastSettings } from '@/hooks/useGlobalForecastSettings';

interface OptimizationJob {
  sku: string;
  modelId: string;
  type: OptimizationType;
  model: ModelConfig;
  skuData: SalesData[];
  businessContext?: BusinessContext;
  aiForecastModelOptimizationEnabled?: boolean;
}

export const useOptimizationQueue = (cleanedData: SalesData[], salesData: SalesData[], aiEnabled: boolean, aiForecastModelOptimizationEnabled: boolean) => {
  const { toast } = useToast();
  const { 
    optimizationQueue: queue,
    setOptimizationQueue,
    setOptimizationProgress,
    setIsOptimizing: setGlobalIsOptimizing
  } = useUnifiedState();
  
  const isProcessingRef = useRef(false);
  const currentBatchRef = useRef<Set<string>>(new Set());
  const {
    setStatus,
    setResult,
    setError,
  } = useOptimizationStore();
  const { setCachedParameters, setSelectedMethod, cache } = useOptimizationCacheContext();
  const unifiedState = useUnifiedState();
  const models = unifiedState.models.length > 0 ? unifiedState.models : getDefaultModels();
  const { aiFailureThreshold, setaiForecastModelOptimizationEnabled } = useGlobalForecastSettings();
  const [aiFailureCount, setAiFailureCount] = useState(() => {
    const saved = localStorage.getItem('aiFailureCount');
    return saved ? parseInt(saved, 10) : 0;
  });
  const effectiveCleanedData = cleanedData.length > 0 ? cleanedData : salesData;

  // Save failure count to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('aiFailureCount', aiFailureCount.toString());
  }, [aiFailureCount]);

  // Reset failure count when AI is manually enabled (only if nonzero)
  useEffect(() => {
    if (aiForecastModelOptimizationEnabled && aiFailureCount !== 0) {
      setAiFailureCount(0);
    }
  }, [aiForecastModelOptimizationEnabled]);

  // Remove AI jobs when either AI Features or AI Model Optimization is disabled
  useEffect(() => {
    console.log('[AI JOB REMOVAL EFFECT] Effect running. aiEnabled:', aiEnabled, 'aiForecastModelOptimizationEnabled:', aiForecastModelOptimizationEnabled);
    
    // Only proceed if AI is disabled and there are AI jobs to remove
    if ((!aiEnabled || !aiForecastModelOptimizationEnabled) && queue.items.some(item => item.method === 'ai')) {
      console.log('[AI JOB REMOVAL EFFECT] Removing AI jobs from queue. Queue before:', queue.items.map(i => `${i.sku}:${i.modelId}:${i.method}`));
      setOptimizationQueue(prev => {
        const newItems = prev.items.filter(item => item.method !== 'ai');
        console.log('[AI JOB REMOVAL EFFECT] Queue after AI job removal:', newItems.map(i => `${i.sku}:${i.modelId}:${i.method}`));
        return {
          ...prev,
          items: newItems
        };
      });
    }
  }, [aiEnabled, aiForecastModelOptimizationEnabled, setOptimizationQueue]);

  const addToQueue = useCallback((items: OptimizationQueueItem[]) => {
    setOptimizationQueue(prev => {
      // Only add items with both SKU and modelId present
      const newItems = items.filter(item => item.sku && item.modelId);

      // Defensive: Remove AI jobs if either switch is off
      const filteredItems = newItems.filter(item => {
        if (item.method === 'ai' && (!aiEnabled || !aiForecastModelOptimizationEnabled)) {
          return false;
        }
        return true;
      });

      const aiJobs = filteredItems.filter(item => item.method === 'ai').length;
      const gridJobs = filteredItems.filter(item => item.method === 'grid').length;
      if (filteredItems.length > 0) {
        console.log(`[QUEUE] Adding jobs: total=${filteredItems.length}, ai=${aiJobs}, grid=${gridJobs}`);
        console.log(`[QUEUE] Current queue size before update: ${prev.items.length}`);
      }

      const updatedQueue = {
        ...prev,
        items: [...prev.items, ...filteredItems],
      };

      if (filteredItems.length > 0) {
        console.log(`[QUEUE] Current queue size after update: ${updatedQueue.items.length}`);
        console.log('[QUEUE] Queue contents after add:', updatedQueue.items.map(i => `${i.sku}:${i.modelId}:${i.method}`));
      }

      return updatedQueue;
    });
  }, [aiEnabled, aiForecastModelOptimizationEnabled, setOptimizationQueue]);

  const removeFromQueue = useCallback((skus: string[]) => {
    setOptimizationQueue(prev => {
      const newItems = prev.items.filter(item => !skus.includes(item.sku));
      const newProgress = Object.fromEntries(
        Object.entries(prev.progress).filter(([sku]) => !skus.includes(sku))
      ) as Record<string, number>;
      console.log(`[QUEUE] Removing SKUs: ${skus.join(', ')}`);
      console.log(`[QUEUE] Queue size before remove: ${prev.items.length}`);
      console.log('[QUEUE] Queue contents before remove:', prev.items.map(i => `${i.sku}:${i.modelId}:${i.method}`));
      console.log(`[QUEUE] Queue size after remove: ${newItems.length}`);
      console.log('[QUEUE] Queue contents after remove:', newItems.map(i => `${i.sku}:${i.modelId}:${i.method}`));
      return {
        ...prev,
        items: newItems,
        progress: newProgress,
      };
    });
  }, [setOptimizationQueue]);

  const updateProgress = useCallback((progress: OptimizationProgress) => {
    setOptimizationProgress(progress.sku, progress.progress);
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
  }, [toast, setOptimizationProgress]);

  const setIsOptimizing = useCallback((isOptimizing: boolean) => {
    setGlobalIsOptimizing(isOptimizing);
  }, [setGlobalIsOptimizing]);

  const setPaused = useCallback((paused: boolean) => {
    setOptimizationQueue(prev => ({ ...prev, paused }));
  }, [setOptimizationQueue]);

  const isQueueEmpty = queue.items.length === 0;
  const queueSize = queue.items.length;
  const uniqueSKUCount = new Set(queue.items.map(item => item.sku)).size;

  // The main processing loop, now works directly from queue.items
  const processQueue = useCallback(async () => {
    if (!effectiveCleanedData || effectiveCleanedData.length === 0) return;
    if (queue.paused) return;
    if (isProcessingRef.current) return;
    if (queue.items.length === 0) return;

    // Create a unique identifier for this batch of items
    const batchId = queue.items.map(item => `${item.sku}:${item.modelId}:${item.method}`).join(',');
    
    // If we've already processed this batch, skip it
    if (currentBatchRef.current.has(batchId)) {
      console.log('[QUEUE] Skipping already processed batch');
      return;
    }

    console.log(`[QUEUE] Processing started. Jobs in queue: ${queue.items.length}`);
    isProcessingRef.current = true;
    currentBatchRef.current.add(batchId);
    setIsOptimizing(true);

    try {
      // Create a local copy of the queue items
      let remainingItems = [...queue.items];
      
      while (remainingItems.length > 0) {
        if (queue.paused) break;
        const nextItem = remainingItems[0];
        const { sku, modelId, reason, method } = nextItem;
        console.log(`[QUEUE] Processing job: SKU=${sku}, Model=${modelId}, Reason=${reason}, Method=${method}`);
        const model = models.find(m => m.id === modelId);
        const skuData = effectiveCleanedData.filter(d => String(d['Material Code']) === String(sku));
        const optimizationType: OptimizationType = method;

        // Skip AI jobs if AI is disabled or failure threshold reached
        if (optimizationType === 'ai' && (!aiForecastModelOptimizationEnabled || aiFailureCount >= aiFailureThreshold)) {
          console.log(`⚠️ Skipping AI optimization for SKU: ${sku} because AI is disabled or threshold reached`);
          remainingItems = remainingItems.slice(1);
          setOptimizationQueue(prev => ({ ...prev, items: remainingItems }));
          continue;
        }

        if (!model || skuData.length === 0) {
          console.log(`❌ QUEUE: Model or data not found for SKU: ${sku}`);
          setError(sku, modelId, optimizationType, 'Model or data not found');
          remainingItems = remainingItems.slice(1);
          setOptimizationQueue(prev => ({ ...prev, items: remainingItems }));
          continue;
        }

        setStatus(sku, modelId, optimizationType, 'running');
        
        try {
          let result;
          if (optimizationType === 'ai') {
            console.log(`🤖 QUEUE: Running AI optimization for SKU: ${sku}`);
            result = await runAIOptimization(model, skuData, sku, unifiedState.businessContext, undefined, aiForecastModelOptimizationEnabled);
            if (!result) {
              // AI failed, increment failure count
              setAiFailureCount(count => {
                const newCount = count + 1;
                console.log(`❌ AI: Failure count increased to ${newCount}/${aiFailureThreshold}`);
                if (newCount >= aiFailureThreshold) {
                  console.log(`❌ AI: Threshold reached (${aiFailureThreshold}), disabling AI optimization and removing all AI jobs`);
                  setaiForecastModelOptimizationEnabled(false);
                  remainingItems = remainingItems.filter(item => item.method !== 'ai');
                  setOptimizationQueue(prev => ({
                    ...prev,
                    items: remainingItems
                  }));
                  toast({
                    title: "AI Optimization Disabled",
                    description: `AI optimization was automatically disabled after ${aiFailureThreshold} consecutive failures.`,
                    variant: "destructive"
                  });
                }
                return newCount;
              });
              // Fallback to cached grid result if available
              const gridCache = cache[sku]?.[modelId]?.grid;
              if (gridCache) {
                toast({
                  title: "AI Optimization Failed",
                  description: `Using cached Grid Search result for SKU: ${sku}, Model: ${model.name}.`,
                  variant: "destructive"
                });
                result = gridCache;
              } else {
                // Only run grid if not already cached (should be rare)
                toast({
                  title: "AI Optimization Failed",
                  description: `No cached Grid result found. Running Grid Search for SKU: ${sku}, Model: ${model.name}.`,
                  variant: "destructive"
                });
                result = await runGridOptimization(model, skuData, sku);
              }
              // After threshold, break out of the loop to prevent further increments
              if (aiFailureCount + 1 >= aiFailureThreshold) {
                break;
              }
            } else {
              // AI succeeded, reset failure count
              setAiFailureCount(0);
            }
          } else {
            // Run grid optimization and cache results (no verbose logs)
            result = await runGridOptimization(model, skuData, sku);
            const dataHash = generateDataHash(skuData);
            setCachedParameters(
              sku,
              modelId,
              result.parameters,
              dataHash,
              result.confidence,
              result.reasoning,
              result.factors,
              result.expectedAccuracy,
              result.method
            );
            if (result.method === 'grid') {
              setCachedParameters(
                sku,
                modelId,
                result.parameters,
                dataHash,
                70, // Default confidence for manual
                'Manual parameters reset to Grid after optimization',
                result.factors,
                result.expectedAccuracy,
                'manual'
              );
              // Check if AI is available and valid
              const aiCache = cache[sku]?.[modelId]?.ai;
              const aiValid = aiCache && aiCache.dataHash === dataHash;
              if (aiValid) {
                setCachedParameters(
                  sku,
                  modelId,
                  aiCache.parameters,
                  dataHash,
                  aiCache.confidence,
                  aiCache.reasoning,
                  aiCache.factors,
                  aiCache.expectedAccuracy,
                  'ai'
                );
                setSelectedMethod(sku, modelId, 'ai');
              } else {
                setSelectedMethod(sku, modelId, 'grid');
              }
            }
          }

          if (model && model.name) {
            console.log(`✅ QUEUE: Optimization completed for SKU: ${sku}, Model: ${model.name}`);
          } else {
            console.log(`✅ QUEUE: Optimization completed for SKU: ${sku}, Model: ${modelId}`);
          }
          setResult(sku, modelId, optimizationType, {
            parameters: result.parameters,
            accuracy: result.accuracy,
            confidence: result.confidence,
            reasoning: result.reasoning,
            updatedAt: new Date().toISOString(),
          });
        } catch (error) {
          if (method === 'ai') {
            let shouldBreak = false;
            setAiFailureCount(prev => {
              const newCount = prev + 1;
              if (newCount >= aiFailureThreshold) {
                setaiForecastModelOptimizationEnabled(false);
                remainingItems = remainingItems.filter(item => item.method !== 'ai');
                setOptimizationQueue(prevQueue => ({
                  ...prevQueue,
                  items: remainingItems
                }));
                toast({
                  title: 'AI Optimization Disabled',
                  description: `AI optimization has been disabled after ${aiFailureThreshold} consecutive failures. Please check your API key or account.`,
                  variant: 'destructive',
                });
                shouldBreak = true;
              }
              return newCount;
            });
            if (shouldBreak) {
              break;
            }
          }
          console.error(`[QUEUE] Error processing job: SKU=${sku}, Model=${modelId}, Reason=${reason}, Method=${method}`, error);
          setError(sku, modelId, optimizationType, error?.message || 'Unknown error');
        }

        // Remove the processed item and update the global queue state
        remainingItems = remainingItems.slice(1);
        setOptimizationQueue(prev => {
          console.log(`[QUEUE] Removing processed job. Queue size before: ${prev.items.length}`);
          console.log('[QUEUE] Queue contents before remove:', prev.items.map(i => `${i.sku}:${i.modelId}:${i.method}`));
          console.log(`[QUEUE] Queue size after remove: ${remainingItems.length}`);
          console.log('[QUEUE] Queue contents after remove:', remainingItems.map(i => `${i.sku}:${i.modelId}:${i.method}`));
          return { ...prev, items: remainingItems };
        });
      }
    } finally {
      isProcessingRef.current = false;
      setIsOptimizing(false);
      console.log('[QUEUE] Processing ended.');
    }
  }, [effectiveCleanedData, queue.paused, queue.items, models, aiForecastModelOptimizationEnabled, aiFailureCount, aiFailureThreshold, unifiedState.businessContext, setOptimizationQueue, setStatus, setResult, setError, setAiFailureCount, setaiForecastModelOptimizationEnabled, toast]);

  // Keep only one useEffect for queue state logging and auto-starting
  useEffect(() => {
    if (
      queue.items.length > 0 &&
      !queue.isOptimizing &&
      !queue.paused &&
      !isProcessingRef.current &&
      effectiveCleanedData.length > 0
    ) {
      processQueue();
    }
  }, [queue.items.length, queue.isOptimizing, queue.paused, processQueue, effectiveCleanedData]);

  // Clear the current batch ref when the queue is empty
  useEffect(() => {
    if (queue.items.length === 0) {
      currentBatchRef.current.clear();
    }
  }, [queue.items.length]);

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
    removeFromQueue(skusToRemove);
  }, [removeFromQueue]);

  const clearQueue = useCallback(() => {
    console.log('🗑️ QUEUE: Clearing entire queue');
    setOptimizationQueue(prev => {
      console.log(`[QUEUE] Queue size before clear: ${prev.items.length}`);
      console.log('[QUEUE] Queue contents before clear:', prev.items.map(i => `${i.sku}:${i.modelId}:${i.method}`));
      return {
        ...prev,
        items: [],
        progress: {},
        isOptimizing: false,
        paused: false,
      };
    });
    console.log('[QUEUE] Queue cleared.');
  }, [setOptimizationQueue]);

  // Add a function to remove AI jobs
  const removeAIJobs = useCallback(() => {
    setOptimizationQueue(prev => {
      const newItems = prev.items.filter(item => item.method !== 'ai');
      console.log(`[QUEUE] Removing all AI jobs. Queue size before: ${prev.items.length}`);
      console.log('[QUEUE] Queue contents before AI remove:', prev.items.map(i => `${i.sku}:${i.modelId}:${i.method}`));
      console.log(`[QUEUE] Queue size after AI remove: ${newItems.length}`);
      console.log('[QUEUE] Queue contents after AI remove:', newItems.map(i => `${i.sku}:${i.modelId}:${i.method}`));
      return {
        ...prev,
        items: newItems
      };
    });
  }, [setOptimizationQueue]);

  // Add an effect to remove AI jobs when AI is disabled
  useEffect(() => {
    if (!aiForecastModelOptimizationEnabled) {
      console.log('🔄 AI: Disabled, removing AI jobs from queue');
      removeAIJobs();
    }
  }, [aiForecastModelOptimizationEnabled, removeAIJobs]);

  return {
    queue,
    addToQueue,
    removeFromQueue,
    updateProgress,
    setIsOptimizing,
    setPaused,
    processQueue,
    getSKUsInQueue,
    getQueuedCombinations,
    getModelsForSKU,
    removeUnnecessarySKUs,
    clearQueue,
    isQueueEmpty,
    queueSize,
    uniqueSKUCount,
  };
};
