
const CACHE_KEY = 'forecast_optimization_cache';
const CACHE_EXPIRY_HOURS = 24;

export interface OptimizedParameters {
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

export interface OptimizationCache {
  [sku: string]: {
    [modelId: string]: {
      ai?: OptimizedParameters;
      grid?: OptimizedParameters;
      manual?: OptimizedParameters;
      selected?: 'ai' | 'grid' | 'manual';
    };
  };
}

export const loadCacheFromStorage = (): OptimizationCache => {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) {
      return {};
    }

    const parsedCache = JSON.parse(stored);
    const now = Date.now();
    const filteredCache: OptimizationCache = {};
    
    Object.keys(parsedCache).forEach(sku => {
      Object.keys(parsedCache[sku]).forEach(modelId => {
        const entry = parsedCache[sku][modelId];
        
        if (entry.parameters) {
          const method = entry.method?.startsWith('ai_') ? 'ai' : 
                       entry.method === 'grid_search' ? 'grid' : 
                       entry.method === 'manual' ? 'manual' : 'ai';
          
          if (!entry.dataHash?.startsWith('v2-')) {
            return;
          }
          
          if (now - entry.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000) {
            if (!filteredCache[sku]) filteredCache[sku] = {};
            if (!filteredCache[sku][modelId]) filteredCache[sku][modelId] = {};
            
            filteredCache[sku][modelId][method] = entry;
            filteredCache[sku][modelId].selected = method;
          }
        } else {
          const hasValidAI = entry.ai && 
                            entry.ai.dataHash?.startsWith('v2-') &&
                            now - entry.ai.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
          const hasValidGrid = entry.grid && 
                              entry.grid.dataHash?.startsWith('v2-') &&
                              now - entry.grid.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
          const hasValidManual = entry.manual && 
                                entry.manual.dataHash?.startsWith('v2-') &&
                                now - entry.manual.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
          
          if (hasValidAI || hasValidGrid || hasValidManual) {
            if (!filteredCache[sku]) filteredCache[sku] = {};
            filteredCache[sku][modelId] = {};
            
            if (hasValidAI) {
              filteredCache[sku][modelId].ai = entry.ai;
            }
            if (hasValidGrid) {
              filteredCache[sku][modelId].grid = entry.grid;
            }
            if (hasValidManual) {
              filteredCache[sku][modelId].manual = entry.manual;
            }
            filteredCache[sku][modelId].selected = entry.selected;
          }
        }
      });
    });
    
    return filteredCache;
  } catch (error) {
    console.error('Cache loading error:', error);
    return {};
  }
};

export const saveCacheToStorage = (cache: OptimizationCache): void => {
  if (Object.keys(cache).length > 0) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.error('Cache saving error:', error);
    }
  }
};

export const clearCacheStorage = (): void => {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    // Silent error handling
  }
};

export { CACHE_EXPIRY_HOURS };
