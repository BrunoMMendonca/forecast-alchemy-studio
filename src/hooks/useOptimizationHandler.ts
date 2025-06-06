
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

  const handleQueueOptimization = useCallback(async () => {
    if (!optimizationQueue) {
      console.log('🚫 OPTIMIZATION: No optimization queue provided');
      return;
    }

    const queuedSKUs = optimizationQueue.getSKUsInQueue();
    if (queuedSKUs.length === 0) {
      console.log('🚫 OPTIMIZATION: No SKUs in queue');
      return;
    }

    console.log('🚀 OPTIMIZATION: Starting queue processing for SKUs:', queuedSKUs);

    const enabledModels = models.filter(m => m.enabled);
    const optimizableModels = enabledModels.filter(m => hasOptimizableParameters(m));
    
    console.log('🚀 OPTIMIZATION: Enabled models:', enabledModels.map(m => m.id));
    console.log('🚀 OPTIMIZATION: Optimizable models:', optimizableModels.map(m => m.id));
    console.log('🚀 OPTIMIZATION: Non-optimizable models (will skip):', enabledModels.filter(m => !hasOptimizableParameters(m)).map(m => m.id));

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
        console.log(`💾 CACHE: Processing optimization result for ${sku}:${modelId}, method: ${method}`);
        
        // CRITICAL: Only cache models with optimizable parameters
        const model = models.find(m => m.id === modelId);
        if (!model || !hasOptimizableParameters(model)) {
          console.log(`🚫 CACHE: Skipping cache for ${sku}:${modelId} - no optimizable parameters`);
          return;
        }

        const skuData = data.filter(d => d.sku === sku);
        const dataHash = generateDataHash(skuData);
        
        const typedFactors: OptimizationFactors = {
          stability: factors?.stability || 0,
          interpretability: factors?.interpretability || 0,
          complexity: factors?.complexity || 0,
          businessImpact: factors?.businessImpact || 'Unknown'
        };
        
        // Cache the optimization results - handle both single and dual results
        if (bothResults) {
          console.log(`💾 CACHE: Storing dual results for ${sku}:${modelId}`);
          
          if (bothResults.ai) {
            console.log(`💾 CACHE: Storing AI result for ${sku}:${modelId}`);
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
            console.log(`💾 CACHE: Storing Grid result for ${sku}:${modelId}`);
            setCachedParameters(
              sku, 
              modelId, 
              bothResults.grid.parameters, 
              dataHash,
              bothResults.grid.confidence,
              bothResults.grid.reasoning,
              bothResults.grid.factors,
              bothResults.grid.expectedAccuracy,
              'grid_search'
            );
          }
          
          // Set preference to best available method
          const preferences = loadManualAIPreferences();
          const preferenceKey = `${sku}:${modelId}`;
          const bestMethod = bothResults.ai ? 'ai' : 'grid';
          preferences[preferenceKey] = bestMethod;
          saveManualAIPreferences(preferences);
          savePreferences(preferences);
          
          console.log(`🎯 PREFERENCE: Set ${preferenceKey} -> ${bestMethod} (dual optimization)`);
        } else {
          console.log(`💾 CACHE: Storing single result for ${sku}:${modelId}, method: ${method}`);
          setCachedParameters(sku, modelId, parameters, dataHash, confidence, reasoning, typedFactors, expectedAccuracy, method);
          
          // Set preference based on the method used
          const preferences = loadManualAIPreferences();
          const preferenceKey = `${sku}:${modelId}`;
          const preferenceMethod = method === 'ai_optimization' ? 'ai' : method === 'grid_search' ? 'grid' : 'manual';
          preferences[preferenceKey] = preferenceMethod;
          saveManualAIPreferences(preferences);
          savePreferences(preferences);
          
          console.log(`🎯 PREFERENCE: Set ${preferenceKey} -> ${preferenceMethod} (single optimization)`);
        }
        
        // Update model state
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
  }, [optimizationQueue, models, data, selectedSKU, markOptimizationStarted, optimizeQueuedSKUs, generateDataHash, setCachedParameters, loadManualAIPreferences, saveManualAIPreferences, savePreferences, setModels, markOptimizationCompleted, getSKUsNeedingOptimization, onOptimizationComplete]);

  return {
    isOptimizing,
    progress,
    handleQueueOptimization
  };
};
