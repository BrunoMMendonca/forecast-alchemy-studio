
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
  
  // CRITICAL: Only initialize unified model management if we have a valid SKU
  const shouldUseUnifiedHook = selectedSKU && selectedSKU.trim() !== '';
  
  console.log('🎯 FORECAST MODELS: Render with selectedSKU:', selectedSKU, 'shouldUseUnifiedHook:', shouldUseUnifiedHook);
  
  // Use the unified model management hook - but only if SKU is valid
  const unifiedHookResult = useUnifiedModelManagement(
    shouldUseUnifiedHook ? selectedSKU : '',
    shouldUseUnifiedHook ? data : [],
    undefined // businessContext
  );

  const {
    models,
    toggleModel,
    updateParameter,
    useAIOptimization,
    useGridOptimization,
    resetToManual
  } = unifiedHookResult;

  // Use optimization handler for queue management - but only if SKU is valid
  const optimizationHandlerResult = useOptimizationHandler(
    shouldUseUnifiedHook ? data : [], 
    shouldUseUnifiedHook ? selectedSKU : '', 
    optimizationQueue
  );

  const {
    isOptimizing,
    progress,
    handleQueueOptimization
  } = optimizationHandlerResult;

  // Mark component as mounted and handle initial optimization
  useEffect(() => {
    componentMountedRef.current = true;
    
    console.log('🎯 FORECAST MODELS: Component mounted');
    
    return () => {
      componentMountedRef.current = false;
    };
  }, []); // Only run on mount

  // CRITICAL: Only trigger optimization if we have a valid SKU
  useEffect(() => {
    if (optimizationQueue && !autoOptimizationDoneRef.current && selectedSKU && selectedSKU.trim() !== '') {
      const queuedSKUs = optimizationQueue.getSKUsInQueue();
      if (queuedSKUs.length > 0 && !isOptimizing) {
        autoOptimizationDoneRef.current = true;
        
        console.log('🎯 FORECAST MODELS: Auto-triggering optimization for queued SKUs');
        
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
  }, [selectedSKU, optimizationQueue, isOptimizing, handleQueueOptimization, onOptimizationStarted]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    startOptimization: handleQueueOptimization
  }));

  // CONTROLLED shouldStartOptimization trigger - only once per change
  useEffect(() => {
    if (shouldStartOptimization && !isOptimizing && !hasTriggeredOptimizationRef.current && componentMountedRef.current && selectedSKU && selectedSKU.trim() !== '') {
      hasTriggeredOptimizationRef.current = true;
      handleQueueOptimization();
      if (onOptimizationStarted) {
        onOptimizationStarted();
      }
    }
  }, [shouldStartOptimization, selectedSKU]);

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

  // CRITICAL: Only show UI if we have data
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No data available for forecasting</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Debug Info */}
      <div className="bg-blue-50 p-3 rounded text-sm">
        <strong>Debug:</strong> Data: {data.length} rows, SKU: "{selectedSKU}", Hook Active: {shouldUseUnifiedHook ? 'Yes' : 'No'}
      </div>

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

      {/* Only show ModelSelection if we have a valid SKU */}
      {selectedSKU && selectedSKU.trim() !== '' && (
        <ModelSelection
          models={models}
          selectedSKU={selectedSKU}
          onToggleModel={toggleModel}
          onUpdateParameter={updateParameter}
          onUseAI={useAIOptimization}
          onUseGrid={useGridOptimization}
          onResetToManual={resetToManual}
        />
      )}

      <OptimizationLogger 
        isVisible={showOptimizationLog} 
        onClose={() => setShowOptimizationLog(false)} 
      />
    </div>
  );
});

ForecastModels.displayName = 'ForecastModels';
