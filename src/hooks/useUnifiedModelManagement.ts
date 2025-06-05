
import { useState, useCallback, useRef, useEffect } from 'react';
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

  const { 
    cache,
    generateDataHash, 
    setCachedParameters,
    setSelectedMethod,
    cacheVersion
  } = useOptimizationCache();
  
  const { loadManualAIPreferences, saveManualAIPreferences } = useManualAIPreferences();
  
  const {
    getCachedForecast,
    setCachedForecast,
    generateParametersHash
  } = useForecastCache();

  const [models, setModels] = useState<ModelConfig[]>(() => {
    console.log('🎯 UNIFIED: Creating default models');
    return getDefaultModels();
  });

  // Generate forecasts when models change
  const generateForecasts = useCallback(async () => {
    if (!selectedSKU || models.length === 0) return;

    try {
      console.log(`🎯 UNIFIED: Generating forecasts for ${selectedSKU}`);
      
      const results = await generateForecastsForSKU(
        selectedSKU,
        data,
        models,
        forecastPeriods,
        getCachedForecast,
        setCachedForecast,
        generateParametersHash
      );

      console.log(`✅ UNIFIED: Generated ${results.length} forecasts for ${selectedSKU}`);
      
      if (onForecastGeneration) {
        onForecastGeneration(results, selectedSKU);
      }

    } catch (error) {
      toast({
        title: "Forecast Error",
        description: error instanceof Error ? error.message : "Failed to generate forecasts. Please try again.",
        variant: "destructive",
      });
      console.error('UNIFIED: Forecast generation error:', error);
    }
  }, [selectedSKU, data, models, forecastPeriods, getCachedForecast, setCachedForecast, generateParametersHash, onForecastGeneration, toast]);

  // CONTROLLED cache version updates - only process when actually needed
  useEffect(() => {
    if (!selectedSKU) return;

    // Prevent unnecessary processing
    const shouldProcess = (
      cacheVersion !== lastProcessedCacheVersionRef.current || 
      selectedSKU !== lastProcessedSKURef.current
    );

    if (!shouldProcess) {
      console.log(`🔇 UNIFIED: Skipping cache update - already processed version ${cacheVersion} for ${selectedSKU}`);
      return;
    }

    console.log(`🔄 UNIFIED CACHE PROCESSING: v${cacheVersion} for ${selectedSKU} (prev: v${lastProcessedCacheVersionRef.current})`);
    
    lastProcessedCacheVersionRef.current = cacheVersion;
    lastProcessedSKURef.current = selectedSKU;
    
    const preferences = loadManualAIPreferences();
    const skuData = data.filter(d => d.sku === selectedSKU);
    const currentDataHash = generateDataHash(skuData);

    const updatedModels = getDefaultModels().map(model => {
      const preferenceKey = `${selectedSKU}:${model.id}`;
      const preference = preferences[preferenceKey] || 'ai';
      const cached = cache[selectedSKU]?.[model.id];

      if (preference === 'manual') {
        console.log(`👤 UNIFIED MODEL ${model.id}: Using manual parameters`);
        return model;
      }

      // For AI/Grid preference, try to get the preferred method first
      let selectedCache = null;
      if (preference === 'ai' && cached?.ai && cached.ai.dataHash === currentDataHash) {
        selectedCache = cached.ai;
      } else if (preference === 'grid' && cached?.grid && cached.grid.dataHash === currentDataHash) {
        selectedCache = cached.grid;
      } else {
        // Fallback to any valid cache
        if (cached?.ai && cached.ai.dataHash === currentDataHash) {
          selectedCache = cached.ai;
        } else if (cached?.grid && cached.grid.dataHash === currentDataHash) {
          selectedCache = cached.grid;
        }
      }

      if (selectedCache) {
        console.log(`✅ UNIFIED USING CACHE: ${model.id} with method ${selectedCache.method}`);
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

    console.log('🎯 UNIFIED SETTING NEW MODELS:', updatedModels.map(m => ({ 
      id: m.id, 
      hasOptimized: !!m.optimizedParameters,
      method: m.optimizationMethod 
    })));
    
    setModels(updatedModels);
  }, [cacheVersion, selectedSKU, data, cache, loadManualAIPreferences, generateDataHash]);

  // CONTROLLED forecast generation - only when models actually change and have enabled models
  useEffect(() => {
    if (!selectedSKU || !models.length) return;
    
    const enabledModels = models.filter(m => m.enabled);
    if (enabledModels.length === 0) return;

    console.log(`🔄 UNIFIED: Models changed, scheduling forecast generation for ${selectedSKU}`);
    
    // Use a longer timeout to prevent rapid-fire updates
    const timeoutId = setTimeout(() => {
      generateForecasts();
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [models, selectedSKU, generateForecasts]);

  const toggleModel = useCallback((modelId: string) => {
    setModels(prev => prev.map(model => 
      model.id === modelId ? { ...model, enabled: !model.enabled } : model
    ));
  }, []);

  const updateParameter = useCallback((modelId: string, parameter: string, value: number) => {
    isTogglingAIManualRef.current = true;
    
    const preferences = loadManualAIPreferences();
    const preferenceKey = `${selectedSKU}:${modelId}`;
    preferences[preferenceKey] = 'manual';
    saveManualAIPreferences(preferences);
    setSelectedMethod(selectedSKU, modelId, 'manual');

    console.log(`UNIFIED PREFERENCE: Updated ${preferenceKey} to manual (parameter change)`);

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
  }, [selectedSKU, loadManualAIPreferences, saveManualAIPreferences, setSelectedMethod]);

  const useAIOptimization = useCallback(async (modelId: string) => {
    console.log(`🤖 UNIFIED USE AI: Starting AI optimization for ${selectedSKU}:${modelId}`);
    isTogglingAIManualRef.current = true;
    
    const preferences = loadManualAIPreferences();
    const preferenceKey = `${selectedSKU}:${modelId}`;
    preferences[preferenceKey] = 'ai';
    saveManualAIPreferences(preferences);
    setSelectedMethod(selectedSKU, modelId, 'ai');
    
    const skuData = data.filter(d => d.sku === selectedSKU);
    const currentDataHash = generateDataHash(skuData);
    
    try {
      const model = models.find(m => m.id === modelId);
      if (model) {
        const result = await getOptimizationByMethod(model, skuData, selectedSKU, 'ai', businessContext);
        
        if (result) {
          console.log(`✅ UNIFIED USE AI: Fresh AI optimization succeeded for ${preferenceKey}`);
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
        }
      }
    } catch (error) {
      console.error('UNIFIED: AI optimization failed:', error);
    }
    
    setTimeout(() => {
      isTogglingAIManualRef.current = false;
    }, 100);
  }, [selectedSKU, data, models, businessContext, generateDataHash, loadManualAIPreferences, saveManualAIPreferences, setSelectedMethod, setCachedParameters]);

  const useGridOptimization = useCallback(async (modelId: string) => {
    console.log(`🔍 UNIFIED GRID: Starting Grid optimization for ${selectedSKU}:${modelId}`);
    isTogglingAIManualRef.current = true;
    
    const preferences = loadManualAIPreferences();
    const preferenceKey = `${selectedSKU}:${modelId}`;
    preferences[preferenceKey] = 'grid';
    saveManualAIPreferences(preferences);
    setSelectedMethod(selectedSKU, modelId, 'grid');
    
    const skuData = data.filter(d => d.sku === selectedSKU);
    const currentDataHash = generateDataHash(skuData);
    
    try {
      const model = models.find(m => m.id === modelId);
      if (model) {
        const result = await getOptimizationByMethod(model, skuData, selectedSKU, 'grid', businessContext);
        
        if (result) {
          console.log(`✅ UNIFIED GRID: Fresh Grid optimization succeeded for ${preferenceKey}`);
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
        }
      }
    } catch (error) {
      console.error('UNIFIED: Grid optimization failed:', error);
    }
    
    setTimeout(() => {
      isTogglingAIManualRef.current = false;
    }, 100);
  }, [selectedSKU, data, models, businessContext, generateDataHash, loadManualAIPreferences, saveManualAIPreferences, setSelectedMethod, setCachedParameters]);

  const resetToManual = useCallback((modelId: string) => {
    console.log(`👤 UNIFIED RESET TO MANUAL: ${selectedSKU}:${modelId}`);
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
