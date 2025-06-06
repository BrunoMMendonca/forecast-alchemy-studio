
import { useState, useCallback, useEffect } from 'react';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useForecastCache } from '@/hooks/useForecastCache';
import { useManualAIPreferences } from '@/hooks/useManualAIPreferences';

interface OptimizationQueueItem {
  sku: string;
  reason: 'csv_upload' | 'data_cleaning' | 'csv_import';
  timestamp: number;
  skipCacheClear?: boolean;
}

export const useOptimizationQueue = () => {
  const [queue, setQueue] = useState<OptimizationQueueItem[]>([]);
  const { clearCacheForSKU } = useOptimizationCache();
  const { clearForecastCacheForSKU } = useForecastCache();
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
    clearForecastCacheForSKU(sku);
    
    const preferences = loadManualAIPreferences();
    const updatedPreferences = Object.keys(preferences).reduce((acc, key) => {
      if (!key.startsWith(`${sku}:`)) {
        acc[key] = preferences[key];
      }
      return acc;
    }, {} as Record<string, any>);
    
    saveManualAIPreferences(updatedPreferences);
  }, [clearCacheForSKU, clearForecastCacheForSKU, loadManualAIPreferences, saveManualAIPreferences]);

  const addSKUsToQueue = useCallback((skus: string[], reason: OptimizationQueueItem['reason'], skipCacheClear = false) => {
    const timestamp = Date.now();
    
    if (!skipCacheClear && reason !== 'csv_upload') {
      skus.forEach(sku => {
        clearCacheAndPreferencesForSKU(sku);
      });
    }
    
    setQueue(prevQueue => {
      const filteredQueue = prevQueue.filter(item => !skus.includes(item.sku));
      
      const newItems = skus.map(sku => ({
        sku,
        reason,
        timestamp,
        skipCacheClear
      }));
      
      return [...filteredQueue, ...newItems];
    });
  }, [clearCacheAndPreferencesForSKU]);

  const removeSKUsFromQueue = useCallback((skus: string[]) => {
    console.log('🗄️ QUEUE: Removing SKUs from queue:', skus);
    setQueue(prevQueue => {
      const newQueue = prevQueue.filter(item => !skus.includes(item.sku));
      console.log('🗄️ QUEUE: Queue after removal:', newQueue.map(item => item.sku));
      return newQueue;
    });
  }, []);

  const removeUnnecessarySKUs = useCallback((skus: string[]) => {
    console.log('🗄️ QUEUE: Removing unnecessary SKUs from queue:', skus);
    removeSKUsFromQueue(skus);
  }, [removeSKUsFromQueue]);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const getSKUsInQueue = useCallback(() => {
    return queue.map(item => item.sku);
  }, [queue]);

  const isQueueEmpty = queue.length === 0;
  const queueSize = queue.length;

  return {
    queue,
    addSKUsToQueue,
    removeSKUsFromQueue,
    removeUnnecessarySKUs,
    clearQueue,
    getSKUsInQueue,
    isQueueEmpty,
    queueSize,
    clearCacheAndPreferencesForSKU
  };
};
