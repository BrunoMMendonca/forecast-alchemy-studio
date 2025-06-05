
import { useState, useCallback, useEffect } from 'react';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { useDatasetOptimization } from '@/hooks/useDatasetOptimization';

interface OptimizedParameters {
  parameters: Record<string, number>;
  timestamp: number;
  dataHash: string;
  confidence?: number;
  reasoning?: string;
  factors?: {
    stability: number;
    interpretability: number;
    complexity: number;
    businessImpact: string;
  };
  expectedAccuracy?: number;
  method?: string;
}

interface OptimizationCache {
  [sku: string]: {
    [modelId: string]: {
      ai?: OptimizedParameters;
      grid?: OptimizedParameters;
      selected?: 'ai' | 'grid' | 'manual';
    };
  };
}

const CACHE_KEY = 'forecast_optimization_cache';
const CACHE_EXPIRY_HOURS = 24;

export const useOptimizationCache = () => {
  const [cache, setCache] = useState<OptimizationCache>({});
  const [cacheStats, setCacheStats] = useState({ hits: 0, misses: 0, skipped: 0 });
  
  const {
    generateDatasetFingerprint,
    isOptimizationComplete,
    markOptimizationComplete
  } = useDatasetOptimization();

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (stored) {
        const parsedCache = JSON.parse(stored);
        const now = Date.now();
        const filteredCache: OptimizationCache = {};
        
        Object.keys(parsedCache).forEach(sku => {
          Object.keys(parsedCache[sku]).forEach(modelId => {
            const entry = parsedCache[sku][modelId];
            
            // Handle legacy format
            if (entry.parameters) {
              const method = entry.method?.startsWith('ai_') ? 'ai' : 
                           entry.method === 'grid_search' ? 'grid' : 'ai';
              
              if (now - entry.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000) {
                if (!filteredCache[sku]) filteredCache[sku] = {};
                if (!filteredCache[sku][modelId]) filteredCache[sku][modelId] = {};
                
                filteredCache[sku][modelId][method] = entry;
                filteredCache[sku][modelId].selected = method;
              }
            } else {
              // New format
              const hasValidEntries = (entry.ai && now - entry.ai.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000) ||
                                    (entry.grid && now - entry.grid.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000);
              
              if (hasValidEntries) {
                if (!filteredCache[sku]) filteredCache[sku] = {};
                filteredCache[sku][modelId] = entry;
              }
            }
          });
        });
        
        setCache(filteredCache);
        console.log('CACHE: Loaded optimization cache from storage');
      }
    } catch (error) {
      console.error('CACHE: Failed to load from localStorage:', error);
    }
  }, []);

  // Save cache to localStorage when it changes
  useEffect(() => {
    if (Object.keys(cache).length > 0) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      } catch (error) {
        console.error('CACHE: Failed to save cache to localStorage:', error);
      }
    }
  }, [cache]);

  const generateDataHash = useCallback((skuData: SalesData[]): string => {
    const sorted = [...skuData].sort((a, b) => a.date.localeCompare(b.date));
    const salesValues = sorted.map(d => Math.round(d.sales * 100) / 100).join('-');
    const outlierFlags = sorted.map(d => d.isOutlier ? '1' : '0').join('');
    const noteFlags = sorted.map(d => d.note ? '1' : '0').join('');
    
    return `${sorted.length}-${salesValues.substring(0, 50)}-${outlierFlags}-${noteFlags}`.substring(0, 100);
  }, []);

  const getSKUsNeedingOptimization = useCallback((
    data: SalesData[], 
    models: ModelConfig[]
  ): { sku: string; models: string[] }[] => {
    console.log('CACHE: Checking which SKUs need optimization...');
    
    const enabledModelsWithParams = models.filter(m => 
      m.enabled && m.parameters && Object.keys(m.parameters).length > 0
    );
    
    const skus = Array.from(new Set(data.map(d => d.sku))).sort();
    const result: { sku: string; models: string[] }[] = [];
    
    skus.forEach(sku => {
      const skuData = data.filter(d => d.sku === sku);
      if (skuData.length < 3) return;
      
      const currentDataHash = generateDataHash(skuData);
      
      const modelsNeedingOptimization = enabledModelsWithParams
        .filter(m => {
          const cached = cache[sku]?.[m.id];
          // Need optimization if BOTH AI and Grid are missing or invalid
          const hasValidAI = cached?.ai && cached.ai.dataHash === currentDataHash;
          const hasValidGrid = cached?.grid && cached.grid.dataHash === currentDataHash;
          
          return !hasValidAI || !hasValidGrid;
        })
        .map(m => m.id);
      
      if (modelsNeedingOptimization.length > 0) {
        result.push({ sku, models: modelsNeedingOptimization });
      }
    });
    
    console.log(`CACHE: ${result.length} SKUs need optimization (missing AI or Grid results)`);
    return result;
  }, [cache, generateDataHash]);

  const getCachedParameters = useCallback((
    sku: string, 
    modelId: string, 
    method?: 'ai' | 'grid'
  ): OptimizedParameters | null => {
    const cached = cache[sku]?.[modelId];
    if (!cached) {
      setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
      return null;
    }

    if (method) {
      const result = cached[method];
      if (result) {
        setCacheStats(prev => ({ ...prev, hits: prev.hits + 1 }));
        return result;
      } else {
        setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
        return null;
      }
    }

    const selectedMethod = cached.selected || 'ai';
    const result = cached[selectedMethod] || cached.ai || cached.grid;
    
    if (result) {
      setCacheStats(prev => ({ ...prev, hits: prev.hits + 1 }));
      return result;
    } else {
      setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
      return null;
    }
  }, [cache]);

  const setCachedParameters = useCallback((
    sku: string, 
    modelId: string, 
    parameters: Record<string, number>,
    dataHash: string,
    confidence?: number,
    reasoning?: string,
    factors?: {
      stability: number;
      interpretability: number;
      complexity: number;
      businessImpact: string;
    },
    expectedAccuracy?: number,
    method?: string
  ) => {
    const optimizedParams: OptimizedParameters = {
      parameters,
      timestamp: Date.now(),
      dataHash,
      confidence,
      reasoning,
      factors,
      expectedAccuracy,
      method
    };

    let cacheMethod: 'ai' | 'grid';
    if (method === 'grid_search') {
      cacheMethod = 'grid';
    } else if (method?.startsWith('ai_')) {
      cacheMethod = 'ai';
    } else {
      cacheMethod = method === 'grid_search' ? 'grid' : 'ai';
    }

    console.log(`💾 CACHE UPDATE: Setting ${sku}:${modelId}:${cacheMethod}`);

    setCache(prev => {
      // Create completely new object to ensure React detects the change
      const newCache = JSON.parse(JSON.stringify(prev));
      
      if (!newCache[sku]) newCache[sku] = {};
      if (!newCache[sku][modelId]) newCache[sku][modelId] = {};
      
      newCache[sku][modelId][cacheMethod] = optimizedParams;
      // Only update selected if not already set
      if (!newCache[sku][modelId].selected) {
        newCache[sku][modelId].selected = cacheMethod;
      }
      
      console.log(`💾 CACHE UPDATE: ${sku}:${modelId}:${cacheMethod} cached`, {
        hasAI: !!newCache[sku][modelId].ai,
        hasGrid: !!newCache[sku][modelId].grid,
        selected: newCache[sku][modelId].selected
      });
      
      return newCache;
    });
  }, []);

  const setSelectedMethod = useCallback((
    sku: string,
    modelId: string,
    method: 'ai' | 'grid' | 'manual'
  ) => {
    setCache(prev => {
      // Create completely new object to ensure React detects the change
      const newCache = JSON.parse(JSON.stringify(prev));
      
      if (!newCache[sku]) newCache[sku] = {};
      if (!newCache[sku][modelId]) newCache[sku][modelId] = {};
      
      newCache[sku][modelId].selected = method;
      
      return newCache;
    });
  }, []);

  const isCacheValid = useCallback((sku: string, modelId: string, currentDataHash: string): boolean => {
    const cached = getCachedParameters(sku, modelId);
    if (!cached) return false;
    
    return cached.dataHash === currentDataHash;
  }, [getCachedParameters]);

  const clearCacheForSKU = useCallback((sku: string) => {
    setCache(prev => {
      const newCache = JSON.parse(JSON.stringify(prev));
      delete newCache[sku];
      return newCache;
    });
  }, []);

  const clearAllCache = useCallback(() => {
    console.log('🗑️ CACHE CLEAR: Clearing all optimization cache');
    setCache({});
    setCacheStats({ hits: 0, misses: 0, skipped: 0 });
    
    try {
      localStorage.removeItem(CACHE_KEY);
      console.log('🗑️ CACHE CLEAR: Cleared localStorage');
    } catch (error) {
      console.error('🗑️ CACHE CLEAR: Failed to clear localStorage:', error);
    }
  }, []);

  return {
    cache,
    cacheStats,
    generateDataHash,
    getCachedParameters,
    setCachedParameters,
    setSelectedMethod,
    isCacheValid,
    getSKUsNeedingOptimization,
    clearCacheForSKU,
    clearAllCache,
    isOptimizationComplete,
    markOptimizationComplete,
    generateDatasetFingerprint,
    // Legacy compatibility functions
    startOptimizationSession: () => {},
    markSKUOptimized: () => {},
    completeOptimizationSession: () => {},
    getDatasetFingerprintString: generateDatasetFingerprint,
    hasOptimizationStarted: () => false,
    markOptimizationStarted: () => {},
    batchValidateCache: () => ({})
  };
};
