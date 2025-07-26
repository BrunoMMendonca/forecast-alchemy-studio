import { create } from 'zustand';

interface ForecastWizardState {
  currentStep: number;
  optimizationResults: any[];
  selectedModel: string | null;
  parameterAdjustments: any[];
  manualAdjustments: any[];
  aiSuggestions: any[];
  finalizedForecast: any | null;
  
  // Actions
  setCurrentStep: (step: number) => void;
  setOptimizationResults: (results: any[]) => void;
  setSelectedModel: (modelId: string | null) => void;
  addParameterAdjustment: (adjustment: any) => void;
  addManualAdjustment: (adjustment: any) => void;
  addAISuggestion: (suggestion: any) => void;
  setFinalizedForecast: (forecast: any) => void;
  reset: () => void;
  
  // Computed
  isStepComplete: (step: number) => boolean;
}

export const useForecastWizardStore = create<ForecastWizardState>((set, get) => ({
  currentStep: 0,
  optimizationResults: [],
  selectedModel: null,
  parameterAdjustments: [],
  manualAdjustments: [],
  aiSuggestions: [],
  finalizedForecast: null,

  setCurrentStep: (step) => set({ currentStep: step }),
  
  setOptimizationResults: (results) => set({ optimizationResults: results }),
  
  setSelectedModel: (modelId) => set({ selectedModel: modelId }),
  
  addParameterAdjustment: (adjustment) => set((state) => ({
    parameterAdjustments: [...state.parameterAdjustments, adjustment]
  })),
  
  addManualAdjustment: (adjustment) => set((state) => ({
    manualAdjustments: [...state.manualAdjustments, adjustment]
  })),
  
  addAISuggestion: (suggestion) => set((state) => ({
    aiSuggestions: [...state.aiSuggestions, suggestion]
  })),
  
  setFinalizedForecast: (forecast) => set({ finalizedForecast: forecast }),
  
  reset: () => set({
    currentStep: 0,
    optimizationResults: [],
    selectedModel: null,
    parameterAdjustments: [],
    manualAdjustments: [],
    aiSuggestions: [],
    finalizedForecast: null,
  }),

  isStepComplete: (step) => {
    const state = get();
    
    switch (step) {
      case 0: // Review & Tune
        // Step is complete if we have optimization results
        return state.optimizationResults.length > 0;
      
      case 1: // Finalize Forecast
        // Step is complete if we have a finalized forecast
        return state.finalizedForecast !== null;
      
      default:
        return false;
    }
  },
})); 