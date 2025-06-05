
import { useState, useRef, useCallback } from 'react';
import { SalesData, ForecastResult } from '@/pages/Index';
import { useToast } from '@/hooks/use-toast';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useForecastCache } from '@/hooks/useForecastCache';
import { useBatchOptimization } from '@/hooks/useBatchOptimization';
import { useNavigationAwareOptimization } from '@/hooks/useNavigationAwareOptimization';
import { useModelManagement } from '@/hooks/useModelManagement';
import { generateForecastsForSKU } from '@/utils/forecastGenerator';
import { OptimizationFactors } from '@/types/optimizationTypes';

interface OptimizationQueue {
  getSKUsInQueue: () => string[];
  removeSKUsFromQueue: (skus: string[]) => void;
}

export const useForecastModelsLogic = (
  data: SalesData[],
  forecastPeriods: number,
  selectedSKU: string,
  onForecastGeneration: (results: ForecastResult[], selectedSKU: string) => void,
  optimizationQueue?: OptimizationQueue
) => {
  const { toast } = useToast();
  const [forceUpdateTrigger, setForceUpdateTrigger] = useState(0);
  const hasTriggeredOptimizationRef = useRef(false);
  
  const {
    generateDataHash,
    getCachedParameters,
    setCachedParameters,
    getSKUsNeedingOptimization
  } = useOptimizationCache();
  
  const {
    getCachedForecast,
    setCachedForecast,
    generateParametersHash
  } = useForecastCache();
  
  const { isOptimizing, progress, optimizationCompleted, optimizeQueuedSKUs } = useBatchOptimization();

  const {
    markOptimizationStarted,
    markOptimizationCompleted
  } = useNavigationAwareOptimization();

  const {
    models,
    setModels,
    toggleModel,
    updateParameter,
    useAIOptimization,
    useGridOptimization,
    resetToManual,
    loadManualAIPreferences,
    saveManualAIPreferences
  } = useModelManagement(selectedSKU, data);

  const generateForecastsForSelectedSKU = useCallback(async () => {
    if (!selectedSKU) return;

    try {
      console.log(`🎯 Generating forecasts for ${selectedSKU} with models:`, models.map(m => ({ 
        id: m.id, 
        enabled: m.enabled,
        hasReasoning: !!m.optimizationReasoning 
      })));
      
      const results = await generateForecastsForSKU(
        selectedSKU,
        data,
        models,
        forecastPeriods,
        getCachedForecast,
        setCachedForecast,
        generateParametersHash
      );

      console.log(`✅ Generated ${results.length} forecasts for ${selectedSKU}, passing to parent`);
      onForecastGeneration(results, selectedSKU);

    } catch (error) {
      toast({
        title: "Forecast Error",
        description: error instanceof Error ? error.message : "Failed to generate forecasts. Please try again.",
        variant: "destructive",
      });
      console.error('Forecast generation error:', error);
    }
  }, [selectedSKU, data, models, forecastPeriods, getCachedForecast, setCachedForecast, generateParametersHash, onForecastGeneration, toast]);

  const handleQueueOptimization = useCallback(async () => {
    if (!optimizationQueue) {
      console.warn('❌ QUEUE: No optimization queue provided');
      return;
    }

    const queuedSKUs = optimizationQueue.getSKUsInQueue();
    if (queuedSKUs.length === 0) {
      console.log('📋 QUEUE: No SKUs in queue for optimization');
      return;
    }

    const enabledModels = models.filter(m => m.enabled);
    const enabledModelIds = enabledModels.map(m => m.id);
    
    console.log('🚀 QUEUE: Starting optimization for queued SKUs:', queuedSKUs);
    
    markOptimizationStarted(data, '/');
    
    await optimizeQueuedSKUs(
      data, 
      enabledModels, // Pass ModelConfig[] here
      queuedSKUs,
      (sku, modelId, parameters, confidence, reasoning, factors, expectedAccuracy, method) => {
        const skuData = data.filter(d => d.sku === sku);
        const dataHash = generateDataHash(skuData);
        
        // Ensure factors has the correct type structure
        const typedFactors: OptimizationFactors = {
          stability: factors?.stability || 0,
          interpretability: factors?.interpretability || 0,
          complexity: factors?.complexity || 0,
          businessImpact: factors?.businessImpact || 'Unknown'
        };
        
        setCachedParameters(sku, modelId, parameters, dataHash, confidence, reasoning, typedFactors, expectedAccuracy, method);
        
        const preferences = loadManualAIPreferences();
        const preferenceKey = `${sku}:${modelId}`;
        if (method?.startsWith('ai_')) {
          preferences[preferenceKey] = true;
        } else if (method === 'grid_search') {
          preferences[preferenceKey] = 'grid';
        } else {
          preferences[preferenceKey] = false;
        }
        saveManualAIPreferences(preferences);
        
        setModels(prev => prev.map(model => 
          model.id === modelId 
            ? { 
                ...model, 
                optimizedParameters: parameters,
                optimizationConfidence: confidence,
                optimizationReasoning: reasoning,
                optimizationFactors: typedFactors,
                expectedAccuracy: expectedAccuracy,
                optimizationMethod: method
              }
            : model
        ));
        
        if (sku === selectedSKU) {
          setForceUpdateTrigger(prev => prev + 1);
        }
      },
      (sku) => {
        optimizationQueue.removeSKUsFromQueue([sku]);
        if (sku === selectedSKU) {
          setForceUpdateTrigger(prev => prev + 1);
        }
      },
      (sku: string, modelIds: string[]) => {
        const skusNeedingOptimization = getSKUsNeedingOptimization(data, enabledModelIds);
        return Array.isArray(skusNeedingOptimization) 
          ? skusNeedingOptimization.map(item => typeof item === 'string' ? item : item.sku).filter(Boolean)
          : [];
      }
    );

    markOptimizationCompleted(data, '/');
    
    setTimeout(() => {
      setForceUpdateTrigger(prev => prev + 1);
    }, 200);
  }, [optimizationQueue, models, data, markOptimizationStarted, optimizeQueuedSKUs, generateDataHash, setCachedParameters, loadManualAIPreferences, saveManualAIPreferences, setModels, selectedSKU, getSKUsNeedingOptimization, markOptimizationCompleted]);

  const handleToggleModel = useCallback((modelId: string) => {
    toggleModel(modelId);
    setTimeout(() => generateForecastsForSelectedSKU(), 50);
  }, [toggleModel, generateForecastsForSelectedSKU]);

  const handleUpdateParameter = useCallback((modelId: string, parameter: string, value: number) => {
    updateParameter(modelId, parameter, value);
    setTimeout(() => generateForecastsForSelectedSKU(), 50);
  }, [updateParameter, generateForecastsForSelectedSKU]);

  const handleUseAI = useCallback((modelId: string) => {
    useAIOptimization(modelId);
    setTimeout(() => generateForecastsForSelectedSKU(), 50);
  }, [useAIOptimization, generateForecastsForSelectedSKU]);

  const handleUseGrid = useCallback((modelId: string) => {
    useGridOptimization(modelId);
    setTimeout(() => generateForecastsForSelectedSKU(), 50);
  }, [useGridOptimization, generateForecastsForSelectedSKU]);

  const handleResetToManual = useCallback((modelId: string) => {
    resetToManual(modelId);
    setTimeout(() => generateForecastsForSelectedSKU(), 50);
  }, [resetToManual, generateForecastsForSelectedSKU]);

  return {
    models,
    isOptimizing,
    progress,
    hasTriggeredOptimizationRef,
    handleQueueOptimization,
    handleToggleModel,
    handleUpdateParameter,
    handleUseAI,
    handleUseGrid,
    handleResetToManual,
    generateForecastsForSelectedSKU
  };
};
