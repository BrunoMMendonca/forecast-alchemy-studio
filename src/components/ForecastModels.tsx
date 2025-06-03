import React, { useState, useRef, useCallback } from 'react';
import { SalesData, ForecastResult } from '@/pages/Index';
import { useToast } from '@/hooks/use-toast';
import { detectDateFrequency, generateForecastDates } from '@/utils/dateUtils';
import { 
  generateSeasonalMovingAverage, 
  generateHoltWinters, 
  generateSeasonalNaive 
} from '@/utils/seasonalUtils';
import { 
  generateMovingAverage, 
  generateSimpleExponentialSmoothing, 
  generateDoubleExponentialSmoothing,
  generateLinearTrend 
} from '@/utils/forecastAlgorithms';
import { getDefaultModels } from '@/utils/modelConfig';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useForecastCache } from '@/hooks/useForecastCache';
import { useBatchOptimization } from '@/hooks/useBatchOptimization';
import { useNavigationAwareOptimization } from '@/hooks/useNavigationAwareOptimization';
import { ModelSelection } from './ModelSelection';
import { ProductSelector } from './ProductSelector';
import { ModelConfig } from '@/types/forecast';
import { OptimizationLogger } from './OptimizationLogger';
import { optimizationLogger } from '@/utils/optimizationLogger';

interface ForecastModelsProps {
  data: SalesData[];
  forecastPeriods: number;
  onForecastGeneration: (results: ForecastResult[], selectedSKU: string) => void;
  selectedSKU: string;
  onSKUChange: (sku: string) => void;
}

const MANUAL_AI_PREFERENCE_KEY = 'manual_ai_preferences';

export const ForecastModels: React.FC<ForecastModelsProps> = ({ 
  data, 
  forecastPeriods,
  onForecastGeneration,
  selectedSKU,
  onSKUChange
}) => {
  const { toast } = useToast();
  const lastDataHashRef = useRef<string>('');
  const isTogglingAIManualRef = useRef<boolean>(false);
  const lastSKURef = useRef<string>('');
  const [showOptimizationLog, setShowOptimizationLog] = useState(false);
  const [optimizationCompleted, setOptimizationCompleted] = useState(false);
  
  const {
    cache,
    cacheStats,
    generateDataHash,
    getCachedParameters,
    setCachedParameters,
    isCacheValid,
    getSKUsNeedingOptimization
  } = useOptimizationCache();
  
  const {
    getCachedForecast,
    setCachedForecast,
    generateParametersHash
  } = useForecastCache();
  
  const { isOptimizing, progress, optimizeAllSKUs } = useBatchOptimization();

  const {
    shouldOptimize,
    markOptimizationStarted,
    markOptimizationCompleted,
    getTriggerCount,
    incrementTriggerCount,
    navigationState,
    generateStableFingerprint
  } = useNavigationAwareOptimization();

  // Load manual/AI preferences from localStorage
  const loadManualAIPreferences = useCallback((): Record<string, boolean> => {
    try {
      const stored = localStorage.getItem(MANUAL_AI_PREFERENCE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to load manual/AI preferences:', error);
      return {};
    }
  }, []);

  // Save manual/AI preferences to localStorage
  const saveManualAIPreferences = useCallback((preferences: Record<string, boolean>) => {
    try {
      localStorage.setItem(MANUAL_AI_PREFERENCE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Failed to save manual/AI preferences:', error);
    }
  }, []);

  // IMMEDIATE FIX: Apply preferences during initial model creation
  const createModelsWithPreferences = useCallback((): ModelConfig[] => {
    console.log('🏗️ CREATING MODELS WITH PREFERENCES');
    
    const defaultModels = getDefaultModels();
    
    if (!selectedSKU || data.length === 0) {
      console.log('❌ No SKU or data, using defaults');
      return defaultModels;
    }

    try {
      const preferences = loadManualAIPreferences();
      const skuData = data.filter(d => d.sku === selectedSKU);
      const currentDataHash = generateDataHash(skuData);
      
      console.log(`📋 Creating models for ${selectedSKU} with preferences:`, preferences);
      
      return defaultModels.map(model => {
        const cached = getCachedParameters(selectedSKU, model.id);
        const preferenceKey = `${selectedSKU}:${model.id}`;
        const preference = preferences[preferenceKey];
        
        console.log(`🔍 ${preferenceKey}: preference=${preference}, cached=${!!cached}`);
        
        if (preference === true && cached && isCacheValid(selectedSKU, model.id, currentDataHash)) {
          console.log(`✅ Applying AI for ${preferenceKey}`);
          return {
            ...model,
            optimizedParameters: cached.parameters,
            optimizationConfidence: cached.confidence
          };
        } else {
          console.log(`🛠️ Using manual for ${preferenceKey}`);
          return {
            ...model,
            optimizedParameters: undefined,
            optimizationConfidence: undefined
          };
        }
      });
    } catch (error) {
      console.error('❌ Error creating models with preferences:', error);
      return defaultModels;
    }
  }, [selectedSKU, data, loadManualAIPreferences, generateDataHash, getCachedParameters, isCacheValid]);

  // IMMEDIATE FIX: Initialize models with a reactive function
  const [models, setModels] = useState<ModelConfig[]>(() => {
    console.log('🎯 INITIAL STATE CREATION');
    return getDefaultModels(); // Will be immediately updated by the effect
  });

  // Auto-select first SKU when data changes
  React.useEffect(() => {
    const skus = Array.from(new Set(data.map(d => d.sku))).sort();
    if (skus.length > 0 && !selectedSKU) {
      onSKUChange(skus[0]);
    }
  }, [data, selectedSKU, onSKUChange]);

  // FIXED: Apply preferences immediately when SKU changes or component mounts
  React.useEffect(() => {
    if (selectedSKU && data.length > 0) {
      // Always apply preferences when SKU changes or component mounts
      const modelsWithPreferences = createModelsWithPreferences();
      console.log(`EFFECT: Setting models with preferences for ${selectedSKU}`);
      setModels(modelsWithPreferences);
      
      // Generate forecasts after a short delay to ensure state is updated
      setTimeout(() => generateForecastsForSelectedSKU(), 50);
      
      // Update the last SKU ref
      lastSKURef.current = selectedSKU;
    }
  }, [selectedSKU, data.length, createModelsWithPreferences]); // Depend on the memoized function

  // FIXED: Main optimization effect - only runs on actual data changes
  React.useEffect(() => {
    if (data.length === 0) return;

    // CRITICAL: Skip optimization if we're toggling AI/Manual modes
    if (isTogglingAIManualRef.current) {
      console.log('FIXED: ❌ SKIPPING OPTIMIZATION - AI/Manual toggle in progress');
      return;
    }

    // Generate hash INSIDE the effect to avoid constant recalculation
    const currentDataHash = generateStableFingerprint(data);
    
    // Only proceed if data actually changed
    if (lastDataHashRef.current === currentDataHash) {
      console.log('FIXED: ❌ Same data hash - no optimization needed');
      return;
    }
    
    lastDataHashRef.current = currentDataHash;
    
    incrementTriggerCount();
    const triggerCount = getTriggerCount();
    
    console.log(`FIXED: Data changed - trigger #${triggerCount}, hash: ${currentDataHash}`);

    // Check navigation state - this is the single source of truth
    const shouldRunOptimization = shouldOptimize(data, '/');
    
    if (!shouldRunOptimization) {
      console.log('FIXED: ❌ OPTIMIZATION BLOCKED BY NAVIGATION STATE - Using cached results');
      
      toast({
        title: "Using Cached Results",
        description: "Optimization already completed for this dataset",
      });
      
      return; // Don't run optimization, preferences will be applied by the other effect
    }

    console.log('FIXED: ✅ NAVIGATION STATE APPROVED OPTIMIZATION - Starting process');
    handleInitialOptimization();
  }, [data]); // FIXED: Only depends on data, hash generated inside effect

  const handleInitialOptimization = async () => {
    const enabledModels = models.filter(m => m.enabled);
    
    console.log('FIXED: 🚀 STARTING OPTIMIZATION PROCESS');
    
    // Mark optimization as started
    markOptimizationStarted(data, '/');
    setOptimizationCompleted(false);
    
    await optimizeAllSKUs(
      data, 
      enabledModels, 
      (sku, modelId, parameters, confidence) => {
        const skuData = data.filter(d => d.sku === sku);
        const dataHash = generateDataHash(skuData);
        setCachedParameters(sku, modelId, parameters, dataHash, confidence);
        
        // FIXED: When optimization completes for a SKU, automatically set all models to AI
        const preferences = loadManualAIPreferences();
        const enabledModelIds = enabledModels.map(m => m.id);
        enabledModelIds.forEach(mId => {
          const preferenceKey = `${sku}:${mId}`;
          preferences[preferenceKey] = true; // Set to AI when optimization completes
        });
        saveManualAIPreferences(preferences);
        console.log(`PREFERENCE: Auto-set ${sku} models to AI after optimization`);
        
        // IMMEDIATE FIX: Update models state immediately if this is for the currently selected SKU
        if (sku === selectedSKU) {
          console.log(`IMMEDIATE FIX: Updating UI state for current SKU ${sku}:${modelId}`);
          setModels(prev => prev.map(model => 
            model.id === modelId 
              ? { 
                  ...model, 
                  optimizedParameters: parameters,
                  optimizationConfidence: confidence
                }
              : model
          ));
        }
      },
      getSKUsNeedingOptimization
    );

    // Mark optimization as completed - this should prevent any future runs
    markOptimizationCompleted(data, '/');
    setOptimizationCompleted(true);

    console.log('FIXED: ✅ OPTIMIZATION COMPLETE - MARKED AS DONE');

    // IMMEDIATE FIX: Force immediate UI update for the current SKU - no timeout
    if (selectedSKU) {
      console.log(`IMMEDIATE FIX: Forcing immediate UI update for current SKU: ${selectedSKU}`);
      
      // Apply preferences immediately - no setTimeout
      const modelsWithPreferences = createModelsWithPreferences();
      setModels(modelsWithPreferences);
      generateForecastsForSelectedSKU();
    }
  };

  const generateForecastsForSelectedSKU = async () => {
    if (!selectedSKU) return;

    const enabledModels = models.filter(m => m.enabled);
    if (enabledModels.length === 0) return;

    try {
      const skuData = data
        .filter(d => d.sku === selectedSKU)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (skuData.length < 3) {
        toast({
          title: "Insufficient Data",
          description: `Not enough data points for ${selectedSKU}. Need at least 3 data points.`,
          variant: "destructive",
        });
        return;
      }

      const frequency = detectDateFrequency(skuData.map(d => d.date));
      const lastDate = new Date(Math.max(...skuData.map(d => new Date(d.date).getTime())));
      const forecastDates = generateForecastDates(lastDate, forecastPeriods, frequency);
      const results: ForecastResult[] = [];

      for (const model of enabledModels) {
        const effectiveParameters = model.optimizedParameters || model.parameters;
        const parametersHash = generateParametersHash(model.parameters, model.optimizedParameters);
        
        const cachedForecast = getCachedForecast(selectedSKU, model.name, parametersHash, forecastPeriods);
        if (cachedForecast) {
          console.log(`Using cached forecast for ${selectedSKU}:${model.name}`);
          results.push(cachedForecast);
          continue;
        }

        let predictions: number[] = [];

        switch (model.id) {
          case 'moving_average':
            predictions = generateMovingAverage(skuData, effectiveParameters?.window || 3, forecastPeriods);
            break;
          case 'simple_exponential_smoothing':
            predictions = generateSimpleExponentialSmoothing(skuData, effectiveParameters?.alpha || 0.3, forecastPeriods);
            break;
          case 'double_exponential_smoothing':
            predictions = generateDoubleExponentialSmoothing(
              skuData, 
              effectiveParameters?.alpha || 0.3, 
              effectiveParameters?.beta || 0.1, 
              forecastPeriods
            );
            break;
          case 'exponential_smoothing':
            predictions = generateSimpleExponentialSmoothing(skuData, effectiveParameters?.alpha || 0.3, forecastPeriods);
            break;
          case 'linear_trend':
            predictions = generateLinearTrend(skuData, forecastPeriods);
            break;
          case 'seasonal_moving_average':
            predictions = generateSeasonalMovingAverage(
              skuData.map(d => d.sales),
              effectiveParameters?.window || 3,
              frequency.seasonalPeriod,
              forecastPeriods
            );
            break;
          case 'holt_winters':
            predictions = generateHoltWinters(
              skuData.map(d => d.sales),
              frequency.seasonalPeriod,
              forecastPeriods,
              effectiveParameters?.alpha || 0.3,
              effectiveParameters?.beta || 0.1,
              effectiveParameters?.gamma || 0.1
            );
            break;
          case 'seasonal_naive':
            predictions = generateSeasonalNaive(
              skuData.map(d => d.sales),
              frequency.seasonalPeriod,
              forecastPeriods
            );
            break;
        }

        const recentActual = skuData.slice(-5).map(d => d.sales);
        const recentPredicted = predictions.slice(0, 5);
        const mape = recentActual.reduce((sum, actual, i) => {
          const predicted = recentPredicted[i] || predictions[0];
          return sum + Math.abs((actual - predicted) / actual);
        }, 0) / recentActual.length * 100;
        
        const accuracy = Math.max(0, 100 - mape);

        const result: ForecastResult = {
          sku: selectedSKU,
          model: model.name,
          predictions: forecastDates.map((date, i) => ({
            date,
            value: Math.round(predictions[i] || 0)
          })),
          accuracy
        };

        setCachedForecast(result, parametersHash, forecastPeriods);
        results.push(result);
      }

      onForecastGeneration(results, selectedSKU);
      console.log(`Generated forecasts for SKU: ${selectedSKU} (${results.length} models)`);

    } catch (error) {
      toast({
        title: "Forecast Error",
        description: "Failed to generate forecasts. Please try again.",
        variant: "destructive",
      });
      console.error('Forecast generation error:', error);
    }
  };

  const toggleModel = (modelId: string) => {
    setModels(prev => prev.map(model => 
      model.id === modelId ? { ...model, enabled: !model.enabled } : model
    ));
    
    setTimeout(() => generateForecastsForSelectedSKU(), 100);
  };

  const updateParameter = (modelId: string, parameter: string, value: number) => {
    // Set flag to prevent optimization during manual parameter updates
    isTogglingAIManualRef.current = true;
    
    const preferences = loadManualAIPreferences();
    const preferenceKey = `${selectedSKU}:${modelId}`;
    preferences[preferenceKey] = false; // Mark as manual when parameters are manually updated
    saveManualAIPreferences(preferences);

    console.log(`PREFERENCE: Updated ${preferenceKey} to manual (parameter change)`);

    setModels(prev => prev.map(model => 
      model.id === modelId 
        ? { 
            ...model, 
            parameters: { ...model.parameters, [parameter]: value },
            optimizedParameters: undefined,
            optimizationConfidence: undefined
          }
        : model
    ));

    setTimeout(() => {
      generateForecastsForSelectedSKU();
      // Clear the flag after operations complete
      isTogglingAIManualRef.current = false;
    }, 100);
  };

  const useAIOptimization = (modelId: string) => {
    // Set flag to prevent optimization during AI toggle
    isTogglingAIManualRef.current = true;
    
    const preferences = loadManualAIPreferences();
    const preferenceKey = `${selectedSKU}:${modelId}`;
    preferences[preferenceKey] = true; // Mark as AI
    saveManualAIPreferences(preferences);

    console.log(`PREFERENCE: Updated ${preferenceKey} to AI`);

    const cached = getCachedParameters(selectedSKU, modelId);
    if (cached) {
      setModels(prev => prev.map(model => 
        model.id === modelId 
          ? { 
              ...model, 
              optimizedParameters: cached.parameters,
              optimizationConfidence: cached.confidence
            }
          : model
      ));
      
      setTimeout(() => {
        generateForecastsForSelectedSKU();
        // Clear the flag after operations complete
        isTogglingAIManualRef.current = false;
      }, 100);
    } else {
      // Clear flag if no cached parameters
      isTogglingAIManualRef.current = false;
    }
  };

  const resetToManual = (modelId: string) => {
    // Set flag to prevent optimization during manual reset
    isTogglingAIManualRef.current = true;
    
    const preferences = loadManualAIPreferences();
    const preferenceKey = `${selectedSKU}:${modelId}`;
    preferences[preferenceKey] = false; // Mark as manual
    saveManualAIPreferences(preferences);

    console.log(`PREFERENCE: Updated ${preferenceKey} to manual (reset)`);

    setModels(prev => prev.map(model => 
      model.id === modelId 
        ? { 
            ...model, 
            optimizedParameters: undefined,
            optimizationConfidence: undefined
          }
        : model
    ));
    
    setTimeout(() => {
      generateForecastsForSelectedSKU();
      // Clear the flag after operations complete
      isTogglingAIManualRef.current = false;
    }, 100);
  };

  return (
    <div className="space-y-6">
      <ProductSelector
        data={data}
        selectedSKU={selectedSKU}
        onSKUChange={onSKUChange}
      />

      {(isOptimizing || (progress && optimizationCompleted)) && progress && (
        <div className={`border rounded-lg p-4 ${optimizationCompleted ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {isOptimizing ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              ) : (
                <div className="rounded-full h-4 w-4 bg-green-600 flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
              <span className={`text-sm font-medium ${optimizationCompleted ? 'text-green-800' : 'text-blue-800'}`}>
                {isOptimizing ? 'Enhanced AI Optimization in Progress...' : 'Optimization Complete!'}
              </span>
            </div>
            <button
              onClick={() => setShowOptimizationLog(!showOptimizationLog)}
              className={`text-xs px-2 py-1 rounded ${
                optimizationCompleted 
                  ? 'bg-green-100 hover:bg-green-200 text-green-700'
                  : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
              }`}
            >
              {showOptimizationLog ? 'Hide' : 'Show'} Log
            </button>
          </div>
          
          {isOptimizing ? (
            <>
              <p className="text-sm text-blue-600 mb-2">
                Processing {progress.currentSKU} - {progress.currentModel} ({progress.completedSKUs + 1}/{progress.totalSKUs})
              </p>
              <div className="mt-2 bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((progress.completedSKUs) / progress.totalSKUs) * 100}%` }}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-green-600 mb-2">
              Successfully processed {progress.totalSKUs} SKU{progress.totalSKUs > 1 ? 's' : ''}
            </p>
          )}
          
          <div className={`grid grid-cols-2 gap-2 text-xs ${optimizationCompleted ? 'text-green-600' : 'text-blue-500'}`}>
            <div>🤖 AI Optimized: {progress.aiOptimized || 0}</div>
            <div>🔍 Grid Optimized: {progress.gridOptimized || 0}</div>
            <div>❌ AI Rejected: {progress.aiRejected || 0}</div>
            <div>📋 From Cache: {progress.skipped || 0}</div>
          </div>
        </div>
      )}

      <ModelSelection
        models={models}
        onToggleModel={toggleModel}
        onUpdateParameter={updateParameter}
        onUseAI={useAIOptimization}
        onResetToManual={resetToManual}
      />

      {navigationState && (
        <div className="text-xs text-slate-500 bg-slate-50 rounded p-2">
          Navigation Optimization: {navigationState.optimizationCompleted ? '✅ Complete' : '⏳ Pending'} 
          | Trigger Count: {getTriggerCount()} 
          | Cache: {cacheStats.hits} hits, {cacheStats.misses} misses
          | Fingerprint: {navigationState.datasetFingerprint}
          | AI/Manual Toggle: {isTogglingAIManualRef.current ? '🔄 Active' : '✅ Idle'}
          | Last SKU: {lastSKURef.current}
        </div>
      )}

      <OptimizationLogger 
        isVisible={showOptimizationLog} 
        onClose={() => setShowOptimizationLog(false)} 
      />
    </div>
  );
};
