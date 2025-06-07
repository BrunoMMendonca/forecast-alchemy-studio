
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
  const isInitializedRef = useRef(false);

  // Initialize on first mount with a delay to allow proper app setup
  useEffect(() => {
    if (!isInitializedRef.current && componentMountedRef.current) {
      const initTimer = setTimeout(() => {
        isInitializedRef.current = true;
        console.log('🔄 AUTO-OPTIMIZATION: Initialization complete');
      }, 1000); // Wait 1 second for app to stabilize

      return () => clearTimeout(initTimer);
    }
  }, [componentMountedRef]);

  // AUTO-START OPTIMIZATION: React to queue changes with stable detection
  useEffect(() => {
    // Skip if not initialized or no queue or not mounted
    if (!isInitializedRef.current || !optimizationQueue || !componentMountedRef.current) {
      console.log('🔄 AUTO-OPTIMIZATION: Skipping auto-start - not ready');
      console.log('🔄 AUTO-OPTIMIZATION: - Initialized:', isInitializedRef.current);
      console.log('🔄 AUTO-OPTIMIZATION: - Has queue:', !!optimizationQueue);
      console.log('🔄 AUTO-OPTIMIZATION: - Component mounted:', componentMountedRef.current);
      return;
    }

    const currentQueueSize = optimizationQueue.queueSize;
    
    // Only process if queue size actually changed and increased
    if (currentQueueSize <= lastProcessedQueueSizeRef.current) {
      console.log('🔄 AUTO-OPTIMIZATION: Queue size unchanged or decreased, skipping');
      return;
    }
    
    lastProcessedQueueSizeRef.current = currentQueueSize;
    
    console.log('🔄 AUTO-OPTIMIZATION: Queue size increased to:', currentQueueSize, 'isOptimizing:', isOptimizing);

    // Auto-start optimization if:
    // 1. Queue has items
    // 2. Not currently optimizing 
    // 3. Component is mounted
    // 4. App is fully initialized
    if (currentQueueSize > 0 && !isOptimizing) {
      console.log('🚀 AUTO-OPTIMIZATION: CONDITIONS MET - Auto-starting optimization');
      console.log('🚀 AUTO-OPTIMIZATION: - Queue size:', currentQueueSize);
      console.log('🚀 AUTO-OPTIMIZATION: - Is optimizing:', isOptimizing);
      console.log('🚀 AUTO-OPTIMIZATION: - Component mounted:', componentMountedRef.current);
      console.log('🚀 AUTO-OPTIMIZATION: - Grok API enabled:', grokApiEnabled);
      console.log('🚀 AUTO-OPTIMIZATION: - Initialized:', isInitializedRef.current);
      
      // Use timeout to avoid potential race conditions
      setTimeout(() => {
        if (componentMountedRef.current && !isOptimizing && isInitializedRef.current) {
          console.log('🚀 AUTO-OPTIMIZATION: EXECUTING handleQueueOptimization');
          handleQueueOptimization();
          if (onOptimizationStarted) {
            onOptimizationStarted();
          }
        }
      }, 100);
    } else {
      console.log('🔄 AUTO-OPTIMIZATION: NOT starting optimization:');
      console.log('🔄 AUTO-OPTIMIZATION: - Queue size > 0:', currentQueueSize > 0);
      console.log('🔄 AUTO-OPTIMIZATION: - Not optimizing:', !isOptimizing);
      console.log('🔄 AUTO-OPTIMIZATION: - Component mounted:', componentMountedRef.current);
      console.log('🔄 AUTO-OPTIMIZATION: - Initialized:', isInitializedRef.current);
    }
  }, [optimizationQueue?.queueSize, isOptimizing, handleQueueOptimization, onOptimizationStarted, grokApiEnabled]);

  // Reset processed queue size when optimization completes
  useEffect(() => {
    if (!isOptimizing && isInitializedRef.current) {
      // Reset after optimization completes to allow new auto-starts
      setTimeout(() => {
        lastProcessedQueueSizeRef.current = optimizationQueue?.queueSize || 0;
        console.log('🔄 AUTO-OPTIMIZATION: Reset queue size tracker to:', lastProcessedQueueSizeRef.current);
      }, 1000);
    }
  }, [isOptimizing]); // Removed optimizationQueue?.queueSize dependency to prevent false triggers

  return {
    lastProcessedQueueSizeRef,
    isInitializedRef
  };
};
