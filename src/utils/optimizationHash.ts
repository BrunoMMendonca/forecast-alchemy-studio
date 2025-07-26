import { GlobalSettings } from '@/types/globalSettings';
import { sha256 } from 'js-sha256';

/**
 * Generate optimization hash for job deduplication
 * This function should match the backend implementation exactly
 */
export function generateOptimizationHash(
  sku: string,
  modelId: string,
  method: string,
  filePath: string,
  parameters: Record<string, any> = {},
  metricWeights: Record<string, number> | null = null
): string {
  // Get default metric weights if not provided
  if (!metricWeights) {
    metricWeights = { mape: 0.4, rmse: 0.3, mae: 0.2, accuracy: 0.1 };
  }
  
  // Create hash input object
  // Note: seasonalPeriod is already included in parameters for seasonal models
  const hashInput = {
    sku,
    modelId,
    method,
    dataHash: filePath, // Using filePath as data identifier
    parameters: parameters || {},
    metricWeights
  };
  
  // Generate SHA-256 hash using js-sha256
  return sha256(JSON.stringify(hashInput));
}

/**
 * Generate metric weights object from GlobalSettings
 */
export function getMetricWeightsFromSettings(settings: GlobalSettings): Record<string, number> {
  return {
    mape: (settings.mapeWeight ?? 40) / 100,
    rmse: (settings.rmseWeight ?? 30) / 100,
    mae: (settings.maeWeight ?? 20) / 100,
    accuracy: (settings.accuracyWeight ?? 10) / 100
  };
} 