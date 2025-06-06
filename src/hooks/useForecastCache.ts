import { useState, useCallback, useEffect } from 'react';
import { ForecastResult } from '@/types/forecast';

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
const CACHE_EXPIRY_HOURS = 2; // Shorter expiry for forecast results

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
          Object.keys(parsedCache[sku]).forEach(model => {
            const entry = parsedCache[sku][model];
            if (now - entry.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000) {
              if (!filteredCache[sku]) filteredCache[sku] = {};
              filteredCache[sku][model] = entry;
            }
          });
        });
        
        setForecastCache(filteredCache);
      }
    } catch (error) {
      // Silent error handling
    }
  }, []);

  // Save cache to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(FORECAST_CACHE_KEY, JSON.stringify(forecastCache));
    } catch (error) {
      // Silent error handling
    }
  }, [forecastCache]);

  const generateParametersHash = useCallback((
    parameters: Record<string, number> | undefined,
    optimizedParameters: Record<string, number> | undefined
  ): string => {
    const effectiveParams = optimizedParameters || parameters || {};
    return btoa(JSON.stringify(effectiveParams)).substring(0, 16);
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
      return cached.result;
    }
    
    return null;
  }, [forecastCache]);

  const setCachedForecast = useCallback((
    result: ForecastResult,
    parametersHash: string,
    forecastPeriods: number
  ) => {
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
    clearForecastCacheForSKU
  };
};
