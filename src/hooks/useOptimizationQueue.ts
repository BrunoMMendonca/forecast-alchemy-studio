
import { useState, useCallback, useEffect } from 'react';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useForecastCache } from '@/hooks/useForecastCache';
import { useManualAIPreferences } from '@/hooks/useManualAIPreferences';

interface OptimizationQueueItem {
  sku: string;
  reason: 'csv_upload' | 'data_cleaning' | 'csv_import';
  timestamp: number;
  skipCacheClear?: boolean; // Flag to skip cache clearing if already done
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
        console.error('Failed to parse optimization queue from localStorage:', error);
      }
    }
  }, []);

  // Save queue to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('optimizationQueue', JSON.stringify(queue));
  }, [queue]);

  const clearCacheAndPreferencesForSKU = useCallback((sku: string) => {
    console.log(`🗑️ CLEAR: Clearing cache and preferences for SKU ${sku}`);
    
    // Clear optimization cache
    clearCacheForSKU(sku);
    
    // Clear forecast cache
    clearForecastCacheForSKU(sku);
    
    // Clear preferences for this SKU
    const preferences = loadManualAIPreferences();
    const updatedPreferences = Object.keys(preferences).reduce((acc, key) => {
      if (!key.startsWith(`${sku}:`)) {
        acc[key] = preferences[key];
      }
      return acc;
    }, {} as Record<string, any>);
    
    saveManualAIPreferences(updatedPreferences);
    console.log(`🗑️ CLEAR: Cleared preferences for SKU ${sku}`);
  }, [clearCacheForSKU, clearForecastCacheForSKU, loadManualAIPreferences, saveManualAIPreferences]);

  const addSKUsToQueue = useCallback((skus: string[], reason: OptimizationQueueItem['reason'], skipCacheClear = false) => {
    const timestamp = Date.now();
    
    // Only clear cache if not already cleared (avoid double clearing for CSV uploads)
    if (!skipCacheClear && reason !== 'csv_upload') {
      console.log(`🗑️ QUEUE: Clearing cache for ${skus.length} SKUs (reason: ${reason})`);
      skus.forEach(sku => {
        clearCacheAndPreferencesForSKU(sku);
      });
    } else if (reason === 'csv_upload') {
      console.log(`📋 QUEUE: Skipping cache clear for CSV upload - cache already cleared during upload`);
    }
    
    setQueue(prevQueue => {
      // Remove existing entries for these SKUs to avoid duplicates
      const filteredQueue = prevQueue.filter(item => !skus.includes(item.sku));
      
      // Add new entries
      const newItems = skus.map(sku => ({
        sku,
        reason,
        timestamp,
        skipCacheClear
      }));
      
      const newQueue = [...filteredQueue, ...newItems];
      console.log(`📋 QUEUE: Added ${skus.length} SKUs to optimization queue (reason: ${reason})`, skus);
      console.log(`📋 QUEUE: Total SKUs in queue: ${newQueue.length}`);
      
      return newQueue;
    });
  }, [clearCacheAndPreferencesForSKU]);

  const removeSKUsFromQueue = useCallback((skus: string[]) => {
    setQueue(prevQueue => {
      const newQueue = prevQueue.filter(item => !skus.includes(item.sku));
      console.log(`📋 QUEUE: Removed ${skus.length} SKUs from optimization queue`, skus);
      console.log(`📋 QUEUE: Remaining SKUs in queue: ${newQueue.length}`);
      return newQueue;
    });
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    console.log('📋 QUEUE: Cleared optimization queue');
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
    clearQueue,
    getSKUsInQueue,
    isQueueEmpty,
    queueSize,
    clearCacheAndPreferencesForSKU
  };
};
