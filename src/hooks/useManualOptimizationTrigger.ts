
import { useRef, useEffect } from 'react';

interface UseManualOptimizationTriggerProps {
  shouldStartOptimization: boolean;
  isOptimizing: boolean;
  handleQueueOptimization: () => void;
  onOptimizationStarted?: () => void;
  componentMountedRef: React.MutableRefObject<boolean>;
}

export const useManualOptimizationTrigger = ({
  shouldStartOptimization,
  isOptimizing,
  handleQueueOptimization,
  onOptimizationStarted,
  componentMountedRef
}: UseManualOptimizationTriggerProps) => {
  const hasTriggeredOptimizationRef = useRef(false);

  // MANUAL shouldStartOptimization trigger
  useEffect(() => {
    if (shouldStartOptimization && !isOptimizing && !hasTriggeredOptimizationRef.current && componentMountedRef.current) {
      console.log('🚀 FORECAST_MODELS: Manual trigger via shouldStartOptimization prop');
      hasTriggeredOptimizationRef.current = true;
      handleQueueOptimization();
      if (onOptimizationStarted) {
        onOptimizationStarted();
      }
    }
  }, [shouldStartOptimization, isOptimizing, handleQueueOptimization, onOptimizationStarted]);

  // Reset manual trigger flag when optimization completes
  useEffect(() => {
    if (!isOptimizing) {
      hasTriggeredOptimizationRef.current = false;
    }
  }, [isOptimizing]);

  return {
    hasTriggeredOptimizationRef
  };
};
