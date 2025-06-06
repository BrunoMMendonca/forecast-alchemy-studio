
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

  // Generate forecasts when models change - no hash prevention
  const generateForecasts = useCallback(async () => {
    if (!selectedSKU || models.length === 0) return;

    const enabledModels = models.filter(m => m.enabled);
    if (enabledModels.length === 0) return;

    try {
      console.log('🎯 FORECASTS: Generating for SKU:', selectedSKU);
      
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
    }
  }, [selectedSKU, data, models, forecastPeriods, onForecastGeneration, toast]);

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
  }, [cacheVersion, selectedSKU, data, cache, generateDataHash, updateAutoBestMethods]);

  // Generate forecasts whenever models change - no prevention
  useEffect(() => {
    if (!selectedSKU || !models.length) return;
    
    const enabledModels = models.filter(m => m.enabled);
    if (enabledModels.length === 0) return;

    console.log('🎯 FORECASTS: Models changed, generating forecasts');
    generateForecasts();
  }, [models, selectedSKU, generateForecasts]);

  const toggleModel = useCallback((modelId: string) => {
    console.log('🎯 MODELS: Toggling model', modelId);
    setModels(prev => prev.map(model => 
      model.id === modelId ? { ...model, enabled: !model.enabled } : model
    ));
  }, []);

  const updateParameter = useCallback((modelId: string, parameter: string, value: number) => {
    isTogglingAIManualRef.current = true;
    
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

    setTimeout(() => {
      isTogglingAIManualRef.current = false;
    }, 100);
  }, [selectedSKU, setSelectedMethod]);

  const resetToManual = useCallback((modelId: string) => {
    isTogglingAIManualRef.current = true;
    
    // Only set the method to manual - don't clear optimization data
    // The cache preserves all optimization results for instant switching
    setSelectedMethod(selectedSKU, modelId, 'manual');
    
    setTimeout(() => {
      isTogglingAIManualRef.current = false;
    }, 100);
  }, [selectedSKU, setSelectedMethod]);

  return {
    models,
    toggleModel,
    updateParameter,
    resetToManual,
    generateForecasts
  };
};
