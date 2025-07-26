import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TrendLine {
  id: string;
  startIndex: number;
  endIndex: number;
  startValue: number;
  endValue: number;
  startDate: string;
  endDate: string;
  label: string;
  createdAt: string;
  datasetId: number;
  sku: string;
  modelId?: string;
}

interface TrendLinesStore {
  // State
  trendLines: TrendLine[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  addTrendLine: (trendLine: Omit<TrendLine, 'id' | 'createdAt'>) => Promise<void>;
  removeTrendLine: (id: string) => Promise<void>;
  clearTrendLines: (datasetId?: number, sku?: string) => Promise<void>;
  loadTrendLines: (datasetId: number, sku: string) => Promise<void>;
  
  // Smart filtering
  getTrendLinesForChart: (
    datasetId: number, 
    sku: string, 
    chartData: Array<{ date: string; type: 'historical' | 'forecast' }>,
    includeFutureTrendLines?: boolean
  ) => TrendLine[];
  
  // Utility
  isTrendLineHistorical: (trendLine: TrendLine, chartData: Array<{ date: string; type: 'historical' | 'forecast' }>) => boolean;
}

// Get the correct API base URL
const getApiBaseUrl = () => {
  // Check if we're in development mode
  if (import.meta.env.DEV) {
    return 'http://localhost:3001'; // Backend server port
  }
  return ''; // Use relative URLs in production
};

export const useTrendLinesStore = create<TrendLinesStore>()(
  persist(
    (set, get) => ({
      // Initial state
      trendLines: [],
      isLoading: false,
      error: null,

      // Add a new trend line
      addTrendLine: async (trendLineData) => {
        try {
          console.log('[TrendLinesStore] Adding trend line:', trendLineData);
          set({ isLoading: true, error: null });
          
          const newTrendLine: TrendLine = {
            ...trendLineData,
            id: `trend-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date().toISOString(),
          };

          console.log('[TrendLinesStore] New trend line with ID:', newTrendLine.id);

          // Save to backend
          const response = await fetch(`${getApiBaseUrl()}/api/trend-lines`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTrendLine),
          });

          console.log('[TrendLinesStore] Backend response status:', response.status);

          if (!response.ok) {
            const errorText = await response.text();
            console.error('[TrendLinesStore] Backend error:', errorText);
            throw new Error('Failed to save trend line to backend');
          }

          const responseData = await response.json();
          console.log('[TrendLinesStore] Backend response data:', responseData);

          // Update local state
          set(state => ({
            trendLines: [...state.trendLines, newTrendLine],
            isLoading: false,
          }));

          console.log('[TrendLinesStore] Trend line added successfully');
        } catch (error) {
          console.error('[TrendLinesStore] Error adding trend line:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to add trend line',
            isLoading: false 
          });
        }
      },

      // Remove a trend line
      removeTrendLine: async (id: string) => {
        try {
          console.log('[TrendLinesStore] Removing trend line with ID:', id);
          set({ isLoading: true, error: null });
          
          // Delete from backend
          const response = await fetch(`${getApiBaseUrl()}/api/trend-lines/${id}`, {
            method: 'DELETE',
          });

          console.log('[TrendLinesStore] Delete response status:', response.status);

          if (!response.ok) {
            const errorText = await response.text();
            console.error('[TrendLinesStore] Delete error:', errorText);
            throw new Error('Failed to delete trend line from backend');
          }

          const responseData = await response.json();
          console.log('[TrendLinesStore] Delete response data:', responseData);

          // Update local state
          set(state => ({
            trendLines: state.trendLines.filter(tl => tl.id !== id),
            isLoading: false,
          }));

          console.log('[TrendLinesStore] Trend line removed successfully');
        } catch (error) {
          console.error('[TrendLinesStore] Error removing trend line:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to remove trend line',
            isLoading: false 
          });
        }
      },

      // Clear trend lines for a specific file/SKU or all
      clearTrendLines: async (datasetId?: number, sku?: string) => {
        try {
          console.log('[TrendLinesStore] Clearing trend lines for:', { datasetId, sku });
          set({ isLoading: true, error: null });
          
          const params = new URLSearchParams();
          if (datasetId) params.append('datasetId', datasetId.toString());
          if (sku) params.append('sku', sku);

          // Delete from backend
          const response = await fetch(`${getApiBaseUrl()}/api/trend-lines?${params.toString()}`, {
            method: 'DELETE',
          });

          console.log('[TrendLinesStore] Clear response status:', response.status);

          if (!response.ok) {
            const errorText = await response.text();
            console.error('[TrendLinesStore] Clear error:', errorText);
            throw new Error('Failed to clear trend lines from backend');
          }

          const responseData = await response.json();
          console.log('[TrendLinesStore] Clear response data:', responseData);

          // Update local state
          set(state => ({
            trendLines: state.trendLines.filter(tl => {
              if (datasetId && sku) {
                return tl.datasetId !== datasetId || tl.sku !== sku;
              } else if (datasetId) {
                return tl.datasetId !== datasetId;
              } else if (sku) {
                return tl.sku !== sku;
              }
              return false; // Don't clear all unless explicitly requested
            }),
            isLoading: false,
          }));

          console.log('[TrendLinesStore] Trend lines cleared successfully');
        } catch (error) {
          console.error('[TrendLinesStore] Error clearing trend lines:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to clear trend lines',
            isLoading: false 
          });
        }
      },

      // Load trend lines for a specific file/SKU
      loadTrendLines: async (datasetId: number, sku: string) => {
        try {
          console.log('[TrendLinesStore] Loading trend lines for:', { datasetId, sku });
          set({ isLoading: true, error: null });
          
          const params = new URLSearchParams({ datasetId: datasetId.toString(), sku });
          const url = `${getApiBaseUrl()}/api/trend-lines?${params.toString()}`;
          console.log('[TrendLinesStore] Making request to:', url);
          
          const response = await fetch(url);

          console.log('[TrendLinesStore] Load response status:', response.status);
          console.log('[TrendLinesStore] Load response headers:', Object.fromEntries(response.headers.entries()));

          const rawTrendLines = await response.json();
          console.log('[TrendLinesStore] Raw response from backend:', rawTrendLines);
          console.log('[TrendLinesStore] Response type:', typeof rawTrendLines);
          console.log('[TrendLinesStore] Is array:', Array.isArray(rawTrendLines));

          // Map backend snake_case to frontend camelCase
          const trendLines = Array.isArray(rawTrendLines)
            ? rawTrendLines.map(tl => ({
                ...tl,
                datasetId: tl.dataset_id || parseInt(tl.file_path?.replace('dataset_', '') || '0'),
                startIndex: tl.start_index,
                endIndex: tl.end_index,
                startValue: tl.start_value,
                endValue: tl.end_value,
                startDate: tl.start_date,
                endDate: tl.end_date,
                createdAt: tl.created_at,
                modelId: tl.model_id,
              }))
            : [];

          console.log('[TrendLinesStore] Loaded trend lines:', trendLines);
          console.log('[TrendLinesStore] Number of trend lines:', trendLines.length);
          set({ trendLines, isLoading: false, error: null });
          console.log('[TrendLinesStore] State updated with trend lines:', trendLines);
        } catch (error) {
          set({ isLoading: false, error: error.message });
          console.error('[TrendLinesStore] Error loading trend lines:', error);
        }
      },

      // Smart filtering logic
      getTrendLinesForChart: (datasetId, sku, chartData, includeFutureTrendLines = false) => {
        const { trendLines } = get();
        const safeTrendLines = Array.isArray(trendLines) ? trendLines : [];
        console.log('[TrendLinesStore] getTrendLinesForChart called with:', { datasetId, sku, chartDataLength: chartData.length, includeFutureTrendLines });
        console.log('[TrendLinesStore] Total trend lines in store:', safeTrendLines.length);
        
        const filtered = safeTrendLines.filter(trendLine => {
          console.log('[TrendLinesStore] Checking trend line:', { 
            id: trendLine.id, 
            trendLineDatasetId: trendLine.datasetId, 
            trendLineSku: trendLine.sku,
            requestedDatasetId: datasetId,
            requestedSku: sku,
            datasetIdMatch: trendLine.datasetId === datasetId,
            skuMatch: trendLine.sku === sku
          });
          
          // Match dataset ID and SKU
          if (trendLine.datasetId !== datasetId || trendLine.sku !== sku) {
            console.log('[TrendLinesStore] Trend line filtered out due to datasetId/sku mismatch');
            return false;
          }

          // Check if trend line is historical-only
          const isHistorical = get().isTrendLineHistorical(trendLine, chartData);
          console.log('[TrendLinesStore] Trend line historical check:', { id: trendLine.id, isHistorical, includeFutureTrendLines });
          
          // Historical trend lines: show everywhere
          if (isHistorical) {
            console.log('[TrendLinesStore] Including historical trend line:', trendLine.id);
            return true;
          }
          
          // Future/mixed trend lines: only show if explicitly requested
          const shouldInclude = includeFutureTrendLines;
          console.log('[TrendLinesStore] Future trend line decision:', { id: trendLine.id, shouldInclude });
          return shouldInclude;
        });
        
        console.log('[TrendLinesStore] Final filtered trend lines:', filtered.length);
        return filtered;
      },

      // Utility to determine if a trend line uses only historical data
      isTrendLineHistorical: (trendLine, chartData) => {
        const startDate = new Date(trendLine.startDate);
        const endDate = new Date(trendLine.endDate);
        
        // Find the separation point between historical and forecast data
        const separationIndex = chartData.findIndex(item => item.type === 'forecast');
        if (separationIndex === -1) {
          // No forecast data, so all data is historical
          return true;
        }
        
        const separationDate = new Date(chartData[separationIndex]?.date);
        
        // Check if both start and end dates are before the separation point
        return startDate < separationDate && endDate < separationDate;
      },
    }),
    {
      name: 'trend-lines-storage',
      partialize: (state) => ({ 
        trendLines: state.trendLines 
      }),
    }
  )
); 