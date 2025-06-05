
import { useCallback } from 'react';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';
import { useManualAIPreferences } from '@/hooks/useManualAIPreferences';
import { getDefaultModels } from '@/utils/modelConfig';

export const useModelPreferences = (selectedSKU: string, data: SalesData[]) => {
  const { 
    generateDataHash, 
    getCachedParameters, 
    isCacheValid
  } = useOptimizationCache();
  const { loadManualAIPreferences } = useManualAIPreferences();

  const createModelsWithPreferences = useCallback((): ModelConfig[] => {
    console.log('🏗️ CREATING MODELS WITH AI-DEFAULT for SKU:', selectedSKU);
    
    const defaultModels = getDefaultModels();
    
    if (!selectedSKU || data.length === 0) {
      console.log('❌ No SKU or data, using defaults');
      return defaultModels;
    }

    try {
      const preferences = loadManualAIPreferences();
      const skuData = data.filter(d => d.sku === selectedSKU);
      const currentDataHash = generateDataHash(skuData);
      
      console.log(`📋 Creating models with AI-default preferences for ${selectedSKU}:`, preferences);
      
      return defaultModels.map(model => {
        const preferenceKey = `${selectedSKU}:${model.id}`;
        const preference = preferences[preferenceKey];
        
        console.log(`🔍 ${preferenceKey}: preference=${preference}`);
        
        // If explicitly set to manual (false), return manual mode
        if (preference === false) {
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
        
        // For AI (true) or Grid ('grid') preferences, try to get cached results
        let cached = null;
        if (preference === 'grid') {
          cached = getCachedParameters(selectedSKU, model.id, 'grid');
          console.log(`🔍 Grid preference for ${preferenceKey}:`, !!cached);
        } else {
          // Default to AI or explicit AI preference
          cached = getCachedParameters(selectedSKU, model.id, 'ai') || 
                   getCachedParameters(selectedSKU, model.id, 'grid');
          console.log(`🤖 AI preference (default) for ${preferenceKey}:`, !!cached);
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
          // If we have AI/Grid preference but no valid cache, show placeholder state
          if (preference === true || preference === 'grid' || preference === undefined) {
            const methodType = preference === 'grid' ? 'Grid' : 'AI';
            console.log(`🛠️ ${methodType} preference for ${preferenceKey} but no valid cache, showing placeholder`);
            return {
              ...model,
              optimizedParameters: undefined,
              optimizationConfidence: undefined,
              optimizationReasoning: `${methodType} optimization in progress...`,
              optimizationFactors: undefined,
              expectedAccuracy: undefined,
              optimizationMethod: preference === 'grid' ? 'grid_search' : 'ai_optimization'
            };
          } else {
            console.log(`🛠️ No valid cache for ${preferenceKey}, using manual`);
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
        }
      });
    } catch (error) {
      console.error('❌ Error creating models with AI-default:', error);
      return defaultModels;
    }
  }, [selectedSKU, data, loadManualAIPreferences, generateDataHash, getCachedParameters, isCacheValid]);

  return {
    createModelsWithPreferences
  };
};
