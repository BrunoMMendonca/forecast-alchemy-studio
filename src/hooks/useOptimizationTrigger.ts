
import { useEffect, useRef } from 'react';

interface UseOptimizationTriggerProps {
  shouldStartOptimization: boolean;
  isOptimizing: boolean;
  handleQueueOptimization: () => void;
  onOptimizationStarted?: () => void;
  componentMountedRef: React.MutableRefObject<boolean>;
  queueSize?: number; // Add queue size to check if there's anything to process
}

export const useOptimizationTrigger = ({
  shouldStartOptimization,
  isOptimizing,
  handleQueueOptimization,
  onOptimizationStarted,
  componentMountedRef,
  queueSize = 0
}: UseOptimizationTriggerProps) => {
  const hasTriggeredOptimizationRef = useRef(false);

  useEffect(() => {
    // Only trigger if:
    // 1. Should start optimization
    // 2. Not currently optimizing
    // 3. Haven't triggered before
    // 4. Component is mounted
    // 5. Queue actually has items to process
    if (shouldStartOptimization && 
        !isOptimizing && 
        !hasTriggeredOptimizationRef.current && 
        componentMountedRef.current &&
        queueSize > 0) {
      
      console.log('🚀 OPTIMIZATION_TRIGGER: Starting optimization with queue size:', queueSize);
      hasTriggeredOptimizationRef.current = true;
      handleQueueOptimization();
      
      if (onOptimizationStarted) {
        onOptimizationStarted();
      }
    } else if (shouldStartOptimization && queueSize === 0) {
      console.log('🔄 OPTIMIZATION_TRIGGER: Skipping - queue is empty');
    }
  }, [shouldStartOptimization, isOptimizing, handleQueueOptimization, onOptimizationStarted, componentMountedRef, queueSize]);

  return { hasTriggeredOptimizationRef };
};
