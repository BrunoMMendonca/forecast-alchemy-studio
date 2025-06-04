
import { useState, useCallback, useEffect } from 'react';

interface OptimizationQueueItem {
  sku: string;
  reason: 'csv_upload' | 'data_cleaning' | 'csv_import';
  timestamp: number;
}

export const useOptimizationQueue = () => {
  const [queue, setQueue] = useState<OptimizationQueueItem[]>([]);

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

  const addSKUsToQueue = useCallback((skus: string[], reason: OptimizationQueueItem['reason']) => {
    const timestamp = Date.now();
    setQueue(prevQueue => {
      // Remove existing entries for these SKUs to avoid duplicates
      const filteredQueue = prevQueue.filter(item => !skus.includes(item.sku));
      
      // Add new entries
      const newItems = skus.map(sku => ({
        sku,
        reason,
        timestamp
      }));
      
      const newQueue = [...filteredQueue, ...newItems];
      console.log(`📋 QUEUE: Added ${skus.length} SKUs to optimization queue (reason: ${reason})`, skus);
      console.log(`📋 QUEUE: Total SKUs in queue: ${newQueue.length}`);
      
      return newQueue;
    });
  }, []);

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
    queueSize
  };
};
