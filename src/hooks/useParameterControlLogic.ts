import { useState, useCallback, useMemo } from 'react';
import { ModelConfig, SalesData } from '@/types/forecast';
import { useToast } from '@/hooks/use-toast';

interface OptimizationData {
  confidence?: number;
  expectedAccuracy?: number;
  reasoning?: any;
  factors?: any;
  method?: string;
}

export const useParameterControlLogic = (
  model: ModelConfig,
  selectedSKU: string,
  data: SalesData[],
  onParameterUpdate?: (parameter: string, value: number) => void
) => {
  const { toast } = useToast();
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);
  const [localSelectedMethod, setLocalSelectedMethod] = useState<'ai' | 'grid' | 'manual' | undefined>(
    'grid'
  );

  // Determine if the model can be optimized
  const canOptimize = useMemo(() => {
    return model.parameters && Object.keys(model.parameters).length > 0;
  }, [model.parameters]);

  // Check if we're in manual mode
  const isManual = useMemo(() => {
    return !model.optimizationMethod || model.optimizationMethod === 'manual';
  }, [model.optimizationMethod]);

  // Check if the model has parameters
  const hasParameters = useMemo(() => {
    return model.parameters && Object.keys(model.parameters).length > 0;
  }, [model.parameters]);

  // Check if we have optimization results
  const hasOptimizationResults = useMemo(() => {
    return !!(model.gridParameters || model.optimizationConfidence || model.optimizationReasoning);
  }, [model.gridParameters, model.optimizationConfidence, model.optimizationReasoning]);

  // Get the current parameter value from the correct set
  const getParameterValue = useCallback((parameter: string): number | undefined => {
    if (localSelectedMethod === 'ai' && model.aiParameters && model.aiParameters[parameter] !== undefined) {
      return model.aiParameters[parameter];
    }
    if (localSelectedMethod === 'grid' && model.gridParameters && model.gridParameters[parameter] !== undefined) {
      return model.gridParameters[parameter];
    }
    if (model.manualParameters && model.manualParameters[parameter] !== undefined) {
      return model.manualParameters[parameter];
    }
    return undefined;
  }, [localSelectedMethod, model.aiParameters, model.gridParameters, model.manualParameters]);

  // Handle method change and update active parameters
  const handleMethodChange = useCallback((newMethod: 'ai' | 'grid' | 'manual') => {
    setLocalSelectedMethod(newMethod);
    let newParams: Record<string, number> | undefined = undefined;
    if (newMethod === 'ai' && model.aiParameters) {
      newParams = model.aiParameters;
    } else if (newMethod === 'grid' && model.gridParameters) {
      newParams = model.gridParameters;
    } else if (newMethod === 'manual' && model.manualParameters) {
      newParams = model.manualParameters;
    }
    // Update the active parameters in the parent state
    if (newParams && onParameterUpdate) {
      Object.entries(newParams).forEach(([parameter, value]) => {
        onParameterUpdate(parameter, value);
      });
    }
  }, [model.aiParameters, model.gridParameters, model.manualParameters, onParameterUpdate]);

  // Create optimization data object
  const optimizationData = useMemo((): OptimizationData | null => {
    if (!hasOptimizationResults) return null;

    return {
      confidence: model.optimizationConfidence,
      expectedAccuracy: model.expectedAccuracy,
      reasoning: model.optimizationReasoning,
      factors: model.optimizationFactors,
      method: model.optimizationMethod
    };
  }, [
    hasOptimizationResults,
    model.optimizationConfidence,
    model.expectedAccuracy,
    model.optimizationReasoning,
    model.optimizationFactors,
    model.optimizationMethod
  ]);

  // Cache version for UI updates
  const cacheVersion = useMemo(() => {
    return Date.now();
  }, [model.parameters, model.gridParameters, model.optimizationMethod]);

  return {
    isReasoningExpanded,
    setIsReasoningExpanded,
    localSelectedMethod,
    setLocalSelectedMethod: handleMethodChange,
    optimizationData,
    isManual: localSelectedMethod === 'manual',
    getParameterValue,
    canOptimize,
    hasParameters,
    hasOptimizationResults,
    cacheVersion,
    applyOptimizedParameters: undefined // deprecated
  };
}; 