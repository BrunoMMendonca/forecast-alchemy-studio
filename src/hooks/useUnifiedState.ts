import { useState, useCallback } from 'react';
import { NormalizedSalesData, ForecastResult } from '@/types/forecast';
import { ModelConfig } from '@/types/forecast';
import { BusinessContext } from '@/types/businessContext';

interface UnifiedState {
  // Data state
  salesData: NormalizedSalesData[];
  cleanedData: NormalizedSalesData[];
  forecastResults: ForecastResult[];

  // UI state
  currentStep: number;
  settingsOpen: boolean;
  isQueuePopupOpen: boolean;

  // SKU state
  selectedSKU: string;

  // Model state
  models: ModelConfig[];

  // Settings state
  forecastPeriods: number;
  businessContext: BusinessContext;

  // Error state
  aiError: string | null;
}

const DEFAULT_STATE: UnifiedState = {
  salesData: [],
  cleanedData: [],
  forecastResults: [],
  currentStep: 0,
  settingsOpen: false,
  isQueuePopupOpen: false,
  selectedSKU: '',
  models: [], // Start empty, will be set by fetch
  forecastPeriods: 12,
  businessContext: {
    costOfError: 'medium',
    planningPurpose: 'tactical',
    updateFrequency: 'weekly',
    interpretabilityNeeds: 'medium'
  },
  aiError: null
};

export const useUnifiedState = () => {
  const [state, setState] = useState<UnifiedState>(DEFAULT_STATE);

  // State update helpers
  const updateState = useCallback((updates: Partial<UnifiedState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Data management
  const setSalesData = useCallback((data: NormalizedSalesData[]) => {
    updateState({ salesData: data });
  }, [updateState]);

  const setCleanedData = useCallback((data: NormalizedSalesData[]) => {
    updateState({ cleanedData: data });
  }, [updateState]);

  const setForecastResults = useCallback((results: ForecastResult[]) => {
    updateState({ forecastResults: results });
  }, [updateState]);

  // UI state management
  const setCurrentStep = useCallback((step: number) => {
    updateState({ currentStep: step });
  }, [updateState]);

  const setSettingsOpen = useCallback((open: boolean) => {
    updateState({ settingsOpen: open });
  }, [updateState]);

  const setIsQueuePopupOpen = useCallback((open: boolean) => {
    updateState({ isQueuePopupOpen: open });
  }, [updateState]);

  // SKU management
  const setSelectedSKU = useCallback((sku: string) => {
    updateState({ selectedSKU: sku });
  }, [updateState]);

  // Model management
  const setModels = useCallback((models: ModelConfig[]) => {
    console.log('[useUnifiedState] setModels called with:', models);
    updateState({ models });
  }, [updateState]);

  const updateModel = useCallback((modelId: string, updates: Partial<ModelConfig>) => {
    setState(prev => {
      const before = prev.models.find(model => model.id === modelId);
      const after = before ? { ...before, ...updates, isWinner: updates.isWinner ?? before.isWinner } : undefined;
      return {
        ...prev,
        models: prev.models.map(model =>
          model.id === modelId ? { ...model, ...updates, isWinner: updates.isWinner ?? model.isWinner } : model
        )
      };
    });
  }, []);

  // Settings management
  const setForecastPeriods = useCallback((periods: number) => {
    updateState({ forecastPeriods: periods });
  }, [updateState]);

  const setBusinessContext = useCallback((context: BusinessContext) => {
    updateState({ businessContext: context });
  }, [updateState]);

  // Error management
  const setAiError = useCallback((error: string | null) => {
    updateState({ aiError: error });
  }, [updateState]);

  return {
    // State
    ...state,
    
    // Data management
    setSalesData,
    setCleanedData,
    setForecastResults,
    
    // UI state management
    setCurrentStep,
    setSettingsOpen,
    setIsQueuePopupOpen,
    
    // SKU management
    setSelectedSKU,
    
    // Model management
    setModels,
    updateModel,
    
    // Settings management
    setForecastPeriods,
    setBusinessContext,

    // Error management
    setAiError,

    // State update helper
    updateState,
    storageAvailable: true // Always true since we're not using persistent storage
  };
};