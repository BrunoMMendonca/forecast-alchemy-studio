
import React, { useState, useRef } from 'react';
import { SalesData, ForecastResult } from '@/types/sales';
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
import { OptimizationProgress } from './OptimizationProgress';
import { ForecastDebugInfo } from './ForecastDebugInfo';
import { useModelControlHandlers } from './ModelControlHandlers';

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

  const generateForecastsForSelectedSKU = async () => {
    if (!selectedSKU) return;

    try {
      const currentModels = models;
      console.log(`🎯 Generating forecasts for ${selectedSKU} with current models:`, 
        currentModels.map(m => ({ id: m.id, enabled: m.enabled })));
      
      const results = await generateForecastsForSKU(
        selectedSKU,
        data,
        currentModels,
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

  // Main optimization effect - only runs on actual data changes
  React.useEffect(() => {
    if (data.length === 0) return;

    if (isTogglingAIManualRef.current) {
      console.log('FIXED: ❌ SKIPPING OPTIMIZATION - AI/Manual toggle in progress');
      return;
    }

    const currentDataHash = generateStableFingerprint(data);
    
    if (lastDataHashRef.current === currentDataHash) {
      console.log('FIXED: ❌ Same data hash - no optimization needed');
      return;
    }
    
    lastDataHashRef.current = currentDataHash;
    
    incrementTriggerCount();
    const triggerCount = getTriggerCount();
    
    console.log(`FIXED: Data changed - trigger #${triggerCount}, hash: ${currentDataHash}`);

    const shouldRunOptimization = shouldOptimize(data, '/');
    
    if (!shouldRunOptimization) {
      console.log('FIXED: ❌ OPTIMIZATION BLOCKED BY NAVIGATION STATE - Using cached results');
      
      toast({
        title: "Using Cached Results",
        description: "Optimization already completed for this dataset",
      });
      
      return;
    }

    console.log('FIXED: ✅ NAVIGATION STATE APPROVED OPTIMIZATION - Starting process');
    handleInitialOptimization();
  }, [data]);

  const handleInitialOptimization = async () => {
    const enabledModels = models.filter(m => m.enabled);
    
    console.log('FIXED: 🚀 STARTING OPTIMIZATION PROCESS');
    
    markOptimizationStarted(data, '/');
    
    await optimizeAllSKUs(
      data, 
      enabledModels, 
      (sku, modelId, parameters, confidence) => {
        const skuData = data.filter(d => d.sku === sku);
        const dataHash = generateDataHash(skuData);
        setCachedParameters(sku, modelId, parameters, dataHash, confidence);
        
        console.log(`OPTIMIZATION CALLBACK: Setting ${sku}:${modelId} to AI (confidence: ${confidence})`);
        
        const preferences = loadManualAIPreferences();
        const preferenceKey = `${sku}:${modelId}`;
        preferences[preferenceKey] = true;
        saveManualAIPreferences(preferences);
        
        if (sku === selectedSKU) {
          console.log(`CRITICAL FIX: Immediately updating UI for ${sku}:${modelId} with optimized parameters`);
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
          
          setTimeout(() => generateForecastsForSelectedSKU(), 100);
        }
      },
      getSKUsNeedingOptimization
    );

    markOptimizationCompleted(data, '/');
    console.log('FIXED: ✅ OPTIMIZATION COMPLETE - MARKED AS DONE');
  };

  const {
    handleToggleModel,
    handleUpdateParameter,
    handleUseAI,
    handleResetToManual
  } = useModelControlHandlers({
    setModels,
    updateParameter,
    useAIOptimization,
    resetToManual,
    generateForecastsForSelectedSKU
  });

  return (
    <div className="space-y-6">
      <ProductSelector
        data={data}
        selectedSKU={selectedSKU}
        onSKUChange={onSKUChange}
      />

      <OptimizationProgress
        isOptimizing={isOptimizing}
        progress={progress}
        optimizationCompleted={optimizationCompleted}
        showOptimizationLog={showOptimizationLog}
        onToggleLog={() => setShowOptimizationLog(!showOptimizationLog)}
        onClearProgress={clearProgress}
      />

      <ModelSelection
        models={models}
        onToggleModel={handleToggleModel}
        onUpdateParameter={handleUpdateParameter}
        onUseAI={handleUseAI}
        onResetToManual={handleResetToManual}
      />

      <ForecastDebugInfo
        navigationState={navigationState}
        getTriggerCount={getTriggerCount}
        cacheStats={cacheStats}
        isTogglingAIManual={isTogglingAIManualRef.current}
        lastSKU={lastSKURef.current}
      />

      <OptimizationLogger 
        isVisible={showOptimizationLog} 
        onClose={() => setShowOptimizationLog(false)} 
      />
    </div>
  );
};
