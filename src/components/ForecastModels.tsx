
import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect, useMemo } from 'react';
import { SalesData, ForecastResult } from '@/pages/Index';
import { useUnifiedModelManagement } from '@/hooks/useUnifiedModelManagement';
import { useOptimizationHandler } from '@/hooks/useOptimizationHandler';
import { useAutoOptimization } from '@/hooks/useAutoOptimization';
import { useManualOptimizationTrigger } from '@/hooks/useManualOptimizationTrigger';
import { ForecastModelsContent } from './ForecastModelsContent';
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
  const componentMountedRef = useRef(false);
  
  // Use the unified model management hook
  const {
    models,
    toggleModel,
    updateParameter,
    resetToManual,
    handleMethodSelection,
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

  // Use auto-optimization hook
  useAutoOptimization({
    optimizationQueue,
    isOptimizing,
    handleQueueOptimization,
    onOptimizationStarted,
    grokApiEnabled,
    componentMountedRef
  });

  // Use manual optimization trigger hook
  const { hasTriggeredOptimizationRef } = useManualOptimizationTrigger({
    shouldStartOptimization,
    isOptimizing,
    handleQueueOptimization,
    onOptimizationStarted,
    componentMountedRef
  });

  // Mark component as mounted
  useEffect(() => {
    componentMountedRef.current = true;
    console.log('🔄 FORECAST_MODELS: Component mounted, grokApiEnabled:', grokApiEnabled);
    
    return () => {
      componentMountedRef.current = false;
      console.log('🔄 FORECAST_MODELS: Component unmounted');
    };
  }, [grokApiEnabled]);

  // Auto-select first SKU when data changes (only if no SKU selected)
  useEffect(() => {
    const skus = Array.from(new Set(data.map(d => d.sku))).sort();
    if (skus.length > 0 && !selectedSKU) {
      onSKUChange(skus[0]);
    }
  }, [data, selectedSKU, onSKUChange]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    startOptimization: handleQueueOptimization
  }));

  return (
    <div className="space-y-6">
      <ForecastModelsContent
        data={data}
        selectedSKU={selectedSKU}
        onSKUChange={onSKUChange}
        optimizationQueue={optimizationQueue}
        isOptimizing={isOptimizing}
        progress={progress}
        hasTriggeredOptimization={hasTriggeredOptimizationRef.current}
        models={models}
        onToggleModel={toggleModel}
        onUpdateParameter={updateParameter}
        onResetToManual={resetToManual}
        onMethodSelection={handleMethodSelection}
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
