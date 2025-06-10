import { useState, useCallback, useRef, useEffect } from 'react';
import { NormalizedSalesData } from '@/pages/Index';
import { ModelConfig } from '@/types/forecast';

interface NavigationOptimizationState {
  datasetFingerprint: string;
  optimizationCompleted: boolean;
  lastOptimizationTime: number;
  currentRoute: string;
  dataModificationTime: number;
  optimizationInProgress: boolean; // NEW: Track if optimization is currently running
}

const NAVIGATION_STATE_KEY = 'navigation_optimization_state';
const COOLING_OFF_PERIOD = 30000; // 30 seconds

export const useNavigationAwareOptimization = () => {
  const [navigationState, setNavigationState] = useState<NavigationOptimizationState | null>(null);
  const lastDataRef = useRef<string>('');
  const optimizationTriggerRef = useRef<number>(0);
  const optimizationLockRef = useRef<boolean>(false); // NEW: Prevent concurrent optimizations

  // Load navigation state on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(NAVIGATION_STATE_KEY);
      if (stored) {
        const parsedState = JSON.parse(stored);
        // Reset optimization in progress flag on reload
        parsedState.optimizationInProgress = false;
        setNavigationState(parsedState);
      }
    } catch (error) {
      console.error('NAVIGATION: Failed to load state:', error);
    }
  }, []);

  // Save navigation state when it changes
  useEffect(() => {
    if (navigationState) {
      try {
        localStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(navigationState));
      } catch (error) {
        console.error('NAVIGATION: Failed to save state:', error);
      }
    }
  }, [navigationState]);

  const generateStableFingerprint = useCallback((data: NormalizedSalesData[]): string => {
    if (!data || data.length === 0) return 'empty';
    
    // Create a stable fingerprint based on data content, including modifications
    const sortedData = [...data].sort((a, b) => {
      const skuCompare = a['Material Code'].localeCompare(b['Material Code']);
      if (skuCompare !== 0) return skuCompare;
      return a['Date'].localeCompare(b['Date']);
    });
    
    // Include sales values, outlier flags, and notes in fingerprint - more precise
    const dataContent = sortedData.map(d => {
      // Round sales to 2 decimals to avoid floating point precision issues
      const roundedSales = Math.round(d['Sales'] * 100) / 100;
      return `${d['Material Code']}|${d['Date']}|${roundedSales}|${d.isOutlier ? '1' : '0'}|${d.note || ''}`;
    }).join('||');
    
    // Create a more stable hash
    let hash = 0;
    for (let i = 0; i < dataContent.length; i++) {
      const char = dataContent.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    const fingerprint = Math.abs(hash).toString(36).substring(0, 16);
    return fingerprint;
  }, []);

  const shouldOptimize = useCallback((data: NormalizedSalesData[], currentRoute: string = '/'): boolean => {
    if (!data || data.length === 0) {
      return false;
    }

    // NEW: Check if optimization is already in progress
    if (optimizationLockRef.current || navigationState?.optimizationInProgress) {
      return false;
    }

    const currentFingerprint = generateStableFingerprint(data);
    const now = Date.now();

    // PRIORITY 1: Check if data has actually changed
    if (navigationState) {
      // If fingerprint has changed, data was modified - need to re-optimize
      if (navigationState.datasetFingerprint !== currentFingerprint) {
        return true;
      }

      // Same dataset and already optimized
      if (navigationState.datasetFingerprint === currentFingerprint && 
          navigationState.optimizationCompleted) {
        return false;
      }

      // Cooling off period check (secondary safety)
      if (now - navigationState.lastOptimizationTime < COOLING_OFF_PERIOD) {
        return false;
      }
    }

    // PRIORITY 2: Check localStorage directly as backup
    try {
      const stored = localStorage.getItem(NAVIGATION_STATE_KEY);
      if (stored) {
        const parsedState = JSON.parse(stored);
        if (parsedState.datasetFingerprint !== currentFingerprint) {
          return true;
        }
        if (parsedState.datasetFingerprint === currentFingerprint && 
            parsedState.optimizationCompleted) {
          return false;
        }
      }
    } catch (error) {
      console.error('NAVIGATION: Failed to check localStorage backup:', error);
    }

    // PRIORITY 3: Check if this is the same data we've seen before (session level)
    if (lastDataRef.current === currentFingerprint) {
      return false;
    }

    lastDataRef.current = currentFingerprint;
    return true;
  }, [navigationState, generateStableFingerprint]);

  const markOptimizationStarted = useCallback((data: NormalizedSalesData[], currentRoute: string = '/') => {
    // NEW: Set optimization lock
    optimizationLockRef.current = true;
    
    const fingerprint = generateStableFingerprint(data);
    const newState: NavigationOptimizationState = {
      datasetFingerprint: fingerprint,
      optimizationCompleted: false,
      optimizationInProgress: true, // NEW: Mark as in progress
      lastOptimizationTime: Date.now(),
      currentRoute,
      dataModificationTime: Date.now()
    };
    
    setNavigationState(newState);
  }, [generateStableFingerprint]);

  const markOptimizationCompleted = useCallback((data: NormalizedSalesData[], currentRoute: string = '/') => {
    // NEW: Release optimization lock
    optimizationLockRef.current = false;
    
    const fingerprint = generateStableFingerprint(data);
    const newState: NavigationOptimizationState = {
      datasetFingerprint: fingerprint,
      optimizationCompleted: true,
      optimizationInProgress: false, // NEW: Mark as completed
      lastOptimizationTime: Date.now(),
      currentRoute,
      dataModificationTime: navigationState?.dataModificationTime || Date.now()
    };
    
    setNavigationState(newState);
  }, [navigationState, generateStableFingerprint]);

  const markDataModified = useCallback((data?: NormalizedSalesData[]) => {
    // NEW: Release any existing optimization lock when data is modified
    optimizationLockRef.current = false;
    
    if (data) {
      // When data is provided, update the fingerprint to reflect the change
      const newFingerprint = generateStableFingerprint(data);
      setNavigationState(prev => prev ? {
        ...prev,
        datasetFingerprint: newFingerprint,
        optimizationCompleted: false,
        optimizationInProgress: false, // NEW: Reset progress flag
        dataModificationTime: Date.now()
      } : null);
    } else {
      // Legacy support - just mark as modified
      if (navigationState) {
        setNavigationState({
          ...navigationState,
          optimizationCompleted: false,
          optimizationInProgress: false, // NEW: Reset progress flag
          dataModificationTime: Date.now()
        });
      }
    }
    lastDataRef.current = '';
  }, [navigationState, generateStableFingerprint]);

  const getTriggerCount = useCallback(() => {
    return optimizationTriggerRef.current;
  }, []);

  const incrementTriggerCount = useCallback(() => {
    optimizationTriggerRef.current += 1;
  }, []);

  return {
    shouldOptimize,
    markOptimizationStarted,
    markOptimizationCompleted,
    markDataModified,
    getTriggerCount,
    incrementTriggerCount,
    navigationState,
    generateStableFingerprint
  };
};
