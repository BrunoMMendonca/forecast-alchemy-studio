
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
      console.log('🔧 HANDLER: No optimization queue provided');
      return;
    }

    const queuedSKUs = optimizationQueue.getSKUsInQueue();
    if (queuedSKUs.length === 0) {
      console.log('🔧 HANDLER: Queue is empty');
      return;
    }

    console.log('🔧 HANDLER: Starting optimization for queued SKUs:', queuedSKUs);

    const enabledModels = models.filter(m => m.enabled);
    const modelsWithOptimizableParams = enabledModels.filter(m => hasOptimizableParameters(m));
    
    console.log('🔧 HANDLER: Models with optimizable parameters:', modelsWithOptimizableParams.map(m => m.id));

    // If no models have optimizable parameters, remove all SKUs immediately
    if (modelsWithOptimizableParams.length === 0) {
      console.log('🔧 HANDLER: No models with optimizable parameters - removing all SKUs from queue');
      optimizationQueue.removeSKUsFromQueue(queuedSKUs);
      return;
    }

    // Check which SKUs actually need optimization
    const skusNeedingOptimization = getSKUsNeedingOptimization(data, modelsWithOptimizableParams);
    const skusNeedingOptimizationList = skusNeedingOptimization.map(item => item.sku);
    
    // Remove SKUs that don't need optimization
    const skusNotNeedingOptimization = queuedSKUs.filter(sku => !skusNeedingOptimizationList.includes(sku));
    if (skusNotNeedingOptimization.length > 0) {
      console.log('🔧 HANDLER: Removing SKUs that don\'t need optimization:', skusNotNeedingOptimization);
      optimizationQueue.removeSKUsFromQueue(skusNotNeedingOptimization);
    }

    // Get the final list of SKUs to optimize
    const finalSKUsToOptimize = queuedSKUs.filter(sku => skusNeedingOptimizationList.includes(sku));
    
    if (finalSKUsToOptimize.length === 0) {
      console.log('🔧 HANDLER: No SKUs need optimization after filtering');
      return;
    }

    console.log('🔧 HANDLER: Final SKUs to optimize:', finalSKUsToOptimize);
    
    markOptimizationStarted(data, '/');
    
    await optimizeQueuedSKUs(
      data, 
      modelsWithOptimizableParams,
      finalSKUsToOptimize,
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
        // SKU completion callback - remove immediately when called
        console.log('🔧 HANDLER: SKU optimization completed:', sku);
        optimizationQueue.removeSKUsFromQueue([sku]);
        
        if (sku === selectedSKU && onOptimizationComplete) {
          setTimeout(() => {
            onOptimizationComplete();
          }, 200);
        }
      },
      getSKUsNeedingOptimization
    );

    // Mark optimization completed after all SKUs are processed
    setTimeout(() => {
      markOptimizationCompleted(data, '/');
      console.log('🔧 HANDLER: Optimization session completed');
    }, 1000);
  }, [optimizationQueue, models, data, selectedSKU, markOptimizationStarted, optimizeQueuedSKUs, generateDataHash, setCachedParameters, loadManualAIPreferences, saveManualAIPreferences, setModels, markOptimizationCompleted, getSKUsNeedingOptimization, onOptimizationComplete]);

  return {
    isOptimizing,
    progress,
    handleQueueOptimization
  };
};
