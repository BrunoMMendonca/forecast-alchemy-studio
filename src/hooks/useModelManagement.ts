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
    console.log('🎯 INITIAL STATE: Creating default models');
    return getDefaultModels();
  });

  // Create models with current cache and preferences - always read fresh from localStorage
  const createModelsWithCurrentData = useCallback(() => {
    if (!selectedSKU || isTogglingAIManualRef.current) {
      return getDefaultModels();
    }

    console.log('🔄 CREATING MODELS: Reading fresh data from localStorage for', selectedSKU);
    
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

      console.log(`📋 MODEL ${model.id}: preference=${preference}, hasCache=${!!cached}, cacheVersion=${cacheVersion}`);

      if (preference === 'manual') {
        console.log(`👤 MODEL ${model.id}: Using manual parameters`);
        return model;
      }

      // For AI/Grid preference, try to get the preferred method first
      let selectedCache = null;
      if (preference === 'ai' && cached?.ai && cached.ai.dataHash === currentDataHash) {
        selectedCache = cached.ai;
        console.log(`🤖 MODEL ${model.id}: Using AI cache`);
      } else if (preference === 'grid' && cached?.grid && cached.grid.dataHash === currentDataHash) {
        selectedCache = cached.grid;
        console.log(`🔍 MODEL ${model.id}: Using Grid cache`);
      } else {
        // Fallback to any valid cache
        if (cached?.ai && cached.ai.dataHash === currentDataHash) {
          selectedCache = cached.ai;
          console.log(`🤖 MODEL ${model.id}: Fallback to AI cache`);
        } else if (cached?.grid && cached.grid.dataHash === currentDataHash) {
          selectedCache = cached.grid;
          console.log(`🔍 MODEL ${model.id}: Fallback to Grid cache`);
        }
      }

      if (selectedCache) {
        console.log(`✅ USING CACHE: ${model.id} with method ${selectedCache.method}, params:`, selectedCache.parameters);
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

      console.log(`❌ NO CACHE: ${model.id} using default parameters`);
      return model;
    });
  }, [selectedSKU, data, generateDataHash, cacheVersion]);

  // Single effect that updates models when cache version changes
  useEffect(() => {
    if (selectedSKU && cacheVersion > 0) {
      console.log(`🔄 CACHE VERSION CHANGED: ${cacheVersion}, updating models for ${selectedSKU}`);
      const updatedModels = createModelsWithCurrentData();
      console.log('🎯 SETTING NEW MODELS:', updatedModels.map(m => ({ 
        id: m.id, 
        hasOptimized: !!m.optimizedParameters,
        method: m.optimizationMethod 
      })));
      setModels(updatedModels);
    }
  }, [cacheVersion, selectedSKU, createModelsWithCurrentData]);

  // Effect for SKU changes
  useEffect(() => {
    if (selectedSKU) {
      console.log(`🔄 SKU CHANGED: Updating models for ${selectedSKU}`);
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

    console.log(`PREFERENCE: Updated ${preferenceKey} to manual (parameter change)`);

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
    console.log(`🤖 USE AI: Starting AI optimization for ${selectedSKU}:${modelId}`);
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
      console.log(`✅ USE AI: Using cached AI result for ${preferenceKey}`);
      // Cache will trigger model update via cacheVersion
    } else {
      console.log(`🔄 USE AI: Running fresh AI optimization for ${preferenceKey}`);
      
      try {
        const model = models.find(m => m.id === modelId);
        if (model) {
          const result = await getOptimizationByMethod(model, skuData, selectedSKU, 'ai', businessContext);
          
          if (result) {
            console.log(`✅ USE AI: Fresh AI optimization succeeded for ${preferenceKey}`);
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
    console.log(`🔍 GRID: Starting Grid optimization for ${selectedSKU}:${modelId}`);
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
      console.log(`✅ GRID: Using cached Grid result for ${preferenceKey}`);
      // Cache will trigger model update via cacheVersion
    } else {
      console.log(`🔄 GRID: Running fresh Grid optimization for ${preferenceKey}`);
      
      try {
        const model = models.find(m => m.id === modelId);
        if (model) {
          const result = await getOptimizationByMethod(model, skuData, selectedSKU, 'grid', businessContext);
          
          if (result) {
            console.log(`✅ GRID: Fresh Grid optimization succeeded for ${preferenceKey}`);
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
    console.log(`👤 RESET TO MANUAL: ${selectedSKU}:${modelId}`);
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
      console.log('🔄 REFRESH: Manually refreshing models');
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
