
import { useCallback } from 'react';
import { SalesData } from '@/pages/Index';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useBatchOptimization } from '@/hooks/useBatchOptimization';
import { useNavigationAwareOptimization } from '@/hooks/useNavigationAwareOptimization';
import { useModelManagement } from '@/hooks/useModelManagement';
import { OptimizationFactors } from '@/types/optimizationTypes';
import { PreferenceValue } from '@/hooks/useManualAIPreferences';

interface OptimizationQueue {
  getSKUsInQueue: () => string[];
  removeSKUsFromQueue: (skus: string[]) => void;
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
      console.warn('❌ QUEUE: No optimization queue provided');
      return;
    }

    const queuedSKUs = optimizationQueue.getSKUsInQueue();
    if (queuedSKUs.length === 0) {
      console.log('📋 QUEUE: No SKUs in queue for optimization');
      return;
    }

    const enabledModels = models.filter(m => m.enabled);
    
    console.log('🚀 QUEUE: Starting optimization for queued SKUs:', queuedSKUs);
    console.log('🚀 QUEUE: Using models:', enabledModels.map(m => m.id));
    
    markOptimizationStarted(data, '/');
    
    await optimizeQueuedSKUs(
      data, 
      enabledModels,
      queuedSKUs,
      (sku, modelId, parameters, confidence, reasoning, factors, expectedAccuracy, method) => {
        console.log(`✅ OPTIMIZATION CALLBACK: Received results for ${sku}:${modelId} with method ${method}`);
        const skuData = data.filter(d => d.sku === sku);
        const dataHash = generateDataHash(skuData);
        
        const typedFactors: OptimizationFactors = {
          stability: factors?.stability || 0,
          interpretability: factors?.interpretability || 0,
          complexity: factors?.complexity || 0,
          businessImpact: factors?.businessImpact || 'Unknown'
        };
        
        // Save to cache first
        setCachedParameters(sku, modelId, parameters, dataHash, confidence, reasoning, typedFactors, expectedAccuracy, method);
        console.log(`💾 CACHE SAVE: Saved ${method} results for ${sku}:${modelId}`);
        
        // Determine preference based on optimization method
        const preferences = loadManualAIPreferences();
        const preferenceKey = `${sku}:${modelId}`;
        let newPreference: PreferenceValue = 'ai'; // Default to AI
        
        if (method === 'grid_search') {
          newPreference = 'grid';
        } else if (method?.startsWith('ai_')) {
          newPreference = 'ai';
        }
        
        // Save preference with immediate effect
        preferences[preferenceKey] = newPreference;
        saveManualAIPreferences(preferences);
        
        console.log(`🎯 PREFERENCE SET: ${preferenceKey} = ${newPreference} (method: ${method})`);
        
        // Update models state immediately with optimized parameters
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
        
        console.log(`🔄 MODEL STATE: Updated model ${modelId} with optimized parameters`);
      },
      (sku) => {
        console.log(`🏁 OPTIMIZATION COMPLETE: Finished optimizing ${sku}`);
        optimizationQueue.removeSKUsFromQueue([sku]);
        
        // Trigger forecast generation for the selected SKU immediately
        if (sku === selectedSKU && onOptimizationComplete) {
          console.log(`🎯 TRIGGERING FORECAST: Optimization complete for selected SKU ${sku}`);
          // Add a small delay to ensure all state updates are complete
          setTimeout(() => {
            onOptimizationComplete();
          }, 200);
        }
      },
      getSKUsNeedingOptimization
    );

    markOptimizationCompleted(data, '/');
  }, [optimizationQueue, models, data, selectedSKU, markOptimizationStarted, optimizeQueuedSKUs, generateDataHash, setCachedParameters, loadManualAIPreferences, saveManualAIPreferences, setModels, markOptimizationCompleted, getSKUsNeedingOptimization, onOptimizationComplete]);

  return {
    isOptimizing,
    progress,
    handleQueueOptimization
  };
};
