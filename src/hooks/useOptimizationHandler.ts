
import { useCallback } from 'react';
import { SalesData } from '@/pages/Index';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useBatchOptimization } from '@/hooks/useBatchOptimization';
import { useNavigationAwareOptimization } from '@/hooks/useNavigationAwareOptimization';
import { useModelManagement } from '@/hooks/useModelManagement';
import { OptimizationFactors } from '@/types/optimizationTypes';
import { PreferenceValue } from '@/hooks/useManualAIPreferences';
import { hasOptimizableParameters } from '@/utils/modelConfig';

interface OptimizationQueue {
  getSKUsInQueue: () => string[];
  removeSKUsFromQueue: (skus: string[]) => void;
  clearCacheAndPreferencesForSKU?: (sku: string) => void;
}

export const useOptimizationHandler = (
  data: SalesData[],
  selectedSKU: string,
  optimizationQueue?: OptimizationQueue,
  onOptimizationComplete?: () => void,
  grokApiEnabled: boolean = true
) => {
  const {
    generateDataHash,
    setCachedParameters,
    getSKUsNeedingOptimization
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

  const handleQueueOptimization = useCallback(async () => {
    if (!optimizationQueue) {
      return;
    }

    const queuedSKUs = optimizationQueue.getSKUsInQueue();
    if (queuedSKUs.length === 0) {
      return;
    }

    // Filter models to only those with optimizable parameters
    const enabledModels = models.filter(m => m.enabled && hasOptimizableParameters(m));
    
    // If no models have optimizable parameters, clear the queue
    if (enabledModels.length === 0) {
      console.log('🗄️ OPTIMIZATION: No models with optimizable parameters, clearing queue');
      optimizationQueue.removeSKUsFromQueue(queuedSKUs);
      return;
    }

    // Check which SKUs actually need optimization
    const skusNeedingOptimization = getSKUsNeedingOptimization(data, models, undefined, grokApiEnabled);
    const validQueuedSKUs = queuedSKUs.filter(sku => 
      skusNeedingOptimization.some(item => item.sku === sku)
    );

    // Remove SKUs that don't need optimization
    const skusToRemove = queuedSKUs.filter(sku => !validQueuedSKUs.includes(sku));
    if (skusToRemove.length > 0) {
      console.log('🗄️ OPTIMIZATION: Removing SKUs that don\'t need optimization:', skusToRemove);
      optimizationQueue.removeSKUsFromQueue(skusToRemove);
    }

    // If no SKUs actually need optimization, return
    if (validQueuedSKUs.length === 0) {
      console.log('🗄️ OPTIMIZATION: No SKUs need optimization, queue cleared');
      return;
    }
    
    markOptimizationStarted(data, '/');
    
    await optimizeQueuedSKUs(
      data, 
      enabledModels,
      validQueuedSKUs,
      (sku, modelId, parameters, confidence, reasoning, factors, expectedAccuracy, method, bothResults) => {
        const skuData = data.filter(d => d.sku === sku);
        const dataHash = generateDataHash(skuData);
        
        const typedFactors: OptimizationFactors = {
          stability: factors?.stability || 0,
          interpretability: factors?.interpretability || 0,
          complexity: factors?.complexity || 0,
          businessImpact: factors?.businessImpact || 'Unknown'
        };
        
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
        
        const preferences = loadManualAIPreferences();
        const preferenceKey = `${sku}:${modelId}`;
        let newPreference: PreferenceValue = 'ai';
        
        if (method === 'grid_search') {
          newPreference = 'grid';
        } else if (method?.startsWith('ai_')) {
          newPreference = 'ai';
        }
        
        preferences[preferenceKey] = newPreference;
        saveManualAIPreferences(preferences);
        
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
        // Delay queue removal to ensure UI updates are complete
        setTimeout(() => {
          optimizationQueue.removeSKUsFromQueue([sku]);
          
          if (sku === selectedSKU && onOptimizationComplete) {
            setTimeout(() => {
              onOptimizationComplete();
            }, 200);
          }
        }, 500); // Give more time for UI updates
      },
      (data, models, cache) => getSKUsNeedingOptimization(data, models, cache, grokApiEnabled)
    );

    // Mark optimization completed after a slight delay to ensure all updates are processed
    setTimeout(() => {
      markOptimizationCompleted(data, '/');
    }, 1000);
  }, [optimizationQueue, models, data, selectedSKU, grokApiEnabled, markOptimizationStarted, optimizeQueuedSKUs, generateDataHash, setCachedParameters, loadManualAIPreferences, saveManualAIPreferences, setModels, markOptimizationCompleted, getSKUsNeedingOptimization, onOptimizationComplete]);

  return {
    isOptimizing,
    progress,
    handleQueueOptimization
  };
};
