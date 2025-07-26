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

// New structure types
export type ModelMethod = 'grid' | 'ai' | 'manual';

export interface ModelMethodState {
  parameters?: Record<string, any>;
  compositeScore?: number;
  isWinner?: boolean;
}

export interface ModelUIStateV2 extends Partial<Record<ModelMethod, ModelMethodState>> {
  selectedMethod?: ModelMethod;
}

export interface ModelUIStoreV2 {
  modelUIState: {
    [filePath: string]: {
      [uuid: string]: {
        [sku: string]: {
          [modelId: string]: ModelUIStateV2;
        };
      };
    };
  };
  setParameters: (
    filePath: string,
    uuid: string,
    sku: string,
    modelId: string,
    method: ModelMethod,
    params: Partial<ModelMethodState>
  ) => void;
  setSelectedMethod: (
    filePath: string,
    uuid: string,
    sku: string,
    modelId: string,
    method: ModelMethod
  ) => void;
  getModelUIState: (
    filePath: string,
    uuid: string,
    sku: string,
    modelId: string
  ) => ModelUIStateV2 | undefined;
  resetModelUIState: () => void;
  cleanupDuplicateDatasets: () => void;
}

// Call cleanup automatically after any state update that could introduce new filePaths
const autoCleanup = (fn: Function, getFn: () => any) => (...args: any[]) => {
  fn(...args);
  getFn().cleanupDuplicateDatasets();
};

export const useModelUIStore = create<ModelUIStoreV2>((set, get) => ({
  modelUIState: {},
  setParameters: (filePath, uuid, sku, modelId, method, params) => set((store) => {
    if (!filePath || !uuid) {
      console.warn('[Zustand] setParameters called with undefined filePath or uuid. Ignoring.');
      return { modelUIState: store.modelUIState };
    }
    
    // Validate filePath format to prevent "default" or invalid entries
    if (filePath === 'default' || !filePath.includes('Original_CSV_Upload-')) {
      console.warn('[Zustand] setParameters called with invalid filePath:', filePath, '. Ignoring.');
      return { modelUIState: store.modelUIState };
    }
    
    let newModelUIState = {
      ...store.modelUIState,
      [filePath]: {
        ...(store.modelUIState[filePath] || {}),
        [uuid]: {
          ...(store.modelUIState[filePath]?.[uuid] || {}),
          [sku]: {
            ...(store.modelUIState[filePath]?.[uuid]?.[sku] || {}),
            [modelId]: {
              ...(store.modelUIState[filePath]?.[uuid]?.[sku]?.[modelId] || {}),
              [method]: {
                ...((store.modelUIState[filePath]?.[uuid]?.[sku]?.[modelId] || {})[method] || {}),
                ...params,
              },
            },
          },
        },
      },
    };
    // Limit to 5 filePaths (as before)
    const filePathKeys = Object.keys(newModelUIState);
    if (filePathKeys.length > 5) {
      const oldest = filePathKeys[0];
      delete newModelUIState[oldest];
    }
    return { modelUIState: newModelUIState };
  }),
  setSelectedMethod: (filePath, uuid, sku, modelId, method) => set((store) => {
    if (!filePath || !uuid) {
      console.warn('[Zustand] setSelectedMethod called with undefined filePath or uuid. Ignoring.');
      return { modelUIState: store.modelUIState };
    }
    // Validate filePath format to prevent "default" or invalid entries
    if (filePath === 'default' || !filePath.includes('Original_CSV_Upload-')) {
      console.warn('[Zustand] setSelectedMethod called with invalid filePath:', filePath, '. Ignoring.');
      return { modelUIState: store.modelUIState };
    }
    let newModelUIState = {
      ...store.modelUIState,
      [filePath]: {
        ...(store.modelUIState[filePath] || {}),
        [uuid]: {
          ...(store.modelUIState[filePath]?.[uuid] || {}),
          [sku]: {
            ...(store.modelUIState[filePath]?.[uuid]?.[sku] || {}),
            [modelId]: {
              ...(store.modelUIState[filePath]?.[uuid]?.[sku]?.[modelId] || {}),
              selectedMethod: method,
            },
          },
        },
      },
    };
    const filePathKeys = Object.keys(newModelUIState);
    if (filePathKeys.length > 5) {
      const oldest = filePathKeys[0];
      delete newModelUIState[oldest];
    }
    return { modelUIState: newModelUIState };
  }),
  getModelUIState: (filePath, uuid, sku, modelId) => {
    return get().modelUIState[filePath]?.[uuid]?.[sku]?.[modelId];
  },
  resetModelUIState: () => set({ modelUIState: {} }),

  // --- Cleanup utility to remove duplicate dataset entries by hash ---
  cleanupDuplicateDatasets: () => {
    const state = get();
    const filePaths = Object.keys(state.modelUIState);

    // Group by hash (extract from filePath)
    const hashGroups = new Map();
    filePaths.forEach(filePath => {
      const match = filePath.match(/Original_CSV_Upload-\d+-([a-f0-9]{8})-processed\.json/);
      if (match) {
        const hash = match[1];
        if (!hashGroups.has(hash)) {
          hashGroups.set(hash, []);
        }
        hashGroups.get(hash).push(filePath);
      }
    });

    // For each hash group, keep only the oldest filePath (lowest timestamp)
    let newModelUIState = { ...state.modelUIState };
    hashGroups.forEach((paths, hash) => {
      if (paths.length > 1) {
        paths.sort((a, b) => {
          const aMatch = a.match(/Original_CSV_Upload-(\d+)-/);
          const bMatch = b.match(/Original_CSV_Upload-(\d+)-/);
          return (aMatch?.[1] || 0) - (bMatch?.[1] || 0);
        });
        // Keep the oldest, remove the rest
        paths.slice(1).forEach(duplicatePath => {
          delete newModelUIState[duplicatePath];
        });
      }
    });

    set({ modelUIState: newModelUIState });
  }
})); 