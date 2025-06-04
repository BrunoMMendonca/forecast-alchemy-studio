import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ForecastResult } from '@/types/sales';

interface CacheEntry {
  modelId: string;
  params: Record<string, number>;
  result: ForecastResult | null;
}

export const useForecastCache = () => {
  const [cache, setCache] = useState<CacheEntry[]>([]);
  const { toast } = useToast();

  const getCachedResult = useCallback(
    (modelId: string, params: Record<string, number>): ForecastResult | null => {
      const cacheEntry = cache.find(
        (entry) =>
          entry.modelId === modelId &&
          JSON.stringify(entry.params) === JSON.stringify(params)
      );
      return cacheEntry ? cacheEntry.result : null;
    },
    [cache]
  );

  const setCachedResult = useCallback(
    (modelId: string, params: Record<string, number>, result: ForecastResult) => {
      setCache((prevCache) => {
        const newCache = [...prevCache];
        const existingIndex = newCache.findIndex(
          (entry) =>
            entry.modelId === modelId &&
            JSON.stringify(entry.params) === JSON.stringify(params)
        );

        if (existingIndex !== -1) {
          newCache[existingIndex] = { modelId, params, result };
        } else {
          newCache.push({ modelId, params, result });
        }

        return newCache;
      });

      toast({
        title: "Cache Updated",
        description: `Forecast for model ${modelId} cached successfully.`,
      });
    },
    [setCache, toast]
  );

  return {
    getCachedResult,
    setCachedResult,
  };
};
