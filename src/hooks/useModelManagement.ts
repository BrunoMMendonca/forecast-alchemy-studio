
import { useState, useCallback, useRef, useEffect } from 'react';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { getDefaultModels } from '@/utils/modelConfig';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useManualAIPreferences, PreferenceValue } from '@/hooks/useManualAIPreferences';
import { getOptimizationByMethod } from '@/utils/singleModelOptimization';

export const useModelManagement = (selectedSKU: string, data: SalesData[]) => {
  const { 
    generateDataHash, 
    getCachedParameters, 
    isCacheValid, 
    setCachedParameters,
    setSelectedMethod 
  } = useOptimizationCache();
  const { loadManualAIPreferences, saveManualAIPreferences } = useManualAIPreferences();
  const isTogglingAIManualRef = useRef<boolean>(false);
  const lastSelectedSKURef = useRef<string>('');

  const createModelsWithPreferences = useCallback((): ModelConfig[] => {
    console.log('🏗️ CREATING MODELS WITH MULTI-METHOD SUPPORT for SKU:', selectedSKU);
    
    const defaultModels = getDefaultModels();
    
    if (!selectedSKU || data.length === 0) {
      console.log('❌ No SKU or data, using defaults');
      return defaultModels;
    }

    try {
      const preferences = loadManualAIPreferences();
      const skuData = data.filter(d => d.sku === selectedSKU);
      const currentDataHash = generateDataHash(skuData);
      
      console.log(`📋 Creating models with preferences for ${selectedSKU}:`, preferences);
      
      return defaultModels.map(model => {
        const preferenceKey = `${selectedSKU}:${model.id}`;
        const preference = preferences[preferenceKey];
        
        console.log(`🔍 ${preferenceKey}: preference=${preference}`);
        
        // Get cached parameters based on preference
        let cached = null;
        if (preference === true) {
          cached = getCachedParameters(selectedSKU, model.id, 'ai');
          console.log(`🤖 Looking for AI cache for ${preferenceKey}:`, !!cached);
        } else if (preference === 'grid') {
          cached = getCachedParameters(selectedSKU, model.id, 'grid');
          console.log(`🔍 Looking for Grid cache for ${preferenceKey}:`, !!cached);
        } else if (preference === false) {
          // Manual - no optimized parameters
          console.log(`👤 Manual preference for ${preferenceKey}`);
          return {
            ...model,
            optimizedParameters: undefined,
            optimizationConfidence: undefined,
            optimizationReasoning: undefined,
            optimizationFactors: undefined,
            expectedAccuracy: undefined,
            optimizationMethod: undefined
          };
        } else {
          // No preference - use AI if available, then grid, then manual
          cached = getCachedParameters(selectedSKU, model.id, 'ai') || 
                   getCachedParameters(selectedSKU, model.id, 'grid');
          console.log(`🎯 No preference for ${preferenceKey}, using available cache:`, !!cached);
        }
        
        if (cached && isCacheValid(selectedSKU, model.id, currentDataHash)) {
          console.log(`✅ Applying ${cached.method} optimization for ${preferenceKey}`);
          return {
            ...model,
            optimizedParameters: cached.parameters,
            optimizationConfidence: cached.confidence,
            optimizationReasoning: cached.reasoning,
            optimizationFactors: cached.factors,
            expectedAccuracy: cached.expectedAccuracy,
            optimizationMethod: cached.method
          };
        } else {
          console.log(`🛠️ No valid cache for ${preferenceKey}, using manual`);
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
      });
    } catch (error) {
      console.error('❌ Error creating models with multi-method support:', error);
      return defaultModels;
    }
  }, [selectedSKU, data, loadManualAIPreferences, generateDataHash, getCachedParameters, isCacheValid]);

  const [models, setModels] = useState<ModelConfig[]>(() => {
    console.log('🎯 INITIAL STATE CREATION WITH MULTI-METHOD SUPPORT');
    return getDefaultModels();
  });

  // Effect to update models when SKU changes or when returning from other pages
  useEffect(() => {
    if (selectedSKU && selectedSKU !== lastSelectedSKURef.current) {
      console.log(`🔄 SKU CHANGED: ${lastSelectedSKURef.current} -> ${selectedSKU}, recreating models`);
      const modelsWithPreferences = createModelsWithPreferences();
      setModels(modelsWithPreferences);
      lastSelectedSKURef.current = selectedSKU;
    }
  }, [selectedSKU, createModelsWithPreferences]);

  const toggleModel = (modelId: string) => {
    setModels(prev => prev.map(model => 
      model.id === modelId ? { ...model, enabled: !model.enabled } : model
    ));
  };

  const updateParameter = (modelId: string, parameter: string, value: number) => {
    isTogglingAIManualRef.current = true;
    
    const preferences = loadManualAIPreferences();
    const preferenceKey = `${selectedSKU}:${modelId}`;
    preferences[preferenceKey] = false;
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
    console.log(`🤖 USE AI: Starting for ${selectedSKU}:${modelId}`);
    isTogglingAIManualRef.current = true;
    
    const preferences = loadManualAIPreferences();
    const preferenceKey = `${selectedSKU}:${modelId}`;
    preferences[preferenceKey] = true;
    saveManualAIPreferences(preferences);
    setSelectedMethod(selectedSKU, modelId, 'ai');

    console.log(`PREFERENCE: Updated ${preferenceKey} to AI`);

    // Try to get cached AI results first
    const cached = getCachedParameters(selectedSKU, modelId, 'ai');
    if (cached) {
      console.log(`✅ USE AI: Using cached AI result for ${preferenceKey}`);
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
      console.log(`🔄 USE AI: Running fresh AI optimization for ${preferenceKey}`);
      // Run fresh AI optimization
      try {
        const model = models.find(m => m.id === modelId);
        if (model) {
          const skuData = data.filter(d => d.sku === selectedSKU);
          
          const result = await getOptimizationByMethod(model, skuData, selectedSKU, 'ai');
          
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
            console.log(`❌ USE AI: Fresh AI optimization failed for ${preferenceKey}`);
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
    console.log(`🔍 USE GRID: Starting for ${selectedSKU}:${modelId}`);
    isTogglingAIManualRef.current = true;
    
    const preferences = loadManualAIPreferences();
    const preferenceKey = `${selectedSKU}:${modelId}`;
    preferences[preferenceKey] = 'grid';
    saveManualAIPreferences(preferences);
    setSelectedMethod(selectedSKU, modelId, 'grid');

    console.log(`PREFERENCE: Updated ${preferenceKey} to Grid`);

    // Try to get cached Grid results first
    const cached = getCachedParameters(selectedSKU, modelId, 'grid');
    if (cached) {
      console.log(`✅ USE GRID: Using cached Grid result for ${preferenceKey}`);
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
      console.log(`🔄 USE GRID: Running fresh Grid optimization for ${preferenceKey}`);
      // Run fresh Grid optimization
      try {
        const model = models.find(m => m.id === modelId);
        if (model) {
          const skuData = data.filter(d => d.sku === selectedSKU);
          
          const result = await getOptimizationByMethod(model, skuData, selectedSKU, 'grid');
          
          if (result) {
            console.log(`✅ USE GRID: Fresh Grid optimization succeeded for ${preferenceKey}`);
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
            console.log(`❌ USE GRID: Fresh Grid optimization failed for ${preferenceKey}`);
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
    preferences[preferenceKey] = false;
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

  // Force recreation of models with preferences (for external triggers)
  const refreshModelsWithPreferences = useCallback(() => {
    console.log('🔄 REFRESH: Manually refreshing models with preferences');
    const modelsWithPreferences = createModelsWithPreferences();
    setModels(modelsWithPreferences);
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
