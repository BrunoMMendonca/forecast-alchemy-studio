
import { SalesData } from '@/pages/Index';
import { ModelConfig } from '@/types/forecast';
import { hasOptimizableParameters } from '@/utils/modelConfig';
import { OptimizationCache, CACHE_EXPIRY_HOURS } from '@/utils/cacheStorageUtils';
import { generateDataHash } from '@/utils/cacheHashUtils';

export const getSKUsNeedingOptimization = (
  data: SalesData[], 
  models: ModelConfig[],
  cache: OptimizationCache
): { sku: string; models: string[] }[] => {
  // Only consider models that have optimizable parameters
  const enabledModelsWithParams = models.filter(m => 
    m.enabled && hasOptimizableParameters(m)
  );
  
  console.log('🗄️ CACHE: Models with optimizable parameters:', enabledModelsWithParams.map(m => m.id));
  console.log('🗄️ CACHE: Models without parameters (skipping):', models.filter(m => m.enabled && !hasOptimizableParameters(m)).map(m => m.id));
  
  // If no models have optimizable parameters, return empty array
  if (enabledModelsWithParams.length === 0) {
    console.log('🗄️ CACHE: No models with optimizable parameters found');
    return [];
  }
  
  const skus = Array.from(new Set(data.map(d => d.sku))).sort();
  const result: { sku: string; models: string[] }[] = [];
  
  skus.forEach(sku => {
    const skuData = data.filter(d => d.sku === sku);
    if (skuData.length < 3) {
      console.log(`🗄️ CACHE: SKU ${sku} has insufficient data (${skuData.length} points), skipping`);
      return;
    }
    
    const currentDataHash = generateDataHash(skuData);
    
    const modelsNeedingOptimization = enabledModelsWithParams
      .filter(m => {
        const cached = cache[sku]?.[m.id];
        if (!cached) {
          console.log(`🗄️ CACHE: ${sku}:${m.id} - No cache entry found`);
          return true;
        }

        const hasValidAI = cached.ai && 
                          cached.ai.dataHash === currentDataHash && 
                          (Date.now() - cached.ai.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000);
        const hasValidGrid = cached.grid && 
                            cached.grid.dataHash === currentDataHash && 
                            (Date.now() - cached.grid.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000);
        
        if (!hasValidAI) {
          console.log(`🗄️ CACHE: ${sku}:${m.id} - No valid AI cache`);
        }
        if (!hasValidGrid) {
          console.log(`🗄️ CACHE: ${sku}:${m.id} - No valid Grid cache`);
        }
        
        return !hasValidAI || !hasValidGrid;
      })
      .map(m => m.id);
    
    if (modelsNeedingOptimization.length > 0) {
      result.push({ sku, models: modelsNeedingOptimization });
    }
  });
  
  console.log('🗄️ CACHE: Final SKUs needing optimization:', result);
  return result;
};

export const isCacheValid = (
  sku: string, 
  modelId: string, 
  currentDataHash: string, 
  cache: OptimizationCache,
  method?: 'ai' | 'grid'
): boolean => {
  const cached = cache[sku]?.[modelId];
  if (!cached) {
    console.log(`🗄️ CACHE: Invalid - no cached parameters for ${sku}:${modelId}:${method || 'any'}`);
    return false;
  }

  const now = Date.now();
  const isExpired = (entry: any) => 
    now - entry.timestamp > CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
  
  const isValidEntry = (entry: any) => 
    entry && entry.dataHash?.startsWith('v2-') && !isExpired(entry) && entry.dataHash === currentDataHash;

  if (method) {
    const result = cached[method];
    return isValidEntry(result);
  }

  // Check any available method
  const selectedMethod = cached.selected || 'ai';
  let result = cached[selectedMethod];
  
  if (!isValidEntry(result)) {
    result = cached.ai || cached.grid;
  }
  
  const isValid = isValidEntry(result);
  console.log(`🗄️ CACHE: Hash validation for ${sku}:${modelId}:${method || 'any'}: ${isValid}`);
  return isValid;
};
