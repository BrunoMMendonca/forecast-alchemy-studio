import { create } from 'zustand';

// Types for forecast data
export interface ForecastPrediction {
  date: string;
  value: number;
  lowerBound?: number;
  upperBound?: number;
}

export interface ForecastParameters {
  [key: string]: string | number | boolean | null | undefined;
}

export interface ForecastPeriod {
  periodId: string;
  periods: number; // e.g., 12 for 12 months
  parameters: ForecastParameters;
  accuracy?: number;
  mape?: number;
  rmse?: number;
  mae?: number;
  generatedAt: string;
  predictions: ForecastPrediction[];
}

export interface ForecastMethod {
  methodId: string;
  methodType: 'grid' | 'ai' | 'manual';
  periods: ForecastPeriod[];
  // Legacy support - will be deprecated
  parameters?: ForecastParameters;
  accuracy?: number;
  mape?: number;
  rmse?: number;
  mae?: number;
  generatedAt?: string;
  forecastPeriods?: number;
  predictions?: ForecastPrediction[];
}

export interface ForecastResult {
  sku: string;
  modelId: string;
  modelName: string;
  datasetId: number;
  companyId: string;
  methods: ForecastMethod[];
  // Legacy support - will be deprecated
  predictions?: ForecastPrediction[];
  parameters?: Record<string, string | number | boolean | null | undefined>;
  accuracy?: number;
  mape?: number;
  rmse?: number;
  mae?: number;
  generatedAt?: string;
  forecastPeriods?: number;
  method?: 'grid' | 'ai' | 'manual';
}

export interface ForecastCache {
  [companyId: string]: {
    [datasetId: number]: {
      [sku: string]: {
        [modelId: string]: ForecastResult;
      };
    };
  };
}

// Pre-caching and performance interfaces
export interface CacheMetadata {
  lastAccessed: number;
  accessCount: number;
  size: number; // Estimated memory usage
  priority: 'high' | 'medium' | 'low';
  isPreloaded: boolean;
}

export interface PreloadStrategy {
  enabled: boolean;
  maxConcurrent: number;
  batchSize: number;
  priorityThreshold: number;
  memoryLimit: number; // MB
}

export interface ForecastStore {
  // State
  forecasts: ForecastCache;
  isLoading: Record<string, boolean>; // Key: `${companyId}-${datasetId}-${sku}-${modelId}`
  errors: Record<string, string>; // Key: `${companyId}-${datasetId}-${sku}-${modelId}`
  
  // Pre-caching and performance
  cacheMetadata: Record<string, CacheMetadata>; // Key: `${companyId}-${datasetId}-${sku}-${modelId}`
  preloadQueue: Array<{ companyId: string; datasetId: number; sku: string; modelId: string; priority: number }>;
  preloadStrategy: PreloadStrategy;
  isPreloading: boolean;
  
  // PostgreSQL sync state
  syncStatus: Record<string, 'pending' | 'syncing' | 'synced' | 'error'>;
  lastSyncTime: Record<string, number>;
  
  // Actions
  setForecast: (companyId: string, datasetId: number, sku: string, modelId: string, forecast: ForecastResult) => void;
  addForecastMethod: (companyId: string, datasetId: number, sku: string, modelId: string, method: ForecastMethod) => void;
  addForecastPeriod: (companyId: string, datasetId: number, sku: string, modelId: string, methodId: string, period: ForecastPeriod) => void;
  updateForecastMethod: (companyId: string, datasetId: number, sku: string, modelId: string, methodId: string, updates: Partial<ForecastMethod>) => void;
  updateForecastPeriod: (companyId: string, datasetId: number, sku: string, modelId: string, methodId: string, periodId: string, updates: Partial<ForecastPeriod>) => void;
  removeForecastMethod: (companyId: string, datasetId: number, sku: string, modelId: string, methodId: string) => void;
  removeForecastPeriod: (companyId: string, datasetId: number, sku: string, modelId: string, methodId: string, periodId: string) => void;
  setLoading: (companyId: string, datasetId: number, sku: string, modelId: string, loading: boolean) => void;
  setError: (companyId: string, datasetId: number, sku: string, modelId: string, error: string) => void;
  clearError: (companyId: string, datasetId: number, sku: string, modelId: string) => void;
  
  // Batch Actions
  setForecastsForMultipleSKUs: (companyId: string, datasetId: number, forecasts: Array<{ sku: string; modelId: string; forecast: ForecastResult }>) => void;
  setLoadingForMultipleSKUs: (companyId: string, datasetId: number, skus: string[], modelIds: string[], loading: boolean) => void;
  setErrorForMultipleSKUs: (companyId: string, datasetId: number, skus: string[], modelIds: string[], error: string) => void;
  
  // Getters
  getForecast: (companyId: string, datasetId: number, sku: string, modelId: string) => ForecastResult | null;
  getForecastMethod: (companyId: string, datasetId: number, sku: string, modelId: string, methodId: string) => ForecastMethod | null;
  getForecastPeriod: (companyId: string, datasetId: number, sku: string, modelId: string, methodId: string, periodId: string) => ForecastPeriod | null;
  getBestForecastMethod: (companyId: string, datasetId: number, sku: string, modelId: string, metric?: 'accuracy' | 'mape' | 'rmse' | 'mae') => ForecastMethod | null;
  getBestForecastPeriod: (companyId: string, datasetId: number, sku: string, modelId: string, methodId: string, metric?: 'accuracy' | 'mape' | 'rmse' | 'mae') => ForecastPeriod | null;
  getIsLoading: (companyId: string, datasetId: number, sku: string, modelId: string) => boolean;
  getError: (companyId: string, datasetId: number, sku: string, modelId: string) => string | null;
  
  // Batch Getters
  getForecastsForSKUs: (companyId: string, datasetId: number, skus: string[], modelIds: string[]) => Array<{ sku: string; modelId: string; forecast: ForecastResult | null }>;
  getLoadingStatusForSKUs: (companyId: string, datasetId: number, skus: string[], modelIds: string[]) => Array<{ sku: string; modelId: string; isLoading: boolean }>;
  getErrorsForSKUs: (companyId: string, datasetId: number, skus: string[], modelIds: string[]) => Array<{ sku: string; modelId: string; error: string | null }>;
  
  // Cache management
  clearForecast: (companyId: string, datasetId: number, sku: string, modelId: string) => void;
  clearForecastsForSku: (companyId: string, datasetId: number, sku: string) => void;
  clearForecastsForDataset: (companyId: string, datasetId: number) => void;
  clearForecastsForCompany: (companyId: string) => void;
  clearAllForecasts: () => void;
  
  // Utility
  hasForecast: (companyId: string, datasetId: number, sku: string, modelId: string) => boolean;
  hasForecastMethod: (companyId: string, datasetId: number, sku: string, modelId: string, methodId: string) => boolean;
  hasForecastPeriod: (companyId: string, datasetId: number, sku: string, modelId: string, methodId: string, periodId: string) => boolean;
  getForecastAge: (companyId: string, datasetId: number, sku: string, modelId: string, methodId?: string, periodId?: string) => number | null; // in milliseconds
  isForecastStale: (companyId: string, datasetId: number, sku: string, modelId: string, maxAgeMs: number, methodId?: string, periodId?: string) => boolean;
  getForecastMethodsCount: (companyId: string, datasetId: number, sku: string, modelId: string) => number;
  getForecastPeriodsCount: (companyId: string, datasetId: number, sku: string, modelId: string, methodId: string) => number;
  
  // Batch Utility
  hasForecastsForSKUs: (companyId: string, datasetId: number, skus: string[], modelIds: string[]) => Array<{ sku: string; modelId: string; hasForecast: boolean }>;
  getStaleForecastsForSKUs: (companyId: string, datasetId: number, skus: string[], modelIds: string[], maxAgeMs: number) => Array<{ sku: string; modelId: string; isStale: boolean }>;
  
  // PostgreSQL Sync Actions
  loadForecastFromDatabase: (companyId: string, datasetId: number, sku: string, modelId: string) => Promise<void>;
  saveForecastToDatabase: (companyId: string, datasetId: number, sku: string, modelId: string, forecast: ForecastResult) => Promise<void>;
  syncForecastToDatabase: (companyId: string, datasetId: number, sku: string, modelId: string) => Promise<void>;
  
  // Pre-caching Actions
  preloadForecasts: (companyId: string, datasetId: number, skus: string[], modelIds: string[], priority?: number) => void;
  updateCacheMetadata: (companyId: string, datasetId: number, sku: string, modelId: string, metadata: Partial<CacheMetadata>) => void;
  cleanupCache: () => void;
  setPreloadStrategy: (strategy: Partial<PreloadStrategy>) => void;
  processPreloadQueue: () => Promise<void>;
}

// Helper function to generate cache keys
const getCacheKey = (companyId: string, datasetId: number, sku: string, modelId: string) => `${companyId}-${datasetId}-${sku}-${modelId}`;

// Helper function to estimate memory usage of a forecast
const estimateForecastSize = (forecast: ForecastResult): number => {
  let size = 0;
  size += JSON.stringify(forecast).length;
  size += forecast.methods.reduce((acc, method) => {
    acc += JSON.stringify(method).length;
    acc += method.periods.reduce((periodAcc, period) => {
      periodAcc += JSON.stringify(period).length;
      return periodAcc;
    }, 0);
    return acc;
  }, 0);
  return size;
};

// API base URL helper
const getApiBaseUrl = () => {
  return import.meta.env.DEV ? 'http://localhost:3001' : '';
};

export const useForecastStore = create<ForecastStore>((set, get) => ({
  // Initial state
  forecasts: {},
  isLoading: {},
  errors: {},
  cacheMetadata: {},
  preloadQueue: [],
  preloadStrategy: {
    enabled: true,
    maxConcurrent: 3,
    batchSize: 10,
    priorityThreshold: 0.5,
    memoryLimit: 50 // 50MB
  },
  isPreloading: false,
  syncStatus: {},
  lastSyncTime: {},

  // Enhanced Actions with PostgreSQL sync
  setForecast: async (companyId, datasetId, sku, modelId, forecast) => {
    const cacheKey = getCacheKey(companyId, datasetId, sku, modelId);
    
    // 1. Update local state immediately (optimistic)
    set((state) => {
      const newForecasts = { ...state.forecasts };
      if (!newForecasts[companyId]) {
        newForecasts[companyId] = {};
      }
      if (!newForecasts[companyId][datasetId]) {
        newForecasts[companyId][datasetId] = {};
      }
      if (!newForecasts[companyId][datasetId][sku]) {
        newForecasts[companyId][datasetId][sku] = {};
      }
      newForecasts[companyId][datasetId][sku][modelId] = forecast;
      
      // Update cache metadata
      const newCacheMetadata = { ...state.cacheMetadata };
      newCacheMetadata[cacheKey] = {
        lastAccessed: Date.now(),
        accessCount: (newCacheMetadata[cacheKey]?.accessCount || 0) + 1,
        size: estimateForecastSize(forecast),
        priority: 'high',
        isPreloaded: false
      };
      
      return {
        forecasts: newForecasts,
        cacheMetadata: newCacheMetadata,
        isLoading: {
          ...state.isLoading,
          [cacheKey]: false
        },
        errors: {
          ...state.errors,
          [cacheKey]: undefined
        }
      };
    });
    
    // 2. Sync to PostgreSQL in background
    try {
      set((state) => ({
        syncStatus: { ...state.syncStatus, [cacheKey]: 'syncing' }
      }));
      
      await get().saveForecastToDatabase(companyId, datasetId, sku, modelId, forecast);
      
      set((state) => ({
        syncStatus: { ...state.syncStatus, [cacheKey]: 'synced' },
        lastSyncTime: { ...state.lastSyncTime, [cacheKey]: Date.now() }
      }));
    } catch (error) {
      console.error('Failed to sync forecast:', error);
      set((state) => ({
        syncStatus: { ...state.syncStatus, [cacheKey]: 'error' },
        errors: { ...state.errors, [cacheKey]: error instanceof Error ? error.message : 'Sync failed' }
      }));
    }
  },

  addForecastMethod: (companyId, datasetId, sku, modelId, method) => set((state) => {
    const newForecasts = { ...state.forecasts };
    if (!newForecasts[companyId]) {
      newForecasts[companyId] = {};
    }
    if (!newForecasts[companyId][datasetId]) {
      newForecasts[companyId][datasetId] = {};
    }
    if (!newForecasts[companyId][datasetId][sku]) {
      newForecasts[companyId][datasetId][sku] = {};
    }
    if (!newForecasts[companyId][datasetId][sku][modelId]) {
      newForecasts[companyId][datasetId][sku][modelId] = {
        sku,
        modelId,
        modelName: '',
        datasetId,
        companyId,
        methods: []
      };
    }
    
    // Add the new method
    newForecasts[companyId][datasetId][sku][modelId].methods.push(method);
    
    return { forecasts: newForecasts };
  }),

  updateForecastMethod: (companyId, datasetId, sku, modelId, methodId, updates) => set((state) => {
    const newForecasts = { ...state.forecasts };
    const forecast = newForecasts[companyId]?.[datasetId]?.[sku]?.[modelId];
    if (forecast) {
      const methodIndex = forecast.methods.findIndex(m => m.methodId === methodId);
      if (methodIndex !== -1) {
        forecast.methods[methodIndex] = { ...forecast.methods[methodIndex], ...updates };
      }
    }
    return { forecasts: newForecasts };
  }),

  removeForecastMethod: (companyId, datasetId, sku, modelId, methodId) => set((state) => {
    const newForecasts = { ...state.forecasts };
    const forecast = newForecasts[companyId]?.[datasetId]?.[sku]?.[modelId];
    if (forecast) {
      forecast.methods = forecast.methods.filter(m => m.methodId !== methodId);
    }
    return { forecasts: newForecasts };
  }),

  addForecastPeriod: (companyId, datasetId, sku, modelId, methodId, period) => set((state) => {
    const newForecasts = { ...state.forecasts };
    const forecast = newForecasts[companyId]?.[datasetId]?.[sku]?.[modelId];
    if (forecast) {
      const method = forecast.methods.find(m => m.methodId === methodId);
      if (method) {
        method.periods.push(period);
      }
    }
    return { forecasts: newForecasts };
  }),

  updateForecastPeriod: (companyId, datasetId, sku, modelId, methodId, periodId, updates) => set((state) => {
    const newForecasts = { ...state.forecasts };
    const forecast = newForecasts[companyId]?.[datasetId]?.[sku]?.[modelId];
    if (forecast) {
      const method = forecast.methods.find(m => m.methodId === methodId);
      if (method) {
        const periodIndex = method.periods.findIndex(p => p.periodId === periodId);
        if (periodIndex !== -1) {
          method.periods[periodIndex] = { ...method.periods[periodIndex], ...updates };
        }
      }
    }
    return { forecasts: newForecasts };
  }),

  removeForecastPeriod: (companyId, datasetId, sku, modelId, methodId, periodId) => set((state) => {
    const newForecasts = { ...state.forecasts };
    const forecast = newForecasts[companyId]?.[datasetId]?.[sku]?.[modelId];
    if (forecast) {
      const method = forecast.methods.find(m => m.methodId === methodId);
      if (method) {
        method.periods = method.periods.filter(p => p.periodId !== periodId);
      }
    }
    return { forecasts: newForecasts };
  }),

  setLoading: (companyId, datasetId, sku, modelId, loading) => set((state) => ({
    isLoading: {
      ...state.isLoading,
      [getCacheKey(companyId, datasetId, sku, modelId)]: loading
    }
  })),

  setError: (companyId, datasetId, sku, modelId, error) => set((state) => ({
    errors: {
      ...state.errors,
      [getCacheKey(companyId, datasetId, sku, modelId)]: error
    },
    isLoading: {
      ...state.isLoading,
      [getCacheKey(companyId, datasetId, sku, modelId)]: false
    }
  })),

  clearError: (companyId, datasetId, sku, modelId) => set((state) => {
    const newErrors = { ...state.errors };
    delete newErrors[getCacheKey(companyId, datasetId, sku, modelId)];
    return { errors: newErrors };
  }),

  // Batch Actions
  setForecastsForMultipleSKUs: (companyId, datasetId, forecasts) => set((state) => {
    const newForecasts = { ...state.forecasts };
    if (!newForecasts[companyId]) {
      newForecasts[companyId] = {};
    }
    if (!newForecasts[companyId][datasetId]) {
      newForecasts[companyId][datasetId] = {};
    }
    
    const newIsLoading = { ...state.isLoading };
    const newErrors = { ...state.errors };
    
    forecasts.forEach(({ sku, modelId, forecast }) => {
      if (!newForecasts[companyId][datasetId][sku]) {
        newForecasts[companyId][datasetId][sku] = {};
      }
      newForecasts[companyId][datasetId][sku][modelId] = forecast;
      
      // Clear loading and error states
      const cacheKey = getCacheKey(companyId, datasetId, sku, modelId);
      newIsLoading[cacheKey] = false;
      delete newErrors[cacheKey];
    });
    
    return {
      forecasts: newForecasts,
      isLoading: newIsLoading,
      errors: newErrors
    };
  }),

  setLoadingForMultipleSKUs: (companyId, datasetId, skus, modelIds, loading) => set((state) => {
    const newIsLoading = { ...state.isLoading };
    
    skus.forEach(sku => {
      modelIds.forEach(modelId => {
        const cacheKey = getCacheKey(companyId, datasetId, sku, modelId);
        newIsLoading[cacheKey] = loading;
      });
    });
    
    return { isLoading: newIsLoading };
  }),

  setErrorForMultipleSKUs: (companyId, datasetId, skus, modelIds, error) => set((state) => {
    const newErrors = { ...state.errors };
    const newIsLoading = { ...state.isLoading };
    
    skus.forEach(sku => {
      modelIds.forEach(modelId => {
        const cacheKey = getCacheKey(companyId, datasetId, sku, modelId);
        newErrors[cacheKey] = error;
        newIsLoading[cacheKey] = false;
      });
    });
    
    return {
      errors: newErrors,
      isLoading: newIsLoading
    };
  }),

  // Getters
  getForecast: (companyId, datasetId, sku, modelId) => {
    const state = get();
    const forecast = state.forecasts[companyId]?.[datasetId]?.[sku]?.[modelId];
    
    // Update cache metadata on access
    if (forecast) {
      const cacheKey = getCacheKey(companyId, datasetId, sku, modelId);
      state.updateCacheMetadata(companyId, datasetId, sku, modelId, {
        lastAccessed: Date.now(),
        accessCount: (state.cacheMetadata[cacheKey]?.accessCount || 0) + 1
      });
    }
    
    return forecast || null;
  },

  getForecastMethod: (companyId, datasetId, sku, modelId, methodId) => {
    const state = get();
    const forecast = state.forecasts[companyId]?.[datasetId]?.[sku]?.[modelId];
    return forecast?.methods.find(m => m.methodId === methodId) || null;
  },

  getForecastPeriod: (companyId, datasetId, sku, modelId, methodId, periodId) => {
    const state = get();
    const forecast = state.forecasts[companyId]?.[datasetId]?.[sku]?.[modelId];
    const method = forecast?.methods.find(m => m.methodId === methodId);
    return method?.periods.find(p => p.periodId === periodId) || null;
  },

  getBestForecastMethod: (companyId, datasetId, sku, modelId, metric = 'accuracy') => {
    const state = get();
    const forecast = state.forecasts[companyId]?.[datasetId]?.[sku]?.[modelId];
    if (!forecast || forecast.methods.length === 0) return null;
    
    return forecast.methods.reduce((best, current) => {
      const bestValue = best[metric];
      const currentValue = current[metric];
      
      if (bestValue === undefined && currentValue !== undefined) return current;
      if (bestValue !== undefined && currentValue === undefined) return best;
      if (bestValue === undefined && currentValue === undefined) return best;
      
      // For accuracy, higher is better; for others, lower is better
      const isBetter = metric === 'accuracy' 
        ? currentValue > bestValue 
        : currentValue < bestValue;
      
      return isBetter ? current : best;
    });
  },

  getBestForecastPeriod: (companyId, datasetId, sku, modelId, methodId, metric = 'accuracy') => {
    const state = get();
    const forecast = state.forecasts[companyId]?.[datasetId]?.[sku]?.[modelId];
    const method = forecast?.methods.find(m => m.methodId === methodId);
    if (!method || method.periods.length === 0) return null;
    return method.periods.reduce((best, current) => {
      const bestValue = best[metric];
      const currentValue = current[metric];
      if (bestValue === undefined && currentValue !== undefined) return current;
      if (bestValue !== undefined && currentValue === undefined) return best;
      if (bestValue === undefined && currentValue === undefined) return best;
      // For accuracy, higher is better; for others, lower is better
      const isBetter = metric === 'accuracy' 
        ? currentValue > bestValue 
        : currentValue < bestValue;
      return isBetter ? current : best;
    });
  },

  // Batch Getters
  getForecastsForSKUs: (companyId, datasetId, skus, modelIds) => {
    const state = get();
    return skus.flatMap(sku => 
      modelIds.map(modelId => ({
        sku,
        modelId,
        forecast: state.forecasts[companyId]?.[datasetId]?.[sku]?.[modelId] || null
      }))
    );
  },

  getLoadingStatusForSKUs: (companyId, datasetId, skus, modelIds) => {
    const state = get();
    return skus.flatMap(sku => 
      modelIds.map(modelId => ({
        sku,
        modelId,
        isLoading: state.isLoading[getCacheKey(companyId, datasetId, sku, modelId)] || false
      }))
    );
  },

  getErrorsForSKUs: (companyId, datasetId, skus, modelIds) => {
    const state = get();
    return skus.flatMap(sku => 
      modelIds.map(modelId => ({
        sku,
        modelId,
        error: state.errors[getCacheKey(companyId, datasetId, sku, modelId)] || null
      }))
    );
  },

  getIsLoading: (companyId, datasetId, sku, modelId) => {
    const state = get();
    return state.isLoading[getCacheKey(companyId, datasetId, sku, modelId)] || false;
  },

  getError: (companyId, datasetId, sku, modelId) => {
    const state = get();
    return state.errors[getCacheKey(companyId, datasetId, sku, modelId)] || null;
  },

  // Cache management
  clearForecast: (companyId, datasetId, sku, modelId) => set((state) => {
    const newForecasts = { ...state.forecasts };
    if (newForecasts[companyId]?.[datasetId]?.[sku]?.[modelId]) {
      delete newForecasts[companyId][datasetId][sku][modelId];
      if (Object.keys(newForecasts[companyId][datasetId][sku]).length === 0) {
        delete newForecasts[companyId][datasetId][sku];
      }
      if (Object.keys(newForecasts[companyId][datasetId]).length === 0) {
        delete newForecasts[companyId][datasetId];
      }
      if (Object.keys(newForecasts[companyId]).length === 0) {
        delete newForecasts[companyId];
      }
    }
    
    const newIsLoading = { ...state.isLoading };
    delete newIsLoading[getCacheKey(companyId, datasetId, sku, modelId)];
    
    const newErrors = { ...state.errors };
    delete newErrors[getCacheKey(companyId, datasetId, sku, modelId)];
    
    return {
      forecasts: newForecasts,
      isLoading: newIsLoading,
      errors: newErrors
    };
  }),

  clearForecastsForSku: (companyId, datasetId, sku) => set((state) => {
    const newForecasts = { ...state.forecasts };
    if (newForecasts[companyId]?.[datasetId]?.[sku]) {
      delete newForecasts[companyId][datasetId][sku];
      if (Object.keys(newForecasts[companyId][datasetId]).length === 0) {
        delete newForecasts[companyId][datasetId];
      }
      if (Object.keys(newForecasts[companyId]).length === 0) {
        delete newForecasts[companyId];
      }
    }
    
    // Clear loading and error states for this SKU
    const newIsLoading = { ...state.isLoading };
    const newErrors = { ...state.errors };
    Object.keys(newIsLoading).forEach(key => {
      if (key.startsWith(`${companyId}-${datasetId}-${sku}-`)) {
        delete newIsLoading[key];
      }
    });
    Object.keys(newErrors).forEach(key => {
      if (key.startsWith(`${companyId}-${datasetId}-${sku}-`)) {
        delete newErrors[key];
      }
    });
    
    return {
      forecasts: newForecasts,
      isLoading: newIsLoading,
      errors: newErrors
    };
  }),

  clearForecastsForDataset: (companyId, datasetId) => set((state) => {
    const newForecasts = { ...state.forecasts };
    if (newForecasts[companyId]?.[datasetId]) {
      delete newForecasts[companyId][datasetId];
      if (Object.keys(newForecasts[companyId]).length === 0) {
        delete newForecasts[companyId];
      }
    }
    
    // Clear loading and error states for this dataset
    const newIsLoading = { ...state.isLoading };
    const newErrors = { ...state.errors };
    Object.keys(newIsLoading).forEach(key => {
      if (key.startsWith(`${companyId}-${datasetId}-`)) {
        delete newIsLoading[key];
      }
    });
    Object.keys(newErrors).forEach(key => {
      if (key.startsWith(`${companyId}-${datasetId}-`)) {
        delete newErrors[key];
      }
    });
    
    return {
      forecasts: newForecasts,
      isLoading: newIsLoading,
      errors: newErrors
    };
  }),

  clearForecastsForCompany: (companyId) => set((state) => {
    const newForecasts = { ...state.forecasts };
    delete newForecasts[companyId];
    
    // Clear loading and error states for this company
    const newIsLoading = { ...state.isLoading };
    const newErrors = { ...state.errors };
    Object.keys(newIsLoading).forEach(key => {
      if (key.startsWith(`${companyId}-`)) {
        delete newIsLoading[key];
      }
    });
    Object.keys(newErrors).forEach(key => {
      if (key.startsWith(`${companyId}-`)) {
        delete newErrors[key];
      }
    });
    
    return {
      forecasts: newForecasts,
      isLoading: newIsLoading,
      errors: newErrors
    };
  }),

  clearAllForecasts: () => set({
    forecasts: {},
    isLoading: {},
    errors: {},
    cacheMetadata: {},
    preloadQueue: []
  }),

  // Utility
  hasForecast: (companyId, datasetId, sku, modelId) => {
    const state = get();
    return !!state.forecasts[companyId]?.[datasetId]?.[sku]?.[modelId];
  },

  hasForecastMethod: (companyId, datasetId, sku, modelId, methodId) => {
    const state = get();
    const forecast = state.forecasts[companyId]?.[datasetId]?.[sku]?.[modelId];
    return !!forecast?.methods.find(m => m.methodId === methodId);
  },

  hasForecastPeriod: (companyId, datasetId, sku, modelId, methodId, periodId) => {
    const state = get();
    const forecast = state.forecasts[companyId]?.[datasetId]?.[sku]?.[modelId];
    const method = forecast?.methods.find(m => m.methodId === methodId);
    return !!method?.periods.find(p => p.periodId === periodId);
  },

  getForecastAge: (companyId, datasetId, sku, modelId, methodId) => {
    const state = get();
    const forecast = state.forecasts[companyId]?.[datasetId]?.[sku]?.[modelId];
    if (!forecast) return null;
    
    if (methodId) {
      const method = forecast.methods.find(m => m.methodId === methodId);
      if (!method) return null;
      const generatedAt = new Date(method.generatedAt).getTime();
      return Date.now() - generatedAt;
    } else {
      // Legacy support - use the top-level generatedAt if available
      if (forecast.generatedAt) {
        const generatedAt = new Date(forecast.generatedAt).getTime();
        return Date.now() - generatedAt;
      }
      // If no top-level generatedAt, use the most recent method
      if (forecast.methods.length > 0) {
        const mostRecent = forecast.methods.reduce((latest, current) => {
          const latestTime = new Date(latest.generatedAt).getTime();
          const currentTime = new Date(current.generatedAt).getTime();
          return currentTime > latestTime ? current : latest;
        });
        const generatedAt = new Date(mostRecent.generatedAt).getTime();
        return Date.now() - generatedAt;
      }
      return null;
    }
  },

  isForecastStale: (companyId, datasetId, sku, modelId, maxAgeMs, methodId) => {
    const age = get().getForecastAge(companyId, datasetId, sku, modelId, methodId);
    return age === null || age > maxAgeMs;
  },

  getForecastMethodsCount: (companyId, datasetId, sku, modelId) => {
    const state = get();
    const forecast = state.forecasts[companyId]?.[datasetId]?.[sku]?.[modelId];
    return forecast?.methods.length || 0;
  },

  getForecastPeriodsCount: (companyId, datasetId, sku, modelId, methodId) => {
    const state = get();
    const forecast = state.forecasts[companyId]?.[datasetId]?.[sku]?.[modelId];
    const method = forecast?.methods.find(m => m.methodId === methodId);
    return method?.periods.length || 0;
  },

  // Batch Utility
  hasForecastsForSKUs: (companyId, datasetId, skus, modelIds) => {
    const state = get();
    return skus.flatMap(sku => 
      modelIds.map(modelId => ({
        sku,
        modelId,
        hasForecast: !!state.forecasts[companyId]?.[datasetId]?.[sku]?.[modelId]
      }))
    );
  },

  getStaleForecastsForSKUs: (companyId, datasetId, skus, modelIds, maxAgeMs) => {
    const state = get();
    return skus.flatMap(sku => 
      modelIds.map(modelId => ({
        sku,
        modelId,
        isStale: state.isForecastStale(companyId, datasetId, sku, modelId, maxAgeMs)
      }))
    );
  },

  // PostgreSQL Sync Actions
  loadForecastFromDatabase: async (companyId, datasetId, sku, modelId) => {
    const cacheKey = getCacheKey(companyId, datasetId, sku, modelId);
    
    try {
      set((state) => ({
        isLoading: { ...state.isLoading, [cacheKey]: true },
        syncStatus: { ...state.syncStatus, [cacheKey]: 'syncing' }
      }));
      
      const response = await fetch(`${getApiBaseUrl()}/api/forecasts?companyId=${companyId}&datasetId=${datasetId}&sku=${sku}&modelId=${modelId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load forecast: ${response.statusText}`);
      }
      
      const forecast = await response.json();
      
      if (forecast) {
        set((state) => {
          const newForecasts = { ...state.forecasts };
          if (!newForecasts[companyId]) {
            newForecasts[companyId] = {};
          }
          if (!newForecasts[companyId][datasetId]) {
            newForecasts[companyId][datasetId] = {};
          }
          if (!newForecasts[companyId][datasetId][sku]) {
            newForecasts[companyId][datasetId][sku] = {};
          }
          newForecasts[companyId][datasetId][sku][modelId] = forecast;
          
          // Update cache metadata
          const newCacheMetadata = { ...state.cacheMetadata };
          newCacheMetadata[cacheKey] = {
            lastAccessed: Date.now(),
            accessCount: 1,
            size: estimateForecastSize(forecast),
            priority: 'medium',
            isPreloaded: false
          };
          
          return {
            forecasts: newForecasts,
            cacheMetadata: newCacheMetadata,
            isLoading: { ...state.isLoading, [cacheKey]: false },
            syncStatus: { ...state.syncStatus, [cacheKey]: 'synced' },
            lastSyncTime: { ...state.lastSyncTime, [cacheKey]: Date.now() }
          };
        });
      }
    } catch (error) {
      console.error('Failed to load forecast from database:', error);
      set((state) => ({
        isLoading: { ...state.isLoading, [cacheKey]: false },
        syncStatus: { ...state.syncStatus, [cacheKey]: 'error' },
        errors: { ...state.errors, [cacheKey]: error instanceof Error ? error.message : 'Load failed' }
      }));
    }
  },

  saveForecastToDatabase: async (companyId, datasetId, sku, modelId, forecast) => {
    const response = await fetch(`${getApiBaseUrl()}/api/forecasts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, datasetId, sku, modelId, forecast })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to save forecast: ${response.statusText}`);
    }
    
    return response.json();
  },

  syncForecastToDatabase: async (companyId, datasetId, sku, modelId) => {
    const forecast = get().getForecast(companyId, datasetId, sku, modelId);
    if (forecast) {
      await get().saveForecastToDatabase(companyId, datasetId, sku, modelId, forecast);
    }
  },

  // Pre-caching Actions
  preloadForecasts: (companyId, datasetId, skus, modelIds, priority = 0.5) => {
    const { preloadStrategy, preloadQueue } = get();
    
    if (!preloadStrategy.enabled) return;
    
    const newQueue = [...preloadQueue];
    
    skus.forEach(sku => {
      modelIds.forEach(modelId => {
        const cacheKey = getCacheKey(companyId, datasetId, sku, modelId);
        const existing = get().getForecast(companyId, datasetId, sku, modelId);
        
        // Only preload if not already cached
        if (!existing) {
          newQueue.push({ companyId, datasetId, sku, modelId, priority });
        }
      });
    });
    
    // Sort by priority (highest first)
    newQueue.sort((a, b) => b.priority - a.priority);
    
    set({ preloadQueue: newQueue });
    
    // Start preloading if not already running
    if (!get().isPreloading) {
      get().processPreloadQueue();
    }
  },

  processPreloadQueue: async () => {
    const { preloadQueue, preloadStrategy } = get();
    
    if (preloadQueue.length === 0) {
      set({ isPreloading: false });
      return;
    }
    
    set({ isPreloading: true });
    
    // Process batch
    const batch = preloadQueue.slice(0, preloadStrategy.batchSize);
    const remaining = preloadQueue.slice(preloadStrategy.batchSize);
    
    set({ preloadQueue: remaining });
    
    // Load forecasts in parallel (with concurrency limit)
    const chunks = [];
    for (let i = 0; i < batch.length; i += preloadStrategy.maxConcurrent) {
      chunks.push(batch.slice(i, i + preloadStrategy.maxConcurrent));
    }
    
    for (const chunk of chunks) {
      await Promise.allSettled(
        chunk.map(({ companyId, datasetId, sku, modelId }) =>
          get().loadForecastFromDatabase(companyId, datasetId, sku, modelId)
        )
      );
    }
    
    // Continue with next batch
    setTimeout(() => get().processPreloadQueue(), 100);
  },

  updateCacheMetadata: (companyId, datasetId, sku, modelId, metadata) => {
    const cacheKey = getCacheKey(companyId, datasetId, sku, modelId);
    set((state) => ({
      cacheMetadata: {
        ...state.cacheMetadata,
        [cacheKey]: {
          ...state.cacheMetadata[cacheKey],
          ...metadata
        }
      }
    }));
  },

  cleanupCache: () => {
    const { cacheMetadata, preloadStrategy } = get();
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    const maxMemory = preloadStrategy.memoryLimit * 1024 * 1024; // Convert to bytes
    
    let totalMemory = 0;
    const entries = Object.entries(cacheMetadata);
    
    // Calculate total memory usage
    entries.forEach(([key, metadata]) => {
      totalMemory += metadata.size;
    });
    
    // If over memory limit, remove low priority items
    if (totalMemory > maxMemory) {
      const sortedEntries = entries.sort((a, b) => {
        const aScore = a[1].accessCount / (now - a[1].lastAccessed);
        const bScore = b[1].accessCount / (now - b[1].lastAccessed);
        return aScore - bScore;
      });
      
      let memoryToFree = totalMemory - maxMemory;
      const keysToRemove: string[] = [];
      
      for (const [key, metadata] of sortedEntries) {
        if (memoryToFree <= 0) break;
        keysToRemove.push(key);
        memoryToFree -= metadata.size;
      }
      
      // Remove from cache
      set((state) => {
        const newForecasts = { ...state.forecasts };
        const newCacheMetadata = { ...state.cacheMetadata };
        
        keysToRemove.forEach(key => {
          const [companyId, datasetIdStr, sku, modelId] = key.split('-');
          const datasetId = parseInt(datasetIdStr, 10);
          if (newForecasts[companyId]?.[datasetId]?.[sku]?.[modelId]) {
            delete newForecasts[companyId][datasetId][sku][modelId];
          }
          delete newCacheMetadata[key];
        });
        
        return {
          forecasts: newForecasts,
          cacheMetadata: newCacheMetadata
        };
      });
    }
  },

  setPreloadStrategy: (strategy) => {
    set((state) => ({
      preloadStrategy: { ...state.preloadStrategy, ...strategy }
    }));
  }
}));

// Export selectors for common use cases
export const useForecastForModel = (companyId: string, datasetId: number, sku: string, modelId: string) => {
  return useForecastStore((state) => ({
    forecast: state.getForecast(companyId, datasetId, sku, modelId),
    isLoading: state.getIsLoading(companyId, datasetId, sku, modelId),
    error: state.getError(companyId, datasetId, sku, modelId),
    hasForecast: state.hasForecast(companyId, datasetId, sku, modelId),
    methodsCount: state.getForecastMethodsCount(companyId, datasetId, sku, modelId)
  }));
};

export const useForecastMethod = (companyId: string, datasetId: number, sku: string, modelId: string, methodId: string) => {
  return useForecastStore((state) => ({
    method: state.getForecastMethod(companyId, datasetId, sku, modelId, methodId),
    hasMethod: state.hasForecastMethod(companyId, datasetId, sku, modelId, methodId)
  }));
};

export const useBestForecastMethod = (companyId: string, datasetId: number, sku: string, modelId: string, metric?: 'accuracy' | 'mape' | 'rmse' | 'mae') => {
  return useForecastStore((state) => state.getBestForecastMethod(companyId, datasetId, sku, modelId, metric));
};

export const useForecastLoading = (companyId: string, datasetId: number, sku: string, modelId: string) => {
  return useForecastStore((state) => state.getIsLoading(companyId, datasetId, sku, modelId));
};

export const useForecastError = (companyId: string, datasetId: number, sku: string, modelId: string) => {
  return useForecastStore((state) => state.getError(companyId, datasetId, sku, modelId));
};

// Batch convenience hooks
export const useForecastsForSKUs = (companyId: string, datasetId: number, skus: string[], modelIds: string[]) => {
  return useForecastStore((state) => state.getForecastsForSKUs(companyId, datasetId, skus, modelIds));
};

export const useLoadingStatusForSKUs = (companyId: string, datasetId: number, skus: string[], modelIds: string[]) => {
  return useForecastStore((state) => state.getLoadingStatusForSKUs(companyId, datasetId, skus, modelIds));
};

export const useErrorsForSKUs = (companyId: string, datasetId: number, skus: string[], modelIds: string[]) => {
  return useForecastStore((state) => state.getErrorsForSKUs(companyId, datasetId, skus, modelIds));
};

export const useForecastStatusForSKUs = (companyId: string, datasetId: number, skus: string[], modelIds: string[]) => {
  return useForecastStore((state) => ({
    forecasts: state.getForecastsForSKUs(companyId, datasetId, skus, modelIds),
    loading: state.getLoadingStatusForSKUs(companyId, datasetId, skus, modelIds),
    errors: state.getErrorsForSKUs(companyId, datasetId, skus, modelIds),
    hasForecasts: state.hasForecastsForSKUs(companyId, datasetId, skus, modelIds)
  }));
}; 