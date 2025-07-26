import { create } from 'zustand';

interface ChartPerformanceState {
  // Cache for expensive calculations
  calculationCache: Map<string, { value: any; timestamp: number }>;
  
  // Pre-computed data for charts
  precomputedData: Map<string, {
    timestamps: number[];
    historicalValues: number[];
    forecastValues: number[];
    dataBounds: {
      minDate: number;
      maxDate: number;
      minValue: number;
      maxValue: number;
      valueRange: number;
    };
  }>;
  
  // Chart rendering optimizations
  renderSettings: {
    maxDataPoints: number;
    animationThreshold: number;
    cacheTTL: number;
  };
  
  // Actions
  setCalculationCache: (key: string, value: any, ttl?: number) => void;
  getCalculationCache: (key: string, ttl?: number) => any | null;
  clearCalculationCache: () => void;
  
  setPrecomputedData: (key: string, data: any) => void;
  getPrecomputedData: (key: string) => any | null;
  clearPrecomputedData: () => void;
  
  updateRenderSettings: (settings: Partial<ChartPerformanceState['renderSettings']>) => void;
}

export const useChartPerformanceStore = create<ChartPerformanceState>((set, get) => ({
  calculationCache: new Map(),
  precomputedData: new Map(),
  renderSettings: {
    maxDataPoints: 2000,
    animationThreshold: 1000,
    cacheTTL: 30000, // 30 seconds
  },
  
  setCalculationCache: (key: string, value: any, ttl?: number) => {
    const { calculationCache, renderSettings } = get();
    const timestamp = Date.now();
    const cacheTTL = ttl || renderSettings.cacheTTL;
    
    // Clean up expired entries
    for (const [cacheKey, cached] of calculationCache.entries()) {
      if (Date.now() - cached.timestamp > cacheTTL) {
        calculationCache.delete(cacheKey);
      }
    }
    
    calculationCache.set(key, { value, timestamp });
    set({ calculationCache: new Map(calculationCache) });
  },
  
  getCalculationCache: (key: string, ttl?: number) => {
    const { calculationCache, renderSettings } = get();
    const cached = calculationCache.get(key);
    const cacheTTL = ttl || renderSettings.cacheTTL;
    
    if (cached && Date.now() - cached.timestamp < cacheTTL) {
      return cached.value;
    }
    
    return null;
  },
  
  clearCalculationCache: () => {
    set({ calculationCache: new Map() });
  },
  
  setPrecomputedData: (key: string, data: any) => {
    const { precomputedData } = get();
    precomputedData.set(key, data);
    set({ precomputedData: new Map(precomputedData) });
  },
  
  getPrecomputedData: (key: string) => {
    const { precomputedData } = get();
    return precomputedData.get(key) || null;
  },
  
  clearPrecomputedData: () => {
    set({ precomputedData: new Map() });
  },
  
  updateRenderSettings: (settings: Partial<ChartPerformanceState['renderSettings']>) => {
    const { renderSettings } = get();
    set({ 
      renderSettings: { ...renderSettings, ...settings }
    });
  },
})); 