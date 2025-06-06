
import { useCallback } from 'react';
import { SalesData } from '@/pages/Index';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useBatchOptimization } from '@/hooks/useBatchOptimization';
import { useNavigationAwareOptimization } from '@/hooks/useNavigationAwareOptimization';
import { useModelManagement } from '@/hooks/useModelManagement';
import { OptimizationFactors } from '@/types/optimizationTypes';
import { PreferenceValue, useManualAIPreferences } from '@/hooks/useManualAIPreferences';
import { useAutoBestMethod } from '@/hooks/useAutoBestMethod';
import { hasOptimizableParameters, getDefaultModels } from '@/utils/modelConfig';

interface OptimizationQueue {
  getSKUsInQueue: () => string[];
  getQueuedCombinations: () => Array<{sku: string, modelId: string}>;
  removeSKUsFromQueue: (skus: string[]) => void;
  removeSKUModelPairsFromQueue: (pairs: Array<{sku: string, modelId: string}>) => void;
  removeUnnecessarySKUs: (skus: string[]) => void;
  clearCacheAndPreferencesForSKU?: (sku: string) => void;
  getModelsForSKU: (sku: string) => string[];
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
    getSKUsNeedingOptimization,
    setSelectedMethod,
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
  const { loadAutoBestMethod, saveAutoBestMethod } = useAutoBestMethod();

  // Helper function to get the best available method for automatic selection
  const getBestAvailableMethod = useCallback((sku: string, modelId: string, currentDataHash: string) => {
    const cached = cache[sku]?.[modelId];
    if (!cached) return 'manual';

    const hasValidAI = cached.ai && cached.ai.dataHash === currentDataHash;
    const hasValidGrid = cached.grid && cached.grid.dataHash === currentDataHash;

    // Priority: AI > Grid > Manual
    if (hasValidAI) return 'ai';
    if (hasValidGrid) return 'grid';
    return 'manual';
  }, [cache]);

  const handleQueueOptimization = useCallback(async () => {
    if (!optimizationQueue) {
      console.log('🚫 OPTIMIZATION: No optimization queue provided');
      return;
    }

    const queuedCombinations = optimizationQueue.getQueuedCombinations();
    if (queuedCombinations.length === 0) {
      console.log('🚫 OPTIMIZATION: No SKU/model combinations in queue');
      return;
    }

    console.log('🚀 OPTIMIZATION: Starting queue processing for combinations:', queuedCombinations);
    console.log('🚀 OPTIMIZATION: Grok API enabled:', grokApiEnabled);

    // Get the default optimizable models
    const defaultModels = getDefaultModels();
    const optimizableModels = defaultModels.filter(m => hasOptimizableParameters(m));
    
    console.log('🚀 OPTIMIZATION: Available optimizable models:', optimizableModels.map(m => m.id));

    // Filter combinations to only include models that actually exist and are optimizable
    const validCombinations = queuedCombinations.filter(combo => 
      optimizableModels.some(model => model.id === combo.modelId)
    );

    if (validCombinations.length === 0) {
      console.log('🧹 OPTIMIZATION: No valid optimizable combinations found, clearing queue');
      const queuedSKUs = optimizationQueue.getSKUsInQueue();
      if (optimizationQueue.removeUnnecessarySKUs) {
        optimizationQueue.removeUnnecessarySKUs(queuedSKUs);
      } else {
        optimizationQueue.removeSKUsFromQueue(queuedSKUs);
      }
      return;
    }

    // Check which combinations actually need optimization
    const skusNeedingOptimization = getSKUsNeedingOptimization(data, optimizableModels);
    const validSKUsSet = new Set(skusNeedingOptimization.map(item => item.sku));
    
    const combinationsToOptimize = validCombinations.filter(combo => 
      validSKUsSet.has(combo.sku)
    );
    
    const unnecessaryCombinations = validCombinations.filter(combo => 
      !validSKUsSet.has(combo.sku)
    );

    console.log('🚀 OPTIMIZATION: Combinations that need optimization:', combinationsToOptimize.length);
    console.log('🧹 OPTIMIZATION: Unnecessary combinations:', unnecessaryCombinations.length);

    // Remove unnecessary combinations from queue
    if (unnecessaryCombinations.length > 0 && optimizationQueue.removeSKUModelPairsFromQueue) {
      optimizationQueue.removeSKUModelPairsFromQueue(unnecessaryCombinations);
    }

    // If no combinations actually need optimization, we're done
    if (combinationsToOptimize.length === 0) {
      console.log('🧹 OPTIMIZATION: No combinations need optimization, done');
      return;
    }

    // Extract unique SKUs from the combinations that need optimization
    const skusToOptimize = Array.from(new Set(combinationsToOptimize.map(combo => combo.sku)));
    
    markOptimizationStarted(data, '/');
    
    await optimizeQueuedSKUs(
      data, 
      optimizableModels,
      skusToOptimize,
      (sku, modelId, parameters, confidence, reasoning, factors, expectedAccuracy, method, bothResults) => {
        console.log(`💾 CACHE: Processing optimization result for ${sku}:${modelId}, method: ${method}`);
        
        // CRITICAL: Only cache models with optimizable parameters
        const model = optimizableModels.find(m => m.id === modelId);
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
          
          // Update AutoBestMethod and set "selected" to the best available
          const autoMethods = loadAutoBestMethod();
          const autoKey = `${sku}:${modelId}`;
          const bestMethod = bothResults.ai ? 'ai' : 'grid';
          autoMethods[autoKey] = bestMethod;
          saveAutoBestMethod(autoMethods);
          
          // Set "selected" to match the AutoBestMethod after optimization
          setSelectedMethod(sku, modelId, bestMethod);
          
          console.log(`🎯 AUTO-METHOD: Set ${autoKey} -> ${bestMethod} (dual optimization)`);
          console.log(`🎯 SELECTED: Set ${autoKey} selected -> ${bestMethod} (matches auto method)`);
        } else {
          console.log(`💾 CACHE: Storing single result for ${sku}:${modelId}, method: ${method}`);
          setCachedParameters(sku, modelId, parameters, dataHash, confidence, reasoning, typedFactors, expectedAccuracy, method);
          
          // Update AutoBestMethod and set "selected" to match
          const autoMethods = loadAutoBestMethod();
          const autoKey = `${sku}:${modelId}`;
          const bestAvailableMethod = getBestAvailableMethod(sku, modelId, dataHash);
          autoMethods[autoKey] = bestAvailableMethod;
          saveAutoBestMethod(autoMethods);
          
          // Set "selected" to match the AutoBestMethod after optimization
          setSelectedMethod(sku, modelId, bestAvailableMethod);
          
          console.log(`🎯 AUTO-METHOD: Set ${autoKey} -> ${bestAvailableMethod} (single optimization)`);
          console.log(`🎯 SELECTED: Set ${autoKey} selected -> ${bestAvailableMethod} (matches auto method)`);
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
        
        // Get all models for this SKU from the current queue state
        const modelsForSKU = optimizationQueue.getModelsForSKU(sku);
        console.log(`🗑️ QUEUE: Found ${modelsForSKU.length} models for completed SKU ${sku}:`, modelsForSKU);
        
        // Create SKU/model pairs to remove
        const pairsToRemove = modelsForSKU.map(modelId => ({ sku, modelId }));
        console.log('🗑️ QUEUE: Removing pairs for completed SKU:', pairsToRemove);
        
        // Remove the completed SKU/model pairs immediately
        if (optimizationQueue.removeSKUModelPairsFromQueue && pairsToRemove.length > 0) {
          optimizationQueue.removeSKUModelPairsFromQueue(pairsToRemove);
          console.log(`✅ QUEUE: Successfully removed ${pairsToRemove.length} pairs for SKU ${sku}`);
        } else {
          // Fallback to removing the entire SKU
          optimizationQueue.removeSKUsFromQueue([sku]);
          console.log(`✅ QUEUE: Fallback - removed entire SKU ${sku} from queue`);
        }
        
        // Log queue state after removal
        const remainingCombinations = optimizationQueue.getQueuedCombinations();
        console.log(`📊 QUEUE: After removal - ${remainingCombinations.length} combinations remaining`);
        
        // Trigger forecast refresh if this is the selected SKU
        if (sku === selectedSKU && onOptimizationComplete) {
          console.log(`🔄 FORECAST: Triggering refresh for selected SKU ${sku}`);
          setTimeout(() => {
            onOptimizationComplete();
          }, 200);
        }
      },
      getSKUsNeedingOptimization,
      grokApiEnabled
    );

    // Mark optimization completed after a slight delay to ensure all updates are processed
    setTimeout(() => {
      markOptimizationCompleted(data, '/');
    }, 1000);
  }, [optimizationQueue, models, data, selectedSKU, markOptimizationStarted, optimizeQueuedSKUs, generateDataHash, setCachedParameters, loadAutoBestMethod, saveAutoBestMethod, setSelectedMethod, setModels, markOptimizationCompleted, getSKUsNeedingOptimization, onOptimizationComplete, grokApiEnabled, getBestAvailableMethod]);

  return {
    isOptimizing,
    progress,
    handleQueueOptimization
  };
};
