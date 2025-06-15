import { NormalizedSalesData } from '@/pages/Index';
import { ModelConfig } from '@/types/forecast';
import { OptimizationCache, CACHE_EXPIRY_HOURS } from '@/utils/cacheStorageUtils';

export const generateDataHash = (skuData: NormalizedSalesData[]): string => {
  if (!skuData || skuData.length === 0) return 'v2-0-empty';
  
  const sorted = [...skuData].sort((a, b) => a['Date'].localeCompare(b['Date']));
  const dataPoints = sorted.map(d => {
    const sales = Math.round((d['Sales'] as number) * 1000) / 1000;
    const outlier = d.isOutlier ? '1' : '0';
    const note = d.note ? '1' : '0';
    return `${d['Date']}:${sales}:${outlier}:${note}`;
  });
  
  return `v2-${sorted.length}-${dataPoints.join('|')}`;
};

export const getBestAvailableMethod = (
  sku: string, 
  modelId: string, 
  currentDataHash: string,
  cache: OptimizationCache
): 'ai' | 'grid' | 'manual' => {
  const cached = cache[sku]?.[modelId];
  if (!cached) return 'manual';

  const hasValidAI = cached.ai && cached.ai.dataHash === currentDataHash;
  const hasValidGrid = cached.grid && cached.grid.dataHash === currentDataHash;

  if (hasValidAI) return 'ai';
  if (hasValidGrid) return 'grid';
  return 'manual';
};

export const getParameterValue = (
  parameter: string,
  model: ModelConfig,
  isManual: boolean
): number | undefined => {
  if (isManual) {
    return model.parameters?.[parameter];
  } else {
    const optimizedValue = model.optimizedParameters?.[parameter];
    const modelValue = model.parameters?.[parameter];
    return optimizedValue !== undefined ? optimizedValue : modelValue;
  }
};

export const isCacheValid = (
  sku: string, 
  modelId: string, 
  currentDataHash: string, 
  cache: OptimizationCache,
  method?: 'ai' | 'grid' | 'manual'
): boolean => {
  const cached = cache[sku]?.[modelId];
  if (!cached) return false;

  const now = Date.now();
  const isExpired = (entry: any) => 
    now - entry.timestamp > CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
  
  const isValidEntry = (entry: any) => 
    entry && entry.dataHash?.startsWith('v2-') && !isExpired(entry) && entry.dataHash === currentDataHash;

  if (method) {
    return isValidEntry(cached[method]);
  }

  const selectedMethod = cached.selected || 'ai';
  let result = cached[selectedMethod];
  
  if (!isValidEntry(result)) {
    result = cached.ai || cached.grid || cached.manual;
  }
  
  return isValidEntry(result);
};
