
import { useState, useCallback, useRef } from 'react';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { getDefaultModels } from '@/utils/modelConfig';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useManualAIPreferences } from '@/hooks/useManualAIPreferences';

export const useModelManagement = (selectedSKU: string, data: SalesData[]) => {
  const { generateDataHash, getCachedParameters, isCacheValid } = useOptimizationCache();
  const { loadManualAIPreferences, saveManualAIPreferences } = useManualAIPreferences();
  const isTogglingAIManualRef = useRef<boolean>(false);

  // IMMEDIATE FIX: Apply preferences during initial model creation
  const createModelsWithPreferences = useCallback((): ModelConfig[] => {
    console.log('🏗️ CREATING MODELS WITH PREFERENCES');
    
    const defaultModels = getDefaultModels();
    
    if (!selectedSKU || data.length === 0) {
      console.log('❌ No SKU or data, using defaults');
      return defaultModels;
    }

    try {
      const preferences = loadManualAIPreferences();
      const skuData = data.filter(d => d.sku === selectedSKU);
      const currentDataHash = generateDataHash(skuData);
      
      console.log(`📋 Creating models for ${selectedSKU} with preferences:`, preferences);
      
      return defaultModels.map(model => {
        const cached = getCachedParameters(selectedSKU, model.id);
        const preferenceKey = `${selectedSKU}:${model.id}`;
        const preference = preferences[preferenceKey];
        
        console.log(`🔍 ${preferenceKey}: preference=${preference}, cached=${!!cached}`);
        
        if (preference === true && cached && isCacheValid(selectedSKU, model.id, currentDataHash)) {
          console.log(`✅ Applying AI for ${preferenceKey}`);
          return {
            ...model,
            optimizedParameters: cached.parameters,
            optimizationConfidence: cached.confidence
          };
        } else {
          console.log(`🛠️ Using manual for ${preferenceKey}`);
          return {
            ...model,
            optimizedParameters: undefined,
            optimizationConfidence: undefined
          };
        }
      });
    } catch (error) {
      console.error('❌ Error creating models with preferences:', error);
      return defaultModels;
    }
  }, [selectedSKU, data, loadManualAIPreferences, generateDataHash, getCachedParameters, isCacheValid]);

  // IMMEDIATE FIX: Initialize models with a reactive function
  const [models, setModels] = useState<ModelConfig[]>(() => {
    console.log('🎯 INITIAL STATE CREATION');
    return getDefaultModels(); // Will be immediately updated by the effect
  });

  const toggleModel = (modelId: string) => {
    setModels(prev => prev.map(model => 
      model.id === modelId ? { ...model, enabled: !model.enabled } : model
    ));
  };

  const updateParameter = (modelId: string, parameter: string, value: number) => {
    // Set flag to prevent optimization during manual parameter updates
    isTogglingAIManualRef.current = true;
    
    const preferences = loadManualAIPreferences();
    const preferenceKey = `${selectedSKU}:${modelId}`;
    preferences[preferenceKey] = false; // Mark as manual when parameters are manually updated
    saveManualAIPreferences(preferences);

    console.log(`PREFERENCE: Updated ${preferenceKey} to manual (parameter change)`);

    setModels(prev => prev.map(model => 
      model.id === modelId 
        ? { 
            ...model, 
            parameters: { ...model.parameters, [parameter]: value },
            optimizedParameters: undefined,
            optimizationConfidence: undefined
          }
        : model
    ));

    setTimeout(() => {
      // Clear the flag after operations complete
      isTogglingAIManualRef.current = false;
    }, 100);
  };

  const useAIOptimization = (modelId: string) => {
    // Set flag to prevent optimization during AI toggle
    isTogglingAIManualRef.current = true;
    
    const preferences = loadManualAIPreferences();
    const preferenceKey = `${selectedSKU}:${modelId}`;
    preferences[preferenceKey] = true; // Mark as AI
    saveManualAIPreferences(preferences);

    console.log(`PREFERENCE: Updated ${preferenceKey} to AI`);

    const cached = getCachedParameters(selectedSKU, modelId);
    if (cached) {
      setModels(prev => prev.map(model => 
        model.id === modelId 
          ? { 
              ...model, 
              optimizedParameters: cached.parameters,
              optimizationConfidence: cached.confidence
            }
          : model
      ));
      
      setTimeout(() => {
        // Clear the flag after operations complete
        isTogglingAIManualRef.current = false;
      }, 100);
    } else {
      // Clear flag if no cached parameters
      isTogglingAIManualRef.current = false;
    }
  };

  const resetToManual = (modelId: string) => {
    // Set flag to prevent optimization during manual reset
    isTogglingAIManualRef.current = true;
    
    const preferences = loadManualAIPreferences();
    const preferenceKey = `${selectedSKU}:${modelId}`;
    preferences[preferenceKey] = false; // Mark as manual
    saveManualAIPreferences(preferences);

    console.log(`PREFERENCE: Updated ${preferenceKey} to manual (reset)`);

    setModels(prev => prev.map(model => 
      model.id === modelId 
        ? { 
            ...model, 
            optimizedParameters: undefined,
            optimizationConfidence: undefined
          }
        : model
    ));
    
    setTimeout(() => {
      // Clear the flag after operations complete
      isTogglingAIManualRef.current = false;
    }, 100);
  };

  return {
    models,
    setModels,
    createModelsWithPreferences,
    toggleModel,
    updateParameter,
    useAIOptimization,
    resetToManual,
    isTogglingAIManualRef,
    loadManualAIPreferences,
    saveManualAIPreferences
  };
};
