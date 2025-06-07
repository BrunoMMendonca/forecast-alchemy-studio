
import { SalesData } from '@/pages/Index';
import { ModelConfig } from '@/types/forecast';
import { hasOptimizableParameters } from '@/utils/modelConfig';
import { OptimizationCache, CACHE_EXPIRY_HOURS } from '@/utils/cacheStorageUtils';
import { generateDataHash, isCacheValid } from '@/utils/cacheUtils';

export const getSKUsNeedingOptimization = (
  data: SalesData[], 
  models: ModelConfig[],
  cache: OptimizationCache
): { sku: string; models: string[] }[] => {
  const enabledModelsWithParams = models.filter(m => 
    m.enabled && hasOptimizableParameters(m)
  );
  
  const skus = Array.from(new Set(data.map(d => d.sku))).sort();
  const result: { sku: string; models: string[] }[] = [];
  
  skus.forEach(sku => {
    const skuData = data.filter(d => d.sku === sku);
    if (skuData.length < 3) return;
    
    const currentDataHash = generateDataHash(skuData);
    
    const modelsNeedingOptimization = enabledModelsWithParams
      .filter(m => {
        const hasValidAI = isCacheValid(sku, m.id, currentDataHash, cache, 'ai');
        const hasValidGrid = isCacheValid(sku, m.id, currentDataHash, cache, 'grid');
        return !hasValidAI || !hasValidGrid;
      })
      .map(m => m.id);
    
    if (modelsNeedingOptimization.length > 0) {
      result.push({ sku, models: modelsNeedingOptimization });
    }
  });
  
  return result;
};

export { isCacheValid };
