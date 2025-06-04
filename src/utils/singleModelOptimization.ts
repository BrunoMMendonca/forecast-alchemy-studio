import { ModelConfig } from '@/types/forecast';
import { useParameterOptimization } from '@/hooks/useParameterOptimization';
import { optimizeParametersLocally } from '@/utils/localOptimization';
import { validateOptimizedParameters } from '@/utils/enhancedValidation';
import { calculateMAPE, calculateAccuracy } from '@/utils/accuracyUtils';
import { optimizationLogger } from '@/utils/optimizationLogger';
import { SalesData } from '@/types/sales';

interface OptimizationContext {
  setProgress: (progress: (prev: any) => any) => void;
}

export const optimizeSingleModel = async (
  model: ModelConfig,
  skuData: SalesData[],
  sku: string,
  { setProgress }: OptimizationContext
): Promise<{ parameters: Record<string, number>; confidence?: number; method: string } | null> => {
  const { optimizeModelParameters } = useParameterOptimization();
  const initialParameters = model.parameters || {};

  // 1. Attempt Enhanced AI Optimization (Grok API)
  try {
    setProgress(prev => prev ? { ...prev, currentModel: `${model.name} (AI)` } : null);
    optimizationLogger.log(`[${sku}:${model.name}] Attempting enhanced AI optimization...`);

    const optimizedParams = await optimizeModelParameters(model, skuData, { seasonalPeriod: 12 });

    if (optimizedParams) {
      const validationResult = validateOptimizedParameters(skuData, initialParameters, optimizedParams, model.id);
      const initialMAPE = calculateMAPE(skuData.map(d => d.sales), model.id, initialParameters);
      const optimizedMAPE = calculateMAPE(skuData.map(d => d.sales), model.id, optimizedParams);
      const initialAccuracy = calculateAccuracy(skuData.map(d => d.sales), model.id, initialParameters);
      const optimizedAccuracy = calculateAccuracy(skuData.map(d => d.sales), model.id, optimizedParams);

      optimizationLogger.log(`[${sku}:${model.name}] AI Optimization Results:`);
      optimizationLogger.log(`  - Initial MAPE: ${initialMAPE.toFixed(2)}%, Accuracy: ${initialAccuracy.toFixed(2)}%`);
      optimizationLogger.log(`  - Optimized MAPE: ${optimizedMAPE.toFixed(2)}%, Accuracy: ${optimizedAccuracy.toFixed(2)}%`);
      optimizationLogger.log(`  - Validation: ${validationResult.message}`);

      if (optimizedAccuracy > initialAccuracy * 1.01) {
        optimizationLogger.log(`[${sku}:${model.name}] AI Optimization: ✅ ACCEPTED (Accuracy improved by >1%)`);
        return { 
          parameters: optimizedParams, 
          confidence: optimizedAccuracy, 
          method: 'ai_confidence' 
        };
      } else if (validationResult.isValid && optimizedMAPE < initialMAPE * 1.1) {
        optimizationLogger.log(`[${sku}:${model.name}] AI Optimization: ✅ ACCEPTED (Within tolerance)`);
        return { 
          parameters: optimizedParams, 
          confidence: optimizedAccuracy,
          method: 'ai_tolerance'
        };
      } else {
        optimizationLogger.log(`[${sku}:${model.name}] AI Optimization: ❌ REJECTED (No significant improvement)`);
        optimizationLogger.log(`  - Initial parameters retained`);
        optimizationLogger.log(`  - Reason: ${validationResult.message}`);
        return null;
      }
    } else {
      optimizationLogger.log(`[${sku}:${model.name}] AI Optimization: ❌ SKIPPED (No parameters returned)`);
      return null;
    }
  } catch (aiError) {
    console.error(`AI Optimization failed for ${sku}:${model.name}:`, aiError);
    optimizationLogger.log(`[${sku}:${model.name}] AI Optimization: ❌ FAILED (${(aiError as Error).message})`);
  }

  // 2. Fallback to Local Optimization (Grid Search)
  try {
    setProgress(prev => prev ? { ...prev, currentModel: `${model.name} (Grid)` } : null);
    optimizationLogger.log(`[${sku}:${model.name}] Falling back to local (grid search) optimization...`);

    const localOptimizationResult = await optimizeParametersLocally(model, skuData);

    if (localOptimizationResult) {
      optimizationLogger.log(`[${sku}:${model.name}] Local Optimization: ✅ SUCCESS`);
      return { 
        parameters: localOptimizationResult, 
        method: 'grid_search' 
      };
    } else {
      optimizationLogger.log(`[${sku}:${model.name}] Local Optimization: ❌ FAILED (No parameters found)`);
      return null;
    }
  } catch (localError) {
    console.error(`Local Optimization failed for ${sku}:${model.name}:`, localError);
    optimizationLogger.log(`[${sku}:${model.name}] Local Optimization: ❌ FAILED (${(localError as Error).message})`);
    return null;
  }
};
