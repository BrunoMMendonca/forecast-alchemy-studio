import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react';
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
import { AlertCircle, Clock, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ForecastModelsProps {
  data: SalesData[];
  forecastPeriods: number;
  onForecastGeneration: (results: ForecastResult[], selectedSKU: string) => void;
  selectedSKU: string;
  onSKUChange: (sku: string) => void;
  shouldStartOptimization?: boolean;
  onOptimizationStarted?: () => void;
  optimizationQueue?: {
    getSKUsInQueue: () => string[];
    removeSKUsFromQueue: (skus: string[]) => void;
  };
}

export const ForecastModels = forwardRef<any, ForecastModelsProps>(({ 
  data, 
  forecastPeriods,
  onForecastGeneration,
  selectedSKU,
  onSKUChange,
  shouldStartOptimization = false,
  onOptimizationStarted,
  optimizationQueue
}, ref) => {
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
  
  const { isOptimizing, progress, optimizationCompleted, optimizeQueuedSKUs, clearProgress } = useBatchOptimization();

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

  // Check if current SKU is in optimization queue
  const isCurrentSKUQueued = optimizationQueue ? optimizationQueue.getSKUsInQueue().includes(selectedSKU) : false;
  const isCurrentSKUBeingOptimized = isOptimizing && progress?.currentSKU === selectedSKU;

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    startOptimization: handleQueueOptimization
  }));

  // Auto-select first SKU when data changes
  React.useEffect(() => {
    const skus = Array.from(new Set(data.map(d => d.sku))).sort();
    if (skus.length > 0 && !selectedSKU) {
      onSKUChange(skus[0]);
    }
  }, [data, selectedSKU, onSKUChange]);

  // Apply preferences immediately when SKU changes or component mounts
  React.useEffect(() => {
    if (selectedSKU && data.length > 0) {
      const modelsWithPreferences = createModelsWithPreferences();
      console.log(`EFFECT: Setting models with preferences for ${selectedSKU}`);
      setModels(modelsWithPreferences);
      
      setTimeout(() => generateForecastsForSelectedSKU(), 50);
      lastSKURef.current = selectedSKU;
    }
  }, [selectedSKU, data.length, createModelsWithPreferences]);

  // Handle external optimization trigger
  React.useEffect(() => {
    if (shouldStartOptimization && data.length > 0 && !isOptimizing && optimizationQueue) {
      console.log('🚀 EXTERNAL TRIGGER: Starting queue optimization from parent component');
      handleQueueOptimization();
      onOptimizationStarted?.();
    }
  }, [shouldStartOptimization, data.length, isOptimizing]);

  const handleQueueOptimization = async () => {
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
    
    console.log('🚀 QUEUE: Starting optimization for queued SKUs:', queuedSKUs);
    
    markOptimizationStarted(data, '/');
    
    await optimizeQueuedSKUs(
      data, 
      enabledModels, 
      queuedSKUs,
      (sku, modelId, parameters, confidence) => {
        const skuData = data.filter(d => d.sku === sku);
        const dataHash = generateDataHash(skuData);
        setCachedParameters(sku, modelId, parameters, dataHash, confidence);
        
        console.log(`QUEUE OPTIMIZATION: Setting ${sku}:${modelId} to AI (confidence: ${confidence})`);
        
        const preferences = loadManualAIPreferences();
        const preferenceKey = `${sku}:${modelId}`;
        preferences[preferenceKey] = true;
        saveManualAIPreferences(preferences);
        
        console.log(`QUEUE OPTIMIZATION: Updating models state for ${sku}:${modelId} with optimized parameters`);
        setModels(prev => {
          const updated = prev.map(model => 
            model.id === modelId 
              ? { 
                  ...model, 
                  optimizedParameters: parameters,
                  optimizationConfidence: confidence
                }
              : model
          );
          return updated;
        });
        
        if (sku === selectedSKU) {
          console.log(`🎯 QUEUE: IMMEDIATE FORECAST REGENERATION for selected SKU: ${sku}`);
          setTimeout(() => generateForecastsForSelectedSKU(), 100);
        }
      },
      (sku) => {
        // Remove completed SKU from queue
        optimizationQueue.removeSKUsFromQueue([sku]);
      },
      getSKUsNeedingOptimization
    );

    markOptimizationCompleted(data, '/');
    console.log('✅ QUEUE: OPTIMIZATION COMPLETE');
  };

  const generateForecastsForSelectedSKU = async () => {
    if (!selectedSKU) return;

    try {
      console.log(`🎯 Generating forecasts for ${selectedSKU} with models:`, models.map(m => ({ id: m.id, enabled: m.enabled })));
      
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
  };

  const handleToggleModel = (modelId: string) => {
    console.log(`🔄 Toggling model ${modelId}`);
    toggleModel(modelId);
    setTimeout(() => {
      console.log(`🔄 Regenerating forecasts after toggling ${modelId}`);
      generateForecastsForSelectedSKU();
    }, 50);
  };

  const handleUpdateParameter = (modelId: string, parameter: string, value: number) => {
    console.log(`🔧 Updating parameter ${parameter} for ${modelId} to ${value}`);
    updateParameter(modelId, parameter, value);
    setTimeout(() => {
      console.log(`🔧 Regenerating forecasts after parameter update for ${modelId}`);
      generateForecastsForSelectedSKU();
    }, 50);
  };

  const handleUseAI = (modelId: string) => {
    console.log(`🤖 Using AI for ${modelId}`);
    useAIOptimization(modelId);
    setTimeout(() => {
      console.log(`🤖 Regenerating forecasts after AI toggle for ${modelId}`);
      generateForecastsForSelectedSKU();
    }, 50);
  };

  const handleResetToManual = (modelId: string) => {
    console.log(`👤 Resetting to manual for ${modelId}`);
    resetToManual(modelId);
    setTimeout(() => {
      console.log(`👤 Regenerating forecasts after manual reset for ${modelId}`);
      generateForecastsForSelectedSKU();
    }, 50);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <ProductSelector
          data={data}
          selectedSKU={selectedSKU}
          onSKUChange={onSKUChange}
        />

        {/* Current SKU Optimization Status */}
        {selectedSKU && (isCurrentSKUQueued || isCurrentSKUBeingOptimized) && (
          <div className={`border rounded-lg p-4 ${
            isCurrentSKUBeingOptimized 
              ? 'bg-blue-50 border-blue-200' 
              : 'bg-amber-50 border-amber-200'
          }`}>
            <div className="flex items-center gap-3">
              {isCurrentSKUBeingOptimized ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-800">
                      Currently Optimizing: {selectedSKU}
                    </span>
                  </div>
                  {progress?.currentModel && (
                    <Badge variant="secondary" className="text-xs">
                      {progress.currentModel}
                    </Badge>
                  )}
                </>
              ) : (
                <>
                  <Clock className="h-5 w-5 text-amber-600" />
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-amber-800">
                      SKU Queued for Optimization: {selectedSKU}
                    </span>
                    <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">
                      Pending
                    </Badge>
                  </div>
                </>
              )}
            </div>
            
            {isCurrentSKUBeingOptimized && progress && (
              <div className="mt-3">
                <div className="text-sm text-blue-600 mb-2">
                  Processing model: {progress.currentModel} 
                  ({progress.completedSKUs + 1}/{progress.totalSKUs} SKUs)
                </div>
                <div className="bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((progress.completedSKUs) / progress.totalSKUs) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Queue-wide optimization progress (when not optimizing current SKU) */}
        {(isOptimizing || (progress && (optimizationCompleted || isOptimizing))) && progress && !isCurrentSKUBeingOptimized && (
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
                  {isOptimizing ? 'Queue AI Optimization in Progress...' : 'Queue Optimization Complete!'}
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
                  Successfully processed {progress.totalSKUs} SKU{progress.totalSKUs > 1 ? 's' : ''} from queue
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
      </div>

      <ModelSelection
        models={models}
        onToggleModel={handleToggleModel}
        onUpdateParameter={handleUpdateParameter}
        onUseAI={handleUseAI}
        onResetToManual={handleResetToManual}
      />

      {navigationState && optimizationQueue && (
        <div className="text-xs text-slate-500 bg-slate-50 rounded p-2">
          Queue Optimization: {navigationState.optimizationCompleted ? '✅ Complete' : '⏳ Pending'} 
          | Queue Size: {optimizationQueue.getSKUsInQueue().length}
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
});

ForecastModels.displayName = 'ForecastModels';
