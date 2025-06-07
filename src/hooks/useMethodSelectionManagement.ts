
import { useCallback } from 'react';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';

export const useMethodSelectionManagement = (
  selectedSKU: string,
  setSelectedMethod: (sku: string, modelId: string, method: 'ai' | 'grid' | 'manual') => void,
  setModels: React.Dispatch<React.SetStateAction<any[]>>,
  currentDataHash: string
) => {
  const { cache } = useOptimizationCache();

  // Method selection handler for badge clicks
  const handleMethodSelection = useCallback((modelId: string, method: 'ai' | 'grid' | 'manual') => {
    console.log(`🎯 METHOD SELECTION: ${modelId} -> ${method}`);
    
    // Update cache
    setSelectedMethod(selectedSKU, modelId, method);
    
    // Immediately update model state based on method
    setModels(prev => prev.map(model => {
      if (model.id !== modelId) return model;
      
      const cached = cache[selectedSKU]?.[modelId];
      
      if (method === 'manual') {
        // Try to restore manual parameters from cache first
        const manualCache = cached?.manual;
        if (manualCache && manualCache.dataHash === currentDataHash) {
          console.log(`🔄 RESTORING manual parameters from cache for ${modelId}`);
          return {
            ...model,
            parameters: manualCache.parameters,
            optimizedParameters: undefined,
            optimizationConfidence: undefined,
            optimizationReasoning: undefined,
            optimizationFactors: undefined,
            expectedAccuracy: undefined,
            optimizationMethod: undefined
          };
        } else {
          // Clear optimization data for manual mode
          return {
            ...model,
            optimizedParameters: undefined,
            optimizationConfidence: undefined,
            optimizationReasoning: undefined,
            optimizationFactors: undefined,
            expectedAccuracy: undefined,
            optimizationMethod: undefined
          };
        }
      } else {
        // Apply cached optimization data if available
        let selectedCache = null;
        if (method === 'ai' && cached?.ai) {
          selectedCache = cached.ai;
        } else if (method === 'grid' && cached?.grid) {
          selectedCache = cached.grid;
        }

        if (selectedCache) {
          return {
            ...model,
            optimizedParameters: selectedCache.parameters,
            optimizationConfidence: selectedCache.confidence,
            optimizationReasoning: selectedCache.reasoning,
            optimizationFactors: selectedCache.factors,
            expectedAccuracy: selectedCache.expectedAccuracy,
            optimizationMethod: selectedCache.method
          };
        }
      }
      
      return model;
    }));
  }, [selectedSKU, setSelectedMethod, setModels, cache, currentDataHash]);

  return {
    handleMethodSelection
  };
};
