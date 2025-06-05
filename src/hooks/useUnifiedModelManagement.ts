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
  console.log('🔧 useUnifiedModelManagement isValidSKU:', { sku: `"${sku}"`, type: typeof sku, isValid });
  return isValid;
};

// Helper function to check if a model has parameters that can be optimized
const modelHasParameters = (model: ModelConfig): boolean => {
  const params = model.optimizedParameters || model.parameters;
  const hasParams = params && Object.keys(params).length > 0;
  console.log('🔧 modelHasParameters check for', model.id, ':', hasParams, 'params:', params);
  return hasParams;
};

export const useUnifiedModelManagement = (
  selectedSKU: string, 
  data: SalesData[], 
  forecastPeriods: number,
  businessContext?: BusinessContext,
  onForecastGeneration?: (results: ForecastResult[], selectedSKU: string) => void
) => {
  const { toast } = useToast();
  const isTogglingAIManualRef = useRef<boolean>(false);
  const lastProcessedCacheVersionRef = useRef<number>(-1);
  const lastProcessedSKURef = useRef<string>('');
  const forecastGenerationInProgressRef = useRef<boolean>(false);
  const lastForecastGenerationHashRef = useRef<string>('');

  // Early validation - don't proceed with any cache operations if SKU is invalid
  const isValidSelectedSKU = isValidSKU(selectedSKU);

  console.log('🔧 useUnifiedModelManagement init:', {
    selectedSKU: `"${selectedSKU}"`,
    isValidSKU: isValidSelectedSKU,
    selectedSKUType: typeof selectedSKU,
    selectedSKULength: selectedSKU?.length,
    willProceedWithCacheOps: isValidSelectedSKU
  });

  // CRITICAL: If SKU is invalid, don't initialize cache hooks that might cause loops
  const shouldInitializeCacheHooks = isValidSelectedSKU;

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

  // Create a stable hash of model state to prevent unnecessary re-renders
  // ONLY include models that have parameters to prevent seasonal_naive from causing issues
  const modelsHash = useMemo(() => {
    if (!isValidSelectedSKU) {
      console.log('🔧 modelsHash: Invalid SKU, returning early');
      return 'invalid-sku';
    }
    
    const enabledModelsWithParams = models.filter(m => {
      const enabled = m.enabled;
      const hasParams = modelHasParameters(m);
      console.log(`🔧 modelsHash filter - ${m.id}: enabled=${enabled}, hasParams=${hasParams}`);
      return enabled && hasParams;
    });
    
    if (enabledModelsWithParams.length === 0) {
      console.log('🔧 modelsHash: No enabled models with parameters');
      return 'no-enabled-models-with-params';
    }
    
    const hashData = enabledModelsWithParams.map(m => ({
      id: m.id,
      enabled: m.enabled,
      params: m.optimizedParameters || m.parameters,
      method: m.optimizationMethod
    }));
    
    const hash = JSON.stringify(hashData);
    console.log('🔧 modelsHash generated:', hash.substring(0, 100) + '...');
    return hash;
  }, [models, isValidSelectedSKU]);

  // Generate forecasts when models actually change (not just re-render)
  const generateForecasts = useCallback(async () => {
    console.log('🚀 generateForecasts called - initial checks:', {
      isValidSelectedSKU,
      modelsLength: models.length,
      inProgress: forecastGenerationInProgressRef.current,
      lastHash: lastForecastGenerationHashRef.current.substring(0, 30),
      currentHash: modelsHash.substring(0, 30)
    });

    if (!isValidSelectedSKU || models.length === 0) {
      console.log('🚀 Skipping forecast generation - invalid SKU or no models');
      return;
    }
    
    if (forecastGenerationInProgressRef.current) {
      console.log('🚀 Skipping forecast generation - already in progress');
      return;
    }

    // Check if we've already generated for this exact state
    if (lastForecastGenerationHashRef.current === modelsHash) {
      console.log('🚀 Skipping forecast generation - already generated for this hash');
      return;
    }

    const enabledModels = models.filter(m => m.enabled);
    if (enabledModels.length === 0) {
      console.log('🚀 Skipping forecast generation - no enabled models');
      return;
    }

    try {
      forecastGenerationInProgressRef.current = true;
      lastForecastGenerationHashRef.current = modelsHash;
      
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
  }, [selectedSKU, data, modelsHash, forecastPeriods, getCachedForecast, setCachedForecast, generateParametersHash, onForecastGeneration, toast, isValidSelectedSKU]);

  // Helper function to get the best available method for a model
  const getBestAvailableMethod = useCallback((sku: string, modelId: string, currentDataHash: string) => {
    console.log('🔍 getBestAvailableMethod called:', { sku: `"${sku}"`, modelId, hashLength: currentDataHash?.length });

    // Early return if SKU is invalid or model doesn't have parameters
    if (!isValidSKU(sku)) {
      console.log('🔍 getBestAvailableMethod: Invalid SKU, returning manual');
      return 'manual';
    }
    
    const model = getDefaultModels().find(m => m.id === modelId);
    if (!model || !modelHasParameters(model)) {
      console.log('🔍 getBestAvailableMethod: Model has no parameters, returning manual for', modelId);
      return 'manual';
    }

    // Only check cache if we should initialize cache hooks
    if (!shouldInitializeCacheHooks) {
      console.log('🔍 getBestAvailableMethod: Cache hooks not initialized, returning manual');
      return 'manual';
    }

    const cached = cache[sku]?.[modelId];
    if (!cached) {
      console.log('🔍 getBestAvailableMethod: No cache for', sku, modelId, 'returning manual');
      return 'manual';
    }

    const hasValidAI = cached.ai && cached.ai.dataHash === currentDataHash;
    const hasValidGrid = cached.grid && cached.grid.dataHash === currentDataHash;

    console.log('🔍 getBestAvailableMethod cache check:', { hasValidAI, hasValidGrid });

    if (hasValidAI) return 'ai';
    if (hasValidGrid) return 'grid';
    return 'manual';
  }, [cache, shouldInitializeCacheHooks]);

  // CONTROLLED cache version updates - only process when actually needed
  useEffect(() => {
    console.log('🔄 Cache version effect triggered:', {
      isValidSelectedSKU,
      shouldInitializeCacheHooks,
      cacheVersion,
      lastProcessedVersion: lastProcessedCacheVersionRef.current,
      selectedSKU: `"${selectedSKU}"`,
      lastProcessedSKU: `"${lastProcessedSKURef.current}"`
    });

    // Early return if no valid SKU - CRITICAL for preventing infinite loops
    if (!isValidSelectedSKU || !shouldInitializeCacheHooks) {
      console.log('❌ useUnifiedModelManagement: Skipping cache update - invalid SKU or cache hooks not initialized');
      return;
    }

    // Prevent unnecessary processing
    const shouldProcess = (
      cacheVersion !== lastProcessedCacheVersionRef.current || 
      selectedSKU !== lastProcessedSKURef.current
    );

    if (!shouldProcess) {
      console.log('⏭️ useUnifiedModelManagement: Skipping cache update - already processed');
      return;
    }
    
    console.log('🔄 useUnifiedModelManagement: Processing cache update for', selectedSKU, 'version', cacheVersion);
    
    lastProcessedCacheVersionRef.current = cacheVersion;
    lastProcessedSKURef.current = selectedSKU;
    
    const preferences = loadManualAIPreferences();
    const skuData = data.filter(d => d.sku === selectedSKU);
    const currentDataHash = generateDataHash(skuData);

    const updatedModels = getDefaultModels().map(model => {
      // Skip cache operations for models without parameters
      if (!modelHasParameters(model)) {
        console.log('⏭️ Skipping cache operations for', model.id, '- no parameters');
        return model;
      }

      const preferenceKey = `${selectedSKU}:${model.id}`;
      const storedPreference = preferences[preferenceKey] || 'manual';
      
      // Determine the best available method based on cache
      const bestAvailableMethod = getBestAvailableMethod(selectedSKU, model.id, currentDataHash);
      
      // Use stored preference if it's available, otherwise use best available
      const actualPreference = (() => {
        const cached = cache[selectedSKU]?.[model.id];
        if (!cached) return 'manual';

        const hasValidAI = cached.ai && cached.ai.dataHash === currentDataHash;
        const hasValidGrid = cached.grid && cached.grid.dataHash === currentDataHash;

        // If stored preference is available, use it
        if (storedPreference === 'ai' && hasValidAI) return 'ai';
        if (storedPreference === 'grid' && hasValidGrid) return 'grid';
        if (storedPreference === 'manual') return 'manual';

        // Otherwise, use best available
        return bestAvailableMethod;
      })();

      const cached = cache[selectedSKU]?.[model.id];
      let selectedCache = null;

      if (actualPreference === 'ai' && cached?.ai) {
        selectedCache = cached.ai;
      } else if (actualPreference === 'grid' && cached?.grid) {
        selectedCache = cached.grid;
      }

      if (selectedCache && selectedCache.dataHash === currentDataHash) {
        // Update preference to match what we're actually using
        if (actualPreference !== storedPreference) {
          const updatedPreferences = { ...preferences };
          updatedPreferences[preferenceKey] = actualPreference;
          saveManualAIPreferences(updatedPreferences);
        }

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
    
    setModels(updatedModels);
    
    // Reset forecast generation hash when models are updated from cache
    lastForecastGenerationHashRef.current = '';
  }, [cacheVersion, selectedSKU, data, cache, loadManualAIPreferences, saveManualAIPreferences, generateDataHash, getBestAvailableMethod, isValidSelectedSKU, shouldInitializeCacheHooks]);

  // CONTROLLED forecast generation - only when models hash actually changes
  useEffect(() => {
    console.log('🔄 Forecast generation effect triggered:', {
      isValidSelectedSKU,
      modelsLength: models.length,
      lastHash: lastForecastGenerationHashRef.current.substring(0, 30),
      currentHash: modelsHash.substring(0, 30),
      inProgress: forecastGenerationInProgressRef.current
    });

    if (!isValidSelectedSKU || !models.length) {
      console.log('⏭️ Skipping forecast effect - invalid SKU or no models');
      return;
    }
    
    const enabledModels = models.filter(m => m.enabled);
    if (enabledModels.length === 0) {
      console.log('⏭️ Skipping forecast effect - no enabled models');
      return;
    }

    // Only generate if the hash has actually changed and we're not currently processing
    if (lastForecastGenerationHashRef.current !== modelsHash && !forecastGenerationInProgressRef.current) {
      console.log('🔄 Models hash changed, scheduling forecast generation');
      // Use a timeout to debounce rapid changes
      const timeoutId = setTimeout(() => {
        if (lastForecastGenerationHashRef.current !== modelsHash) {
          generateForecasts();
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [modelsHash, generateForecasts, isValidSelectedSKU]);

  const toggleModel = useCallback((modelId: string) => {
    console.log('🔄 toggleModel called:', { modelId, isValidSelectedSKU });
    if (!isValidSelectedSKU) {
      console.log('❌ toggleModel: Invalid SKU, skipping');
      return;
    }

    setModels(prev => prev.map(model => 
      model.id === modelId ? { ...model, enabled: !model.enabled } : model
    ));
    // Reset forecast hash to trigger regeneration
    lastForecastGenerationHashRef.current = '';
  }, [isValidSelectedSKU]);

  const updateParameter = useCallback((modelId: string, parameter: string, value: number) => {
    console.log('📝 updateParameter called:', { modelId, parameter, value, isValidSelectedSKU });
    // Early return if no valid SKU
    if (!isValidSelectedSKU) {
      console.log('❌ updateParameter: Invalid SKU, skipping');
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

    // Reset forecast hash to trigger regeneration
    lastForecastGenerationHashRef.current = '';

    setTimeout(() => {
      isTogglingAIManualRef.current = false;
    }, 100);
  }, [selectedSKU, loadManualAIPreferences, saveManualAIPreferences, setSelectedMethod, isValidSelectedSKU]);

  const useAIOptimization = useCallback(async (modelId: string) => {
    // Early return if no valid SKU
    if (!isValidSelectedSKU) {
      console.log('❌ useAIOptimization: Invalid SKU, skipping');
      return;
    }
    
    console.log(`🤖 AI button clicked for ${modelId}`);
    isTogglingAIManualRef.current = true;
    
    const skuData = data.filter(d => d.sku === selectedSKU);
    const currentDataHash = generateDataHash(skuData);
    
    console.log(`🤖 Checking cache FIRST for AI optimization ${selectedSKU}:${modelId}`);
    
    // CACHE-FIRST APPROACH: Check if we have valid cached AI results
    const cachedAI = getCachedParameters(selectedSKU, modelId, 'ai');
    if (cachedAI && isCacheValid(selectedSKU, modelId, currentDataHash, 'ai')) {
      console.log(`✅ CACHE HIT: Using cached AI result for ${modelId} - no API call needed!`);
      
      // Update preference to AI
      const preferences = loadManualAIPreferences();
      const preferenceKey = `${selectedSKU}:${modelId}`;
      preferences[preferenceKey] = 'ai';
      saveManualAIPreferences(preferences);
      setSelectedMethod(selectedSKU, modelId, 'ai');
      
      // Apply cached AI parameters immediately
      setModels(prev => {
        const newModels = prev.map(m => 
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
        );
        return newModels;
      });
      
      lastForecastGenerationHashRef.current = '';
      isTogglingAIManualRef.current = false;
      return;
    }
    
    console.log(`🚀 CACHE MISS: No valid cached AI result, making fresh API call for ${modelId}`);
    
    // Only call API if cache miss or invalid cache
    try {
      const model = models.find(m => m.id === modelId);
      if (model && modelHasParameters(model)) {
        const result = await getOptimizationByMethod(model, skuData, selectedSKU, 'ai', businessContext);
        
        if (result) {
          console.log(`🎯 Fresh AI optimization SUCCESS for ${modelId}`);
          
          // Update preference to AI
          const preferences = loadManualAIPreferences();
          const preferenceKey = `${selectedSKU}:${modelId}`;
          preferences[preferenceKey] = 'ai';
          saveManualAIPreferences(preferences);
          setSelectedMethod(selectedSKU, modelId, 'ai');
          
          // Cache the new result
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
          
          // Apply new parameters
          setModels(prev => {
            const newModels = prev.map(m => 
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
            );
            return newModels;
          });
          
          lastForecastGenerationHashRef.current = '';
        } else {
          console.log(`❌ Fresh AI optimization FAILED for ${modelId} - no result returned`);
        }
      }
    } catch (error) {
      console.error('AI optimization failed:', error);
    }
    
    setTimeout(() => {
      isTogglingAIManualRef.current = false;
    }, 100);
  }, [selectedSKU, data, models, businessContext, generateDataHash, getCachedParameters, isCacheValid, loadManualAIPreferences, saveManualAIPreferences, setSelectedMethod, setCachedParameters, isValidSelectedSKU]);

  const useGridOptimization = useCallback(async (modelId: string) => {
    // Early return if no valid SKU
    if (!isValidSelectedSKU) {
      console.log('❌ useGridOptimization: Invalid SKU, skipping');
      return;
    }
    
    console.log(`📊 Grid button clicked for ${modelId}`);
    isTogglingAIManualRef.current = true;
    
    const skuData = data.filter(d => d.sku === selectedSKU);
    const currentDataHash = generateDataHash(skuData);
    
    console.log(`📊 Checking cache FIRST for Grid optimization ${selectedSKU}:${modelId}`);
    
    // CACHE-FIRST APPROACH: Check if we have valid cached Grid results
    const cachedGrid = getCachedParameters(selectedSKU, modelId, 'grid');
    if (cachedGrid && isCacheValid(selectedSKU, modelId, currentDataHash, 'grid')) {
      console.log(`✅ CACHE HIT: Using cached Grid result for ${modelId} - no API call needed!`);
      
      // Update preference to Grid
      const preferences = loadManualAIPreferences();
      const preferenceKey = `${selectedSKU}:${modelId}`;
      preferences[preferenceKey] = 'grid';
      saveManualAIPreferences(preferences);
      setSelectedMethod(selectedSKU, modelId, 'grid');
      
      // Apply cached Grid parameters immediately
      setModels(prev => {
        const newModels = prev.map(m => 
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
        );
        return newModels;
      });
      
      lastForecastGenerationHashRef.current = '';
      isTogglingAIManualRef.current = false;
      return;
    }
    
    console.log(`🚀 CACHE MISS: No valid cached Grid result, running fresh optimization for ${modelId}`);
    
    // Only run optimization if cache miss or invalid cache
    try {
      const model = models.find(m => m.id === modelId);
      if (model && modelHasParameters(model)) {
        const result = await getOptimizationByMethod(model, skuData, selectedSKU, 'grid', businessContext);
        
        if (result) {
          console.log(`🎯 Fresh Grid optimization SUCCESS for ${modelId}`);
          
          // Update preference to Grid
          const preferences = loadManualAIPreferences();
          const preferenceKey = `${selectedSKU}:${modelId}`;
          preferences[preferenceKey] = 'grid';
          saveManualAIPreferences(preferences);
          setSelectedMethod(selectedSKU, modelId, 'grid');
          
          // Cache the new result
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
          
          // Apply new parameters
          setModels(prev => {
            const newModels = prev.map(m => 
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
            );
            return newModels;
          });
          
          lastForecastGenerationHashRef.current = '';
        } else {
          console.log(`❌ Fresh Grid optimization FAILED for ${modelId} - no result returned`);
        }
      }
    } catch (error) {
      console.error('Grid optimization failed:', error);
    }
    
    setTimeout(() => {
      isTogglingAIManualRef.current = false;
    }, 100);
  }, [selectedSKU, data, models, businessContext, generateDataHash, getCachedParameters, isCacheValid, loadManualAIPreferences, saveManualAIPreferences, setSelectedMethod, setCachedParameters, isValidSelectedSKU]);

  const resetToManual = useCallback((modelId: string) => {
    // Early return if no valid SKU
    if (!isValidSelectedSKU) {
      console.log('❌ resetToManual: Invalid SKU, skipping');
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
            optimizedParameters: undefined,
            optimizationConfidence: undefined,
            optimizationReasoning: undefined,
            optimizationFactors: undefined,
            expectedAccuracy: undefined,
            optimizationMethod: undefined
          }
        : model
    ));
    
    // Reset forecast hash to trigger regeneration
    lastForecastGenerationHashRef.current = '';
    
    setTimeout(() => {
      isTogglingAIManualRef.current = false;
    }, 100);
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
