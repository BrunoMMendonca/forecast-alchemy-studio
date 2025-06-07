
import { useEffect, useRef } from 'react';

interface UseOptimizationTriggerProps {
  shouldStartOptimization: boolean;
  isOptimizing: boolean;
  handleQueueOptimization: () => void;
  onOptimizationStarted?: () => void;
  componentMountedRef: React.MutableRefObject<boolean>;
}

export const useOptimizationTrigger = ({
  shouldStartOptimization,
  isOptimizing,
  handleQueueOptimization,
  onOptimizationStarted,
  componentMountedRef
}: UseOptimizationTriggerProps) => {
  const hasTriggeredOptimizationRef = useRef(false);

  useEffect(() => {
    if (shouldStartOptimization && 
        !isOptimizing && 
        !hasTriggeredOptimizationRef.current && 
        componentMountedRef.current) {
      
      hasTriggeredOptimizationRef.current = true;
      handleQueueOptimization();
      
      if (onOptimizationStarted) {
        onOptimizationStarted();
      }
    }
  }, [shouldStartOptimization, isOptimizing, handleQueueOptimization, onOptimizationStarted, componentMountedRef]);

  return { hasTriggeredOptimizationRef };
};
