
// DEPRECATED: This file is being replaced by useUnifiedModelManagement.ts
// TODO: Remove this file after confirming the unified hook works correctly

import { useState, useCallback, useRef, useEffect } from 'react';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { getDefaultModels } from '@/utils/modelConfig';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useManualAIPreferences } from '@/hooks/useManualAIPreferences';
import { getOptimizationByMethod } from '@/utils/singleModelOptimization';
import { BusinessContext } from '@/types/businessContext';

export const useModelManagement = (selectedSKU: string, data: SalesData[], businessContext?: BusinessContext) => {
  const { 
    generateDataHash, 
    setCachedParameters,
    setSelectedMethod,
    cacheVersion
  } = useOptimizationCache();
  const { loadManualAIPreferences, saveManualAIPreferences } = useManualAIPreferences();
  const isTogglingAIManualRef = useRef<boolean>(false);

  const [models, setModels] = useState<ModelConfig[]>(() => {
    return getDefaultModels();
  });

  // Create models with current cache and preferences - always read fresh from localStorage
  const createModelsWithCurrentData = useCallback(() => {
    if (!selectedSKU || isTogglingAIManualRef.current) {
      return getDefaultModels();
    }

    // Always read fresh from localStorage
    let optimizationCache = {};
    let preferences = {};
    
    try {
      const storedCache = localStorage.getItem('forecast_optimization_cache');
      optimizationCache = storedCache ? JSON.parse(storedCache) : {};
    } catch {
      optimizationCache = {};
    }
    
    try {
      const storedPrefs = localStorage.getItem('manual_ai_preferences');
      preferences = storedPrefs ? JSON.parse(storedPrefs) : {};
    } catch {
      preferences = {};
    }

    const skuData = data.filter(d => d.sku === selectedSKU);
    const currentDataHash = generateDataHash(skuData);

    return getDefaultModels().map(model => {
      const preferenceKey = `${selectedSKU}:${model.id}`;
      const preference = preferences[preferenceKey] || 'ai';
      const cached = optimizationCache[selectedSKU]?.[model.id];

      if (preference === 'manual') {
        return model;
      }

      // For AI/Grid preference, try to get the preferred method first
      let selectedCache = null;
      if (preference === 'ai' && cached?.ai && cached.ai.dataHash === currentDataHash) {
        selectedCache = cached.ai;
      } else if (preference === 'grid' && cached?.grid && cached.grid.dataHash === currentDataHash) {
        selectedCache = cached.grid;
      } else {
        // Fallback to any valid cache
        if (cached?.ai && cached.ai.dataHash === currentDataHash) {
          selectedCache = cached.ai;
        } else if (cached?.grid && cached.grid.dataHash === currentDataHash) {
          selectedCache = cached.grid;
        }
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

      return model;
    });
  }, [selectedSKU, data, generateDataHash, cacheVersion]);

  // Single effect that updates models when cache version changes
  useEffect(() => {
    if (selectedSKU && cacheVersion > 0) {
      const updatedModels = createModelsWithCurrentData();
      setModels(updatedModels);
    }
  }, [cacheVersion, selectedSKU, createModelsWithCurrentData]);

  // Effect for SKU changes
  useEffect(() => {
    if (selectedSKU) {
      const updatedModels = createModelsWithCurrentData();
      setModels(updatedModels);
    }
  }, [selectedSKU, createModelsWithCurrentData]);

  const toggleModel = (modelId: string) => {
    setModels(prev => prev.map(model => 
      model.id === modelId ? { ...model, enabled: !model.enabled } : model
    ));
  };

  const updateParameter = (modelId: string, parameter: string, value: number) => {
    isTogglingAIManualRef.current = true;
    
    const preferences = loadManualAIPreferences();
    const preferenceKey = `${selectedSKU}:${modelId}`;
    preferences[preferenceKey] = 'manual';
    saveManualAIPreferences(preferences);
    setSelectedMethod(selectedSKU, modelId, 'manual');

    setModels(prev => prev.map(model => 
      model.id === modelId 
        ? { 
            ...model, 
            parameters: { ...model.parameters, [parameter]: value },
            optimizedParameters: undefined,
            optimizationConfidence: undefined,
            optimizationReasoning: undefined,
            optimizationFactors: undefined,
            expectedAccuracy: undefined,
            optimizationMethod: undefined
          }
        : model
    ));

    setTimeout(() => {
      isTogglingAIManualRef.current = false;
    }, 100);
  };

  const useAIOptimization = async (modelId: string) => {
    isTogglingAIManualRef.current = true;
    
    const preferences = loadManualAIPreferences();
    const preferenceKey = `${selectedSKU}:${modelId}`;
    preferences[preferenceKey] = 'ai';
    saveManualAIPreferences(preferences);
    setSelectedMethod(selectedSKU, modelId, 'ai');
    
    // Check cache first
    let optimizationCache = {};
    try {
      const stored = localStorage.getItem('forecast_optimization_cache');
      optimizationCache = stored ? JSON.parse(stored) : {};
    } catch {
      optimizationCache = {};
    }
    
    const skuData = data.filter(d => d.sku === selectedSKU);
    const currentDataHash = generateDataHash(skuData);
    const cached = optimizationCache[selectedSKU]?.[modelId];
    
    if (cached?.ai && cached.ai.dataHash === currentDataHash) {
      // Cache will trigger model update via cacheVersion
    } else {
      try {
        const model = models.find(m => m.id === modelId);
        if (model) {
          const result = await getOptimizationByMethod(model, skuData, selectedSKU, 'ai', businessContext);
          
          if (result) {
            setCachedParameters(
              selectedSKU, 
              modelId, 
              result.parameters, 
              currentDataHash,
              result.confidence,
              result.reasoning,
              result.factors,
              result.expectedAccuracy,
              result.method
            );
          }
        }
      } catch (error) {
        console.error('AI optimization failed:', error);
      }
    }
    
    setTimeout(() => {
      isTogglingAIManualRef.current = false;
    }, 100);
  };

  const useGridOptimization = async (modelId: string) => {
    isTogglingAIManualRef.current = true;
    
    const preferences = loadManualAIPreferences();
    const preferenceKey = `${selectedSKU}:${modelId}`;
    preferences[preferenceKey] = 'grid';
    saveManualAIPreferences(preferences);
    setSelectedMethod(selectedSKU, modelId, 'grid');
    
    // Check cache first
    let optimizationCache = {};
    try {
      const stored = localStorage.getItem('forecast_optimization_cache');
      optimizationCache = stored ? JSON.parse(stored) : {};
    } catch {
      optimizationCache = {};
    }
    
    const skuData = data.filter(d => d.sku === selectedSKU);
    const currentDataHash = generateDataHash(skuData);
    const cached = optimizationCache[selectedSKU]?.[modelId];
    
    if (cached?.grid && cached.grid.dataHash === currentDataHash) {
      // Cache will trigger model update via cacheVersion
    } else {
      try {
        const model = models.find(m => m.id === modelId);
        if (model) {
          const result = await getOptimizationByMethod(model, skuData, selectedSKU, 'grid', businessContext);
          
          if (result) {
            setCachedParameters(
              selectedSKU, 
              modelId, 
              result.parameters, 
              currentDataHash,
              result.confidence,
              result.reasoning,
              result.factors,
              result.expectedAccuracy,
              result.method
            );
          }
        }
      } catch (error) {
        console.error('Grid optimization failed:', error);
      }
    }
    
    setTimeout(() => {
      isTogglingAIManualRef.current = false;
    }, 100);
  };

  const resetToManual = (modelId: string) => {
    isTogglingAIManualRef.current = true;
    
    const preferences = loadManualAIPreferences();
    const preferenceKey = `${selectedSKU}:${modelId}`;
    preferences[preferenceKey] = 'manual';
    saveManualAIPreferences(preferences);
    setSelectedMethod(selectedSKU, modelId, 'manual');

    setModels(prev => prev.map(model => 
      model.id === modelId 
        ? { 
            ...model, 
            optimizedParameters: undefined,
            optimizationConfidence: undefined,
            optimizationReasoning: undefined,
            optimizationFactors: undefined,
            expectedAccuracy: undefined,
            optimizationMethod: undefined
          }
        : model
    ));
    
    setTimeout(() => {
      isTogglingAIManualRef.current = false;
    }, 100);
  };

  const refreshModelsWithPreferences = useCallback(() => {
    if (!isTogglingAIManualRef.current) {
      const updatedModels = createModelsWithCurrentData();
      setModels(updatedModels);
    }
  }, [createModelsWithCurrentData]);

  return {
    models,
    setModels,
    createModelsWithPreferences: createModelsWithCurrentData,
    refreshModelsWithPreferences,
    toggleModel,
    updateParameter,
    useAIOptimization,
    useGridOptimization,
    resetToManual,
    isTogglingAIManualRef,
    loadManualAIPreferences,
    saveManualAIPreferences
  };
};
