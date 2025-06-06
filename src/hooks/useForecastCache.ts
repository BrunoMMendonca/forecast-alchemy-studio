
import { useState, useCallback, useEffect } from 'react';
import { ForecastResult } from '@/pages/Index';

interface CachedForecast {
  result: ForecastResult;
  timestamp: number;
  parametersHash: string;
  forecastPeriods: number;
}

interface ForecastCache {
  [sku: string]: {
    [modelName: string]: CachedForecast;
  };
}

const FORECAST_CACHE_KEY = 'forecast_results_cache';
const CACHE_EXPIRY_HOURS = 2;

export const useForecastCache = () => {
  const [forecastCache, setForecastCache] = useState<ForecastCache>({});

  // Load cache from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FORECAST_CACHE_KEY);
      if (stored) {
        const parsedCache = JSON.parse(stored);
        const now = Date.now();
        const filteredCache: ForecastCache = {};
        
        Object.keys(parsedCache).forEach(sku => {
          Object.keys(parsedCache[sku] || {}).forEach(model => {
            const entry = parsedCache[sku][model];
            if (entry && now - entry.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000) {
              if (!filteredCache[sku]) filteredCache[sku] = {};
              filteredCache[sku][model] = entry;
            }
          });
        });
        
        setForecastCache(filteredCache);
        console.log('📦 FORECAST CACHE: Loaded from localStorage', Object.keys(filteredCache));
      }
    } catch (error) {
      console.error('📦 FORECAST CACHE: Error loading from localStorage', error);
    }
  }, []);

  // Save cache to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(FORECAST_CACHE_KEY, JSON.stringify(forecastCache));
      console.log('💾 FORECAST CACHE: Saved to localStorage', Object.keys(forecastCache));
    } catch (error) {
      console.error('💾 FORECAST CACHE: Error saving to localStorage', error);
    }
  }, [forecastCache]);

  const generateParametersHash = useCallback((
    parameters: Record<string, number> | undefined,
    optimizedParameters: Record<string, number> | undefined
  ): string => {
    const effectiveParams = optimizedParameters || parameters || {};
    const hash = btoa(JSON.stringify(effectiveParams)).substring(0, 16);
    console.log('🔑 FORECAST CACHE: Generated hash', hash, 'for params', effectiveParams);
    return hash;
  }, []);

  const getCachedForecast = useCallback((
    sku: string,
    modelName: string,
    parametersHash: string,
    forecastPeriods: number
  ): ForecastResult | null => {
    const cached = forecastCache[sku]?.[modelName];
    
    if (cached && 
        cached.parametersHash === parametersHash && 
        cached.forecastPeriods === forecastPeriods) {
      console.log('✅ FORECAST CACHE: Hit for', sku, modelName);
      return cached.result;
    }
    
    console.log('❌ FORECAST CACHE: Miss for', sku, modelName);
    return null;
  }, [forecastCache]);

  const setCachedForecast = useCallback((
    result: ForecastResult,
    parametersHash: string,
    forecastPeriods: number
  ) => {
    console.log('💾 FORECAST CACHE: Setting cache for', result.sku, result.model, parametersHash);
    setForecastCache(prev => ({
      ...prev,
      [result.sku]: {
        ...prev[result.sku],
        [result.model]: {
          result,
          timestamp: Date.now(),
          parametersHash,
          forecastPeriods
        }
      }
    }));
  }, []);

  const clearForecastCacheForSKU = useCallback((sku: string) => {
    console.log('🗑️ FORECAST CACHE: Clearing for SKU', sku);
    setForecastCache(prev => {
      const newCache = { ...prev };
      delete newCache[sku];
      return newCache;
    });
  }, []);

  return {
    getCachedForecast,
    setCachedForecast,
    generateParametersHash,
    clearForecastCacheForSKU,
    forecastCache // Expose for debugging
  };
};
