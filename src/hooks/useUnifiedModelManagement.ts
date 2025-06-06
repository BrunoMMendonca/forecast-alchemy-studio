
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ModelConfig } from '@/types/forecast';
import { SalesData, ForecastResult } from '@/pages/Index';
import { getDefaultModels } from '@/utils/modelConfig';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useManualAIPreferences } from '@/hooks/useManualAIPreferences';
import { getOptimizationByMethod } from '@/utils/singleModelOptimization';
import { BusinessContext } from '@/types/businessContext';
import { useForecastCache } from '@/hooks/useForecastCache';
import { generateForecastsForSKU } from '@/utils/forecastGenerator';
import { useToast } from '@/hooks/use-toast';

// Helper function to validate SKU - centralized validation
const isValidSKU = (sku: any): boolean => {
  const isValid = sku !== null && sku !== undefined && typeof sku === 'string' && sku.trim().length > 0;
  return isValid;
};

// Helper function to check if a model has parameters that can be optimized
const modelHasParameters = (model: ModelConfig): boolean => {
  const params = model.optimizedParameters || model.parameters;
  return params && Object.keys(params).length > 0;
};

export const useUnifiedModelManagement = (
  selectedSKU: string, 
  data: SalesData[], 
  forecastPeriods: number,
  businessContext?: BusinessContext,
  onForecastGeneration?: (results: ForecastResult[], selectedSKU: string) => void
) => {
  const { toast } = useToast();
  const lastProcessedSKURef = useRef<string>('');
  const forecastGenerationInProgressRef = useRef<boolean>(false);
  const modelsInitializedRef = useRef<boolean>(false);

  // Early validation - don't proceed with any operations if SKU is invalid
  const isValidSelectedSKU = isValidSKU(selectedSKU);

  console.log('🔧 useUnifiedModelManagement init:', {
    selectedSKU: `"${selectedSKU}"`,
    isValidSKU: isValidSelectedSKU,
    dataLength: data?.length
  });

  // Only initialize cache hooks if we have a valid SKU to prevent loops
  const { 
    cache,
    generateDataHash, 
    setCachedParameters,
    setSelectedMethod,
    getCachedParameters,
    isCacheValid,
    cacheVersion
  } = useOptimizationCache();
  
  const { loadManualAIPreferences, saveManualAIPreferences } = useManualAIPreferences();
  
  const {
    getCachedForecast,
    setCachedForecast,
    generateParametersHash
  } = useForecastCache();

  const [models, setModels] = useState<ModelConfig[]>(() => {
    console.log('🔧 Initializing models with defaults');
    return getDefaultModels();
  });

  // Create models from cache data - SIMPLIFIED to break circular dependencies
  const createModelsFromCache = useCallback(() => {
    if (!isValidSelectedSKU) {
      console.log('🔧 createModelsFromCache: Invalid SKU, returning defaults');
      return getDefaultModels();
    }

    console.log('🔧 createModelsFromCache: Processing for SKU:', selectedSKU);
    
    const preferences = loadManualAIPreferences();
    const skuData = data.filter(d => d.sku === selectedSKU);
    const currentDataHash = generateDataHash(skuData);

    return getDefaultModels().map(model => {
      // Skip cache operations for models without parameters
      if (!modelHasParameters(model)) {
        return model;
      }

      const preferenceKey = `${selectedSKU}:${model.id}`;
      const storedPreference = preferences[preferenceKey] || 'manual';
      
      const cached = cache[selectedSKU]?.[model.id];
      if (!cached) {
        return model;
      }

      let selectedCache = null;
      if (storedPreference === 'ai' && cached.ai?.dataHash === currentDataHash) {
        selectedCache = cached.ai;
      } else if (storedPreference === 'grid' && cached.grid?.dataHash === currentDataHash) {
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

      return model;
    });
  }, [selectedSKU, data, cache, loadManualAIPreferences, generateDataHash, isValidSelectedSKU]);

  // SINGLE effect to handle SKU changes and cache updates - SIMPLIFIED
  useEffect(() => {
    if (!isValidSelectedSKU) {
      console.log('❌ useUnifiedModelManagement: Invalid SKU, skipping all operations');
      return;
    }

    // Only process if SKU actually changed or we haven't initialized models yet
    if (selectedSKU === lastProcessedSKURef.current && modelsInitializedRef.current) {
      console.log('⏭️ useUnifiedModelManagement: SKU unchanged and models initialized, skipping');
      return;
    }
    
    console.log('🔄 useUnifiedModelManagement: Processing SKU change:', selectedSKU);
    
    lastProcessedSKURef.current = selectedSKU;
    modelsInitializedRef.current = true;
    
    const updatedModels = createModelsFromCache();
    setModels(updatedModels);
    
    // Reset forecast generation to trigger new forecasts
    forecastGenerationInProgressRef.current = false;
  }, [selectedSKU, cacheVersion, createModelsFromCache, isValidSelectedSKU]);

  // Generate forecasts when models are ready - SIMPLIFIED
  const generateForecasts = useCallback(async () => {
    if (!isValidSelectedSKU || models.length === 0) {
      console.log('🚀 generateForecasts: Invalid SKU or no models, skipping');
      return;
    }
    
    if (forecastGenerationInProgressRef.current) {
      console.log('🚀 generateForecasts: Already in progress, skipping');
      return;
    }

    const enabledModels = models.filter(m => m.enabled);
    if (enabledModels.length === 0) {
      console.log('🚀 generateForecasts: No enabled models, skipping');
      return;
    }

    try {
      forecastGenerationInProgressRef.current = true;
      
      console.log('🚀 Generating forecasts for SKU:', selectedSKU, 'with', enabledModels.length, 'models');
      
      const results = await generateForecastsForSKU(
        selectedSKU,
        data,
        models,
        forecastPeriods,
        getCachedForecast,
        setCachedForecast,
        generateParametersHash
      );
      
      if (onForecastGeneration) {
        onForecastGeneration(results, selectedSKU);
      }

    } catch (error) {
      console.error('🚀 Forecast generation error:', error);
      toast({
        title: "Forecast Error",
        description: error instanceof Error ? error.message : "Failed to generate forecasts. Please try again.",
        variant: "destructive",
      });
    } finally {
      forecastGenerationInProgressRef.current = false;
    }
  }, [selectedSKU, data, models, forecastPeriods, getCachedForecast, setCachedForecast, generateParametersHash, onForecastGeneration, toast, isValidSelectedSKU]);

  // Trigger forecast generation when models change - DEBOUNCED
  useEffect(() => {
    if (!isValidSelectedSKU || !modelsInitializedRef.current) {
      return;
    }

    const enabledModels = models.filter(m => m.enabled);
    if (enabledModels.length === 0) {
      return;
    }

    // Debounce forecast generation to prevent rapid calls
    const timeoutId = setTimeout(() => {
      generateForecasts();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [models, generateForecasts, isValidSelectedSKU]);

  const toggleModel = useCallback((modelId: string) => {
    if (!isValidSelectedSKU) {
      console.log('❌ toggleModel: Invalid SKU, skipping');
      return;
    }

    setModels(prev => prev.map(model => 
      model.id === modelId ? { ...model, enabled: !model.enabled } : model
    ));
  }, [isValidSelectedSKU]);

  const updateParameter = useCallback((modelId: string, parameter: string, value: number) => {
    if (!isValidSelectedSKU) {
      console.log('❌ updateParameter: Invalid SKU, skipping');
      return;
    }
    
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
  }, [selectedSKU, loadManualAIPreferences, saveManualAIPreferences, setSelectedMethod, isValidSelectedSKU]);

  const useAIOptimization = useCallback(async (modelId: string) => {
    if (!isValidSelectedSKU) {
      console.log('❌ useAIOptimization: Invalid SKU, skipping');
      return;
    }
    
    console.log(`🤖 AI button clicked for ${modelId}`);
    
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
      
      setModels(prev => prev.map(m => 
        m.id === modelId 
          ? { 
              ...m, 
              optimizedParameters: cachedAI.parameters,
              optimizationConfidence: cachedAI.confidence,
              optimizationReasoning: cachedAI.reasoning,
              optimizationFactors: cachedAI.factors,
              expectedAccuracy: cachedAI.expectedAccuracy,
              optimizationMethod: cachedAI.method
            }
          : m
      ));
      return;
    }
    
    // Run fresh optimization if no cache
    try {
      const model = models.find(m => m.id === modelId);
      if (model && modelHasParameters(model)) {
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
  }, [selectedSKU, data, models, businessContext, generateDataHash, getCachedParameters, isCacheValid, loadManualAIPreferences, saveManualAIPreferences, setSelectedMethod, setCachedParameters, isValidSelectedSKU]);

  const useGridOptimization = useCallback(async (modelId: string) => {
    if (!isValidSelectedSKU) {
      console.log('❌ useGridOptimization: Invalid SKU, skipping');
      return;
    }
    
    console.log(`📊 Grid button clicked for ${modelId}`);
    
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
      
      setModels(prev => prev.map(m => 
        m.id === modelId 
          ? { 
              ...m, 
              optimizedParameters: cachedGrid.parameters,
              optimizationConfidence: cachedGrid.confidence,
              optimizationReasoning: cachedGrid.reasoning,
              optimizationFactors: cachedGrid.factors,
              expectedAccuracy: cachedGrid.expectedAccuracy,
              optimizationMethod: cachedGrid.method
            }
          : m
      ));
      return;
    }
    
    // Run fresh optimization if no cache
    try {
      const model = models.find(m => m.id === modelId);
      if (model && modelHasParameters(model)) {
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
  }, [selectedSKU, data, models, businessContext, generateDataHash, getCachedParameters, isCacheValid, loadManualAIPreferences, saveManualAIPreferences, setSelectedMethod, setCachedParameters, isValidSelectedSKU]);

  const resetToManual = useCallback((modelId: string) => {
    if (!isValidSelectedSKU) {
      console.log('❌ resetToManual: Invalid SKU, skipping');
      return;
    }
    
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
  }, [selectedSKU, loadManualAIPreferences, saveManualAIPreferences, setSelectedMethod, isValidSelectedSKU]);

  return {
    models,
    toggleModel,
    updateParameter,
    useAIOptimization,
    useGridOptimization,
    resetToManual,
    generateForecasts
  };
};
