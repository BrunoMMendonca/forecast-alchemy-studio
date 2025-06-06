
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

// Helper function to validate SKU
const isValidSKU = (sku: any): boolean => {
  return sku !== null && sku !== undefined && typeof sku === 'string' && sku.trim().length > 0;
};

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
  
  console.log('🔄 ForecastModels render - selectedSKU validation:', {
    selectedSKU: `"${selectedSKU}"`,
    isValid: isValidSKU(selectedSKU),
    dataLength: data?.length
  });
  
  // Auto-select first SKU ONLY when data changes and no valid SKU is selected
  useEffect(() => {
    const skus = Array.from(new Set(data.map(d => d.sku))).sort();
    const currentlyValid = isValidSKU(selectedSKU);
    
    console.log('🔄 ForecastModels SKU auto-selection check:', {
      availableSKUs: skus,
      currentSelectedSKU: selectedSKU,
      currentlyValid,
      shouldAutoSelect: skus.length > 0 && !currentlyValid
    });
    
    // Only auto-select if we have SKUs and no valid selected SKU
    if (skus.length > 0 && !currentlyValid) {
      console.log('✅ Auto-selecting first SKU:', skus[0]);
      onSKUChange(skus[0]);
    }
  }, [data, onSKUChange]); // Removed selectedSKU from deps to prevent loops

  // Determine if we should initialize hooks
  const hooksShouldInitialize = isValidSKU(selectedSKU);
  
  console.log('🧪 ForecastModels hooks initialization check:', {
    selectedSKU: `"${selectedSKU}"`,
    hooksShouldInitialize,
    willPassToHooks: hooksShouldInitialize ? selectedSKU : ''
  });

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
    hooksShouldInitialize ? selectedSKU : '', // Pass empty string if not valid
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
  } = useOptimizationHandler(
    data, 
    hooksShouldInitialize ? selectedSKU : '', // Pass empty string if not valid
    optimizationQueue, 
    generateForecasts
  );

  // Handle component mounting and initial optimization - SIMPLIFIED
  useEffect(() => {
    componentMountedRef.current = true;
    
    // Only proceed if we have a valid SKU
    if (!isValidSKU(selectedSKU)) {
      console.log('⏭️ Skipping optimization setup - invalid SKU');
      return;
    }
    
    // Auto-trigger optimization if queue exists and hasn't been done yet
    if (optimizationQueue && !autoOptimizationDoneRef.current) {
      const queuedSKUs = optimizationQueue.getSKUsInQueue();
      if (queuedSKUs.length > 0 && !isOptimizing) {
        autoOptimizationDoneRef.current = true;
        
        setTimeout(() => {
          if (componentMountedRef.current && isValidSKU(selectedSKU)) {
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
  }, []); // Empty deps to only run on mount

  // Handle shouldStartOptimization trigger - SIMPLIFIED
  useEffect(() => {
    if (!isValidSKU(selectedSKU)) {
      console.log('⏭️ Skipping optimization trigger - invalid SKU');
      return;
    }
    
    if (shouldStartOptimization && !isOptimizing && !hasTriggeredOptimizationRef.current && componentMountedRef.current) {
      hasTriggeredOptimizationRef.current = true;
      handleQueueOptimization();
      if (onOptimizationStarted) {
        onOptimizationStarted();
      }
    }
  }, [shouldStartOptimization]); // Only depend on shouldStartOptimization

  // Reset trigger flags when optimization completes
  useEffect(() => {
    if (!isOptimizing) {
      hasTriggeredOptimizationRef.current = false;
    }
    
    if (optimizationQueue && optimizationQueue.getSKUsInQueue().length === 0) {
      hasTriggeredOptimizationRef.current = false;
      autoOptimizationDoneRef.current = false;
    }
  }, [isOptimizing, optimizationQueue]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    startOptimization: handleQueueOptimization
  }));

  // Don't render anything if we don't have a valid SKU yet
  if (!isValidSKU(selectedSKU)) {
    console.log('⏳ ForecastModels waiting for valid SKU selection...');
    return (
      <div className="space-y-6">
        <ProductSelector
          data={data}
          selectedSKU={selectedSKU || ''} // Ensure we never pass undefined
          onSKUChange={onSKUChange}
        />
        <div className="text-center text-gray-500 py-8">
          Please select a product to begin forecasting...
        </div>
      </div>
    );
  }

  console.log('✅ ForecastModels rendering full component with valid SKU:', selectedSKU);

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
