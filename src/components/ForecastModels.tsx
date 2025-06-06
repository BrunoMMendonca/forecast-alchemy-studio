

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
    console.log('🔄 FORECAST_MODELS: Component mounted');
    
    return () => {
      componentMountedRef.current = false;
      console.log('🔄 FORECAST_MODELS: Component unmounted');
    };
  }, []);

  // AUTO-START OPTIMIZATION: React to queue changes with more robust detection
  useEffect(() => {
    if (!optimizationQueue || !componentMountedRef.current) {
      console.log('🔄 FORECAST_MODELS: Skipping auto-start - no queue or not mounted');
      return;
    }

    const queueSize = optimizationQueue.queueSize;
    const queuedCombinations = optimizationQueue.getQueuedCombinations();
    
    console.log('🔄 FORECAST_MODELS: Queue check - size:', queueSize, 'combinations:', queuedCombinations.length, 'isOptimizing:', isOptimizing);

    // Auto-start optimization if:
    // 1. Queue has items
    // 2. Not currently optimizing 
    // 3. Component is mounted
    if (queueSize > 0 && !isOptimizing) {
      console.log('🚀 FORECAST_MODELS: CONDITIONS MET - Auto-starting optimization');
      console.log('🚀 FORECAST_MODELS: - Queue size:', queueSize);
      console.log('🚀 FORECAST_MODELS: - Is optimizing:', isOptimizing);
      console.log('🚀 FORECAST_MODELS: - Component mounted:', componentMountedRef.current);
      console.log('🚀 FORECAST_MODELS: - Queued combinations:', queuedCombinations);
      
      // Use immediate execution instead of timeout to avoid race conditions
      console.log('🚀 FORECAST_MODELS: EXECUTING handleQueueOptimization NOW');
      handleQueueOptimization();
      if (onOptimizationStarted) {
        onOptimizationStarted();
      }
    } else {
      console.log('🔄 FORECAST_MODELS: NOT starting optimization:');
      console.log('🔄 FORECAST_MODELS: - Queue size > 0:', queueSize > 0);
      console.log('🔄 FORECAST_MODELS: - Not optimizing:', !isOptimizing);
      console.log('🔄 FORECAST_MODELS: - Component mounted:', componentMountedRef.current);
    }
  }, [optimizationQueue?.queueSize, optimizationQueue?.getQueuedCombinations().length, isOptimizing, handleQueueOptimization, onOptimizationStarted]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    startOptimization: handleQueueOptimization
  }));

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

