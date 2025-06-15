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
    paused: false,
  });
  const { clearCacheForSKU } = useOptimizationCache();
  const { loadManualAIPreferences, saveManualAIPreferences } = useManualAIPreferences();
  const isProcessingRef = useRef(false);
  const {
    setStatus,
    setResult,
    setError,
  } = useOptimizationStore();
  const { setCachedParameters, setSelectedMethod, cache } = useOptimizationCacheContext();
  const unifiedState = useUnifiedState();
  const models = unifiedState.models.length > 0 ? unifiedState.models : getDefaultModels();
  const cleanedData = unifiedState.cleanedData;
  const grokApiEnabled = unifiedState.grokApiEnabled;

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
    setQueue(prev => {
      // Only add items with both SKU and modelId present
      const newItems = items.filter(item => item.sku && item.modelId);
      return {
        ...prev,
        items: [...prev.items, ...newItems],
      };
    });
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

  const setPaused = useCallback((paused: boolean) => {
    setQueue(prev => ({ ...prev, paused }));
  }, []);

  const isQueueEmpty = queue.items.length === 0;
  const queueSize = queue.items.length;
  const uniqueSKUCount = new Set(queue.items.map(item => item.sku)).size;

  // The main processing loop, now works directly from queue.items
  const processQueue = useCallback(async () => {
    if (queue.paused) {
      console.log('⏸️ QUEUE: Not starting processing because queue is paused');
      return;
    }
    console.log('🔄 QUEUE: Checking if can process - isProcessing:', isProcessingRef.current, 'isOptimizing:', queue.isOptimizing, 'queueSize:', queue.items.length);
    
    if (isProcessingRef.current) {
      console.log('🔄 QUEUE: Already processing, skipping');
      return;
    }
    
    if (queue.items.length === 0) {
      console.log('🔄 QUEUE: No items to process');
      return;
    }
    
    console.log('🚀 QUEUE: Starting queue processing');
    isProcessingRef.current = true;
    setQueue(prev => ({ ...prev, isOptimizing: true }));

    try {
      // Get a local copy of the queue items
      let localQueueItems = [...queue.items];
      
      while (localQueueItems.length > 0) {
        // Stop processing if paused
        if (queue.paused) {
          console.log('⏸️ QUEUE: Paused during processing, breaking out of loop');
          break;
        }
        const nextItem = localQueueItems[0];
        const { sku, modelId, reason, method } = nextItem;
        console.log(`🔄 QUEUE: Processing item - SKU: ${sku}, Model: ${modelId}, Reason: ${reason}, Method: ${method}`);

        const model = models.find(m => m.id === modelId);
        const skuData = cleanedData.filter(d => String(d['Material Code']) === String(sku));
        console.log('[QUEUE DEBUG] Processing job:', { sku, modelId, reason, method });
        console.log('[QUEUE DEBUG] Available models:', models.map(m => m.id));
        console.log('[QUEUE DEBUG] cleanedData SKUs:', cleanedData.map(d => d['Material Code']));
        if (!model) {
          console.log(`[QUEUE DEBUG] Model not found for modelId: ${modelId}`);
        }
        if (skuData.length === 0) {
          console.log(`[QUEUE DEBUG] No cleanedData found for SKU: ${sku}`);
        }
        const optimizationType: OptimizationType = method;

        if (!model || skuData.length === 0) {
          console.log(`❌ QUEUE: Model or data not found for SKU: ${sku}`);
          setError(sku, modelId, optimizationType, 'Model or data not found');
          setQueue(prev => ({ ...prev, items: prev.items.slice(1) }));
          localQueueItems = localQueueItems.slice(1);
          continue;
        }

        setStatus(sku, modelId, optimizationType, 'running');
        
        try {
          let result;
          if (optimizationType === 'ai') {
            console.log(`🤖 QUEUE: Running AI optimization for SKU: ${sku}`);
            result = await runAIOptimization(model, skuData, sku, unifiedState.businessContext, undefined, grokApiEnabled);
          } else {
            console.log(`🔍 QUEUE: Running grid optimization for SKU: ${sku}`);
            result = await runGridOptimization(model, skuData, sku);
            console.log('[QUEUE CACHE] Grid optimization result for', sku, modelId, ':', result);
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
            console.log('[QUEUE CACHE] Called setCachedParameters for', sku, modelId, 'with:', result.parameters);
            if (result.method === 'grid') {
              console.log('[QUEUE CACHE] Copying Grid parameters to Manual for', sku, modelId, result.parameters);
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

          console.log(`✅ QUEUE: Optimization completed for SKU: ${sku}`);
          setResult(sku, modelId, optimizationType, {
            parameters: result.parameters,
            accuracy: result.accuracy,
            confidence: result.confidence,
            reasoning: result.reasoning,
            updatedAt: new Date().toISOString(),
          });
        } catch (err: any) {
          console.error(`❌ QUEUE: Optimization failed for SKU: ${sku}`, err);
          setError(sku, modelId, optimizationType, err?.message || 'Unknown error');
        }

        // Remove the processed item and update both local and global queue state
        setQueue(prev => {
          const newItems = prev.items.slice(1);
          console.log(`🔄 QUEUE: Removed processed item, remaining items: ${newItems.length}`);
          return { ...prev, items: newItems };
        });
        localQueueItems = localQueueItems.slice(1);
      }
    } finally {
      console.log('🏁 QUEUE: Processing complete');
      setQueue(prev => ({ ...prev, isOptimizing: false }));
      isProcessingRef.current = false;
    }
  }, [setStatus, setResult, setError, models, cleanedData, grokApiEnabled, unifiedState.businessContext, queue]);

  // Auto-start processing when queue is not empty, not already optimizing, not paused
  useEffect(() => {
    if (queue.items.length > 0 && !queue.isOptimizing && !queue.paused && !isProcessingRef.current) {
      processQueue();
    }
  }, [queue.items.length, queue.isOptimizing, queue.paused, processQueue]);

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

  const clearQueue = useCallback(() => {
    console.log('🗑️ QUEUE: Clearing entire queue');
    setQueue({
      items: [],
      progress: {},
      isOptimizing: false,
      paused: false,
    });
  }, []);

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
    clearCacheAndPreferencesForSKU,
  };
};
