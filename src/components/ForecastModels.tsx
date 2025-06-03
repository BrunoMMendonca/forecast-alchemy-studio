
import React, { useState, useRef } from 'react';
import { SalesData, ForecastResult } from '@/pages/Index';
import { useToast } from '@/hooks/use-toast';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useForecastCache } from '@/hooks/useForecastCache';
import { useBatchOptimization } from '@/hooks/useBatchOptimization';
import { useNavigationAwareOptimization } from '@/hooks/useNavigationAwareOptimization';
import { useModelManagement } from '@/hooks/useModelManagement';
import { generateForecastsForSKU } from '@/utils/forecastGenerator';
import { ModelSelection } from './ModelSelection';
import { ProductSelector } from './ProductSelector';
import { OptimizationLogger } from './OptimizationLogger';
import { optimizationLogger } from '@/utils/optimizationLogger';

interface ForecastModelsProps {
  data: SalesData[];
  forecastPeriods: number;
  onForecastGeneration: (results: ForecastResult[], selectedSKU: string) => void;
  selectedSKU: string;
  onSKUChange: (sku: string) => void;
}

export const ForecastModels: React.FC<ForecastModelsProps> = ({ 
  data, 
  forecastPeriods,
  onForecastGeneration,
  selectedSKU,
  onSKUChange
}) => {
  const { toast } = useToast();
  const lastDataHashRef = useRef<string>('');
  const lastSKURef = useRef<string>('');
  const [showOptimizationLog, setShowOptimizationLog] = useState(false);
  
  const {
    cache,
    cacheStats,
    generateDataHash,
    setCachedParameters,
    getSKUsNeedingOptimization
  } = useOptimizationCache();
  
  const {
    getCachedForecast,
    setCachedForecast,
    generateParametersHash
  } = useForecastCache();
  
  const { isOptimizing, progress, optimizationCompleted, optimizeAllSKUs, clearProgress } = useBatchOptimization();

  const {
    shouldOptimize,
    markOptimizationStarted,
    markOptimizationCompleted,
    getTriggerCount,
    incrementTriggerCount,
    navigationState,
    generateStableFingerprint
  } = useNavigationAwareOptimization();

  const {
    models,
    setModels,
    createModelsWithPreferences,
    toggleModel,
    updateParameter,
    useAIOptimization,
    resetToManual,
    isTogglingAIManualRef,
    loadManualAIPreferences,
    saveManualAIPreferences
  } = useModelManagement(selectedSKU, data);

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
  }, [selectedSKU, data.length, createModelsWithPreferences]);

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
  }, [data]);

  const handleInitialOptimization = async () => {
    const enabledModels = models.filter(m => m.enabled);
    
    console.log('FIXED: 🚀 STARTING OPTIMIZATION PROCESS');
    
    // Mark optimization as started
    markOptimizationStarted(data, '/');
    
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

    try {
      const results = await generateForecastsForSKU(
        selectedSKU,
        data,
        models,
        forecastPeriods,
        getCachedForecast,
        setCachedForecast,
        generateParametersHash
      );

      onForecastGeneration(results, selectedSKU);
      console.log(`Generated forecasts for SKU: ${selectedSKU} (${results.length} models)`);

    } catch (error) {
      toast({
        title: "Forecast Error",
        description: error instanceof Error ? error.message : "Failed to generate forecasts. Please try again.",
        variant: "destructive",
      });
      console.error('Forecast generation error:', error);
    }
  };

  const handleToggleModel = (modelId: string) => {
    toggleModel(modelId);
    setTimeout(() => generateForecastsForSelectedSKU(), 100);
  };

  const handleUpdateParameter = (modelId: string, parameter: string, value: number) => {
    updateParameter(modelId, parameter, value);
    setTimeout(() => generateForecastsForSelectedSKU(), 100);
  };

  const handleUseAI = (modelId: string) => {
    useAIOptimization(modelId);
    setTimeout(() => generateForecastsForSelectedSKU(), 100);
  };

  const handleResetToManual = (modelId: string) => {
    resetToManual(modelId);
    setTimeout(() => generateForecastsForSelectedSKU(), 100);
  };

  return (
    <div className="space-y-6">
      <ProductSelector
        data={data}
        selectedSKU={selectedSKU}
        onSKUChange={onSKUChange}
      />

      {(isOptimizing || (progress && (optimizationCompleted || isOptimizing))) && progress && (
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
                {isOptimizing ? 'Enhanced AI Optimization in Progress...' : 'Enhanced Optimization Complete!'}
              </span>
            </div>
            <div className="flex items-center gap-2">
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
              {optimizationCompleted && (
                <button
                  onClick={clearProgress}
                  className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  Dismiss
                </button>
              )}
            </div>
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
            <div>
              <p className="text-sm text-green-600 mb-2">
                Successfully processed {progress.totalSKUs} SKU{progress.totalSKUs > 1 ? 's' : ''}
              </p>
              {progress.aiOptimized > 0 && (
                <p className="text-xs text-green-500 mb-1">
                  AI Acceptance Rate: {((progress.aiOptimized / (progress.aiOptimized + progress.aiRejected)) * 100).toFixed(1)}%
                </p>
              )}
            </div>
          )}
          
          <div className={`grid grid-cols-2 gap-2 text-xs ${optimizationCompleted ? 'text-green-600' : 'text-blue-500'}`}>
            <div>🤖 AI Optimized: {progress.aiOptimized || 0}</div>
            <div>🔍 Grid Optimized: {progress.gridOptimized || 0}</div>
            <div>❌ AI Rejected: {progress.aiRejected || 0}</div>
            <div>📋 From Cache: {progress.skipped || 0}</div>
            {progress.aiAcceptedByTolerance > 0 && (
              <div className="col-span-2 text-xs text-blue-600">
                ✅ AI by Tolerance: {progress.aiAcceptedByTolerance} | by Confidence: {progress.aiAcceptedByConfidence || 0}
              </div>
            )}
          </div>
        </div>
      )}

      <ModelSelection
        models={models}
        onToggleModel={handleToggleModel}
        onUpdateParameter={handleUpdateParameter}
        onUseAI={handleUseAI}
        onResetToManual={handleResetToManual}
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
