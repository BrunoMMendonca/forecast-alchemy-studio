
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Settings } from 'lucide-react';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { hasOptimizableParameters } from '@/utils/modelConfig';
import { generateDataHash } from '@/utils/cacheHashUtils';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useOptimizationMethodManagement } from '@/hooks/useOptimizationMethodManagement';
import { ParameterBadges } from './ParameterBadges';
import { ParameterSliders } from './ParameterSliders';
import { ParameterStatusDisplay } from './ParameterStatusDisplay';

interface ParameterControlProps {
  model: ModelConfig;
  selectedSKU: string;
  data: SalesData[];
  onParameterUpdate: (parameter: string, value: number) => void;
  onResetToManual: () => void;
  onMethodSelection?: (method: 'ai' | 'grid' | 'manual') => void;
  disabled?: boolean;
  grokApiEnabled?: boolean;
}

export const ParameterControl: React.FC<ParameterControlProps> = ({
  model,
  selectedSKU,
  data,
  onParameterUpdate,
  onResetToManual,
  onMethodSelection,
  disabled = false,
  grokApiEnabled = true,
}) => {
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);
  const { cache, cacheVersion } = useOptimizationCache();
  const { getBestAvailableMethod } = useOptimizationMethodManagement();

  // Get the actual data hash for the current SKU
  const currentDataHash = useMemo(() => {
    const skuData = data.filter(d => d.sku === selectedSKU);
    const hash = generateDataHash(skuData);
    console.log(`🔄 PARAM_CONTROL: Generated data hash for ${selectedSKU}: ${hash.substring(0, 50)}...`);
    return hash;
  }, [data, selectedSKU]);

  // Get current user selection from cache
  const cacheEntry = useMemo(() => {
    console.log(`🔄 PARAM_CONTROL: Cache lookup for ${selectedSKU}:${model.id} (version: ${cacheVersion})`);
    const entry = cache[selectedSKU]?.[model.id];
    console.log(`🔄 PARAM_CONTROL: Found cache entry:`, entry);
    return entry;
  }, [cache, selectedSKU, model.id, cacheVersion]);

  const userSelectedMethod = useMemo(() => {
    const method = cacheEntry?.selected;
    console.log(`🔄 PARAM_CONTROL: User selected method for ${selectedSKU}:${model.id} = ${method} (cache version: ${cacheVersion})`);
    return method;
  }, [cacheEntry, selectedSKU, model.id, cacheVersion]);

  // Compute the effective selected method - combines user choice with best available
  const effectiveSelectedMethod = useMemo(() => {
    // If user has made an explicit choice, use that
    if (userSelectedMethod) {
      console.log(`🎯 PARAM_CONTROL: Using explicit user choice: ${userSelectedMethod} for ${selectedSKU}:${model.id}`);
      return userSelectedMethod;
    }

    // Otherwise, use the best available method based on current cache state
    const bestMethod = getBestAvailableMethod(selectedSKU, model.id, currentDataHash);
    console.log(`🎯 PARAM_CONTROL: Using best available method: ${bestMethod} for ${selectedSKU}:${model.id} (hash: ${currentDataHash.substring(0, 20)}...)`);
    return bestMethod;
  }, [userSelectedMethod, selectedSKU, model.id, getBestAvailableMethod, currentDataHash, cacheVersion]);

  // Local state for immediate visual feedback on user clicks
  const [localSelectedMethod, setLocalSelectedMethod] = useState<'ai' | 'grid' | 'manual' | undefined>(effectiveSelectedMethod);

  // Sync local state with effective method when it changes (due to optimization completion)
  useEffect(() => {
    setLocalSelectedMethod(effectiveSelectedMethod);
    console.log(`🎯 PARAM_CONTROL: Local state synced to effective method ${effectiveSelectedMethod} for ${selectedSKU}:${model.id}`);
  }, [effectiveSelectedMethod, selectedSKU, model.id]);

  // Load optimization data from cache based on effective selected method
  const optimizationData = useMemo(() => {
    if (!cacheEntry || localSelectedMethod === 'manual') {
      console.log(`🔄 PARAM_CONTROL: No optimization data - manual mode or no cache entry`);
      return null;
    }

    if (localSelectedMethod === 'ai' && cacheEntry.ai) {
      console.log(`🔄 PARAM_CONTROL: Using AI optimization data`);
      return cacheEntry.ai;
    } else if (localSelectedMethod === 'grid' && cacheEntry.grid) {
      console.log(`🔄 PARAM_CONTROL: Using Grid optimization data`);
      return cacheEntry.grid;
    }

    const fallback = cacheEntry.ai || cacheEntry.grid || null;
    console.log(`🔄 PARAM_CONTROL: Using fallback optimization data:`, fallback ? 'found' : 'none');
    return fallback;
  }, [cacheEntry, localSelectedMethod]);

  // Determine which method is currently active
  const isManual = localSelectedMethod === 'manual';
  const isAI = localSelectedMethod === 'ai';
  const isGrid = localSelectedMethod === 'grid';

  // Log current state for debugging
  useEffect(() => {
    console.log(`🎯 PARAM_CONTROL: Badge states for ${selectedSKU}:${model.id}:`, {
      effectiveSelectedMethod,
      localSelectedMethod,
      isManual,
      isAI,
      isGrid,
      cacheVersion,
      currentDataHash: currentDataHash.substring(0, 20) + '...'
    });
  }, [selectedSKU, model.id, effectiveSelectedMethod, localSelectedMethod, isManual, isAI, isGrid, cacheVersion, currentDataHash]);

  // Determine the source of truth for parameter values
  const getParameterValue = useCallback((parameter: string) => {
    if (isManual) {
      // For manual mode, check cache first, then fall back to model parameters
      const manualCache = cacheEntry?.manual;
      if (manualCache && manualCache.dataHash === currentDataHash) {
        const cachedValue = manualCache.parameters?.[parameter];
        if (cachedValue !== undefined) {
          console.log(`🔄 PARAM_CONTROL: Using cached manual value for ${parameter}: ${cachedValue}`);
          return cachedValue;
        }
      }
      return model.parameters?.[parameter];
    } else {
      const optimizedValue = model.optimizedParameters?.[parameter];
      const modelValue = model.parameters?.[parameter];
      return optimizedValue !== undefined ? optimizedValue : modelValue;
    }
  }, [isManual, model.parameters, model.optimizedParameters, cacheEntry, currentDataHash]);

  const canOptimize = hasOptimizableParameters(model);

  // Only show parameters section if model actually has parameters
  const hasParameters = model.parameters && Object.keys(model.parameters).length > 0;

  // Check if optimization results exist for display
  const hasOptimizationResults = canOptimize && optimizationData && !isManual;

  const handleParameterChange = useCallback((parameter: string, values: number[]) => {
    const newValue = values[0];
    console.log(`🎚️ SLIDER CHANGE: ${parameter} = ${newValue}, switching to manual mode`);
    onParameterUpdate(parameter, newValue);
  }, [onParameterUpdate]);

  // Handle badge clicks with immediate local state update
  const handlePreferenceChange = useCallback((newMethod: 'manual' | 'ai' | 'grid') => {
    // Prevent duplicate calls by checking if we're already in this method
    if (localSelectedMethod === newMethod) {
      console.log(`🎯 BADGE CLICK: Already in ${newMethod} mode for ${model.id}, ignoring`);
      return;
    }
    
    console.log(`🎯 BADGE CLICK: Switching to ${newMethod} for ${model.id}`);
    
    // Update local state immediately for visual feedback
    setLocalSelectedMethod(newMethod);
    
    if (onMethodSelection) {
      onMethodSelection(newMethod);
    } else {
      if (newMethod === 'manual') {
        onResetToManual();
      }
    }
  }, [localSelectedMethod, model.id, onMethodSelection, onResetToManual]);

  // If model has no parameters, don't render anything
  if (!hasParameters) {
    return null;
  }

  // Add safety check for selectedSKU
  if (!selectedSKU) {
    console.log('ParameterControl: No selectedSKU provided');
    return null;
  }

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header with badges - always visible */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Settings className="h-4 w-4" />
              <span className="font-medium">Parameters</span>
            </div>
            
            <ParameterBadges
              canOptimize={canOptimize}
              grokApiEnabled={grokApiEnabled}
              localSelectedMethod={localSelectedMethod}
              cacheVersion={cacheVersion}
              onMethodChange={handlePreferenceChange}
            />
          </div>

          {/* Parameter sliders - always visible */}
          <ParameterSliders
            model={model}
            isManual={isManual}
            disabled={disabled}
            getParameterValue={getParameterValue}
            onParameterChange={handleParameterChange}
          />

          {/* Optimization reasoning - collapsible */}
          {hasOptimizationResults && (
            <Collapsible open={isReasoningExpanded} onOpenChange={setIsReasoningExpanded}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
                  {isReasoningExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span className="text-sm font-medium">Optimization Details</span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pt-2">
                  <ParameterStatusDisplay
                    canOptimize={canOptimize}
                    isManual={isManual}
                    optimizationData={optimizationData}
                    hasOptimizationResults={hasOptimizationResults}
                    localSelectedMethod={localSelectedMethod}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
