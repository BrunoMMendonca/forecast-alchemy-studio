
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
    isCacheValid
  } = useOptimizationCache();
  const { loadManualAIPreferences, saveManualAIPreferences } = useManualAIPreferences();
  const isTogglingAIManualRef = useRef<boolean>(false);
  const lastProcessedSKURef = useRef<string>('');

  const [models, setModels] = useState<ModelConfig[]>(() => {
    return getDefaultModels();
  });

  // Simple function to create models with cached data - no complex dependencies
  const applyOptimizedParametersToModels = useCallback((targetSKU: string, targetData: SalesData[]) => {
    if (!targetSKU || isTogglingAIManualRef.current) {
      return getDefaultModels();
    }

    const skuData = targetData.filter(d => d.sku === targetSKU);
    if (skuData.length === 0) {
      return getDefaultModels();
    }

    const currentDataHash = generateDataHash(skuData);
    let preferences = {};
    
    try {
      const storedPrefs = localStorage.getItem('manual_ai_preferences');
      preferences = storedPrefs ? JSON.parse(storedPrefs) : {};
    } catch {
      preferences = {};
    }

    return getDefaultModels().map(model => {
      // Skip optimization logic for models without parameters
      if (!hasOptimizableParameters(model)) {
        return model;
      }

      const preferenceKey = `${targetSKU}:${model.id}`;
      const preference = preferences[preferenceKey] || 'ai';

      if (preference === 'manual') {
        return model;
      }

      // Only look for cached parameters if we have a preference for AI or Grid
      let cachedParams = null;
      if (preference === 'ai') {
        cachedParams = getCachedParameters(targetSKU, model.id, 'ai');
        if (cachedParams && isCacheValid(targetSKU, model.id, currentDataHash, 'ai')) {
          // Use cached AI parameters
        } else {
          cachedParams = null;
        }
      } else if (preference === 'grid') {
        cachedParams = getCachedParameters(targetSKU, model.id, 'grid');
        if (cachedParams && isCacheValid(targetSKU, model.id, currentDataHash, 'grid')) {
          // Use cached Grid parameters
        } else {
          cachedParams = null;
        }
      }

      if (cachedParams) {
        return {
          ...model,
          optimizedParameters: cachedParams.parameters,
          optimizationConfidence: cachedParams.confidence,
          optimizationReasoning: cachedParams.reasoning,
          optimizationFactors: cachedParams.factors,
          expectedAccuracy: cachedParams.expectedAccuracy,
          optimizationMethod: cachedParams.method
        };
      }

      return model;
    });
  }, [generateDataHash, getCachedParameters, isCacheValid]);

  // Single effect that only runs when SKU changes
  useEffect(() => {
    if (selectedSKU && selectedSKU !== lastProcessedSKURef.current) {
      console.log(`🔄 UNIFIED: Processing SKU change from ${lastProcessedSKURef.current} to ${selectedSKU}`);
      lastProcessedSKURef.current = selectedSKU;
      
      const updatedModels = applyOptimizedParametersToModels(selectedSKU, data);
      setModels(updatedModels);
    }
  }, [selectedSKU, applyOptimizedParametersToModels, data]);

  const toggleModel = (modelId: string) => {
    setModels(prev => prev.map(model => 
      model.id === modelId ? { ...model, enabled: !model.enabled } : model
    ));
  };

  const updateParameter = (modelId: string, parameter: string, value: number) => {
    const model = models.find(m => m.id === modelId);
    
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
    
    if (!model || !hasOptimizableParameters(model)) {
      console.log(`⚠️ UNIFIED: Cannot use AI optimization for ${modelId} - no optimizable parameters`);
      return;
    }

    console.log(`🤖 AI button clicked for ${modelId} (unified hook)`);
    isTogglingAIManualRef.current = true;
    
    const skuData = data.filter(d => d.sku === selectedSKU);
    const currentDataHash = generateDataHash(skuData);
    
    // Check cache first
    const cachedAI = getCachedParameters(selectedSKU, modelId, 'ai');
    if (cachedAI && isCacheValid(selectedSKU, modelId, currentDataHash, 'ai')) {
      console.log(`✅ CACHE HIT: Using cached AI result for ${modelId}`);
      
      const preferences = loadManualAIPreferences();
      const preferenceKey = `${selectedSKU}:${modelId}`;
      preferences[preferenceKey] = 'ai';
      saveManualAIPreferences(preferences);
      setSelectedMethod(selectedSKU, modelId, 'ai');
      
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
    
    console.log(`🚀 CACHE MISS: Making fresh API call for ${modelId}`);
    
    try {
      const result = await getOptimizationByMethod(model, skuData, selectedSKU, 'ai', businessContext);
      
      if (result) {
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

        // Update models immediately
        setModels(prev => prev.map(model => 
          model.id === modelId 
            ? { 
                ...model, 
                optimizedParameters: result.parameters,
                optimizationConfidence: result.confidence,
                optimizationReasoning: result.reasoning,
                optimizationFactors: result.factors,
                expectedAccuracy: result.expectedAccuracy,
                optimizationMethod: result.method
              }
            : model
        ));
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
    
    if (!model || !hasOptimizableParameters(model)) {
      console.log(`⚠️ UNIFIED: Cannot use Grid optimization for ${modelId} - no optimizable parameters`);
      return;
    }

    console.log(`📊 Grid button clicked for ${modelId} (unified hook)`);
    isTogglingAIManualRef.current = true;
    
    const skuData = data.filter(d => d.sku === selectedSKU);
    const currentDataHash = generateDataHash(skuData);
    
    // Check cache first
    const cachedGrid = getCachedParameters(selectedSKU, modelId, 'grid');
    if (cachedGrid && isCacheValid(selectedSKU, modelId, currentDataHash, 'grid')) {
      console.log(`✅ CACHE HIT: Using cached Grid result for ${modelId}`);
      
      const preferences = loadManualAIPreferences();
      const preferenceKey = `${selectedSKU}:${modelId}`;
      preferences[preferenceKey] = 'grid';
      saveManualAIPreferences(preferences);
      setSelectedMethod(selectedSKU, modelId, 'grid');
      
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
    
    console.log(`🚀 CACHE MISS: Running fresh optimization for ${modelId}`);
    
    try {
      const result = await getOptimizationByMethod(model, skuData, selectedSKU, 'grid', businessContext);
      
      if (result) {
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

        // Update models immediately
        setModels(prev => prev.map(model => 
          model.id === modelId 
            ? { 
                ...model, 
                optimizedParameters: result.parameters,
                optimizationConfidence: result.confidence,
                optimizationReasoning: result.reasoning,
                optimizationFactors: result.factors,
                expectedAccuracy: result.expectedAccuracy,
                optimizationMethod: result.method
              }
            : model
        ));
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
    
    if (!model) {
      console.log(`⚠️ UNIFIED: Model ${modelId} not found`);
      return;
    }

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
    if (!isTogglingAIManualRef.current && selectedSKU) {
      const updatedModels = applyOptimizedParametersToModels(selectedSKU, data);
      setModels(updatedModels);
    }
  }, [selectedSKU, data, applyOptimizedParametersToModels]);

  return {
    models,
    setModels,
    createModelsWithPreferences: applyOptimizedParametersToModels,
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
