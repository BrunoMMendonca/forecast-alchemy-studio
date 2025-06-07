
import { SalesData } from '@/pages/Index';
import { ModelConfig } from '@/types/forecast';
import { OptimizationCache, CACHE_EXPIRY_HOURS } from '@/utils/cacheStorageUtils';

export const generateDataHash = (skuData: SalesData[]): string => {
  if (!skuData || skuData.length === 0) return 'empty';
  
  const sorted = [...skuData].sort((a, b) => a.date.localeCompare(b.date));
  const dataPoints = sorted.map(d => {
    const sales = Math.round(d.sales * 1000) / 1000;
    const outlier = d.isOutlier ? '1' : '0';
    const note = d.note ? '1' : '0';
    return `${d.date}:${sales}:${outlier}:${note}`;
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
  if (!cached) {
    console.log(`🔍 CACHE_UTILS: No cache for ${sku}:${modelId}, defaulting to manual`);
    return 'manual';
  }

  const hasValidAI = cached.ai && cached.ai.dataHash === currentDataHash;
  const hasValidGrid = cached.grid && cached.grid.dataHash === currentDataHash;
  const hasValidManual = cached.manual && cached.manual.dataHash === currentDataHash;

  console.log(`🔍 CACHE_UTILS: Best method analysis for ${sku}:${modelId}:`);
  console.log(`  - Valid AI: ${hasValidAI}`);
  console.log(`  - Valid Grid: ${hasValidGrid}`);
  console.log(`  - Valid Manual: ${hasValidManual}`);

  if (hasValidAI) return 'ai';
  if (hasValidGrid) return 'grid';
  if (hasValidManual) return 'manual';
  return 'manual';
};

export const getParameterValue = (
  parameter: string,
  model: ModelConfig,
  isManual: boolean
): number | undefined => {
  console.log(`🔧 CACHE_UTILS: Getting parameter ${parameter} for model ${model.id} (manual: ${isManual})`);
  
  if (isManual) {
    const modelValue = model.parameters?.[parameter];
    console.log(`🔧 CACHE_UTILS: Manual mode - using model value: ${modelValue}`);
    return modelValue;
  } else {
    const optimizedValue = model.optimizedParameters?.[parameter];
    const modelValue = model.parameters?.[parameter];
    const finalValue = optimizedValue !== undefined ? optimizedValue : modelValue;
    console.log(`🔧 CACHE_UTILS: Optimization mode - optimized: ${optimizedValue}, model: ${modelValue}, final: ${finalValue}`);
    return finalValue;
  }
};

export const getManualParameterValue = (
  sku: string,
  modelId: string,
  parameter: string,
  currentDataHash: string,
  cache: OptimizationCache
): number | undefined => {
  const cached = cache[sku]?.[modelId];
  if (!cached?.manual || cached.manual.dataHash !== currentDataHash) {
    console.log(`🔧 CACHE_UTILS: No valid manual cache for ${sku}:${modelId}:${parameter}`);
    return undefined;
  }
  
  const value = cached.manual.parameters[parameter];
  console.log(`🔧 CACHE_UTILS: Found cached manual value for ${sku}:${modelId}:${parameter}: ${value}`);
  return value;
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
