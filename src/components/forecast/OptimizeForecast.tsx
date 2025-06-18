import React, { useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ProductSelector } from '@/components/ProductSelector';
import type { SalesData, ModelConfig } from '@/types/forecast';
import { BusinessContext } from '@/types/businessContext';
import { Bot, Grid, User } from 'lucide-react';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { ParameterSliders } from '@/components/ParameterSliders';

interface OptimizeForecastProps {
  data: SalesData[];
  selectedSKU: string;
  models: ModelConfig[];
  businessContext: BusinessContext;
  aiForecastModelOptimizationEnabled: boolean;
  onSKUChange: (sku: string) => void;
  onUpdateParameter: (modelId: string, parameter: string, value: number) => void;
}

// Order: AI, Grid, Manual
const methodOptions = [
  { value: 'ai', label: 'AI', icon: <Bot className="w-4 h-4 mr-1" /> },
  { value: 'grid', label: 'Grid Search', icon: <Grid className="w-4 h-4 mr-1" /> },
  { value: 'manual', label: 'Manual', icon: <User className="w-4 h-4 mr-1" /> },
];

export const OptimizeForecast: React.FC<OptimizeForecastProps> = ({
  data,
  selectedSKU,
  models,
  businessContext,
  aiForecastModelOptimizationEnabled,
  onSKUChange,
  onUpdateParameter,
}) => {
  const { setSelectedMethod, getCachedParameters, cache, generateDataHash, cacheVersion } = useOptimizationCache();
  // Store optimization method per model per SKU
  const [modelMethods, setModelMethods] = React.useState<Record<string, 'manual' | 'grid' | 'ai'>>({});
  // Track the last updated modelId and method
  const lastUpdateRef = React.useRef<{ sku: string; modelId: string; method: string } | null>(null);
  // Track which model's next cache read should be skipped
  const skipNextReadRef = React.useRef<Record<string, boolean>>({});
  const [userSelectedMethods, setUserSelectedMethods] = React.useState<Record<string, boolean>>({});

  // Helper to get the key for modelMethods
  const getMethodKey = (sku: string, modelId: string) => `${sku}:${modelId}`;

  // Auto-select the best method (AI or Grid) based on score when SKU/model changes, unless user has chosen
  React.useEffect(() => {
    setModelMethods((prev) => {
      const updated: typeof prev = { ...prev };
      models.forEach((model) => {
        const isOptimizable = !!model.parameters && Object.keys(model.parameters ?? {}).length > 0;
        if (!isOptimizable) return;
        
        const key = getMethodKey(selectedSKU, model.id);
        const cacheEntry = cache[selectedSKU]?.[model.id];
        
        // If we have a cached selection, use it
        if (cacheEntry?.selected) {
          updated[key] = cacheEntry.selected;
          return;
        }

        // If no cached selection, auto-select best method
        const aiScore = cacheEntry?.ai?.confidence || 0;
        const gridScore = cacheEntry?.grid?.confidence || 0;
        
        // Auto-select best method (AI or Grid)
        if (aiScore >= gridScore && aiScore > 0 && aiForecastModelOptimizationEnabled) {
          updated[key] = 'ai';
        } else if (gridScore > 0) {
          updated[key] = 'grid';
        } else {
          updated[key] = aiForecastModelOptimizationEnabled ? 'ai' : 'grid';
        }
      });
      return updated;
    });
  }, [aiForecastModelOptimizationEnabled, models, selectedSKU, cache]);

  // On method change, update cache and load parameters for that method
  const handleMethodChange = (modelId: string, method: 'manual' | 'grid' | 'ai') => {
    // Get current cached values
    const cached = getCachedParameters(selectedSKU, modelId, method);
    const manualCached = getCachedParameters(selectedSKU, modelId, 'manual');
    
    // If switching to manual and we have cached manual parameters, use those
    if (method === 'manual' && manualCached?.parameters) {
      // Use existing manual parameters
      Object.entries(manualCached.parameters).forEach(([param, value]) => {
        onUpdateParameter(modelId, param, value);
      });
    } 
    // Only initialize with grid/defaults if no manual parameters exist
    else if (method === 'manual' && !manualCached?.parameters) {
      const gridParams = getCachedParameters(selectedSKU, modelId, 'grid')?.parameters;
      if (gridParams) {
        Object.entries(gridParams).forEach(([param, value]) => {
          onUpdateParameter(modelId, param, value);
        });
      } else {
        const modelObj = models.find(m => m.id === modelId);
        if (modelObj && modelObj.parameters) {
          Object.entries(modelObj.parameters).forEach(([param, value]) => {
            onUpdateParameter(modelId, param, value);
          });
        }
      }
    }
    // For AI/Grid, use their respective cached parameters
    else if (cached?.parameters) {
      Object.entries(cached.parameters).forEach(([param, value]) => {
        onUpdateParameter(modelId, param, value);
      });
    }

    // Update method selection in state and cache
    setModelMethods((prev) => ({ ...prev, [getMethodKey(selectedSKU, modelId)]: method }));
    setSelectedMethod(selectedSKU, modelId, method);
  };

  // Manual parameter edit handler
  const handleManualParamEdit = (modelId: string, key: string, value: number) => {
    // Ensure we're in manual mode when editing parameters
    const currentMethod = modelMethods[getMethodKey(selectedSKU, modelId)];
    if (currentMethod !== 'manual') {
      handleMethodChange(modelId, 'manual');
    }
    onUpdateParameter(modelId, key, value);
    lastUpdateRef.current = { sku: selectedSKU, modelId, method: 'manual' };
    skipNextReadRef.current[modelId] = true;
  };

  // Always call useMemo, even if returning early
  const allCacheResults = React.useMemo(() => {
    return models.reduce((acc, model) => {
      const ai = getCachedParameters(selectedSKU, model.id, 'ai')?.parameters;
      const grid = getCachedParameters(selectedSKU, model.id, 'grid')?.parameters;
      const manual = getCachedParameters(selectedSKU, model.id, 'manual')?.parameters || model.parameters || {};
      const currentDataHash = generateDataHash(data.filter(d => d['Material Code'] === selectedSKU));
      // Only log for the last updated model, and suppress log immediately after a save
      const shouldLog = lastUpdateRef.current &&
        lastUpdateRef.current.sku === selectedSKU &&
        lastUpdateRef.current.modelId === model.id;
      // Skip the cache read/log if flagged for this model
      if (skipNextReadRef.current[model.id]) {
        skipNextReadRef.current[model.id] = false;
      } else if (shouldLog) {
        console.log('[CACHE READ] getCachedParameters', { sku: selectedSKU, modelId: model.id, method: lastUpdateRef.current.method, currentDataHash, aiParams: ai, gridParams: grid, manualParams: manual });
        // Clear the ref so we only log once per update
        lastUpdateRef.current = null;
      }
      acc[model.id] = { ai, grid, manual, currentDataHash };
      return acc;
    }, {} as Record<string, { ai: any, grid: any, manual: any, currentDataHash: string }>);
  }, [models, selectedSKU, getCachedParameters, data, generateDataHash, cacheVersion]);

  // Only render model cards if selectedSKU is set and there is data for that SKU
  const skuData = data.filter(d => d['Material Code'] === selectedSKU);
  if (!selectedSKU || skuData.length === 0) {
    return (
      <div className="space-y-4">
        <ProductSelector
          data={data}
          selectedSKU={selectedSKU}
          onSKUChange={onSKUChange}
        />
        <div className="text-gray-500 text-center py-8">
          {!selectedSKU
            ? "Please select a product to view forecast models."
            : "No data available for the selected product."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ProductSelector
        data={data}
        selectedSKU={selectedSKU}
        onSKUChange={onSKUChange}
      />

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Optimize Forecast</h2>
          <p className="text-muted-foreground">
            View model configurations and optimization status
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {models.map((model) => {
          const isOptimizable = !!model.parameters && Object.keys(model.parameters ?? {}).length > 0;
          const selectedMethod = modelMethods[getMethodKey(selectedSKU, model.id)] || model.optimizationMethod || (aiForecastModelOptimizationEnabled ? 'ai' : 'grid');

          // Use memoized cache results for this model
          const { ai, grid, manual, currentDataHash } = allCacheResults[model.id] || { ai: undefined, grid: undefined, manual: {}, currentDataHash: '' };

          const aiAvailable = !!ai && aiForecastModelOptimizationEnabled;
          const gridAvailable = !!grid;
          const manualAvailable = isOptimizable; // Always allow manual for optimizable models
          // Only show parameters for the selected method
          let paramLabel = '';
          let paramSet: Record<string, number> | undefined;
          if (selectedMethod === 'ai') {
            paramLabel = 'AI Optimized Parameters';
            paramSet = ai;
          } else if (selectedMethod === 'grid') {
            paramLabel = 'Grid Search Optimized Parameters';
            paramSet = grid;
          } else {
            paramLabel = 'Manual Parameters';
            paramSet = Object.keys(model.parameters ?? {}).length > 0 ? model.parameters : manual;
          }

          // Only show the score for the selected method
          let score = undefined;
          if (selectedMethod === 'ai') {
            score = cache[selectedSKU]?.[model.id]?.ai?.confidence;
          } else if (selectedMethod === 'grid') {
            score = cache[selectedSKU]?.[model.id]?.grid?.confidence;
          } else if (selectedMethod === 'manual') {
            score = cache[selectedSKU]?.[model.id]?.manual?.confidence;
          }

          return (
            <Card key={model.id} className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    {model.icon}
                    {model.name}
                  </div>
                  {score !== undefined && (
                    <div className="text-blue-700 font-semibold text-base">
                      Score: {score}%
                    </div>
                  )}
                </CardTitle>
                <CardDescription>{model.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Per-model optimization method badges, only for optimizable models */}
                  {isOptimizable && (
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="mr-2">Optimization Method</Label>
                      <button
                        type="button"
                        disabled={!aiAvailable}
                        onClick={() => aiAvailable && handleMethodChange(model.id, 'ai')}
                        className={`flex items-center px-2 py-1 rounded-full border text-xs font-medium transition-colors
                          ${selectedMethod === 'ai' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-blue-100'}
                          ${!aiAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <Bot className="w-4 h-4 mr-1" />AI
                      </button>
                      <button
                        type="button"
                        disabled={!gridAvailable}
                        onClick={() => gridAvailable && handleMethodChange(model.id, 'grid')}
                        className={`flex items-center px-2 py-1 rounded-full border text-xs font-medium transition-colors
                          ${selectedMethod === 'grid' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-blue-100'}
                          ${!gridAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <Grid className="w-4 h-4 mr-1" />Grid Search
                      </button>
                      <button
                        type="button"
                        disabled={!manualAvailable}
                        onClick={() => handleMethodChange(model.id, 'manual')}
                        className={`flex items-center px-2 py-1 rounded-full border text-xs font-medium transition-colors
                          ${selectedMethod === 'manual' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-blue-100'}
                          ${!manualAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <User className="w-4 h-4 mr-1" />Manual
                      </button>
                    </div>
                  )}
                  {/* Parameter sliders for manual mode */}
                  <ParameterSliders
                    model={model}
                    isManual={selectedMethod === 'manual'}
                    disabled={false}
                    getParameterValue={(parameter) => paramSet?.[parameter]}
                    onParameterChange={(parameter, values) => handleManualParamEdit(model.id, parameter, values[0])}
                  />
                  {model.optimizationMethod && (
                    <div className="mt-4 p-2 bg-gray-50 rounded-md">
                      <div className="text-sm text-gray-600">
                        Last optimized with: {model.optimizationMethod}
                      </div>
                      {model.optimizationConfidence && (
                        <div className="text-sm text-gray-600">
                          Confidence: {model.optimizationConfidence}%
                        </div>
                    )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}; 