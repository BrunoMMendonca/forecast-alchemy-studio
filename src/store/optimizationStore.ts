import { create } from 'zustand';
import { SKUModelOptimizationState, OptimizationType, OptimizationStatus, OptimizationResult } from '@/types/optimization';

interface OptimizationStore {
  state: SKUModelOptimizationState;
  setStatus: (sku: string, modelId: string, type: OptimizationType, status: OptimizationStatus) => void;
  setResult: (sku: string, modelId: string, type: OptimizationType, result: OptimizationResult) => void;
  setError: (sku: string, modelId: string, type: OptimizationType, error: string) => void;
  setSelected: (sku: string, modelId: string, type: OptimizationType) => void;
  reset: () => void;
}

export const useOptimizationStore = create<OptimizationStore>((set) => ({
  state: {},
  setStatus: (sku, modelId, type, status) => set((store) => {
    const prev = store.state[sku]?.[modelId]?.[type] || {};
    return {
      state: {
        ...store.state,
        [sku]: {
          ...store.state[sku],
          [modelId]: {
            ...store.state[sku]?.[modelId],
            [type]: { ...prev, status },
          },
        },
      },
    };
  }),
  setResult: (sku, modelId, type, result) => set((store) => {
    return {
      state: {
        ...store.state,
        [sku]: {
          ...store.state[sku],
          [modelId]: {
            ...store.state[sku]?.[modelId],
            [type]: { status: 'done', result },
          },
        },
      },
    };
  }),
  setError: (sku, modelId, type, error) => set((store) => {
    return {
      state: {
        ...store.state,
        [sku]: {
          ...store.state[sku],
          [modelId]: {
            ...store.state[sku]?.[modelId],
            [type]: { status: 'error', error },
          },
        },
      },
    };
  }),
  setSelected: (sku, modelId, type) => set((store) => {
    return {
      state: {
        ...store.state,
        [sku]: {
          ...store.state[sku],
          [modelId]: {
            ...store.state[sku]?.[modelId],
            selected: type,
          },
        },
      },
    };
  }),
  reset: () => set({ state: {} }),
})); 