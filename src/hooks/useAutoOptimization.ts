import { useRef, useEffect } from 'react';

interface UseAutoOptimizationProps {
  optimizationQueue?: {
    queueSize: number;
    items: any[];
  };
  isOptimizing: boolean;
  handleQueueOptimization: () => void;
  onOptimizationStarted?: () => void;
  aiForecastModelOptimizationEnabled: boolean;
  componentMountedRef: React.MutableRefObject<boolean>;
}

export const useAutoOptimization = ({
  optimizationQueue,
  isOptimizing,
  handleQueueOptimization,
  onOptimizationStarted,
  aiForecastModelOptimizationEnabled,
  componentMountedRef
}: UseAutoOptimizationProps) => {
  const lastProcessedQueueSizeRef = useRef(0);

  // AUTO-START OPTIMIZATION: React to queue changes with stable detection
  useEffect(() => {
    console.log('🔄 FORECAST_MODELS: Checking auto-start conditions');
    console.log('🔄 FORECAST_MODELS: - Queue:', optimizationQueue);
    console.log('🔄 FORECAST_MODELS: - Component mounted:', componentMountedRef.current);
    console.log('🔄 FORECAST_MODELS: - Is optimizing:', isOptimizing);
    console.log('🔄 FORECAST_MODELS: - Last processed size:', lastProcessedQueueSizeRef.current);

    if (!optimizationQueue || !componentMountedRef.current) {
      console.log('🔄 FORECAST_MODELS: Skipping auto-start - no queue or not mounted');
      return;
    }

    const currentQueueSize = optimizationQueue.items?.length || 0;
    
    // Only process if queue size actually changed and increased
    if (currentQueueSize <= lastProcessedQueueSizeRef.current) {
      console.log('🔄 FORECAST_MODELS: Queue size unchanged or decreased, skipping');
      return;
    }
    
    lastProcessedQueueSizeRef.current = currentQueueSize;
    
    console.log('🔄 FORECAST_MODELS: Queue size increased to:', currentQueueSize, 'isOptimizing:', isOptimizing);

    // Auto-start optimization if:
    // 1. Queue has items
    // 2. Not currently optimizing 
    // 3. Component is mounted
    if (currentQueueSize > 0 && !isOptimizing) {
      console.log('🚀 FORECAST_MODELS: CONDITIONS MET - Auto-starting optimization');
      console.log('🚀 FORECAST_MODELS: - Queue size:', currentQueueSize);
      console.log('🚀 FORECAST_MODELS: - Is optimizing:', isOptimizing);
      console.log('🚀 FORECAST_MODELS: - Component mounted:', componentMountedRef.current);
      console.log('🚀 FORECAST_MODELS: - Grok API enabled:', aiForecastModelOptimizationEnabled);
      
      // Use timeout to avoid potential race conditions
      setTimeout(() => {
        if (componentMountedRef.current && !isOptimizing) {
          console.log('🚀 FORECAST_MODELS: EXECUTING handleQueueOptimization');
          handleQueueOptimization();
          if (onOptimizationStarted) {
            onOptimizationStarted();
          }
        } else {
          console.log('🔄 FORECAST_MODELS: Conditions changed during timeout - skipping');
          console.log('🔄 FORECAST_MODELS: - Component mounted:', componentMountedRef.current);
          console.log('🔄 FORECAST_MODELS: - Is optimizing:', isOptimizing);
        }
      }, 100);
    } else {
      console.log('🔄 FORECAST_MODELS: NOT starting optimization:');
      console.log('🔄 FORECAST_MODELS: - Queue size > 0:', currentQueueSize > 0);
      console.log('🔄 FORECAST_MODELS: - Not optimizing:', !isOptimizing);
      console.log('🔄 FORECAST_MODELS: - Component mounted:', componentMountedRef.current);
    }
  }, [optimizationQueue?.items, isOptimizing, handleQueueOptimization, onOptimizationStarted, aiForecastModelOptimizationEnabled]);

  // Reset processed queue size when optimization completes
  useEffect(() => {
    if (!isOptimizing) {
      console.log('🔄 FORECAST_MODELS: Optimization completed, resetting last processed size');
      // Reset after optimization completes to allow new auto-starts
      setTimeout(() => {
        lastProcessedQueueSizeRef.current = optimizationQueue?.items?.length || 0;
        console.log('🔄 FORECAST_MODELS: Reset last processed size to:', lastProcessedQueueSizeRef.current);
      }, 1000);
    }
  }, [isOptimizing, optimizationQueue?.items]);

  return {
    lastProcessedQueueSizeRef
  };
};
