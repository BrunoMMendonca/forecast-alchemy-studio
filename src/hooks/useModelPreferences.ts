
import { useCallback } from 'react';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useManualAIPreferences, PreferenceValue } from '@/hooks/useManualAIPreferences';
import { getDefaultModels, hasOptimizableParameters } from '@/utils/modelConfig';

export const useModelPreferences = (selectedSKU: string, data: SalesData[]) => {
  const { 
    generateDataHash, 
    getCachedParameters, 
    isCacheValid
  } = useOptimizationCache();
  const { loadManualAIPreferences } = useManualAIPreferences();

  const createModelsWithPreferences = useCallback((): ModelConfig[] => {
    console.log('🏗️ CREATING MODELS WITH PREFERENCES for SKU:', selectedSKU);
    
    const defaultModels = getDefaultModels();
    
    if (!selectedSKU || data.length === 0) {
      console.log('❌ No SKU or data, using defaults');
      return defaultModels;
    }

    try {
      const preferences = loadManualAIPreferences();
      const skuData = data.filter(d => d.sku === selectedSKU);
      const currentDataHash = generateDataHash(skuData);
      
      console.log(`📋 Creating models with preferences for ${selectedSKU}:`, preferences);
      console.log(`📋 Current data hash: ${currentDataHash.substring(0, 50)}...`);
      
      return defaultModels.map(model => {
        // Skip optimization for models without parameters
        if (!hasOptimizableParameters(model)) {
          console.log(`⏭️ Skipping ${model.id} - no optimizable parameters`);
          return model;
        }

        const preferenceKey = `${selectedSKU}:${model.id}`;
        const preference: PreferenceValue = preferences[preferenceKey] || 'ai'; // Default to AI
        
        console.log(`🔍 ${preferenceKey}: preference=${preference}`);
        
        // Handle manual preference
        if (preference === 'manual') {
          console.log(`👤 Manual preference for ${preferenceKey}`);
          return {
            ...model,
            optimizedParameters: undefined,
            optimizationConfidence: undefined,
            optimizationReasoning: undefined,
            optimizationFactors: undefined,
            expectedAccuracy: undefined,
            optimizationMethod: undefined
          };
        }
        
        // Handle AI and Grid preferences with fallback logic
        let cached = null;
        let actualMethod = preference;
        
        if (preference === 'ai') {
          // Try AI first, fallback to Grid
          cached = getCachedParameters(selectedSKU, model.id, 'ai');
          if (!cached) {
            cached = getCachedParameters(selectedSKU, model.id, 'grid');
            if (cached) {
              actualMethod = 'grid';
              console.log(`🔄 AI->Grid fallback for ${preferenceKey}`);
            }
          }
        } else if (preference === 'grid') {
          cached = getCachedParameters(selectedSKU, model.id, 'grid');
        }
        
        if (cached && isCacheValid(selectedSKU, model.id, currentDataHash)) {
          console.log(`✅ Applying ${cached.method} optimization for ${preferenceKey}`);
          return {
            ...model,
            optimizedParameters: cached.parameters,
            optimizationConfidence: cached.confidence,
            optimizationReasoning: cached.reasoning,
            optimizationFactors: cached.factors,
            expectedAccuracy: cached.expectedAccuracy,
            optimizationMethod: cached.method
          };
        } else {
          // No valid cache found, show appropriate placeholder
          const methodType = actualMethod === 'grid' ? 'Grid' : 'AI';
          console.log(`🛠️ ${methodType} preference for ${preferenceKey} but no valid cache, showing placeholder`);
          return {
            ...model,
            optimizedParameters: undefined,
            optimizationConfidence: undefined,
            optimizationReasoning: `${methodType} optimization pending...`,
            optimizationFactors: undefined,
            expectedAccuracy: undefined,
            optimizationMethod: actualMethod === 'grid' ? 'grid_search' : 'ai_optimization'
          };
        }
      });
    } catch (error) {
      console.error('❌ Error creating models with preferences:', error);
      return defaultModels;
    }
  }, [selectedSKU, data, loadManualAIPreferences, generateDataHash, getCachedParameters, isCacheValid]);

  return {
    createModelsWithPreferences
  };
};
