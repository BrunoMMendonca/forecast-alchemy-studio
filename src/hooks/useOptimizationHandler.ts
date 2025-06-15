import { useCallback } from 'react';
import { NormalizedSalesData } from '@/pages/Index';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useBatchOptimization } from '@/hooks/useBatchOptimization';
import { useNavigationAwareOptimization } from '@/hooks/useNavigationAwareOptimization';
import { OptimizationFactors } from '@/types/optimizationTypes';
import { PreferenceValue, useManualAIPreferences } from '@/hooks/useManualAIPreferences';
import { hasOptimizableParameters, getDefaultModels } from '@/utils/modelConfig';
import { useUnifiedState } from '@/hooks/useUnifiedState';

export const useOptimizationHandler = (
  data: NormalizedSalesData[],
  selectedSKU: string,
  onOptimizationComplete?: () => void,
  grokApiEnabled: boolean = true
) => {
  const {
    generateDataHash,
    setCachedParameters,
    getSKUsNeedingOptimization,
    cache
  } = useOptimizationCache();
  
  const { isOptimizing, progress, optimizeQueuedSKUs } = useBatchOptimization();

  const {
    markOptimizationStarted,
    markOptimizationCompleted
  } = useNavigationAwareOptimization();

  // Use unified state for models and queue
  const {
    models,
    setModels,
    optimizationQueue,
    setOptimizationProgress,
    setIsOptimizing,
    addToQueue,
    removeFromQueue,
    // If you have preferences in unified state, add them here
  } = useUnifiedState();

  // Helper function to cache manual parameters for all SKUs
  const cacheManualParametersForSKUs = useCallback((skusToCache: string[]) => {
    const defaultModels = getDefaultModels();
    const optimizableModels = defaultModels.filter(m => hasOptimizableParameters(m));
    skusToCache.forEach(sku => {
      const skuData = data.filter(d => d['Material Code'] === sku);
      if (skuData.length < 3) return; // Skip SKUs with insufficient data
      const dataHash = generateDataHash(skuData);
      optimizableModels.forEach(model => {
        // Check if manual parameters are already cached and valid
        const cached = cache[sku]?.[model.id];
        const hasValidManual = cached?.manual && cached.manual.dataHash === dataHash;
        if (!hasValidManual) {
          // Use default model parameters as manual baseline
          const manualParameters = model.parameters || {};
          setCachedParameters(
            sku,
            model.id,
            manualParameters,
            dataHash,
            70, // Default confidence for manual
            'Using default model parameters. No optimization applied.',
            {
              stability: 70,
              interpretability: 90,
              complexity: 10,
              businessImpact: 'Baseline configuration with default parameters'
            },
            70, // Default expected accuracy
            'manual'
          );
        }
      });
    });
  }, [data, generateDataHash, setCachedParameters, cache]);

  const handleQueueOptimization = useCallback(async () => {
    markOptimizationStarted(data);
    setIsOptimizing(true);
    const defaultModels = getDefaultModels();
    const optimizableModels = defaultModels.filter(m => hasOptimizableParameters(m));
    const skusToOptimize = Array.from(new Set(data.map(d => d['Material Code'])));
    await optimizeQueuedSKUs(
      data, 
      optimizableModels,
      skusToOptimize,
      (sku, modelId, parameters, confidence, reasoning, factors, expectedAccuracy, method, bothResults) => {
        const skuData = data.filter(d => d['Material Code'] === sku);
        const dataHash = generateDataHash(skuData);
        const typedFactors: OptimizationFactors = {
          stability: factors?.stability || 0,
          interpretability: factors?.interpretability || 0,
          complexity: factors?.complexity || 0,
          businessImpact: factors?.businessImpact || 'Unknown'
        };
        // Cache the optimization results - handle both single and dual results
        if (bothResults) {
          if (bothResults.ai) {
            setCachedParameters(
              sku, 
              modelId, 
              bothResults.ai.parameters, 
              dataHash,
              bothResults.ai.confidence,
              bothResults.ai.reasoning,
              bothResults.ai.factors,
              bothResults.ai.expectedAccuracy,
              'ai'
            );
          }
          if (bothResults.grid) {
            setCachedParameters(
              sku, 
              modelId, 
              bothResults.grid.parameters, 
              dataHash,
              bothResults.grid.confidence,
              bothResults.grid.reasoning,
              bothResults.grid.factors,
              bothResults.grid.expectedAccuracy,
              'grid'
            );
            // --- NEW: Copy Grid params to Manual after optimization ---
            console.log('[OPTIMIZATION] Copying Grid parameters to Manual for', sku, modelId, bothResults.grid.parameters);
            setCachedParameters(
              sku,
              modelId,
              bothResults.grid.parameters,
              dataHash,
              70, // Default confidence for manual
              'Manual parameters reset to Grid after optimization',
              bothResults.grid.factors,
              bothResults.grid.expectedAccuracy,
              'manual'
            );
          }
        } else {
          setCachedParameters(sku, modelId, parameters, dataHash, confidence, reasoning, typedFactors, expectedAccuracy, method);
        }
        // Update model state
        const newModels = models.map(model => 
          model.id === modelId 
            ? { 
                ...model, 
                optimizedParameters: parameters,
                optimizationConfidence: confidence,
                optimizationReasoning: reasoning,
                optimizationFactors: typedFactors,
                expectedAccuracy: expectedAccuracy,
                optimizationMethod: method,
                isWinner: bothResults?.selectedResult?.isWinner || false
              }
            : model
        );
        setModels(newModels);
      },
      (sku) => {
        // SKU complete callback
        console.log(`Optimization completed for SKU: ${sku}`);
      },
      (data, models) => {
        // Get SKUs needing optimization
        return skusToOptimize.map(sku => ({ sku, models: optimizableModels.map(m => m.id) }));
      },
      grokApiEnabled
    );
    setIsOptimizing(false);
    markOptimizationCompleted(data);
    if (onOptimizationComplete) onOptimizationComplete();
  }, [data, generateDataHash, setCachedParameters, setModels, optimizeQueuedSKUs, markOptimizationStarted, markOptimizationCompleted, setIsOptimizing, onOptimizationComplete, models]);

  return {
    isOptimizing,
    progress,
    handleQueueOptimization
  };
};
