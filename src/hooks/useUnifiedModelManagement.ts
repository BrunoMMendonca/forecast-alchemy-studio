
import { useState, useCallback, useRef, useEffect } from 'react';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { getDefaultModels, hasOptimizableParameters } from '@/utils/modelConfig';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useManualAIPreferences } from '@/hooks/useManualAIPreferences';
import { getOptimizationByMethod } from '@/utils/singleModelOptimization';
import { BusinessContext } from '@/types/businessContext';

export const useUnifiedModelManagement = (selectedSKU: string, data: SalesData[], businessContext?: BusinessContext) => {
  const { 
    generateDataHash, 
    setCachedParameters,
    setSelectedMethod,
    getCachedParameters,
    isCacheValid,
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
      // Skip optimization logic for models without parameters
      if (!hasOptimizableParameters(model)) {
        console.log(`🔧 UNIFIED: Skipping optimization logic for ${model.id} - no parameters`);
        return model;
      }

      const preferenceKey = `${selectedSKU}:${model.id}`;
      const preference = preferences[preferenceKey] || 'ai';
      const cached = optimizationCache[selectedSKU]?.[model.id];

      if (preference === 'manual') {
        return model;
      }

      let selectedCache = null;
      if (preference === 'ai' && cached?.ai && cached.ai.dataHash === currentDataHash) {
        selectedCache = cached.ai;
      } else if (preference === 'grid' && cached?.grid && cached.grid.dataHash === currentDataHash) {
        selectedCache = cached.grid;
      } else {
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
    const model = models.find(m => m.id === modelId);
    
    // Add parameter check to prevent optimization logic for models without parameters
    if (!model || !hasOptimizableParameters(model)) {
      console.log(`⚠️ UNIFIED: Cannot update parameter for ${modelId} - no optimizable parameters`);
      return;
    }

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
    const model = models.find(m => m.id === modelId);
    
    // Add parameter check to prevent optimization for models without parameters
    if (!model || !hasOptimizableParameters(model)) {
      console.log(`⚠️ UNIFIED: Cannot use AI optimization for ${modelId} - no optimizable parameters`);
      return;
    }

    console.log(`🤖 AI button clicked for ${modelId} (unified hook)`);
    isTogglingAIManualRef.current = true;
    
    const skuData = data.filter(d => d.sku === selectedSKU);
    const currentDataHash = generateDataHash(skuData);
    
    // CACHE-FIRST APPROACH: Check if we have valid cached AI results
    const cachedAI = getCachedParameters(selectedSKU, modelId, 'ai');
    if (cachedAI && isCacheValid(selectedSKU, modelId, currentDataHash, 'ai')) {
      console.log(`✅ CACHE HIT: Using cached AI result for ${modelId} - no API call needed! (unified)`);
      
      // Update preference to AI
      const preferences = loadManualAIPreferences();
      const preferenceKey = `${selectedSKU}:${modelId}`;
      preferences[preferenceKey] = 'ai';
      saveManualAIPreferences(preferences);
      setSelectedMethod(selectedSKU, modelId, 'ai');
      
      // Cache will trigger model update via cacheVersion - but also apply immediately
      setModels(prev => prev.map(model => 
        model.id === modelId 
          ? { 
              ...model, 
              optimizedParameters: cachedAI.parameters,
              optimizationConfidence: cachedAI.confidence,
              optimizationReasoning: cachedAI.reasoning,
              optimizationFactors: cachedAI.factors,
              expectedAccuracy: cachedAI.expectedAccuracy,
              optimizationMethod: cachedAI.method
            }
          : model
      ));
      
      isTogglingAIManualRef.current = false;
      return;
    }
    
    console.log(`🚀 CACHE MISS: No valid cached AI result, making fresh API call for ${modelId} (unified)`);
    
    // Only call API if cache miss or invalid cache
    try {
      const result = await getOptimizationByMethod(model, skuData, selectedSKU, 'ai', businessContext);
      
      if (result) {
        // Update preference to AI
        const preferences = loadManualAIPreferences();
        const preferenceKey = `${selectedSKU}:${modelId}`;
        preferences[preferenceKey] = 'ai';
        saveManualAIPreferences(preferences);
        setSelectedMethod(selectedSKU, modelId, 'ai');
        
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
    } catch (error) {
      console.error('AI optimization failed:', error);
    }
    
    setTimeout(() => {
      isTogglingAIManualRef.current = false;
    }, 100);
  };

  const useGridOptimization = async (modelId: string) => {
    const model = models.find(m => m.id === modelId);
    
    // Add parameter check to prevent optimization for models without parameters
    if (!model || !hasOptimizableParameters(model)) {
      console.log(`⚠️ UNIFIED: Cannot use Grid optimization for ${modelId} - no optimizable parameters`);
      return;
    }

    console.log(`📊 Grid button clicked for ${modelId} (unified hook)`);
    isTogglingAIManualRef.current = true;
    
    const skuData = data.filter(d => d.sku === selectedSKU);
    const currentDataHash = generateDataHash(skuData);
    
    // CACHE-FIRST APPROACH: Check if we have valid cached Grid results
    const cachedGrid = getCachedParameters(selectedSKU, modelId, 'grid');
    if (cachedGrid && isCacheValid(selectedSKU, modelId, currentDataHash, 'grid')) {
      console.log(`✅ CACHE HIT: Using cached Grid result for ${modelId} - no optimization needed! (unified)`);
      
      // Update preference to Grid
      const preferences = loadManualAIPreferences();
      const preferenceKey = `${selectedSKU}:${modelId}`;
      preferences[preferenceKey] = 'grid';
      saveManualAIPreferences(preferences);
      setSelectedMethod(selectedSKU, modelId, 'grid');
      
      // Apply cached Grid parameters immediately
      setModels(prev => prev.map(model => 
        model.id === modelId 
          ? { 
              ...model, 
              optimizedParameters: cachedGrid.parameters,
              optimizationConfidence: cachedGrid.confidence,
              optimizationReasoning: cachedGrid.reasoning,
              optimizationFactors: cachedGrid.factors,
              expectedAccuracy: cachedGrid.expectedAccuracy,
              optimizationMethod: cachedGrid.method
            }
          : model
      ));
      
      isTogglingAIManualRef.current = false;
      return;
    }
    
    console.log(`🚀 CACHE MISS: No valid cached Grid result, running fresh optimization for ${modelId} (unified)`);
    
    // Only run optimization if cache miss or invalid cache
    try {
      const result = await getOptimizationByMethod(model, skuData, selectedSKU, 'grid', businessContext);
      
      if (result) {
        // Update preference to Grid
        const preferences = loadManualAIPreferences();
        const preferenceKey = `${selectedSKU}:${modelId}`;
        preferences[preferenceKey] = 'grid';
        saveManualAIPreferences(preferences);
        setSelectedMethod(selectedSKU, modelId, 'grid');
        
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
    } catch (error) {
      console.error('Grid optimization failed:', error);
    }
    
    setTimeout(() => {
      isTogglingAIManualRef.current = false;
    }, 100);
  };

  const resetToManual = (modelId: string) => {
    const model = models.find(m => m.id === modelId);
    
    // Add parameter check - though manual mode should work for all models
    if (!model) {
      console.log(`⚠️ UNIFIED: Model ${modelId} not found`);
      return;
    }

    // Allow manual mode even for models without parameters (they just won't show parameter controls)
    console.log(`👤 Manual reset for ${modelId} (unified hook)`);
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
