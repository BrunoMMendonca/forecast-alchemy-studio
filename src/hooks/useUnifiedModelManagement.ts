
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ModelConfig } from '@/types/forecast';
import { SalesData, ForecastResult } from '@/pages/Index';
import { getDefaultModels } from '@/utils/modelConfig';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useManualAIPreferences } from '@/hooks/useManualAIPreferences';
import { BusinessContext } from '@/types/businessContext';
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
    setSelectedMethod,
    cacheVersion
  } = useOptimizationCache();
  
  const { loadManualAIPreferences, saveManualAIPreferences } = useManualAIPreferences();

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
        forecastPeriods
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
  }, [selectedSKU, data, modelsHash, forecastPeriods, onForecastGeneration, toast]);

  // Helper function to get the best available method for a model
  const getBestAvailableMethod = useCallback((sku: string, modelId: string, currentDataHash: string) => {
    const cached = cache[sku]?.[modelId];
    if (!cached) return 'manual';

    const hasValidAI = cached.ai && cached.ai.dataHash === currentDataHash;
    const hasValidGrid = cached.grid && cached.grid.dataHash === currentDataHash;

    // Priority: AI > Grid > Manual
    if (hasValidAI) return 'ai';
    if (hasValidGrid) return 'grid';
    return 'manual';
  }, [cache]);

  // Function to update preferences to best available method
  const updatePreferencesToBestAvailable = useCallback((sku: string, currentDataHash: string) => {
    const preferences = loadManualAIPreferences();
    let preferencesUpdated = false;

    // Get all models that have cache entries for this SKU
    const skuCache = cache[sku];
    if (!skuCache) return;

    Object.keys(skuCache).forEach(modelId => {
      const preferenceKey = `${sku}:${modelId}`;
      const currentPreference = preferences[preferenceKey];
      const bestAvailableMethod = getBestAvailableMethod(sku, modelId, currentDataHash);

      // Only update if we have a better method available than current preference
      const shouldUpdate = (
        !currentPreference || // No preference set
        (currentPreference === 'manual' && bestAvailableMethod !== 'manual') || // Manual -> Better method
        (currentPreference === 'grid' && bestAvailableMethod === 'ai') // Grid -> AI
      );

      if (shouldUpdate && bestAvailableMethod !== currentPreference) {
        preferences[preferenceKey] = bestAvailableMethod;
        preferencesUpdated = true;
        console.log(`🎯 AUTO-PREFERENCE UPDATE: ${preferenceKey} -> ${bestAvailableMethod} (was: ${currentPreference || 'none'})`);
      }
    });

    if (preferencesUpdated) {
      saveManualAIPreferences(preferences);
      console.log(`💾 PREFERENCES: Updated to best available methods for ${sku}`);
    }

    return preferencesUpdated;
  }, [cache, loadManualAIPreferences, saveManualAIPreferences, getBestAvailableMethod]);

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
    
    const skuData = data.filter(d => d.sku === selectedSKU);
    const currentDataHash = generateDataHash(skuData);
    
    // First, update preferences to best available methods
    const preferencesWereUpdated = updatePreferencesToBestAvailable(selectedSKU, currentDataHash);
    
    // Load preferences (potentially updated)
    const preferences = loadManualAIPreferences();

    const updatedModels = getDefaultModels().map(model => {
      const preferenceKey = `${selectedSKU}:${model.id}`;
      const actualPreference = preferences[preferenceKey] || getBestAvailableMethod(selectedSKU, model.id, currentDataHash);

      const cached = cache[selectedSKU]?.[model.id];
      let selectedCache = null;

      if (actualPreference === 'ai' && cached?.ai) {
        selectedCache = cached.ai;
      } else if (actualPreference === 'grid' && cached?.grid) {
        selectedCache = cached.grid;
      }

      if (selectedCache && selectedCache.dataHash === currentDataHash) {
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
  }, [cacheVersion, selectedSKU, data, cache, generateDataHash, updatePreferencesToBestAvailable]);

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
    resetToManual,
    generateForecasts
  };
};
