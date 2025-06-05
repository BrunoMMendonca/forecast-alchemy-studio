
import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
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
  const [forceUpdateTrigger, setForceUpdateTrigger] = useState(0);
  const hasTriggeredOptimizationRef = useRef(false);
  const navigationReturnRef = useRef(false);
  
  const {
    cache,
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
  
  const { isOptimizing, progress, optimizationCompleted, optimizeQueuedSKUs, clearProgress } = useBatchOptimization();

  const {
    shouldOptimize,
    markOptimizationStarted,
    markOptimizationCompleted
  } = useNavigationAwareOptimization();

  const {
    models,
    setModels,
    createModelsWithPreferences,
    refreshModelsWithPreferences,
    toggleModel,
    updateParameter,
    useAIOptimization,
    useGridOptimization,
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

  // Detect navigation return and refresh models
  useEffect(() => {
    console.log('🔄 NAVIGATION: ForecastModels component mounted/remounted');
    navigationReturnRef.current = true;
    
    // Small delay to allow cache to be populated
    setTimeout(() => {
      if (selectedSKU) {
        console.log('🔄 NAVIGATION: Refreshing models on return for', selectedSKU);
        refreshModelsWithPreferences();
      }
      navigationReturnRef.current = false;
    }, 100);
  }, []);

  // AUTO-TRIGGER: Watch for shouldStartOptimization prop
  React.useEffect(() => {
    if (shouldStartOptimization && !isOptimizing && !hasTriggeredOptimizationRef.current) {
      console.log('🚀 AUTO-TRIGGER: shouldStartOptimization is true, starting optimization...');
      hasTriggeredOptimizationRef.current = true;
      handleQueueOptimization();
      if (onOptimizationStarted) {
        onOptimizationStarted();
      }
    }
  }, [shouldStartOptimization, isOptimizing]);

  // AUTO-TRIGGER: Watch for new items in queue
  React.useEffect(() => {
    if (optimizationQueue) {
      const queuedSKUs = optimizationQueue.getSKUsInQueue();
      if (queuedSKUs.length > 0 && !isOptimizing && !hasTriggeredOptimizationRef.current) {
        console.log('🚀 AUTO-TRIGGER: Queue has items and optimization not running, starting...', queuedSKUs);
        hasTriggeredOptimizationRef.current = true;
        setTimeout(() => {
          handleQueueOptimization();
        }, 1000); // Small delay to allow UI to update
      }
    }
  }, [optimizationQueue?.getSKUsInQueue().length, isOptimizing]);

  // Reset trigger flag when optimization completes
  React.useEffect(() => {
    if (!isOptimizing && optimizationCompleted) {
      hasTriggeredOptimizationRef.current = false;
      console.log('🏁 AUTO-TRIGGER: Optimization completed, resetting trigger flag');
      
      // Force UI update when optimization completes
      console.log('🔄 OPTIMIZATION COMPLETE: Forcing UI update');
      setForceUpdateTrigger(prev => prev + 1);
    }
  }, [isOptimizing, optimizationCompleted]);

  // Reset trigger flag when queue is empty
  React.useEffect(() => {
    if (optimizationQueue) {
      const queuedSKUs = optimizationQueue.getSKUsInQueue();
      if (queuedSKUs.length === 0) {
        hasTriggeredOptimizationRef.current = false;
        console.log('🏁 AUTO-TRIGGER: Queue is empty, resetting trigger flag');
      }
    }
  }, [optimizationQueue?.getSKUsInQueue().length]);

  // CRITICAL FIX: Watch for cache changes and immediately update models state
  React.useEffect(() => {
    if (selectedSKU && cache[selectedSKU] && !navigationReturnRef.current) {
      console.log('🔄 CACHE UPDATED: Immediately updating models state for', selectedSKU);
      
      // Update models state with cached optimization results
      setModels(prev => prev.map(model => {
        const cached = getCachedParameters(selectedSKU, model.id);
        if (cached) {
          console.log(`✅ CACHE UPDATE: Applying ${cached.method || 'unknown'} optimization to ${model.id} for ${selectedSKU}`);
          return {
            ...model,
            optimizedParameters: cached.parameters,
            optimizationConfidence: cached.confidence,
            optimizationReasoning: cached.reasoning,
            optimizationFactors: cached.factors,
            expectedAccuracy: cached.expectedAccuracy,
            optimizationMethod: cached.method
          };
        }
        return model;
      }));
      
      // Force forecast regeneration after models update
      setTimeout(() => {
        console.log('🔄 CACHE UPDATE: Regenerating forecasts with updated models');
        generateForecastsForSelectedSKU();
      }, 100);
    }
  }, [cache, selectedSKU, getCachedParameters]);

  // Auto-select first SKU when data changes
  React.useEffect(() => {
    const skus = Array.from(new Set(data.map(d => d.sku))).sort();
    if (skus.length > 0 && !selectedSKU) {
      onSKUChange(skus[0]);
    }
  }, [data, selectedSKU, onSKUChange]);

  // Apply preferences immediately when SKU changes or component mounts - BUT NOT on force updates
  React.useEffect(() => {
    if (selectedSKU && data.length > 0 && forceUpdateTrigger === 0 && !navigationReturnRef.current) {
      const modelsWithPreferences = createModelsWithPreferences();
      console.log(`EFFECT: Setting models with preferences for ${selectedSKU} (initial load only)`);
      setModels(modelsWithPreferences);
      
      setTimeout(() => generateForecastsForSelectedSKU(), 50);
      lastSKURef.current = selectedSKU;
    }
  }, [selectedSKU, data.length, createModelsWithPreferences]);

  // Reset models when cache is cleared (when data changes significantly)
  React.useEffect(() => {
    if (selectedSKU && data.length > 0) {
      // Check if this is a completely new dataset by looking at cache state
      const currentDataHash = generateDataHash(data.filter(d => d.sku === selectedSKU));
      const hasAnyCache = Object.keys(cache).length > 0;
      
      // If we have no cache at all, this indicates a fresh start (cache was cleared)
      if (!hasAnyCache) {
        console.log('🔄 CACHE CLEARED: Resetting models to default state');
        setForceUpdateTrigger(prev => prev + 1);
      }
    }
  }, [cache, selectedSKU, data.length, generateDataHash]);

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
      (sku, modelId, parameters, confidence, reasoning, factors, expectedAccuracy, method) => {
        const skuData = data.filter(d => d.sku === sku);
        const dataHash = generateDataHash(skuData);
        
        // Ensure factors has the correct type structure
        const typedFactors = factors || {
          stability: 0,
          interpretability: 0,
          complexity: 0,
          businessImpact: 'Unknown'
        };
        
        // Store complete optimization result in cache including method
        setCachedParameters(sku, modelId, parameters, dataHash, confidence, reasoning, typedFactors, expectedAccuracy, method);
        
        console.log(`QUEUE OPTIMIZATION: Setting ${sku}:${modelId} to ${method} (confidence: ${confidence})`);
        
        const preferences = loadManualAIPreferences();
        const preferenceKey = `${sku}:${modelId}`;
        // Set preference based on method
        if (method?.startsWith('ai_')) {
          preferences[preferenceKey] = true;
        } else if (method === 'grid_search') {
          preferences[preferenceKey] = 'grid';
        } else {
          preferences[preferenceKey] = false;
        }
        saveManualAIPreferences(preferences);
        
        console.log(`QUEUE OPTIMIZATION: Updating models state for ${sku}:${modelId} with ${method} parameters and reasoning`);
        setModels(prev => {
          const updated = prev.map(model => 
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
          );
          return updated;
        });
        
        // Force UI update for the current SKU immediately
        if (sku === selectedSKU) {
          console.log(`🎯 QUEUE: IMMEDIATE UI UPDATE for selected SKU: ${sku}`);
          setForceUpdateTrigger(prev => prev + 1);
        }
      },
      (sku) => {
        // Remove completed SKU from queue
        optimizationQueue.removeSKUsFromQueue([sku]);
        
        // Force UI update when current SKU is completed
        if (sku === selectedSKU) {
          console.log(`🎯 QUEUE: SKU COMPLETED UI UPDATE for: ${sku}`);
          setForceUpdateTrigger(prev => prev + 1);
        }
      },
      (sku: string, modelIds: string[]) => {
        // Return the SKUs that need optimization - this should return string[]
        const skusNeedingOptimization = getSKUsNeedingOptimization(sku, modelIds);
        // Since getSKUsNeedingOptimization returns an array of objects, we need to extract the SKU strings
        return Array.isArray(skusNeedingOptimization) 
          ? skusNeedingOptimization.map(item => typeof item === 'string' ? item : item.sku).filter(Boolean)
          : [];
      }
    );

    markOptimizationCompleted(data, '/');
    console.log('✅ QUEUE: OPTIMIZATION COMPLETE');
    
    // Final force update to ensure UI reflects all changes
    setTimeout(() => {
      console.log('🔄 FINAL UI UPDATE: After optimization completion');
      setForceUpdateTrigger(prev => prev + 1);
    }, 200);
  };

  const generateForecastsForSelectedSKU = async () => {
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

  const handleUseGrid = (modelId: string) => {
    console.log(`🔍 Using Grid for ${modelId}`);
    useGridOptimization(modelId);
    setTimeout(() => {
      console.log(`🔍 Regenerating forecasts after Grid toggle for ${modelId}`);
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

        {/* Simplified Queue Status */}
        {optimizationQueue && optimizationQueue.getSKUsInQueue().length > 0 && (
          <div className={`border rounded-lg p-4 ${
            isOptimizing 
              ? 'bg-blue-50 border-blue-200' 
              : 'bg-amber-50 border-amber-200'
          }`}>
            <div className="flex items-center gap-3">
              {isOptimizing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <Zap className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-800">
                    Currently optimizing: {progress?.currentSKU || 'Unknown'}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {progress ? `${progress.completedSKUs + 1}/${progress.totalSKUs}` : 'Processing...'}
                  </Badge>
                </>
              ) : (
                <>
                  <Clock className="h-5 w-5 text-amber-600" />
                  <span className="font-medium text-amber-800">
                    {optimizationQueue.getSKUsInQueue().length} SKUs queued for optimization
                  </span>
                  <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">
                    {hasTriggeredOptimizationRef.current ? 'Starting...' : 'Pending'}
                  </Badge>
                </>
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
        onUseGrid={handleUseGrid}
        onResetToManual={handleResetToManual}
      />

      <OptimizationLogger 
        isVisible={showOptimizationLog} 
        onClose={() => setShowOptimizationLog(false)} 
      />
    </div>
  );
});

ForecastModels.displayName = 'ForecastModels';
