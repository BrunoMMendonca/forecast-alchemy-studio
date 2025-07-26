import { create } from 'zustand';
import { ForecastResult } from '@/types/forecast';

type Method = 'manual' | 'grid' | 'ai';

interface PendingForecast {
  filePath: string;
  sku: string;
  modelId: string;
  method: Method;
  parameters: Record<string, any>;
  optimizationId?: string;
}

interface ForecastResultsStore {
  results: {
    [filePath: string]: {
      [sku: string]: {
        [modelId: string]: {
          [method in Method]?: ForecastResult;
        };
      };
    };
  };
  pending: PendingForecast[];
  optimizationCompleted: {
    [filePath: string]: {
      [sku: string]: boolean;
    };
  };
  setResult: (filePath: string, sku: string, modelId: string, method: Method, result: ForecastResult, optimizationId?: string) => void;
  getResult: (filePath: string, sku: string, modelId: string, method: Method, optimizationId?: string) => ForecastResult | undefined;
  setOptimizationCompleted: (filePath: string, sku: string, value: boolean) => void;
  getOptimizationCompleted: (filePath: string, sku: string) => boolean;
  clear: (options?: { keepOptimizationCompleted?: boolean }) => void;
  addPending: (item: PendingForecast) => void;
  clearPending: () => void;
  removePending: (filePath: string, sku: string, modelId: string, method: Method, optimizationId?: string) => void;
}

export const useForecastResultsStore = create<ForecastResultsStore>((set, get) => ({
  results: {},
  pending: [],
  optimizationCompleted: {},
  setResult: (filePath, sku, modelId, method, result, optimizationId) =>
    set(state => {
      // Add/update the result
      let newResults = {
        ...state.results,
        [filePath]: {
          ...(state.results[filePath] || {}),
          [sku]: {
            ...(state.results[filePath]?.[sku] || {}),
            [modelId]: {
              ...(state.results[filePath]?.[sku]?.[modelId] || {}),
              [method]: optimizationId ? { ...result, optimizationId } : result,
            },
          },
        },
      };
      // Limit to 5 filePaths
      const filePathKeys = Object.keys(newResults);
      if (filePathKeys.length > 5) {
        const oldest = filePathKeys[0];
        delete newResults[oldest];
      }
      // Also filter pending to only keep items for the 5 most recent filePaths
      const allowedFilePaths = Object.keys(newResults);
      const newPending = state.pending.filter(p => allowedFilePaths.includes(p.filePath));
      return {
        results: newResults,
        pending: newPending,
        optimizationCompleted: { ...state.optimizationCompleted },
      };
    }),
  getResult: (filePath, sku, modelId, method, optimizationId) => {
    // Optionally filter by optimizationId if provided
    const result = get().results[filePath]?.[sku]?.[modelId]?.[method];
    if (!result) return undefined;
    if (optimizationId && result.optimizationId && result.optimizationId !== optimizationId) return undefined;
    return result;
  },
  setOptimizationCompleted: (filePath, sku, value) =>
    set(state => ({
      optimizationCompleted: {
        ...state.optimizationCompleted,
        [filePath]: {
          ...(state.optimizationCompleted[filePath] || {}),
          [sku]: value,
        },
      },
    })),
  getOptimizationCompleted: (filePath, sku) => {
    return !!get().optimizationCompleted[filePath]?.[sku];
  },
  clear: (options) => set(state => {
    if (options && options.keepOptimizationCompleted) {
      return { results: {}, pending: [], optimizationCompleted: { ...state.optimizationCompleted } };
    }
    return { results: {}, pending: [], optimizationCompleted: {} };
  }),
  addPending: (item) =>
    set(state => ({
      pending: state.pending.some(
        p =>
          p.filePath === item.filePath &&
          p.sku === item.sku &&
          p.modelId === item.modelId &&
          p.method === item.method &&
          (!item.optimizationId || p.optimizationId === item.optimizationId)
      )
        ? state.pending
        : [...state.pending, item],
    })),
  clearPending: () => set(state => ({ ...state, pending: [] })),
  removePending: (filePath, sku, modelId, method, optimizationId) =>
    set(state => ({
      pending: state.pending.filter(
        p =>
          !(
            p.filePath === filePath &&
            p.sku === sku &&
            p.modelId === modelId &&
            p.method === method &&
            (!optimizationId || p.optimizationId === optimizationId)
          )
      ),
    })),
})); 