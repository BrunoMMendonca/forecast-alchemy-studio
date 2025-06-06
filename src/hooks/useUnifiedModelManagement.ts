
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
  const forecastGenerationInProgressRef = useRef<boolean>(false);
  const lastForecastGenerationHashRef = useRef<string>('');
  const lastProcessedCacheVersionRef = useRef<number>(-1);
  const lastProcessedMethodVersionRef = useRef<number>(-1);
  const lastProcessedSKURef = useRef<string>('');
  const currentDataHashRef = useRef<string>(''); // Store hash to avoid regeneration

  const { 
    cache,
    generateDataHash, 
    setSelectedMethod,
    cacheVersion,
    methodSelectionVersion
  } = useOptimizationCache();
  
  const { loadAutoBestMethod, saveAutoBestMethod } = useAutoBestMethod();

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
      // Only include the actual parameter values that affect forecasting
      // Don't include optimization metadata like method, confidence, etc.
      params: m.optimizedParameters || m.parameters
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

  // CONTROLLED cache version updates - only process when optimization data actually changes
  useEffect(() => {
    if (!selectedSKU) return;

    // Only process cache version changes (when optimization data changes)
    const shouldProcessCacheVersion = (
      cacheVersion !== lastProcessedCacheVersionRef.current || 
      selectedSKU !== lastProcessedSKURef.current
    );

    if (!shouldProcessCacheVersion) {
      return;
    }
    
    console.log(`🗄️ CACHE: Processing cache version change: ${lastProcessedCacheVersionRef.current} -> ${cacheVersion}`);
    lastProcessedCacheVersionRef.current = cacheVersion;
    lastProcessedSKURef.current = selectedSKU;
    
    const skuData = data.filter(d => d.sku === selectedSKU);
    const currentDataHash = generateDataHash(skuData);
    currentDataHashRef.current = currentDataHash; // Store for reuse
    
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
    
    // Reset forecast generation hash when models are updated from cache changes
    lastForecastGenerationHashRef.current = '';
  }, [cacheVersion, selectedSKU, data, cache, generateDataHash, updateAutoBestMethods]);

  // LIGHTWEIGHT method selection changes - minimal processing for UI responsiveness
  useEffect(() => {
    if (!selectedSKU) return;

    // Only process method selection changes
    const shouldProcessMethodVersion = (
      methodSelectionVersion !== lastProcessedMethodVersionRef.current &&
      methodSelectionVersion > 0
    );

    if (!shouldProcessMethodVersion) {
      return;
    }

    console.log(`🎯 METHOD: Processing method selection change (lightweight): ${lastProcessedMethodVersionRef.current} -> ${methodSelectionVersion}`);
    lastProcessedMethodVersionRef.current = methodSelectionVersion;

    // Use cached hash if available to avoid regeneration
    const currentDataHash = currentDataHashRef.current || generateDataHash(data.filter(d => d.sku === selectedSKU));

    // Only update models that actually changed their selection
    setModels(prevModels => {
      return prevModels.map(model => {
        const cached = cache[selectedSKU]?.[model.id];
        const userSelectedMethod = cached?.selected;
        
        // Check if this model's method selection actually changed
        const currentIsManual = !model.optimizedParameters;
        const newIsManual = !userSelectedMethod || userSelectedMethod === 'manual';
        
        // If switching to manual mode
        if (!currentIsManual && newIsManual) {
          console.log(`🎯 METHOD: Switching ${model.id} to manual (clearing optimization data)`);
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
        
        // If switching to AI/Grid mode
        if (currentIsManual && !newIsManual) {
          let selectedCache = null;
          if (userSelectedMethod === 'ai' && cached?.ai) {
            selectedCache = cached.ai;
          } else if (userSelectedMethod === 'grid' && cached?.grid) {
            selectedCache = cached.grid;
          }

          if (selectedCache && selectedCache.dataHash === currentDataHash) {
            console.log(`🎯 METHOD: Switching ${model.id} to ${userSelectedMethod} (applying optimization data)`);
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
        }
        
        // No change needed for this model
        return model;
      });
    });
  }, [methodSelectionVersion, selectedSKU, cache]);

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
  }, []);

  const updateParameter = useCallback((modelId: string, parameter: string, value: number) => {
    console.log(`🎚️ PARAMETER UPDATE: ${parameter} = ${value} for ${modelId}`);
    
    // Set explicit user selection to manual in cache (this will trigger method selection effect)
    setSelectedMethod(selectedSKU, modelId, 'manual');

    // Update the parameter - this will trigger forecast regeneration via modelsHash change
    setModels(prev => prev.map(model => 
      model.id === modelId 
        ? { 
            ...model, 
            parameters: { ...model.parameters, [parameter]: value }
          }
        : model
    ));
  }, [selectedSKU, setSelectedMethod]);

  const resetToManual = useCallback((modelId: string) => {
    console.log(`🔄 RESET TO MANUAL: ${modelId}`);
    
    // Only set the method to manual - the method selection effect will handle the UI update
    setSelectedMethod(selectedSKU, modelId, 'manual');
  }, [selectedSKU, setSelectedMethod]);

  return {
    models,
    toggleModel,
    updateParameter,
    resetToManual,
    generateForecasts
  };
};
