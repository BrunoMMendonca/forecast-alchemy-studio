
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

  const { 
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

  // Update models when cache version changes (FIXED: removed circular dependency)
  useEffect(() => {
    if (!selectedSKU || isTogglingAIManualRef.current) {
      return;
    }

    console.log(`🔄 UNIFIED CACHE VERSION CHANGED: ${cacheVersion}, updating models for ${selectedSKU}`);
    
    // Read fresh data from localStorage for this specific update
    let optimizationCache = {};
    let preferences = {};
    
    try {
      const storedCache = localStorage.getItem('forecast_optimization_cache');
      optimizationCache = storedCache ? JSON.parse(storedCache) : {};
    } catch {
      optimizationCache = {};
    }
    
    try {
      const storedPrefs = localStorage.getItem('manual_ai_preferences');
      preferences = storedPrefs ? JSON.parse(storedPrefs) : {};
    } catch {
      preferences = {};
    }

    const skuData = data.filter(d => d.sku === selectedSKU);
    const currentDataHash = generateDataHash(skuData);

    const updatedModels = getDefaultModels().map(model => {
      const preferenceKey = `${selectedSKU}:${model.id}`;
      const preference = preferences[preferenceKey] || 'ai';
      const cached = optimizationCache[selectedSKU]?.[model.id];

      console.log(`📋 UNIFIED MODEL ${model.id}: preference=${preference}, hasCache=${!!cached}, cacheVersion=${cacheVersion}`);

      if (preference === 'manual') {
        console.log(`👤 UNIFIED MODEL ${model.id}: Using manual parameters`);
        return model;
      }

      // For AI/Grid preference, try to get the preferred method first
      let selectedCache = null;
      if (preference === 'ai' && cached?.ai && cached.ai.dataHash === currentDataHash) {
        selectedCache = cached.ai;
        console.log(`🤖 UNIFIED MODEL ${model.id}: Using AI cache`);
      } else if (preference === 'grid' && cached?.grid && cached.grid.dataHash === currentDataHash) {
        selectedCache = cached.grid;
        console.log(`🔍 UNIFIED MODEL ${model.id}: Using Grid cache`);
      } else {
        // Fallback to any valid cache
        if (cached?.ai && cached.ai.dataHash === currentDataHash) {
          selectedCache = cached.ai;
          console.log(`🤖 UNIFIED MODEL ${model.id}: Fallback to AI cache`);
        } else if (cached?.grid && cached.grid.dataHash === currentDataHash) {
          selectedCache = cached.grid;
          console.log(`🔍 UNIFIED MODEL ${model.id}: Fallback to Grid cache`);
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

      console.log(`❌ UNIFIED NO CACHE: ${model.id} using default parameters`);
      return model;
    });

    console.log('🎯 UNIFIED SETTING NEW MODELS:', updatedModels.map(m => ({ 
      id: m.id, 
      hasOptimized: !!m.optimizedParameters,
      method: m.optimizationMethod 
    })));
    
    setModels(updatedModels);
  }, [cacheVersion, selectedSKU, data, generateDataHash]);

  // Update models when SKU changes
  useEffect(() => {
    if (selectedSKU && data.length > 0) {
      console.log(`🔄 UNIFIED SKU CHANGED: Updating models for ${selectedSKU}`);
      // Trigger the same logic as cache version change
      setModels(getDefaultModels());
    }
  }, [selectedSKU]);

  // Generate forecasts when models change
  useEffect(() => {
    if (selectedSKU && models.length > 0 && models.some(m => m.enabled)) {
      console.log(`🔄 UNIFIED: Models changed, regenerating forecasts for ${selectedSKU}`);
      setTimeout(() => generateForecasts(), 50);
    }
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
    
    // Check if we already have valid AI cache (rely on cacheVersion system)
    console.log(`🔄 UNIFIED USE AI: Running fresh AI optimization for ${preferenceKey}`);
    
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
    
    // Run fresh optimization and let cacheVersion system handle updates
    console.log(`🔄 UNIFIED GRID: Running fresh Grid optimization for ${preferenceKey}`);
    
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
