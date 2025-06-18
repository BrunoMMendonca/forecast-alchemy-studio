import { useState, useCallback, useEffect } from 'react';
import { NormalizedSalesData, ForecastResult } from '@/pages/Index';
import { ModelConfig } from '@/types/forecast';
import { BusinessContext } from '@/types/businessContext';
import { OptimizationQueueItem } from '@/types/optimization';

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

  // Optimization state
  optimizationQueue: {
    items: OptimizationQueueItem[];
    isOptimizing: boolean;
    progress: Record<string, number>;
    paused: boolean;
  };

  // Settings state
  forecastPeriods: number;
  businessContext: BusinessContext;
}

const DEFAULT_STATE: UnifiedState = {
  salesData: [],
  cleanedData: [],
  forecastResults: [],
  currentStep: 0,
  settingsOpen: false,
  isQueuePopupOpen: false,
  selectedSKU: '',
  models: [],
  optimizationQueue: {
    items: [],
    isOptimizing: false,
    progress: {},
    paused: false
  },
  forecastPeriods: 12,
  businessContext: {
    costOfError: 'medium',
    planningPurpose: 'tactical',
    updateFrequency: 'weekly',
    interpretabilityNeeds: 'medium'
  }
};

const STORAGE_KEY = 'forecast_unified_state';

export const useUnifiedState = () => {
  const [state, setState] = useState<UnifiedState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_STATE;
    } catch {
      return DEFAULT_STATE;
    }
  });

  // Save state to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }, [state]);

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
    updateState({ models });
  }, [updateState]);

  const updateModel = useCallback((modelId: string, updates: Partial<ModelConfig>) => {
    setState(prev => ({
      ...prev,
      models: prev.models.map(model =>
        model.id === modelId ? { ...model, ...updates, isWinner: updates.isWinner ?? model.isWinner } : model
      )
    }));
  }, []);

  // Optimization queue management
  const setOptimizationQueue = useCallback((updater: (prev: UnifiedState['optimizationQueue']) => UnifiedState['optimizationQueue']) => {
    setState(prev => ({
      ...prev,
      optimizationQueue: updater(prev.optimizationQueue)
    }));
  }, []);

  const addToQueue = useCallback((items: OptimizationQueueItem[]) => {
    setOptimizationQueue(prev => ({
      ...prev,
      items: [
        ...prev.items,
        ...items.map(item => ({ ...item, timestamp: Date.now() }))
      ]
    }));
  }, [setOptimizationQueue]);

  const removeFromQueue = useCallback((skus: string[]) => {
    setOptimizationQueue(prev => ({
      ...prev,
      items: prev.items.filter(item => !skus.includes(item.sku))
    }));
  }, [setOptimizationQueue]);

  const setOptimizationProgress = useCallback((sku: string, value: number) => {
    setOptimizationQueue(prev => ({
      ...prev,
      progress: { ...prev.progress, [sku]: value }
    }));
  }, [setOptimizationQueue]);

  const setIsOptimizing = useCallback((isOptimizing: boolean) => {
    setOptimizationQueue(prev => ({
      ...prev,
      isOptimizing
    }));
  }, [setOptimizationQueue]);

  // Settings management
  const setForecastPeriods = useCallback((periods: number) => {
    updateState({ forecastPeriods: periods });
  }, [updateState]);

  const setBusinessContext = useCallback((context: BusinessContext) => {
    updateState({ businessContext: context });
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
    
    // Optimization queue management
    setOptimizationQueue,
    addToQueue,
    removeFromQueue,
    setOptimizationProgress,
    setIsOptimizing,
    
    // Settings management
    setForecastPeriods,
    setBusinessContext,

    // State update helper
    updateState
  };
};