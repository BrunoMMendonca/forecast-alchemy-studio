import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { NormalizedSalesData, ForecastResult } from '@/pages/Index';
import { useModelController } from '@/hooks/useModelController';
import { useOptimizationHandler } from '@/hooks/useOptimizationHandler';
import { useAutoOptimization } from '@/hooks/useAutoOptimization';
import { useOptimizationTrigger } from '@/hooks/useOptimizationTrigger';
import { ForecastModelsContent } from './ForecastModelsContent';
import { OptimizationLogger } from './OptimizationLogger';

interface OptimizationQueueItem {
  sku: string;
  modelId: string;
  reason: string;
  timestamp: number;
}

interface OptimizationQueue {
  items: OptimizationQueueItem[];
  queueSize: number;
  uniqueSKUCount: number;
}

interface ForecastModelsProps {
  data: NormalizedSalesData[];
  forecastPeriods: number;
  onForecastGeneration: (results: ForecastResult[], selectedSKU: string) => void;
  selectedSKUForResults: string;
  onSKUChange: (sku: string) => void;
  shouldStartOptimization?: boolean;
  onOptimizationStarted?: () => void;
  aiForecastModelOptimizationEnabled?: boolean;
  optimizationQueue: OptimizationQueue;
}

export const ForecastModels = forwardRef<any, ForecastModelsProps>(({ 
  data, 
  forecastPeriods,
  onForecastGeneration,
  selectedSKUForResults,
  onSKUChange,
  shouldStartOptimization = false,
  onOptimizationStarted,
  aiForecastModelOptimizationEnabled = true,
  optimizationQueue
}, ref) => {
  const [showOptimizationLog, setShowOptimizationLog] = useState(false);
  const componentMountedRef = useRef(false);

  const {
    models,
    toggleModel,
    updateParameter,
    resetToManual,
    handleMethodSelection,
    generateForecasts
  } = useModelController(
    selectedSKUForResults,
    data,
    forecastPeriods,
    undefined,
    onForecastGeneration
  );

  const {
    isOptimizing,
    progress,
    handleQueueOptimization
  } = useOptimizationHandler(data, selectedSKUForResults, generateForecasts, aiForecastModelOptimizationEnabled);

  useAutoOptimization({
    optimizationQueue,
    isOptimizing,
    handleQueueOptimization,
    onOptimizationStarted,
    aiForecastModelOptimizationEnabled,
    componentMountedRef
  });

  const { hasTriggeredOptimizationRef } = useOptimizationTrigger({
    shouldStartOptimization,
    isOptimizing,
    handleQueueOptimization,
    onOptimizationStarted,
    componentMountedRef
  });

  useEffect(() => {
    componentMountedRef.current = true;
    return () => {
      componentMountedRef.current = false;
    };
  }, [aiForecastModelOptimizationEnabled]);

  useEffect(() => {
    const skus = Array.from(new Set(data.map(d => d['Material Code']))).sort();
    if (skus.length > 0 && !selectedSKUForResults) {
      onSKUChange(skus[0]);
    }
  }, [data, selectedSKUForResults, onSKUChange]);

  useImperativeHandle(ref, () => ({
    startOptimization: handleQueueOptimization
  }));

  return (
    <div className="space-y-6">
      <ForecastModelsContent
        data={data}
        selectedSKU={selectedSKUForResults}
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
        aiForecastModelOptimizationEnabled={aiForecastModelOptimizationEnabled}
      />

      <OptimizationLogger 
        isVisible={showOptimizationLog} 
        onClose={() => setShowOptimizationLog(false)} 
      />
    </div>
  );
});

ForecastModels.displayName = 'ForecastModels';
