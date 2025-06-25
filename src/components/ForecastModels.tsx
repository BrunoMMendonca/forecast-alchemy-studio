import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { NormalizedSalesData, ForecastResult } from '@/types/forecast';
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
      {/* Backend handles all model management and optimization */}
      <div className="text-center text-gray-500 py-8">
        <p>Model management and optimization are now handled by the backend.</p>
        <p>Check the job monitor for optimization progress.</p>
      </div>

      <OptimizationLogger 
        isVisible={showOptimizationLog} 
        onClose={() => setShowOptimizationLog(false)} 
      />
    </div>
  );
});

ForecastModels.displayName = 'ForecastModels';
