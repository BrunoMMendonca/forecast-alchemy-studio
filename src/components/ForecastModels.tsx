
import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { SalesData, ForecastResult } from '@/pages/Index';
import { useUnifiedModelManagement } from '@/hooks/useUnifiedModelManagement';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
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
    removeSKUsFromQueue: (skus: string[]) => void;
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
  const hasTriggeredOptimizationRef = useRef(false);
  const componentMountedRef = useRef(false);
  
  const { cache } = useOptimizationCache();

  // Use the unified model management hook
  const {
    models,
    toggleModel,
    updateParameter,
    useAIOptimization,
    useGridOptimization,
    resetToManual,
    generateForecasts
  } = useUnifiedModelManagement(
    selectedSKU,
    data,
    forecastPeriods,
    undefined, // businessContext - will be added later if needed
    onForecastGeneration
  );

  // Use optimization handler for queue management
  const {
    isOptimizing,
    progress,
    handleQueueOptimization
  } = useOptimizationHandler(data, selectedSKU, optimizationQueue, generateForecasts);

  // Mark component as mounted
  useEffect(() => {
    componentMountedRef.current = true;
    console.log('📊 FORECAST MODELS: Component mounted');
    
    // Auto-trigger optimization if there are queued items and component just mounted
    if (optimizationQueue) {
      const queuedSKUs = optimizationQueue.getSKUsInQueue();
      if (queuedSKUs.length > 0 && !isOptimizing && !hasTriggeredOptimizationRef.current) {
        console.log('🚀 FORECAST MODELS: Auto-starting optimization on mount for queued SKUs:', queuedSKUs);
        hasTriggeredOptimizationRef.current = true;
        setTimeout(() => {
          handleQueueOptimization();
          if (onOptimizationStarted) {
            onOptimizationStarted();
          }
        }, 1000);
      }
    }
    
    return () => {
      componentMountedRef.current = false;
    };
  }, []);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    startOptimization: handleQueueOptimization
  }));

  // AUTO-TRIGGER: Watch for shouldStartOptimization prop (when provided by parent)
  useEffect(() => {
    if (shouldStartOptimization && !isOptimizing && !hasTriggeredOptimizationRef.current && componentMountedRef.current) {
      console.log('🚀 AUTO-TRIGGER: shouldStartOptimization is true, starting optimization...');
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
      hasTriggeredOptimizationRef.current = false;
    }
  }, [isOptimizing]);

  // Reset trigger flag when queue is empty
  useEffect(() => {
    if (optimizationQueue) {
      const queuedSKUs = optimizationQueue.getSKUsInQueue();
      if (queuedSKUs.length === 0) {
        hasTriggeredOptimizationRef.current = false;
      }
    }
  }, [optimizationQueue?.getSKUsInQueue().length]);

  // Auto-select first SKU when data changes
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
            optimizationQueue={optimizationQueue}
            isOptimizing={isOptimizing}
            progress={progress}
            hasTriggeredOptimization={hasTriggeredOptimizationRef.current}
          />
        )}
      </div>

      <ModelSelection
        models={models}
        onToggleModel={toggleModel}
        onUpdateParameter={updateParameter}
        onUseAI={useAIOptimization}
        onUseGrid={useGridOptimization}
        onResetToManual={resetToManual}
      />

      <OptimizationLogger 
        isVisible={showOptimizationLog} 
        onClose={() => setShowOptimizationLog(false)} 
      />
    </div>
  );
});

ForecastModels.displayName = 'ForecastModels';
