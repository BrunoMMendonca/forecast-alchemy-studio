
import { ModelConfig } from '@/types/forecast';
import { useParameterOptimization } from '@/hooks/useParameterOptimization';
import { optimizeParametersLocally } from '@/utils/localOptimization';
import { validateOptimizedParameters } from '@/utils/localOptimization';
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
    console.log(`[${sku}:${model.name}] Attempting enhanced AI optimization...`);

    const optimizedParams = await optimizeModelParameters(model, skuData, { seasonalPeriod: 12 });

    if (optimizedParams) {
      const validationResult = validateOptimizedParameters(model.id, skuData, initialParameters, optimizedParams, 70);
      const initialMAPE = calculateMAPE(skuData.map(d => d.sales), model.id);
      const optimizedMAPE = calculateMAPE(skuData.map(d => d.sales), model.id);
      const initialAccuracy = calculateAccuracy(skuData.map(d => d.sales), model.id);
      const optimizedAccuracy = calculateAccuracy(skuData.map(d => d.sales), model.id);

      console.log(`[${sku}:${model.name}] AI Optimization Results:`);
      console.log(`  - Initial MAPE: ${initialMAPE.toFixed(2)}%, Accuracy: ${initialAccuracy.toFixed(2)}%`);
      console.log(`  - Optimized MAPE: ${optimizedMAPE.toFixed(2)}%, Accuracy: ${optimizedAccuracy.toFixed(2)}%`);
      console.log(`  - Validation: ${validationResult?.method || 'No result'}`);

      if (optimizedAccuracy > initialAccuracy * 1.01) {
        console.log(`[${sku}:${model.name}] AI Optimization: ✅ ACCEPTED (Accuracy improved by >1%)`);
        return { 
          parameters: optimizedParams, 
          confidence: optimizedAccuracy, 
          method: 'ai_confidence' 
        };
      } else if (validationResult && optimizedMAPE < initialMAPE * 1.1) {
        console.log(`[${sku}:${model.name}] AI Optimization: ✅ ACCEPTED (Within tolerance)`);
        return { 
          parameters: optimizedParams, 
          confidence: optimizedAccuracy,
          method: 'ai_tolerance'
        };
      } else {
        console.log(`[${sku}:${model.name}] AI Optimization: ❌ REJECTED (No significant improvement)`);
        console.log(`  - Initial parameters retained`);
        return null;
      }
    } else {
      console.log(`[${sku}:${model.name}] AI Optimization: ❌ SKIPPED (No parameters returned)`);
      return null;
    }
  } catch (aiError) {
    console.error(`AI Optimization failed for ${sku}:${model.name}:`, aiError);
    console.log(`[${sku}:${model.name}] AI Optimization: ❌ FAILED (${(aiError as Error).message})`);
  }

  // 2. Fallback to Local Optimization (Grid Search)
  try {
    setProgress(prev => prev ? { ...prev, currentModel: `${model.name} (Grid)` } : null);
    console.log(`[${sku}:${model.name}] Falling back to local (grid search) optimization...`);

    const localOptimizationResult = await optimizeParametersLocally(model, skuData);

    if (localOptimizationResult) {
      console.log(`[${sku}:${model.name}] Local Optimization: ✅ SUCCESS`);
      return { 
        parameters: localOptimizationResult, 
        method: 'grid_search' 
      };
    } else {
      console.log(`[${sku}:${model.name}] Local Optimization: ❌ FAILED (No parameters found)`);
      return null;
    }
  } catch (localError) {
    console.error(`Local Optimization failed for ${sku}:${model.name}:`, localError);
    console.log(`[${sku}:${model.name}] Local Optimization: ❌ FAILED (${(localError as Error).message})`);
    return null;
  }
};
