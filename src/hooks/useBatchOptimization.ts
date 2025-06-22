import { useState, useCallback } from 'react';
import { NormalizedSalesData } from '@/types/forecast';
import { ModelConfig } from '@/types/forecast';
import { optimizationLogger } from '@/utils/optimizationLogger';
import { optimizeSingleModel } from '@/utils/singleModelOptimization';
import { useNavigationAwareOptimization } from '@/hooks/useNavigationAwareOptimization';
import { BusinessContext } from '@/types/businessContext';

interface OptimizationProgress {
  [sku: string]: {
    modelId: string;
    status: 'pending' | 'optimizing' | 'complete' | 'error';
    progress: number;
    result?: any;
    error?: string;
  };
}

interface BatchProgress {
  currentSKU?: string;
  completedSKUs: number;
  totalSKUs: number;
}

export const useBatchOptimization = () => {
  const [optimizationProgress, setOptimizationProgress] = useState<OptimizationProgress>({});
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const navigationAware = useNavigationAwareOptimization();

  const runOptimization = useCallback(async (
    skus: string[],
    data: NormalizedSalesData[],
    models: ModelConfig[],
    businessContext?: BusinessContext,
    forceGridSearch: boolean = false
  ) => {
    console.warn('🚫 FRONTEND OPTIMIZATION DISABLED: Use backend optimization system instead');
    console.warn('🚫 This function should not be called - all optimization should go through the backend queue');
    return;
  }, [navigationAware, optimizationLogger]);

  const optimizeQueuedSKUs = useCallback(async (
    data: NormalizedSalesData[],
    models: ModelConfig[],
    queuedSKUs: string[],
    onComplete: (sku: string, modelId: string, parameters: any, confidence: number, reasoning: string, factors: any, expectedAccuracy: number, method: string, bothResults?: any) => void,
    onSKUComplete: (sku: string) => void,
    getSKUsNeedingOptimization: (data: NormalizedSalesData[], models: ModelConfig[]) => { sku: string; models: string[] }[],
    aiForecastModelOptimizationEnabled: boolean = true
  ) => {
    console.warn('🚫 FRONTEND OPTIMIZATION DISABLED: Use backend optimization system instead');
    console.warn('🚫 This function should not be called - all optimization should go through the backend queue');
    return;
  }, []);

  return {
    optimizationProgress,
    isOptimizing,
    progress,
    runOptimization,
    optimizeQueuedSKUs
  };
};
