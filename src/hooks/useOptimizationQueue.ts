
import { useState, useCallback, useEffect } from 'react';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useManualAIPreferences } from '@/hooks/useManualAIPreferences';
import { getDefaultModels, hasOptimizableParameters } from '@/utils/modelConfig';

interface OptimizationQueueItem {
  sku: string;
  modelId: string;
  reason: 'csv_upload' | 'data_cleaning' | 'csv_import';
  timestamp: number;
  skipCacheClear?: boolean;
}

export const useOptimizationQueue = () => {
  const [queue, setQueue] = useState<OptimizationQueueItem[]>([]);
  const { clearCacheForSKU } = useOptimizationCache();
  const { loadManualAIPreferences, saveManualAIPreferences } = useManualAIPreferences();

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

  const addSKUsToQueue = useCallback((skus: string[], reason: OptimizationQueueItem['reason'], skipCacheClear = false) => {
    const timestamp = Date.now();
    
    // Get all models that have optimizable parameters
    const defaultModels = getDefaultModels();
    const optimizableModels = defaultModels.filter(hasOptimizableParameters);
    
    console.log('🚀 QUEUE: Adding SKU/model pairs to queue');
    console.log('🚀 QUEUE: SKUs:', skus);
    console.log('🚀 QUEUE: Optimizable models:', optimizableModels.map(m => m.id));
    
    if (!skipCacheClear && reason !== 'csv_upload') {
      skus.forEach(sku => {
        clearCacheAndPreferencesForSKU(sku);
      });
    }
    
    setQueue(prevQueue => {
      // Remove any existing entries for these SKUs
      const filteredQueue = prevQueue.filter(item => !skus.includes(item.sku));
      
      // Create new SKU/model combinations
      const newItems: OptimizationQueueItem[] = [];
      skus.forEach(sku => {
        optimizableModels.forEach(model => {
          newItems.push({
            sku,
            modelId: model.id,
            reason,
            timestamp,
            skipCacheClear
          });
        });
      });
      
      console.log('🚀 QUEUE: Created', newItems.length, 'SKU/model combinations');
      return [...filteredQueue, ...newItems];
    });
  }, [clearCacheAndPreferencesForSKU]);

  const removeSKUsFromQueue = useCallback((skus: string[]) => {
    console.log('🗑️ QUEUE: Removing SKUs from queue:', skus);
    setQueue(prevQueue => {
      const newQueue = prevQueue.filter(item => !skus.includes(item.sku));
      console.log('🗑️ QUEUE: Queue after removal:', newQueue.length, 'combinations remaining');
      return newQueue;
    });
  }, []);

  const removeSKUModelPairsFromQueue = useCallback((pairs: Array<{sku: string, modelId: string}>) => {
    console.log('🗑️ QUEUE: Removing SKU/model pairs from queue:', pairs);
    setQueue(prevQueue => {
      const newQueue = prevQueue.filter(item => 
        !pairs.some(pair => pair.sku === item.sku && pair.modelId === item.modelId)
      );
      console.log('🗑️ QUEUE: Queue after pair removal:', newQueue.length, 'combinations remaining');
      return newQueue;
    });
  }, []);

  const clearQueue = useCallback(() => {
    console.log('🗑️ QUEUE: Clearing entire queue');
    setQueue([]);
  }, []);

  const getSKUsInQueue = useCallback(() => {
    const uniqueSKUs = Array.from(new Set(queue.map(item => item.sku)));
    return uniqueSKUs;
  }, [queue]);

  const getQueuedCombinations = useCallback(() => {
    return queue.map(item => ({ sku: item.sku, modelId: item.modelId }));
  }, [queue]);

  const getModelsForSKU = useCallback((sku: string) => {
    return queue.filter(item => item.sku === sku).map(item => item.modelId);
  }, [queue]);

  // Helper to remove SKUs that don't actually need optimization
  const removeUnnecessarySKUs = useCallback((skusToRemove: string[]) => {
    console.log('🧹 QUEUE: Removing unnecessary SKUs:', skusToRemove);
    removeSKUsFromQueue(skusToRemove);
  }, [removeSKUsFromQueue]);

  const isQueueEmpty = queue.length === 0;
  const queueSize = queue.length;
  const uniqueSKUCount = new Set(queue.map(item => item.sku)).size;

  return {
    queue,
    addSKUsToQueue,
    removeSKUsFromQueue,
    removeSKUModelPairsFromQueue,
    clearQueue,
    getSKUsInQueue,
    getQueuedCombinations,
    getModelsForSKU,
    isQueueEmpty,
    queueSize,
    uniqueSKUCount,
    clearCacheAndPreferencesForSKU,
    removeUnnecessarySKUs
  };
};
