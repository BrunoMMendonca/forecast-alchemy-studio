
import { useRef, useEffect } from 'react';

interface UseAutoOptimizationProps {
  optimizationQueue?: {
    queueSize: number;
  };
  isOptimizing: boolean;
  handleQueueOptimization: () => void;
  onOptimizationStarted?: () => void;
  grokApiEnabled: boolean;
  componentMountedRef: React.MutableRefObject<boolean>;
}

export const useAutoOptimization = ({
  optimizationQueue,
  isOptimizing,
  handleQueueOptimization,
  onOptimizationStarted,
  grokApiEnabled,
  componentMountedRef
}: UseAutoOptimizationProps) => {
  const lastProcessedQueueSizeRef = useRef(0);

  // AUTO-START OPTIMIZATION: React to queue changes with stable detection
  useEffect(() => {
    if (!optimizationQueue || !componentMountedRef.current) {
      console.log('🔄 FORECAST_MODELS: Skipping auto-start - no queue or not mounted');
      return;
    }

    const currentQueueSize = optimizationQueue.queueSize;
    
    // Don't process if queue is empty
    if (currentQueueSize === 0) {
      console.log('🔄 FORECAST_MODELS: Skipping auto-start - queue is empty');
      return;
    }
    
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
    if (!isOptimizing) {
      console.log('🚀 FORECAST_MODELS: CONDITIONS MET - Auto-starting optimization');
      console.log('🚀 FORECAST_MODELS: - Queue size:', currentQueueSize);
      console.log('🚀 FORECAST_MODELS: - Is optimizing:', isOptimizing);
      console.log('🚀 FORECAST_MODELS: - Component mounted:', componentMountedRef.current);
      console.log('🚀 FORECAST_MODELS: - Grok API enabled:', grokApiEnabled);
      
      // Use timeout to avoid potential race conditions
      setTimeout(() => {
        if (componentMountedRef.current && !isOptimizing && optimizationQueue.queueSize > 0) {
          console.log('🚀 FORECAST_MODELS: EXECUTING handleQueueOptimization');
          handleQueueOptimization();
          if (onOptimizationStarted) {
            onOptimizationStarted();
          }
        } else {
          console.log('🔄 FORECAST_MODELS: Skipping execution - conditions changed');
        }
      }, 100);
    } else {
      console.log('🔄 FORECAST_MODELS: NOT starting optimization - already optimizing');
    }
  }, [optimizationQueue?.queueSize, isOptimizing, handleQueueOptimization, onOptimizationStarted, grokApiEnabled]);

  // Reset processed queue size when optimization completes
  useEffect(() => {
    if (!isOptimizing) {
      // Reset after optimization completes to allow new auto-starts
      setTimeout(() => {
        lastProcessedQueueSizeRef.current = optimizationQueue?.queueSize || 0;
      }, 1000);
    }
  }, [isOptimizing, optimizationQueue?.queueSize]);

  return {
    lastProcessedQueueSizeRef
  };
};
