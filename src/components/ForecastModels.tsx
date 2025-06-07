
import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect, useMemo } from 'react';
import { SalesData, ForecastResult } from '@/pages/Index';
import { useModelController } from '@/hooks/useModelController';
import { useOptimizationHandler } from '@/hooks/useOptimizationHandler';
import { useAutoOptimization } from '@/hooks/useAutoOptimization';
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
  
  const {
    models,
    toggleModel,
    updateParameter,
    resetToManual,
    handleMethodSelection,
    generateForecasts
  } = useModelController(
    selectedSKU,
    data,
    forecastPeriods,
    undefined,
    onForecastGeneration
  );

  const queuedCombinations = useMemo(() => {
    return optimizationQueue?.getQueuedCombinations() || [];
  }, [optimizationQueue?.queueSize]);

  const {
    isOptimizing,
    progress,
    handleQueueOptimization
  } = useOptimizationHandler(data, selectedSKU, optimizationQueue, generateForecasts, grokApiEnabled);

  useAutoOptimization({
    optimizationQueue,
    isOptimizing,
    handleQueueOptimization,
    onOptimizationStarted,
    grokApiEnabled,
    componentMountedRef
  });

  useEffect(() => {
    componentMountedRef.current = true;
    
    return () => {
      componentMountedRef.current = false;
    };
  }, [grokApiEnabled]);

  useEffect(() => {
    const skus = Array.from(new Set(data.map(d => d.sku))).sort();
    if (skus.length > 0 && (!selectedSKU || selectedSKU === '')) {
      console.log('ForecastModels: Auto-selecting first SKU:', skus[0]);
      onSKUChange(skus[0]);
    }
  }, [data, selectedSKU, onSKUChange]);

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
        hasTriggeredOptimization={false}
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
