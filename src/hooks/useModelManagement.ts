import { useState, useCallback, useRef, useEffect } from 'react';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { getDefaultModels } from '@/utils/modelConfig';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useManualAIPreferences, PreferenceValue } from '@/hooks/useManualAIPreferences';
import { useModelPreferences } from '@/hooks/useModelPreferences';
import { getOptimizationByMethod } from '@/utils/singleModelOptimization';
import { BusinessContext } from '@/types/businessContext';

export const useModelManagement = (selectedSKU: string, data: SalesData[], businessContext?: BusinessContext) => {
  const { 
    generateDataHash, 
    getCachedParameters, 
    setCachedParameters,
    setSelectedMethod,
    cache,
    cacheVersion // Add this to track cache changes
  } = useOptimizationCache();
  const { loadManualAIPreferences, saveManualAIPreferences } = useManualAIPreferences();
  const { createModelsWithPreferences } = useModelPreferences(selectedSKU, data);
  const isTogglingAIManualRef = useRef<boolean>(false);
  const lastSelectedSKURef = useRef<string>('');
  const lastCacheVersionRef = useRef<number>(0);

  const [models, setModels] = useState<ModelConfig[]>(() => {
    console.log('🎯 INITIAL STATE CREATION WITH AI-DEFAULT');
    return getDefaultModels();
  });

  // Effect to update models when SKU changes
  useEffect(() => {
    if (selectedSKU && selectedSKU !== lastSelectedSKURef.current) {
      console.log(`🔄 SKU CHANGED: ${lastSelectedSKURef.current} -> ${selectedSKU}, recreating models`);
      const modelsWithPreferences = createModelsWithPreferences();
      setModels(modelsWithPreferences);
      lastSelectedSKURef.current = selectedSKU;
    }
  }, [selectedSKU, createModelsWithPreferences]);

  // NEW: React to cache version changes for real-time updates
  useEffect(() => {
    if (selectedSKU && cacheVersion !== lastCacheVersionRef.current && !isTogglingAIManualRef.current) {
      console.log(`🔄 CACHE VERSION CHANGED: ${lastCacheVersionRef.current} -> ${cacheVersion}, updating models for ${selectedSKU}`);
      const modelsWithPreferences = createModelsWithPreferences();
      setModels(modelsWithPreferences);
      lastCacheVersionRef.current = cacheVersion;
    }
  }, [cacheVersion, selectedSKU, createModelsWithPreferences]);

  // Enhanced effect to update models when cache changes (after optimization)
  useEffect(() => {
    if (selectedSKU && cache[selectedSKU] && !isTogglingAIManualRef.current) {
      // Use a simple cache change detection
      const currentCacheTime = Date.now();
      if (currentCacheTime - lastCacheUpdateRef.current > 100) { // Debounce rapid updates
        console.log('🔄 CACHE UPDATED: Updating models state after optimization for', selectedSKU);
        const modelsWithPreferences = createModelsWithPreferences();
        setModels(modelsWithPreferences);
        lastCacheUpdateRef.current = currentCacheTime;
      }
    }
  }, [cache, selectedSKU, createModelsWithPreferences]);

  // Additional effect to force model refresh when new optimization results arrive
  useEffect(() => {
    if (selectedSKU && cache[selectedSKU]) {
      const skuCache = cache[selectedSKU];
      const hasOptimizationResults = Object.values(skuCache).some(modelCache => 
        modelCache.ai || modelCache.grid
      );
      
      if (hasOptimizationResults && !isTogglingAIManualRef.current) {
        console.log('🚀 OPTIMIZATION RESULTS DETECTED: Force refreshing models for', selectedSKU);
        setTimeout(() => {
          const modelsWithPreferences = createModelsWithPreferences();
          setModels(modelsWithPreferences);
        }, 50);
      }
    }
  }, [cache, selectedSKU, createModelsWithPreferences]);

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
    
    // First, try to get cached AI results
    let cached = getCachedParameters(selectedSKU, modelId, 'ai');
    
    // If no AI cache found, try fallback to Grid cache
    if (!cached) {
      console.log(`🔍 AI FALLBACK: No AI cache for ${preferenceKey}, checking Grid cache`);
      cached = getCachedParameters(selectedSKU, modelId, 'grid');
      if (cached) {
        console.log(`✅ AI FALLBACK: Using Grid cache for ${preferenceKey}`);
      }
    }
    
    if (cached) {
      console.log(`✅ USE AI: Using cached result for ${preferenceKey} (method: ${cached.method})`);
      
      // Set preference to AI regardless of cached method
      preferences[preferenceKey] = 'ai';
      saveManualAIPreferences(preferences);
      setSelectedMethod(selectedSKU, modelId, 'ai');
      
      console.log(`🎯 PREFERENCE: Set ${preferenceKey} to AI (using cache)`);
      
      setModels(prev => prev.map(model => 
        model.id === modelId 
          ? { 
              ...model, 
              optimizedParameters: cached.parameters,
              optimizationConfidence: cached.confidence,
              optimizationReasoning: cached.reasoning,
              optimizationFactors: cached.factors,
              expectedAccuracy: cached.expectedAccuracy,
              optimizationMethod: cached.method
            }
          : model
      ));
    } else {
      console.log(`🔄 USE AI: No cache found, running fresh AI optimization for ${preferenceKey}`);
      
      // Set preference to AI before optimization
      preferences[preferenceKey] = 'ai';
      saveManualAIPreferences(preferences);
      setSelectedMethod(selectedSKU, modelId, 'ai');
      
      // Show pending state
      setModels(prev => prev.map(model => 
        model.id === modelId 
          ? { 
              ...model, 
              optimizedParameters: undefined,
              optimizationConfidence: undefined,
              optimizationReasoning: 'AI optimization pending...',
              optimizationFactors: undefined,
              expectedAccuracy: undefined,
              optimizationMethod: 'ai_optimization'
            }
          : model
      ));
      
      try {
        const model = models.find(m => m.id === modelId);
        if (model) {
          const skuData = data.filter(d => d.sku === selectedSKU);
          
          const result = await getOptimizationByMethod(model, skuData, selectedSKU, 'ai', businessContext);
          
          if (result) {
            console.log(`✅ USE AI: Fresh AI optimization succeeded for ${preferenceKey}`);
            const dataHash = generateDataHash(skuData);
            setCachedParameters(
              selectedSKU, 
              modelId, 
              result.parameters, 
              dataHash,
              result.confidence,
              result.reasoning,
              result.factors,
              result.expectedAccuracy,
              result.method
            );
            
            setModels(prev => prev.map(m => 
              m.id === modelId 
                ? { 
                    ...m, 
                    optimizedParameters: result.parameters,
                    optimizationConfidence: result.confidence,
                    optimizationReasoning: result.reasoning,
                    optimizationFactors: result.factors,
                    expectedAccuracy: result.expectedAccuracy,
                    optimizationMethod: result.method
                  }
                : m
            ));
          } else {
            console.log(`❌ USE AI: AI optimization failed for ${preferenceKey}, trying Grid fallback`);
            preferences[preferenceKey] = 'grid';
            saveManualAIPreferences(preferences);
            await useGridOptimization(modelId);
          }
        }
      } catch (error) {
        console.error('AI optimization failed:', error);
        preferences[preferenceKey] = 'grid';
        saveManualAIPreferences(preferences);
        await useGridOptimization(modelId);
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
    
    // Try to get cached Grid results first
    let cached = getCachedParameters(selectedSKU, modelId, 'grid');
    
    // If no Grid cache found, try fallback to AI cache
    if (!cached) {
      console.log(`🤖 GRID FALLBACK: No Grid cache for ${preferenceKey}, checking AI cache`);
      cached = getCachedParameters(selectedSKU, modelId, 'ai');
      if (cached) {
        console.log(`✅ GRID FALLBACK: Using AI cache for ${preferenceKey}`);
      }
    }
    
    if (cached) {
      console.log(`✅ GRID: Using cached result for ${preferenceKey} (method: ${cached.method})`);
      
      // Set preference to Grid regardless of cached method
      preferences[preferenceKey] = 'grid';
      saveManualAIPreferences(preferences);
      setSelectedMethod(selectedSKU, modelId, 'grid');
      
      console.log(`🎯 PREFERENCE: Set ${preferenceKey} to Grid (using cache)`);
      
      setModels(prev => prev.map(model => 
        model.id === modelId 
          ? { 
              ...model, 
              optimizedParameters: cached.parameters,
              optimizationConfidence: cached.confidence,
              optimizationReasoning: cached.reasoning,
              optimizationFactors: cached.factors,
              expectedAccuracy: cached.expectedAccuracy,
              optimizationMethod: cached.method
            }
          : model
      ));
    } else {
      console.log(`🔄 GRID: No cache found, running fresh Grid optimization for ${preferenceKey}`);
      
      // Set preference to Grid before optimization
      preferences[preferenceKey] = 'grid';
      saveManualAIPreferences(preferences);
      setSelectedMethod(selectedSKU, modelId, 'grid');
      
      // Show pending state
      setModels(prev => prev.map(model => 
        model.id === modelId 
          ? { 
              ...model, 
              optimizedParameters: undefined,
              optimizationConfidence: undefined,
              optimizationReasoning: 'Grid optimization pending...',
              optimizationFactors: undefined,
              expectedAccuracy: undefined,
              optimizationMethod: 'grid_search'
            }
          : model
      ));
      
      try {
        const model = models.find(m => m.id === modelId);
        if (model) {
          const skuData = data.filter(d => d.sku === selectedSKU);
          
          const result = await getOptimizationByMethod(model, skuData, selectedSKU, 'grid', businessContext);
          
          if (result) {
            console.log(`✅ GRID: Fresh Grid optimization succeeded for ${preferenceKey}`);
            const dataHash = generateDataHash(skuData);
            
            setCachedParameters(
              selectedSKU, 
              modelId, 
              result.parameters, 
              dataHash,
              result.confidence,
              result.reasoning,
              result.factors,
              result.expectedAccuracy,
              result.method
            );
            
            setModels(prev => prev.map(m => 
              m.id === modelId 
                ? { 
                    ...m, 
                    optimizedParameters: result.parameters,
                    optimizationConfidence: result.confidence,
                    optimizationReasoning: result.reasoning,
                    optimizationFactors: result.factors,
                    expectedAccuracy: result.expectedAccuracy,
                    optimizationMethod: result.method
                  }
                : m
            ));
          } else {
            console.log(`❌ GRID: Fresh Grid optimization failed for ${preferenceKey}`);
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

    console.log(`PREFERENCE: Updated ${preferenceKey} to manual (reset)`);

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
      console.log('🔄 REFRESH: Manually refreshing models with preferences');
      const modelsWithPreferences = createModelsWithPreferences();
      setModels(modelsWithPreferences);
    }
  }, [createModelsWithPreferences]);

  return {
    models,
    setModels,
    createModelsWithPreferences,
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
