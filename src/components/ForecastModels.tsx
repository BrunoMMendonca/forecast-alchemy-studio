
import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { SalesData, ForecastResult } from '@/pages/Index';
import { useForecastModelsLogic } from '@/hooks/useForecastModelsLogic';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useModelManagement } from '@/hooks/useModelManagement';
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
  const navigationReturnRef = useRef(false);
  
  const { cache } = useOptimizationCache();
  const { 
    createModelsWithPreferences, 
    refreshModelsWithPreferences,
    setModels 
  } = useModelManagement(selectedSKU, data);

  const {
    models,
    isOptimizing,
    progress,
    handleQueueOptimization,
    handleToggleModel,
    handleUpdateParameter,
    handleUseAI,
    handleUseGrid,
    handleResetToManual,
    generateForecastsForSelectedSKU
  } = useForecastModelsLogic(
    data,
    forecastPeriods,
    selectedSKU,
    onForecastGeneration,
    optimizationQueue
  );

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    startOptimization: handleQueueOptimization
  }));

  // Detect navigation return and refresh models
  useEffect(() => {
    console.log('🔄 NAVIGATION: ForecastModels component mounted/remounted');
    navigationReturnRef.current = true;
    
    setTimeout(() => {
      if (selectedSKU) {
        console.log('🔄 NAVIGATION: Refreshing models on return for', selectedSKU);
        refreshModelsWithPreferences();
      }
      navigationReturnRef.current = false;
    }, 100);
  }, []);

  // AUTO-TRIGGER: Watch for shouldStartOptimization prop
  React.useEffect(() => {
    if (shouldStartOptimization && !isOptimizing && !hasTriggeredOptimizationRef.current) {
      console.log('🚀 AUTO-TRIGGER: shouldStartOptimization is true, starting optimization...');
      hasTriggeredOptimizationRef.current = true;
      handleQueueOptimization();
      if (onOptimizationStarted) {
        onOptimizationStarted();
      }
    }
  }, [shouldStartOptimization, isOptimizing]);

  // AUTO-TRIGGER: Watch for new items in queue
  React.useEffect(() => {
    if (optimizationQueue) {
      const queuedSKUs = optimizationQueue.getSKUsInQueue();
      if (queuedSKUs.length > 0 && !isOptimizing && !hasTriggeredOptimizationRef.current) {
        console.log('🚀 AUTO-TRIGGER: Queue has items and optimization not running, starting...', queuedSKUs);
        hasTriggeredOptimizationRef.current = true;
        setTimeout(() => {
          handleQueueOptimization();
        }, 1000);
      }
    }
  }, [optimizationQueue?.getSKUsInQueue().length, isOptimizing]);

  // Reset trigger flag when optimization completes
  React.useEffect(() => {
    if (!isOptimizing) {
      hasTriggeredOptimizationRef.current = false;
    }
  }, [isOptimizing]);

  // Reset trigger flag when queue is empty
  React.useEffect(() => {
    if (optimizationQueue) {
      const queuedSKUs = optimizationQueue.getSKUsInQueue();
      if (queuedSKUs.length === 0) {
        hasTriggeredOptimizationRef.current = false;
      }
    }
  }, [optimizationQueue?.getSKUsInQueue().length]);

  // Watch for cache changes and update models
  React.useEffect(() => {
    if (selectedSKU && cache[selectedSKU] && !navigationReturnRef.current) {
      console.log('🔄 CACHE UPDATED: Immediately updating models state for', selectedSKU);
      
      const modelsWithPreferences = createModelsWithPreferences();
      setModels(modelsWithPreferences);
      
      setTimeout(() => {
        generateForecastsForSelectedSKU();
      }, 100);
    }
  }, [cache, selectedSKU]);

  // Auto-select first SKU when data changes
  React.useEffect(() => {
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
        onToggleModel={handleToggleModel}
        onUpdateParameter={handleUpdateParameter}
        onUseAI={handleUseAI}
        onUseGrid={handleUseGrid}
        onResetToManual={handleResetToManual}
      />

      <OptimizationLogger 
        isVisible={showOptimizationLog} 
        onClose={() => setShowOptimizationLog(false)} 
      />
    </div>
  );
});

ForecastModels.displayName = 'ForecastModels';
