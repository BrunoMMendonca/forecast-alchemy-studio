
import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { SalesData, ForecastResult } from '@/pages/Index';
import { useUnifiedModelManagement } from '@/hooks/useUnifiedModelManagement';
import { useOptimizationHandler } from '@/hooks/useOptimizationHandler';
import { ModelSelection } from './ModelSelection';
import { ProductSelector } from './ProductSelector';
import { QueueStatusDisplay } from './QueueStatusDisplay';
import { OptimizationLogger } from './OptimizationLogger';
import { OptimizationQueuePopup } from './OptimizationQueuePopup';

interface ForecastModelsProps {
  data: SalesData[];
  forecastPeriods: number;
  onForecastGeneration: (results: ForecastResult[], selectedSKU: string) => void;
  selectedSKU: string;
  onSKUChange: (sku: string) => void;
  shouldStartOptimization?: boolean;
  onOptimizationStarted?: () => void;
  optimizationQueue?: {
    getSKUsInQueue: () => string[];
    getQueuedCombinations: () => Array<{sku: string, modelId: string}>;
    getModelsForSKU: (sku: string) => string[];
    removeSKUsFromQueue: (skus: string[]) => void;
    removeSKUModelPairsFromQueue: (pairs: Array<{sku: string, modelId: string}>) => void;
    removeUnnecessarySKUs: (skus: string[]) => void;
    queueSize: number;
    uniqueSKUCount: number;
  };
}

export const ForecastModels = forwardRef<any, ForecastModelsProps>(({ 
  data, 
  forecastPeriods,
  onForecastGeneration,
  selectedSKU,
  onSKUChange,
  shouldStartOptimization = false,
  onOptimizationStarted,
  optimizationQueue
}, ref) => {
  const [showOptimizationLog, setShowOptimizationLog] = useState(false);
  const [isQueuePopupOpen, setIsQueuePopupOpen] = useState(false);
  const hasTriggeredOptimizationRef = useRef(false);
  const componentMountedRef = useRef(false);
  
  // Use the unified model management hook
  const {
    models,
    toggleModel,
    updateParameter,
    resetToManual,
    generateForecasts
  } = useUnifiedModelManagement(
    selectedSKU,
    data,
    forecastPeriods,
    undefined,
    onForecastGeneration
  );

  // Use optimization handler for queue management - pass the complete queue interface
  const {
    isOptimizing,
    progress,
    handleQueueOptimization
  } = useOptimizationHandler(data, selectedSKU, optimizationQueue, generateForecasts);

  // Mark component as mounted
  useEffect(() => {
    componentMountedRef.current = true;
    console.log('🚀 FORECAST MODELS: Component mounted');
    
    return () => {
      componentMountedRef.current = false;
      console.log('🚀 FORECAST MODELS: Component unmounted');
    };
  }, []);

  // Auto-start optimization when queue has items and optimization is not running
  useEffect(() => {
    if (!optimizationQueue || !componentMountedRef.current) {
      return;
    }

    const queueSize = optimizationQueue.queueSize;
    const queuedSKUs = optimizationQueue.getSKUsInQueue();
    
    console.log('🚀 AUTO-OPTIMIZATION: Checking queue state');
    console.log('🚀 AUTO-OPTIMIZATION: Queue size:', queueSize);
    console.log('🚀 AUTO-OPTIMIZATION: Is optimizing:', isOptimizing);
    console.log('🚀 AUTO-OPTIMIZATION: Has triggered:', hasTriggeredOptimizationRef.current);
    console.log('🚀 AUTO-OPTIMIZATION: Queued SKUs:', queuedSKUs);

    // Start optimization if:
    // 1. There are items in the queue
    // 2. Not currently optimizing
    // 3. Haven't already triggered for this queue state
    if (queueSize > 0 && !isOptimizing && !hasTriggeredOptimizationRef.current) {
      console.log('🚀 AUTO-OPTIMIZATION: Starting auto-optimization');
      hasTriggeredOptimizationRef.current = true;
      
      // Small delay to ensure everything is ready
      setTimeout(() => {
        if (componentMountedRef.current) {
          console.log('🚀 AUTO-OPTIMIZATION: Executing handleQueueOptimization');
          handleQueueOptimization();
          if (onOptimizationStarted) {
            onOptimizationStarted();
          }
        }
      }, 500);
    }
  }, [optimizationQueue?.queueSize, isOptimizing, handleQueueOptimization, onOptimizationStarted]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    startOptimization: handleQueueOptimization
  }));

  // CONTROLLED shouldStartOptimization trigger - only once per change
  useEffect(() => {
    if (shouldStartOptimization && !isOptimizing && !hasTriggeredOptimizationRef.current && componentMountedRef.current) {
      console.log('🚀 FORECAST MODELS: Manual optimization trigger');
      hasTriggeredOptimizationRef.current = true;
      handleQueueOptimization();
      if (onOptimizationStarted) {
        onOptimizationStarted();
      }
    }
  }, [shouldStartOptimization, isOptimizing, handleQueueOptimization, onOptimizationStarted]);

  // Reset trigger flag when optimization completes
  useEffect(() => {
    if (!isOptimizing) {
      console.log('🚀 FORECAST MODELS: Optimization completed, resetting trigger flag');
      hasTriggeredOptimizationRef.current = false;
    }
  }, [isOptimizing]);

  // Auto-select first SKU when data changes (only if no SKU selected)
  useEffect(() => {
    const skus = Array.from(new Set(data.map(d => d.sku))).sort();
    if (skus.length > 0 && !selectedSKU) {
      onSKUChange(skus[0]);
    }
  }, [data, selectedSKU, onSKUChange]);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <ProductSelector
          data={data}
          selectedSKU={selectedSKU}
          onSKUChange={onSKUChange}
        />

        {optimizationQueue && (
          <QueueStatusDisplay
            optimizationQueue={{
              getSKUsInQueue: optimizationQueue.getSKUsInQueue,
              removeSKUsFromQueue: optimizationQueue.removeSKUsFromQueue,
              queueSize: optimizationQueue.queueSize,
              uniqueSKUCount: optimizationQueue.uniqueSKUCount
            }}
            isOptimizing={isOptimizing}
            progress={progress}
            hasTriggeredOptimization={hasTriggeredOptimizationRef.current}
            onOpenQueuePopup={() => setIsQueuePopupOpen(true)}
          />
        )}
      </div>

      <ModelSelection
        models={models}
        selectedSKU={selectedSKU}
        onToggleModel={toggleModel}
        onUpdateParameter={updateParameter}
        onResetToManual={resetToManual}
      />

      <OptimizationLogger 
        isVisible={showOptimizationLog} 
        onClose={() => setShowOptimizationLog(false)} 
      />

      {optimizationQueue && (
        <OptimizationQueuePopup
          optimizationQueue={optimizationQueue}
          models={models}
          isOptimizing={isOptimizing}
          progress={progress}
          isOpen={isQueuePopupOpen}
          onOpenChange={setIsQueuePopupOpen}
        />
      )}
    </div>
  );
});

ForecastModels.displayName = 'ForecastModels';
