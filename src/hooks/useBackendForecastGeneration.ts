import { useCallback, useEffect, useRef } from 'react';
import { ForecastResult } from '@/types/forecast';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/types/forecast';
import { generateForecasts } from '@/services/forecastService';
import { useToast } from '@/hooks/use-toast';

interface UseBackendForecastGenerationProps {
  selectedSKU: string;
  data: SalesData[];
  models: ModelConfig[];
  forecastPeriods: number;
  setForecastResults: (results: ForecastResult[]) => void;
  // Trigger forecast generation when these change
  optimizationResults?: any[];
  hasCompletedJobs?: boolean;
  isOptimizing?: boolean;
}

export const useBackendForecastGeneration = ({
  selectedSKU,
  data,
  models,
  forecastPeriods,
  setForecastResults,
  optimizationResults,
  hasCompletedJobs,
  isOptimizing
}: UseBackendForecastGenerationProps) => {
  const { toast } = useToast();
  const isGeneratingRef = useRef(false);
  const lastGenerationHashRef = useRef<string>('');

  // Create a hash of the current state to prevent unnecessary regenerations
  const stateHash = JSON.stringify({
    selectedSKU,
    models: models.filter(m => m.enabled).map(m => ({ id: m.id, enabled: m.enabled, parameters: m.parameters })),
    forecastPeriods,
    hasCompletedJobs,
    isOptimizing
  });

  const generateForecastsFromBackend = useCallback(async () => {
    if (!selectedSKU || !data.length || isGeneratingRef.current) {
      return;
    }

    const enabledModels = models.filter(m => m.enabled);
    console.log('Enabled models:', enabledModels);
    if (enabledModels.length === 0) {
      setForecastResults([]);
      return;
    }

    // Check if we've already generated for this exact state
    if (lastGenerationHashRef.current === stateHash) {
      return;
    }

    try {
      isGeneratingRef.current = true;
      lastGenerationHashRef.current = stateHash;

      console.log('generateForecastsFromBackend called', { selectedSKU, dataLength: data.length, modelsLength: models.length });
      
      // 1. Filter to only enabled models and use optimization results
      const enabledModelsFiltered = models
        .filter(m => m.enabled)
        .map(m => {
          // Use the best parameters from optimization results
          let parameters = m.parameters;
          let method = 'manual';
          
          // Check if we have optimization results for this model
          if (optimizationResults && optimizationResults.length > 0) {
            const modelResult = optimizationResults.find(r => r.modelType === m.id);
            if (modelResult && modelResult.methods.length > 0) {
              // Find the best method result (highest composite score)
              const bestMethodResult = modelResult.methods.reduce((best, current) => {
                const bestScore = best.bestResult?.compositeScore || 0;
                const currentScore = current.bestResult?.compositeScore || 0;
                return currentScore > bestScore ? current : best;
              });
              
              if (bestMethodResult.bestResult?.parameters) {
                parameters = bestMethodResult.bestResult.parameters;
                method = bestMethodResult.method;
              }
            }
          } else {
            // Fallback to current model parameters
            if (m.optimizationMethod === 'manual' && m.manualParameters) {
              parameters = m.manualParameters;
              method = 'manual';
            } else if (m.optimizationMethod === 'grid' && m.gridParameters) {
              parameters = m.gridParameters;
              method = 'grid';
            } else if (m.optimizationMethod === 'ai' && m.aiParameters) {
              parameters = m.aiParameters;
              method = 'ai';
            }
          }
          
          return {
            ...m,
            parameters, // explicitly set the parameters to use
            method, // include the method for the backend
          };
        });

      console.log('Forecast request payload:', {
        sku: selectedSKU,
        data,
        models: enabledModelsFiltered,
        forecastPeriods
      });

      // 3. Send only enabled models with current parameters
      const results = await generateForecasts({
        sku: selectedSKU,
        data,
        models: enabledModelsFiltered,
        forecastPeriods
      });

      console.log('[Backend Forecast] Generated', results.length, 'forecast results');
      setForecastResults(results);

    } catch (error) {
      console.error('[Backend Forecast] Generation failed:', error);
      toast({
        title: "Forecast Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate forecasts from backend",
        variant: "destructive",
      });
      setForecastResults([]);
    } finally {
      isGeneratingRef.current = false;
    }
  }, [selectedSKU, data, models, forecastPeriods, setForecastResults, stateHash, toast, optimizationResults]);

  // Auto-generate forecasts when:
  // 1. Optimization jobs complete
  // 2. Models change
  // 3. SKU changes
  // 4. Forecast periods change
  useEffect(() => {
    if (hasCompletedJobs && !isOptimizing) {
      // Small delay to ensure optimization results are fully processed
      const timer = setTimeout(() => {
        generateForecastsFromBackend();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [hasCompletedJobs, isOptimizing, generateForecastsFromBackend]);

  // Also generate when models or other dependencies change (but not during optimization)
  useEffect(() => {
    if (!isOptimizing) {
      generateForecastsFromBackend();
    }
  }, [selectedSKU, models, forecastPeriods, isOptimizing, generateForecastsFromBackend]);

  return {
    generateForecasts: generateForecastsFromBackend,
    isGenerating: isGeneratingRef.current
  };
}; 