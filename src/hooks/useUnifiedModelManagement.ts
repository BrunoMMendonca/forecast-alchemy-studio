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
    return getDefaultModels();
  });

  // Create a stable hash of model state to prevent unnecessary re-renders
  const modelsHash = useMemo(() => {
    const enabledModels = models.filter(m => m.enabled);
    if (enabledModels.length === 0) return 'no-enabled-models';
    
    const hashData = enabledModels.map(m => ({
      id: m.id,
      enabled: m.enabled,
      params: m.optimizedParameters || m.parameters,
      method: m.optimizationMethod
    }));
    
    return JSON.stringify(hashData);
  }, [models]);

  // Generate forecasts when models actually change (not just re-render)
  const generateForecasts = useCallback(async () => {
    if (!selectedSKU || models.length === 0) return;
    if (forecastGenerationInProgressRef.current) {
      return;
    }

    // Check if we've already generated for this exact state
    if (lastForecastGenerationHashRef.current === modelsHash) {
      return;
    }

    const enabledModels = models.filter(m => m.enabled);
    if (enabledModels.length === 0) return;

    try {
      forecastGenerationInProgressRef.current = true;
      lastForecastGenerationHashRef.current = modelsHash;
      
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
      toast({
        title: "Forecast Error",
        description: error instanceof Error ? error.message : "Failed to generate forecasts. Please try again.",
        variant: "destructive",
      });
    } finally {
      forecastGenerationInProgressRef.current = false;
    }
  }, [selectedSKU, data, modelsHash, forecastPeriods, getCachedForecast, setCachedForecast, generateParametersHash, onForecastGeneration, toast]);

  // Helper function to get the best available method for a model
  const getBestAvailableMethod = useCallback((sku: string, modelId: string, currentDataHash: string) => {
    const cached = cache[sku]?.[modelId];
    if (!cached) return 'manual';

    const hasValidAI = cached.ai && cached.ai.dataHash === currentDataHash;
    const hasValidGrid = cached.grid && cached.grid.dataHash === currentDataHash;

    if (hasValidAI) return 'ai';
    if (hasValidGrid) return 'grid';
    return 'manual';
  }, [cache]);

  // CONTROLLED cache version updates - only process when actually needed
  useEffect(() => {
    if (!selectedSKU) return;

    // Prevent unnecessary processing
    const shouldProcess = (
      cacheVersion !== lastProcessedCacheVersionRef.current || 
      selectedSKU !== lastProcessedSKURef.current
    );

    if (!shouldProcess) {
      return;
    }
    
    lastProcessedCacheVersionRef.current = cacheVersion;
    lastProcessedSKURef.current = selectedSKU;
    
    const preferences = loadManualAIPreferences();
    const skuData = data.filter(d => d.sku === selectedSKU);
    const currentDataHash = generateDataHash(skuData);

    const updatedModels = getDefaultModels().map(model => {
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
  }, [cacheVersion, selectedSKU, data, cache, loadManualAIPreferences, saveManualAIPreferences, generateDataHash, getBestAvailableMethod]);

  // CONTROLLED forecast generation - only when models hash actually changes
  useEffect(() => {
    if (!selectedSKU || !models.length) return;
    
    const enabledModels = models.filter(m => m.enabled);
    if (enabledModels.length === 0) return;

    // Only generate if the hash has actually changed and we're not currently processing
    if (lastForecastGenerationHashRef.current !== modelsHash && !forecastGenerationInProgressRef.current) {
      // Use a timeout to debounce rapid changes
      const timeoutId = setTimeout(() => {
        if (lastForecastGenerationHashRef.current !== modelsHash) {
          generateForecasts();
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [modelsHash, selectedSKU, generateForecasts]);

  const toggleModel = useCallback((modelId: string) => {
    setModels(prev => prev.map(model => 
      model.id === modelId ? { ...model, enabled: !model.enabled } : model
    ));
    // Reset forecast hash to trigger regeneration
    lastForecastGenerationHashRef.current = '';
  }, []);

  const updateParameter = useCallback((modelId: string, parameter: string, value: number) => {
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
  }, [selectedSKU, loadManualAIPreferences, saveManualAIPreferences, setSelectedMethod]);

  const useAIOptimization = useCallback(async (modelId: string) => {
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
      if (model) {
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
  }, [selectedSKU, data, models, businessContext, generateDataHash, getCachedParameters, isCacheValid, loadManualAIPreferences, saveManualAIPreferences, setSelectedMethod, setCachedParameters]);

  const useGridOptimization = useCallback(async (modelId: string) => {
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
      if (model) {
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
  }, [selectedSKU, data, models, businessContext, generateDataHash, getCachedParameters, isCacheValid, loadManualAIPreferences, saveManualAIPreferences, setSelectedMethod, setCachedParameters]);

  const resetToManual = useCallback((modelId: string) => {
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
  }, [selectedSKU, loadManualAIPreferences, saveManualAIPreferences, setSelectedMethod]);

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
