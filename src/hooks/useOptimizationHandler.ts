
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
      return;
    }

    const queuedSKUs = optimizationQueue.getSKUsInQueue();
    if (queuedSKUs.length === 0) {
      return;
    }

    const enabledModels = models.filter(m => m.enabled);
    
    markOptimizationStarted(data, '/');
    
    await optimizeQueuedSKUs(
      data, 
      enabledModels,
      queuedSKUs,
      (sku, modelId, parameters, confidence, reasoning, factors, expectedAccuracy, method, bothResults) => {
        const skuData = data.filter(d => d.sku === sku);
        const dataHash = generateDataHash(skuData);
        
        const typedFactors: OptimizationFactors = {
          stability: factors?.stability || 0,
          interpretability: factors?.interpretability || 0,
          complexity: factors?.complexity || 0,
          businessImpact: factors?.businessImpact || 'Unknown'
        };
        
        // Cache both AI and Grid results when available
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
          // Fallback to single result caching
          setCachedParameters(sku, modelId, parameters, dataHash, confidence, reasoning, typedFactors, expectedAccuracy, method);
        }
        
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
        
        // Update models state immediately with optimized parameters (from selected result)
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
        optimizationQueue.removeSKUsFromQueue([sku]);
        
        // Trigger forecast generation for the selected SKU immediately
        if (sku === selectedSKU && onOptimizationComplete) {
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
