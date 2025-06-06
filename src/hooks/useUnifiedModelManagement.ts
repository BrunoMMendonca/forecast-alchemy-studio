
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ModelConfig } from '@/types/forecast';
import { SalesData, ForecastResult } from '@/pages/Index';
import { getDefaultModels } from '@/utils/modelConfig';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useAutoBestMethod } from '@/hooks/useAutoBestMethod';
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
  const methodSwitchInProgressRef = useRef<boolean>(false);

  const { 
    cache,
    generateDataHash, 
    setSelectedMethod,
    cacheVersion
  } = useOptimizationCache();
  
  const { loadAutoBestMethod, saveAutoBestMethod } = useAutoBestMethod();

  const [models, setModels] = useState<ModelConfig[]>(() => {
    return getDefaultModels();
  });

  // Create a stable hash of model state to prevent unnecessary re-renders
  // IMPROVED: Only include the actual parameters that will be used, not the method selection
  const modelsHash = useMemo(() => {
    const enabledModels = models.filter(m => m.enabled);
    if (enabledModels.length === 0) return 'no-enabled-models';
    
    const hashData = enabledModels.map(m => {
      // Determine which parameters will actually be used
      const cached = cache[selectedSKU]?.[m.id];
      const userSelectedMethod = cached?.selected;
      const isManual = userSelectedMethod === 'manual';
      
      // Use the actual parameters that will be used for forecasting
      const effectiveParams = isManual ? m.parameters : (m.optimizedParameters || m.parameters);
      
      return {
        id: m.id,
        enabled: m.enabled,
        params: effectiveParams,
        // Only include method if it affects which parameters are used
        method: m.optimizedParameters ? (isManual ? 'manual' : 'optimized') : 'manual'
      };
    });
    
    return JSON.stringify(hashData);
  }, [models, cache, selectedSKU]);

  // Generate forecasts when models actually change (not just re-render)
  const generateForecasts = useCallback(async () => {
    if (!selectedSKU || models.length === 0) return;
    if (forecastGenerationInProgressRef.current || methodSwitchInProgressRef.current) {
      console.log('🔄 FORECAST: Skipping generation - operation in progress');
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
      
      console.log('🔄 FORECAST: Generating forecasts with hash:', modelsHash.substring(0, 100));
      
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

  // Helper function to get the best available method for automatic selection
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

  // Function to update automatic best method selections
  const updateAutoBestMethods = useCallback((sku: string, currentDataHash: string) => {
    const autoMethods = loadAutoBestMethod();
    let methodsUpdated = false;

    // Get all models that have cache entries for this SKU
    const skuCache = cache[sku];
    if (!skuCache) return;

    Object.keys(skuCache).forEach(modelId => {
      const autoKey = `${sku}:${modelId}`;
      const currentAutoMethod = autoMethods[autoKey];
      const bestAvailableMethod = getBestAvailableMethod(sku, modelId, currentDataHash);

      // Only update if we have a better method available than current auto method
      const shouldUpdate = (
        !currentAutoMethod || // No auto method set
        (currentAutoMethod === 'manual' && bestAvailableMethod !== 'manual') || // Manual -> Better method
        (currentAutoMethod === 'grid' && bestAvailableMethod === 'ai') // Grid -> AI
      );

      if (shouldUpdate && bestAvailableMethod !== currentAutoMethod) {
        autoMethods[autoKey] = bestAvailableMethod;
        methodsUpdated = true;
        console.log(`🎯 AUTO-METHOD UPDATE: ${autoKey} -> ${bestAvailableMethod} (was: ${currentAutoMethod || 'none'})`);
      }
    });

    if (methodsUpdated) {
      saveAutoBestMethod(autoMethods);
      console.log(`💾 AUTO-METHODS: Updated to best available methods for ${sku}`);
    }

    return methodsUpdated;
  }, [cache, loadAutoBestMethod, saveAutoBestMethod, getBestAvailableMethod]);

  // CONTROLLED cache version updates - only process when actually needed
  useEffect(() => {
    if (!selectedSKU) return;

    // Skip processing during method switches to prevent unnecessary updates
    if (isTogglingAIManualRef.current || methodSwitchInProgressRef.current) {
      console.log('🔄 CACHE: Skipping cache processing - method switch in progress');
      return;
    }

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
    
    // First, update automatic best method selections
    updateAutoBestMethods(selectedSKU, currentDataHash);
    
    // Load automatic best methods
    const autoMethods = loadAutoBestMethod();

    const updatedModels = getDefaultModels().map(model => {
      const autoKey = `${selectedSKU}:${model.id}`;
      const cached = cache[selectedSKU]?.[model.id];
      
      // Priority: Use user's explicit "selected" choice, fallback to automatic best method
      let effectiveMethod = cached?.selected;
      if (!effectiveMethod) {
        effectiveMethod = autoMethods[autoKey] || getBestAvailableMethod(selectedSKU, model.id, currentDataHash);
      }

      let selectedCache = null;
      if (effectiveMethod === 'ai' && cached?.ai) {
        selectedCache = cached.ai;
      } else if (effectiveMethod === 'grid' && cached?.grid) {
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
  }, [cacheVersion, selectedSKU, data, cache, generateDataHash, updateAutoBestMethods]);

  // CONTROLLED forecast generation - only when models hash actually changes
  useEffect(() => {
    if (!selectedSKU || !models.length) return;
    
    const enabledModels = models.filter(m => m.enabled);
    if (enabledModels.length === 0) return;

    // Skip during method switches or if already processing
    if (isTogglingAIManualRef.current || methodSwitchInProgressRef.current || forecastGenerationInProgressRef.current) {
      console.log('🔄 FORECAST: Skipping generation - operation in progress');
      return;
    }

    // Only generate if the hash has actually changed
    if (lastForecastGenerationHashRef.current !== modelsHash) {
      // Use a longer timeout to debounce method switches more aggressively
      const timeoutId = setTimeout(() => {
        if (lastForecastGenerationHashRef.current !== modelsHash && !methodSwitchInProgressRef.current) {
          generateForecasts();
        }
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [modelsHash, selectedSKU, generateForecasts]);

  const toggleModel = useCallback((modelId: string) => {
    setModels(prev => prev.map(model => 
      model.id === modelId ? { ...model, enabled: !model.enabled } : model
    ));
    lastForecastGenerationHashRef.current = '';
  }, []);

  const updateParameter = useCallback((modelId: string, parameter: string, value: number) => {
    isTogglingAIManualRef.current = true;
    methodSwitchInProgressRef.current = true;
    
    // Set explicit user selection to manual in cache
    setSelectedMethod(selectedSKU, modelId, 'manual');

    // Update the parameter without clearing optimization data
    setModels(prev => prev.map(model => 
      model.id === modelId 
        ? { 
            ...model, 
            parameters: { ...model.parameters, [parameter]: value }
          }
        : model
    ));

    lastForecastGenerationHashRef.current = '';

    setTimeout(() => {
      isTogglingAIManualRef.current = false;
      methodSwitchInProgressRef.current = false;
    }, 200);
  }, [selectedSKU, setSelectedMethod]);

  const resetToManual = useCallback((modelId: string) => {
    isTogglingAIManualRef.current = true;
    methodSwitchInProgressRef.current = true;
    
    console.log('🔄 RESET: Setting method to manual for', modelId);
    
    // Only set the method to manual - don't clear optimization data
    // The cache preserves all optimization results for instant switching
    setSelectedMethod(selectedSKU, modelId, 'manual');
    
    lastForecastGenerationHashRef.current = '';
    
    setTimeout(() => {
      isTogglingAIManualRef.current = false;
      methodSwitchInProgressRef.current = false;
      console.log('🔄 RESET: Method switch completed for', modelId);
    }, 200);
  }, [selectedSKU, setSelectedMethod]);

  return {
    models,
    toggleModel,
    updateParameter,
    resetToManual,
    generateForecasts
  };
};
