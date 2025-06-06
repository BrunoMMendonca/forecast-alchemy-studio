
import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect, useMemo } from 'react';
import { SalesData, ForecastResult } from '@/pages/Index';
import { useUnifiedModelManagement } from '@/hooks/useUnifiedModelManagement';
import { useOptimizationHandler } from '@/hooks/useOptimizationHandler';
import { ModelSelection } from './ModelSelection';
import { ProductSelector } from './ProductSelector';
import { QueueStatusDisplay } from './QueueStatusDisplay';
import { OptimizationLogger } from './OptimizationLogger';

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
  grokApiEnabled?: boolean;
}

export const ForecastModels = forwardRef<any, ForecastModelsProps>(({ 
  data, 
  forecastPeriods,
  onForecastGeneration,
  selectedSKU,
  onSKUChange,
  shouldStartOptimization = false,
  onOptimizationStarted,
  optimizationQueue,
  grokApiEnabled = true
}, ref) => {
  const [showOptimizationLog, setShowOptimizationLog] = useState(false);
  const hasTriggeredOptimizationRef = useRef(false);
  const componentMountedRef = useRef(false);
  const lastProcessedQueueSizeRef = useRef(0);
  
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

  // Memoize queue combinations to prevent infinite re-renders
  const queuedCombinations = useMemo(() => {
    return optimizationQueue?.getQueuedCombinations() || [];
  }, [optimizationQueue?.queueSize]); // Only recalculate when queue size changes

  // Use optimization handler for queue management - pass grokApiEnabled
  const {
    isOptimizing,
    progress,
    handleQueueOptimization
  } = useOptimizationHandler(data, selectedSKU, optimizationQueue, generateForecasts, grokApiEnabled);

  // Mark component as mounted
  useEffect(() => {
    componentMountedRef.current = true;
    console.log('🔄 FORECAST_MODELS: Component mounted, grokApiEnabled:', grokApiEnabled);
    
    return () => {
      componentMountedRef.current = false;
      console.log('🔄 FORECAST_MODELS: Component unmounted');
    };
  }, [grokApiEnabled]);

  // AUTO-START OPTIMIZATION: React to queue changes with stable detection
  useEffect(() => {
    if (!optimizationQueue || !componentMountedRef.current) {
      console.log('🔄 FORECAST_MODELS: Skipping auto-start - no queue or not mounted');
      return;
    }

    const currentQueueSize = optimizationQueue.queueSize;
    
    // Only process if queue size actually changed and increased
    if (currentQueueSize <= lastProcessedQueueSizeRef.current) {
      console.log('🔄 FORECAST_MODELS: Queue size unchanged or decreased, skipping');
      return;
    }
    
    lastProcessedQueueSizeRef.current = currentQueueSize;
    
    console.log('🔄 FORECAST_MODELS: Queue size increased to:', currentQueueSize, 'combinations:', queuedCombinations.length, 'isOptimizing:', isOptimizing);

    // Auto-start optimization if:
    // 1. Queue has items
    // 2. Not currently optimizing 
    // 3. Component is mounted
    if (currentQueueSize > 0 && !isOptimizing) {
      console.log('🚀 FORECAST_MODELS: CONDITIONS MET - Auto-starting optimization');
      console.log('🚀 FORECAST_MODELS: - Queue size:', currentQueueSize);
      console.log('🚀 FORECAST_MODELS: - Is optimizing:', isOptimizing);
      console.log('🚀 FORECAST_MODELS: - Component mounted:', componentMountedRef.current);
      console.log('🚀 FORECAST_MODELS: - Grok API enabled:', grokApiEnabled);
      
      // Use timeout to avoid potential race conditions
      setTimeout(() => {
        if (componentMountedRef.current && !isOptimizing) {
          console.log('🚀 FORECAST_MODELS: EXECUTING handleQueueOptimization');
          handleQueueOptimization();
          if (onOptimizationStarted) {
            onOptimizationStarted();
          }
        }
      }, 100);
    } else {
      console.log('🔄 FORECAST_MODELS: NOT starting optimization:');
      console.log('🔄 FORECAST_MODELS: - Queue size > 0:', currentQueueSize > 0);
      console.log('🔄 FORECAST_MODELS: - Not optimizing:', !isOptimizing);
      console.log('🔄 FORECAST_MODELS: - Component mounted:', componentMountedRef.current);
    }
  }, [optimizationQueue?.queueSize, isOptimizing, handleQueueOptimization, onOptimizationStarted, queuedCombinations.length, grokApiEnabled]);

  // Reset processed queue size when optimization completes
  useEffect(() => {
    if (!isOptimizing) {
      // Reset after optimization completes to allow new auto-starts
      setTimeout(() => {
        lastProcessedQueueSizeRef.current = optimizationQueue?.queueSize || 0;
      }, 1000);
    }
  }, [isOptimizing, optimizationQueue?.queueSize]);

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
            onOpenQueuePopup={() => {
              // Trigger the global queue popup via a custom event
              window.dispatchEvent(new CustomEvent('openGlobalQueuePopup'));
            }}
          />
        )}
      </div>

      <ModelSelection
        models={models}
        selectedSKU={selectedSKU}
        onToggleModel={toggleModel}
        onUpdateParameter={updateParameter}
        onResetToManual={resetToManual}
        grokApiEnabled={grokApiEnabled}
      />

      <OptimizationLogger 
        isVisible={showOptimizationLog} 
        onClose={() => setShowOptimizationLog(false)} 
      />
    </div>
  );
});

ForecastModels.displayName = 'ForecastModels';
