
import { useCallback } from 'react';
import { SalesData } from '@/pages/Index';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useBatchOptimization } from '@/hooks/useBatchOptimization';
import { useNavigationAwareOptimization } from '@/hooks/useNavigationAwareOptimization';
import { useModelManagement } from '@/hooks/useModelManagement';
import { OptimizationFactors } from '@/types/optimizationTypes';
import { PreferenceValue, useManualAIPreferences } from '@/hooks/useManualAIPreferences';
import { hasOptimizableParameters } from '@/utils/modelConfig';

interface OptimizationQueue {
  getSKUsInQueue: () => string[];
  removeSKUsFromQueue: (skus: string[]) => void;
  removeUnnecessarySKUs: (skus: string[]) => void;
  clearCacheAndPreferencesForSKU?: (sku: string) => void;
}

export const useOptimizationHandler = (
  data: SalesData[],
  selectedSKU: string,
  optimizationQueue?: OptimizationQueue,
  onOptimizationComplete?: () => void
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

  const {
    models,
    setModels,
    loadManualAIPreferences,
    saveManualAIPreferences
  } = useModelManagement(selectedSKU, data);

  const { saveManualAIPreferences: savePreferences } = useManualAIPreferences();

  // Helper function to determine best available method for a model
  const getBestAvailableMethod = useCallback((sku: string, modelId: string): PreferenceValue => {
    const cached = cache[sku]?.[modelId];
    if (!cached) return 'manual';

    const skuData = data.filter(d => d.sku === sku);
    const currentDataHash = generateDataHash(skuData);

    const hasValidAI = cached.ai && cached.ai.dataHash === currentDataHash;
    const hasValidGrid = cached.grid && cached.grid.dataHash === currentDataHash;

    // Priority: AI > Grid > Manual
    if (hasValidAI) return 'ai';
    if (hasValidGrid) return 'grid';
    return 'manual';
  }, [cache, data, generateDataHash]);

  const handleQueueOptimization = useCallback(async () => {
    if (!optimizationQueue) {
      return;
    }

    const queuedSKUs = optimizationQueue.getSKUsInQueue();
    if (queuedSKUs.length === 0) {
      return;
    }

    console.log('🚀 OPTIMIZATION: Starting queue processing for SKUs:', queuedSKUs);

    const enabledModels = models.filter(m => m.enabled);
    const optimizableModels = enabledModels.filter(m => hasOptimizableParameters(m));
    
    console.log('🚀 OPTIMIZATION: Enabled models:', enabledModels.map(m => m.id));
    console.log('🚀 OPTIMIZATION: Optimizable models:', optimizableModels.map(m => m.id));

    // If no models have optimizable parameters, remove all SKUs from queue
    if (optimizableModels.length === 0) {
      console.log('🧹 OPTIMIZATION: No optimizable models found, clearing queue');
      if (optimizationQueue.removeUnnecessarySKUs) {
        optimizationQueue.removeUnnecessarySKUs(queuedSKUs);
      } else {
        optimizationQueue.removeSKUsFromQueue(queuedSKUs);
      }
      return;
    }

    // Check which SKUs actually need optimization
    const skusNeedingOptimization = getSKUsNeedingOptimization(data, optimizableModels);
    const skusToOptimize = skusNeedingOptimization.map(item => item.sku);
    const unnecessarySKUs = queuedSKUs.filter(sku => !skusToOptimize.includes(sku));

    console.log('🚀 OPTIMIZATION: SKUs that need optimization:', skusToOptimize);
    console.log('🧹 OPTIMIZATION: SKUs that don\'t need optimization:', unnecessarySKUs);

    // Remove unnecessary SKUs from queue
    if (unnecessarySKUs.length > 0) {
      if (optimizationQueue.removeUnnecessarySKUs) {
        optimizationQueue.removeUnnecessarySKUs(unnecessarySKUs);
      } else {
        optimizationQueue.removeSKUsFromQueue(unnecessarySKUs);
      }
    }

    // If no SKUs actually need optimization, we're done
    if (skusToOptimize.length === 0) {
      console.log('🧹 OPTIMIZATION: No SKUs need optimization, done');
      return;
    }
    
    markOptimizationStarted(data, '/');
    
    await optimizeQueuedSKUs(
      data, 
      optimizableModels,
      skusToOptimize,
      (sku, modelId, parameters, confidence, reasoning, factors, expectedAccuracy, method, bothResults) => {
        const skuData = data.filter(d => d.sku === sku);
        const dataHash = generateDataHash(skuData);
        
        const typedFactors: OptimizationFactors = {
          stability: factors?.stability || 0,
          interpretability: factors?.interpretability || 0,
          complexity: factors?.complexity || 0,
          businessImpact: factors?.businessImpact || 'Unknown'
        };
        
        // Cache the optimization results
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
              bothResults.ai.method
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
              bothResults.grid.method
            );
          }
        } else {
          setCachedParameters(sku, modelId, parameters, dataHash, confidence, reasoning, typedFactors, expectedAccuracy, method);
        }
        
        // IMPORTANT: Update preferences to best available method after caching
        const preferences = loadManualAIPreferences();
        const preferenceKey = `${sku}:${modelId}`;
        const bestAvailableMethod = getBestAvailableMethod(sku, modelId);
        
        preferences[preferenceKey] = bestAvailableMethod;
        saveManualAIPreferences(preferences);
        savePreferences(preferences);
        
        console.log(`🎯 PREFERENCE UPDATE: ${preferenceKey} -> ${bestAvailableMethod} (after optimization)`);
        
        setModels(prev => prev.map(model => 
          model.id === modelId 
            ? { 
                ...model, 
                optimizedParameters: parameters,
                optimizationConfidence: confidence,
                optimizationReasoning: reasoning,
                optimizationFactors: typedFactors,
                expectedAccuracy: expectedAccuracy,
                optimizationMethod: method
              }
            : model
        ));
      },
      (sku) => {
        console.log('✅ OPTIMIZATION: SKU completed:', sku);
        // Delay queue removal to ensure UI updates are complete
        setTimeout(() => {
          optimizationQueue.removeSKUsFromQueue([sku]);
          
          if (sku === selectedSKU && onOptimizationComplete) {
            setTimeout(() => {
              onOptimizationComplete();
            }, 200);
          }
        }, 500);
      },
      getSKUsNeedingOptimization
    );

    // Mark optimization completed after a slight delay to ensure all updates are processed
    setTimeout(() => {
      markOptimizationCompleted(data, '/');
    }, 1000);
  }, [optimizationQueue, models, data, selectedSKU, markOptimizationStarted, optimizeQueuedSKUs, generateDataHash, setCachedParameters, loadManualAIPreferences, saveManualAIPreferences, savePreferences, getBestAvailableMethod, setModels, markOptimizationCompleted, getSKUsNeedingOptimization, onOptimizationComplete]);

  return {
    isOptimizing,
    progress,
    handleQueueOptimization
  };
};
