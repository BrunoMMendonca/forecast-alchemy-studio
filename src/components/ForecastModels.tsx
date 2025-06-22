import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { NormalizedSalesData, ForecastResult } from '@/types/forecast';
import { useModelController } from '@/hooks/useModelController';
import { OptimizationLogger } from './OptimizationLogger';
import { WorkerProgressIndicator } from './WorkerProgressIndicator';

interface ForecastModelsProps {
  data: NormalizedSalesData[];
  forecastPeriods: number;
  onForecastGeneration: (results: ForecastResult[], selectedSKU: string) => void;
  selectedSKUForResults: string;
  onSKUChange: (sku: string) => void;
  shouldStartOptimization?: boolean;
  onOptimizationStarted?: () => void;
  aiForecastModelOptimizationEnabled?: boolean;
}

export const ForecastModels = forwardRef<any, ForecastModelsProps>(({ 
  data, 
  forecastPeriods,
  onForecastGeneration,
  selectedSKUForResults,
  onSKUChange,
  shouldStartOptimization = false,
  onOptimizationStarted,
  aiForecastModelOptimizationEnabled = true
}, ref) => {
  const [showOptimizationLog, setShowOptimizationLog] = useState(false);
  const componentMountedRef = useRef(false);

  const {
    models,
    toggleModel,
    updateParameter,
    resetToManual,
    handleMethodSelection,
    generateForecasts,
    isGenerating,
    generationProgress,
    generationProgressMessage
  } = useModelController(
    selectedSKUForResults,
    data,
    forecastPeriods,
    undefined,
    onForecastGeneration,
    aiForecastModelOptimizationEnabled
  );

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
    // No optimization methods needed since backend handles this
  }));

  return (
    <div className="space-y-6">
      {/* Worker Progress Indicators */}
      <WorkerProgressIndicator
        isWorking={isGenerating}
        progress={generationProgress}
        message={generationProgressMessage}
        title="Generating Forecasts"
      />
      
      {/* Optimization progress is now shown in the queue popup, not here */}

      <OptimizationLogger 
        isVisible={showOptimizationLog} 
        onClose={() => setShowOptimizationLog(false)} 
      />
    </div>
  );
});

ForecastModels.displayName = 'ForecastModels';
