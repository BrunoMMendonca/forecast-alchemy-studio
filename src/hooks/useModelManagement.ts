
import { useState, useCallback, useRef } from 'react';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { getDefaultModels } from '@/utils/modelConfig';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useManualAIPreferences, PreferenceValue } from '@/hooks/useManualAIPreferences';
import { optimizeSingleModel } from '@/utils/singleModelOptimization';

export const useModelManagement = (selectedSKU: string, data: SalesData[]) => {
  const { generateDataHash, getCachedParameters, isCacheValid, cacheParameters } = useOptimizationCache();
  const { loadManualAIPreferences, saveManualAIPreferences } = useManualAIPreferences();
  const isTogglingAIManualRef = useRef<boolean>(false);

  // FIXED: Apply preferences during initial model creation with enhanced cache handling and reasoning
  const createModelsWithPreferences = useCallback((): ModelConfig[] => {
    console.log('🏗️ CREATING MODELS WITH PREFERENCES AND REASONING');
    
    const defaultModels = getDefaultModels();
    
    if (!selectedSKU || data.length === 0) {
      console.log('❌ No SKU or data, using defaults');
      return defaultModels;
    }

    try {
      const preferences = loadManualAIPreferences();
      const skuData = data.filter(d => d.sku === selectedSKU);
      const currentDataHash = generateDataHash(skuData);
      
      console.log(`📋 Creating models with preferences and reasoning for ${selectedSKU}:`, preferences);
      
      return defaultModels.map(model => {
        const cached = getCachedParameters(selectedSKU, model.id);
        const preferenceKey = `${selectedSKU}:${model.id}`;
        const preference = preferences[preferenceKey];
        
        console.log(`🔍 ${preferenceKey}: preference=${preference}, cached=${!!cached}, cacheValid=${cached ? isCacheValid(selectedSKU, model.id, currentDataHash) : false}`);
        
        // ENHANCED: If preference is AI (true) and we have cached parameters with reasoning, use them
        if (preference === true && cached) {
          console.log(`✅ Applying AI with full reasoning for ${preferenceKey}`);
          return {
            ...model,
            optimizedParameters: cached.parameters,
            optimizationConfidence: cached.confidence,
            optimizationReasoning: cached.reasoning,
            optimizationFactors: cached.factors,
            expectedAccuracy: cached.expectedAccuracy
          };
        } 
        // ENHANCED: If preference is grid and we have cached grid parameters, use them
        else if (preference === 'grid' && cached && cached.method === 'grid_search') {
          console.log(`✅ Applying Grid with full reasoning for ${preferenceKey}`);
          return {
            ...model,
            optimizedParameters: cached.parameters,
            optimizationConfidence: cached.confidence,
            optimizationReasoning: cached.reasoning,
            optimizationFactors: cached.factors,
            expectedAccuracy: cached.expectedAccuracy,
            optimizationMethod: cached.method
          };
        }
        // ENHANCED: If preference is explicitly false (manual), clear all AI-related fields
        else if (preference === false) {
          console.log(`🛠️ Using manual for ${preferenceKey} (preference set to false)`);
          return {
            ...model,
            optimizedParameters: undefined,
            optimizationConfidence: undefined,
            optimizationReasoning: undefined,
            optimizationFactors: undefined,
            expectedAccuracy: undefined
          };
        }
        // ENHANCED: If no preference is set but we have valid cached parameters with reasoning, use them
        else if (!preference && cached && isCacheValid(selectedSKU, model.id, currentDataHash)) {
          console.log(`🤖 Auto-applying AI with full reasoning for ${preferenceKey}`);
          
          // Auto-set preference to AI when we have valid cached parameters
          const updatedPreferences = { ...preferences };
          updatedPreferences[preferenceKey] = true;
          saveManualAIPreferences(updatedPreferences);
          
          return {
            ...model,
            optimizedParameters: cached.parameters,
            optimizationConfidence: cached.confidence,
            optimizationReasoning: cached.reasoning,
            optimizationFactors: cached.factors,
            expectedAccuracy: cached.expectedAccuracy
          };
        }
        // Default to manual with clean state
        else {
          console.log(`🛠️ Default to manual for ${preferenceKey}`);
          return {
            ...model,
            optimizedParameters: undefined,
            optimizationConfidence: undefined,
            optimizationReasoning: undefined,
            optimizationFactors: undefined,
            expectedAccuracy: undefined
          };
        }
      });
    } catch (error) {
      console.error('❌ Error creating models with preferences and reasoning:', error);
      return defaultModels;
    }
  }, [selectedSKU, data, loadManualAIPreferences, saveManualAIPreferences, generateDataHash, getCachedParameters, isCacheValid]);

  // Initialize models with a reactive function
  const [models, setModels] = useState<ModelConfig[]>(() => {
    console.log('🎯 INITIAL STATE CREATION WITH REASONING');
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
            optimizationConfidence: undefined,
            optimizationReasoning: undefined,
            optimizationFactors: undefined,
            expectedAccuracy: undefined,
            optimizationMethod: undefined
          }
        : model
    ));

    setTimeout(() => {
      // Clear the flag after operations complete
      isTogglingAIManualRef.current = false;
    }, 100);
  };

  const useAIOptimization = async (modelId: string) => {
    // Set flag to prevent optimization during AI toggle
    isTogglingAIManualRef.current = true;
    
    const preferences = loadManualAIPreferences();
    const preferenceKey = `${selectedSKU}:${modelId}`;
    preferences[preferenceKey] = true; // Mark as AI (boolean true)
    saveManualAIPreferences(preferences);

    console.log(`PREFERENCE: Updated ${preferenceKey} to AI`);

    const cached = getCachedParameters(selectedSKU, modelId);
    if (cached && cached.method?.startsWith('ai_')) {
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
      // Trigger AI optimization if no cached results
      try {
        const model = models.find(m => m.id === modelId);
        if (model) {
          const skuData = data.filter(d => d.sku === selectedSKU);
          const progressUpdater = { setProgress: () => {} }; // Dummy progress updater
          
          const result = await optimizeSingleModel(model, skuData, selectedSKU, progressUpdater, false);
          
          if (result && result.method?.startsWith('ai_')) {
            // Cache the results
            cacheParameters(selectedSKU, modelId, result);
            
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
    // Set flag to prevent optimization during Grid toggle
    isTogglingAIManualRef.current = true;
    
    const preferences = loadManualAIPreferences();
    const preferenceKey = `${selectedSKU}:${modelId}`;
    preferences[preferenceKey] = 'grid'; // Mark as Grid (string 'grid')
    saveManualAIPreferences(preferences);

    console.log(`PREFERENCE: Updated ${preferenceKey} to Grid`);

    const cached = getCachedParameters(selectedSKU, modelId);
    if (cached && cached.method === 'grid_search') {
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
      // Trigger grid optimization if no cached results
      try {
        const model = models.find(m => m.id === modelId);
        if (model) {
          const skuData = data.filter(d => d.sku === selectedSKU);
          const progressUpdater = { setProgress: () => {} }; // Dummy progress updater
          
          const result = await optimizeSingleModel(model, skuData, selectedSKU, progressUpdater, true); // Force grid search
          
          if (result) {
            // Cache the results
            cacheParameters(selectedSKU, modelId, result);
            
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
            optimizationConfidence: undefined,
            optimizationReasoning: undefined,
            optimizationFactors: undefined,
            expectedAccuracy: undefined,
            optimizationMethod: undefined
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
    useGridOptimization,
    resetToManual,
    isTogglingAIManualRef,
    loadManualAIPreferences,
    saveManualAIPreferences
  };
};
