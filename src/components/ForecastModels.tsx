
import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
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
  const autoOptimizationDoneRef = useRef(false);
  
  // Auto-select first SKU when data changes - FIXED to prevent empty strings
  useEffect(() => {
    const skus = Array.from(new Set(data.map(d => d.sku))).sort();
    console.log('🔄 ForecastModels SKU auto-selection check:', {
      availableSKUs: skus,
      currentSelectedSKU: selectedSKU,
      selectedSKUType: typeof selectedSKU,
      selectedSKULength: selectedSKU?.length,
      shouldAutoSelect: skus.length > 0 && (!selectedSKU || selectedSKU.trim() === '')
    });
    
    // Only auto-select if we have SKUs and no valid selected SKU
    if (skus.length > 0 && (!selectedSKU || selectedSKU.trim() === '')) {
      console.log('✅ Auto-selecting first SKU:', skus[0]);
      onSKUChange(skus[0]);
    }
  }, [data, selectedSKU, onSKUChange]);

  // Use the unified model management hook - ONLY if we have a valid SKU
  const {
    models,
    toggleModel,
    updateParameter,
    useAIOptimization,
    useGridOptimization,
    resetToManual,
    generateForecasts
  } = useUnifiedModelManagement(
    selectedSKU && selectedSKU.trim() ? selectedSKU : '', // Ensure we never pass empty strings
    data,
    forecastPeriods,
    undefined,
    onForecastGeneration
  );

  // Use optimization handler for queue management
  const {
    isOptimizing,
    progress,
    handleQueueOptimization
  } = useOptimizationHandler(data, selectedSKU, optimizationQueue, generateForecasts);

  // Mark component as mounted and handle initial optimization
  useEffect(() => {
    componentMountedRef.current = true;
    
    // Only auto-trigger once per mount
    if (optimizationQueue && !autoOptimizationDoneRef.current) {
      const queuedSKUs = optimizationQueue.getSKUsInQueue();
      if (queuedSKUs.length > 0 && !isOptimizing) {
        autoOptimizationDoneRef.current = true;
        
        // Add delay to ensure all components are ready
        setTimeout(() => {
          if (componentMountedRef.current) {
            handleQueueOptimization();
            if (onOptimizationStarted) {
              onOptimizationStarted();
            }
          }
        }, 1000);
      }
    }
    
    return () => {
      componentMountedRef.current = false;
    };
  }, []); // Only run on mount

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    startOptimization: handleQueueOptimization
  }));

  // CONTROLLED shouldStartOptimization trigger - only once per change
  useEffect(() => {
    if (shouldStartOptimization && !isOptimizing && !hasTriggeredOptimizationRef.current && componentMountedRef.current) {
      hasTriggeredOptimizationRef.current = true;
      handleQueueOptimization();
      if (onOptimizationStarted) {
        onOptimizationStarted();
      }
    }
  }, [shouldStartOptimization]);

  // Reset trigger flags when optimization completes or queue is empty
  useEffect(() => {
    if (!isOptimizing) {
      hasTriggeredOptimizationRef.current = false;
    }
    
    if (optimizationQueue && optimizationQueue.getSKUsInQueue().length === 0) {
      hasTriggeredOptimizationRef.current = false;
      autoOptimizationDoneRef.current = false;
    }
  }, [isOptimizing, optimizationQueue?.getSKUsInQueue().length]);

  // Don't render anything if we don't have a valid SKU yet
  if (!selectedSKU || selectedSKU.trim() === '') {
    console.log('⏳ ForecastModels waiting for valid SKU selection...');
    return (
      <div className="space-y-6">
        <ProductSelector
          data={data}
          selectedSKU={selectedSKU}
          onSKUChange={onSKUChange}
        />
        <div className="text-center text-gray-500 py-8">
          Please select a product to begin forecasting...
        </div>
      </div>
    );
  }

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
        selectedSKU={selectedSKU}
        data={data}
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
