
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
      selected?: 'ai' | 'grid' | 'manual';
    };
  };
}

export const loadCacheFromStorage = (): OptimizationCache => {
  console.log('🗄️ CACHE: Loading from localStorage...');
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) {
      console.log('🗄️ CACHE: No stored cache found');
      return {};
    }

    const parsedCache = JSON.parse(stored);
    console.log('🗄️ CACHE: Found stored cache with', Object.keys(parsedCache).length, 'SKUs');
    const now = Date.now();
    const filteredCache: OptimizationCache = {};
    
    Object.keys(parsedCache).forEach(sku => {
      Object.keys(parsedCache[sku]).forEach(modelId => {
        const entry = parsedCache[sku][modelId];
        
        // Handle both old and new cache structures
        if (entry.parameters) {
          const method = entry.method?.startsWith('ai_') ? 'ai' : 
                       entry.method === 'grid_search' ? 'grid' : 'ai';
          
          // Skip entries that don't have the new hash format (v2-)
          if (!entry.dataHash?.startsWith('v2-')) {
            console.log(`🗄️ CACHE: Skipping old format entry ${sku}:${modelId}:${method}`);
            return;
          }
          
          if (now - entry.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000) {
            if (!filteredCache[sku]) filteredCache[sku] = {};
            if (!filteredCache[sku][modelId]) filteredCache[sku][modelId] = {};
            
            filteredCache[sku][modelId][method] = entry;
            filteredCache[sku][modelId].selected = method;
            console.log(`🗄️ CACHE: Loaded ${sku}:${modelId}:${method}`);
          } else {
            console.log(`🗄️ CACHE: Expired ${sku}:${modelId}:${method}`);
          }
        } else {
          // Handle new cache structure
          const hasValidAI = entry.ai && 
                            entry.ai.dataHash?.startsWith('v2-') &&
                            now - entry.ai.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
          const hasValidGrid = entry.grid && 
                              entry.grid.dataHash?.startsWith('v2-') &&
                              now - entry.grid.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
          
          if (hasValidAI || hasValidGrid) {
            if (!filteredCache[sku]) filteredCache[sku] = {};
            filteredCache[sku][modelId] = {};
            
            if (hasValidAI) {
              filteredCache[sku][modelId].ai = entry.ai;
            }
            if (hasValidGrid) {
              filteredCache[sku][modelId].grid = entry.grid;
            }
            filteredCache[sku][modelId].selected = entry.selected;
            console.log(`🗄️ CACHE: Loaded ${sku}:${modelId} with multiple methods`);
          }
        }
      });
    });
    
    console.log('🗄️ CACHE: Final loaded cache has', Object.keys(filteredCache).length, 'SKUs');
    return filteredCache;
  } catch (error) {
    console.error('🗄️ CACHE: Error loading from localStorage:', error);
    return {};
  }
};

export const saveCacheToStorage = (cache: OptimizationCache): void => {
  if (Object.keys(cache).length > 0) {
    console.log('🗄️ CACHE: Saving to localStorage with', Object.keys(cache).length, 'SKUs');
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      console.log('🗄️ CACHE: Successfully saved to localStorage');
    } catch (error) {
      console.error('🗄️ CACHE: Error saving to localStorage:', error);
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
