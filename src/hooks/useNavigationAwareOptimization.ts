
import { useState, useCallback, useRef, useEffect } from 'react';
import { SalesData } from '@/pages/Index';
import { ModelConfig } from '@/types/forecast';

interface NavigationOptimizationState {
  datasetFingerprint: string;
  optimizationCompleted: boolean;
  lastOptimizationTime: number;
  currentRoute: string;
  dataModificationTime: number;
}

const NAVIGATION_STATE_KEY = 'navigation_optimization_state';
const COOLING_OFF_PERIOD = 30000; // 30 seconds

export const useNavigationAwareOptimization = () => {
  const [navigationState, setNavigationState] = useState<NavigationOptimizationState | null>(null);
  const lastDataRef = useRef<string>('');
  const optimizationTriggerRef = useRef<number>(0);

  // Load navigation state on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(NAVIGATION_STATE_KEY);
      if (stored) {
        const parsedState = JSON.parse(stored);
        setNavigationState(parsedState);
        console.log('NAVIGATION: Loaded state:', parsedState);
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
        console.log('NAVIGATION: Saved state:', navigationState);
      } catch (error) {
        console.error('NAVIGATION: Failed to save state:', error);
      }
    }
  }, [navigationState]);

  const generateStableFingerprint = useCallback((data: SalesData[]): string => {
    if (!data || data.length === 0) return 'empty';
    
    // Create a stable fingerprint based on data content, including modifications
    const sortedData = [...data].sort((a, b) => {
      const skuCompare = a.sku.localeCompare(b.sku);
      if (skuCompare !== 0) return skuCompare;
      return a.date.localeCompare(b.date);
    });
    
    // Include sales values, outlier flags, and notes in fingerprint - more precise
    const dataContent = sortedData.map(d => {
      // Round sales to 2 decimals to avoid floating point precision issues
      const roundedSales = Math.round(d.sales * 100) / 100;
      return `${d.sku}|${d.date}|${roundedSales}|${d.isOutlier ? '1' : '0'}|${d.note || ''}`;
    }).join('||');
    
    // Create a more stable hash
    let hash = 0;
    for (let i = 0; i < dataContent.length; i++) {
      const char = dataContent.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    const fingerprint = Math.abs(hash).toString(36).substring(0, 16);
    
    console.log('NAVIGATION: Generated fingerprint:', fingerprint, 'for', sortedData.length, 'records');
    return fingerprint;
  }, []);

  const shouldOptimize = useCallback((data: SalesData[], currentRoute: string = '/'): boolean => {
    if (!data || data.length === 0) {
      console.log('NAVIGATION: ❌ No data - skipping optimization');
      return false;
    }

    const currentFingerprint = generateStableFingerprint(data);
    const now = Date.now();

    console.log('NAVIGATION: CHECKING OPTIMIZATION NEED');
    console.log(`NAVIGATION: Current fingerprint: ${currentFingerprint}`);
    console.log(`NAVIGATION: Stored fingerprint: ${navigationState?.datasetFingerprint}`);
    console.log(`NAVIGATION: Optimization completed: ${navigationState?.optimizationCompleted}`);
    
    // PRIORITY 1: Check if data has actually changed
    if (navigationState) {
      // If fingerprint has changed, data was modified - need to re-optimize
      if (navigationState.datasetFingerprint !== currentFingerprint) {
        console.log('NAVIGATION: ✅ DATA HAS CHANGED - Re-optimization needed');
        return true;
      }

      // Same dataset and already optimized
      if (navigationState.datasetFingerprint === currentFingerprint && 
          navigationState.optimizationCompleted) {
        console.log('NAVIGATION: ❌ SAME DATA AND ALREADY OPTIMIZED - ABSOLUTE BLOCK');
        return false;
      }

      // Cooling off period check (secondary safety)
      if (now - navigationState.lastOptimizationTime < COOLING_OFF_PERIOD) {
        console.log('NAVIGATION: ❌ In cooling off period - skipping');
        return false;
      }
    }

    // PRIORITY 2: Check localStorage directly as backup
    try {
      const stored = localStorage.getItem(NAVIGATION_STATE_KEY);
      if (stored) {
        const parsedState = JSON.parse(stored);
        if (parsedState.datasetFingerprint !== currentFingerprint) {
          console.log('NAVIGATION: ✅ LOCALSTORAGE BACKUP - Data changed, re-optimization needed');
          return true;
        }
        if (parsedState.datasetFingerprint === currentFingerprint && 
            parsedState.optimizationCompleted) {
          console.log('NAVIGATION: ❌ LOCALSTORAGE BACKUP CHECK - Already optimized');
          return false;
        }
      }
    } catch (error) {
      console.error('NAVIGATION: Failed to check localStorage backup:', error);
    }

    // PRIORITY 3: Check if this is the same data we've seen before (session level)
    if (lastDataRef.current === currentFingerprint) {
      console.log('NAVIGATION: ❌ Same data as before in session - skipping optimization');
      return false;
    }

    console.log('NAVIGATION: ✅ OPTIMIZATION APPROVED - All checks passed');
    lastDataRef.current = currentFingerprint;
    return true;
  }, [navigationState, generateStableFingerprint]);

  const markOptimizationStarted = useCallback((data: SalesData[], currentRoute: string = '/') => {
    const fingerprint = generateStableFingerprint(data);
    const newState: NavigationOptimizationState = {
      datasetFingerprint: fingerprint,
      optimizationCompleted: false,
      lastOptimizationTime: Date.now(),
      currentRoute,
      dataModificationTime: Date.now()
    };
    
    setNavigationState(newState);
    console.log('NAVIGATION: ✅ Marked optimization started for fingerprint:', fingerprint);
  }, [generateStableFingerprint]);

  const markOptimizationCompleted = useCallback((data: SalesData[], currentRoute: string = '/') => {
    const fingerprint = generateStableFingerprint(data);
    const newState: NavigationOptimizationState = {
      datasetFingerprint: fingerprint,
      optimizationCompleted: true,
      lastOptimizationTime: Date.now(),
      currentRoute,
      dataModificationTime: navigationState?.dataModificationTime || Date.now()
    };
    
    setNavigationState(newState);
    console.log('NAVIGATION: ✅ OPTIMIZATION MARKED AS COMPLETE for fingerprint:', fingerprint);
  }, [navigationState, generateStableFingerprint]);

  const markDataModified = useCallback((data?: SalesData[]) => {
    if (data) {
      // When data is provided, update the fingerprint to reflect the change
      const newFingerprint = generateStableFingerprint(data);
      setNavigationState(prev => prev ? {
        ...prev,
        datasetFingerprint: newFingerprint,
        optimizationCompleted: false,
        dataModificationTime: Date.now()
      } : null);
      console.log('NAVIGATION: ✅ Marked data as modified with new fingerprint:', newFingerprint);
    } else {
      // Legacy support - just mark as modified
      if (navigationState) {
        setNavigationState({
          ...navigationState,
          optimizationCompleted: false,
          dataModificationTime: Date.now()
        });
        console.log('NAVIGATION: ✅ Marked data as modified (legacy)');
      }
    }
    lastDataRef.current = '';
  }, [navigationState, generateStableFingerprint]);

  const getTriggerCount = useCallback(() => {
    return optimizationTriggerRef.current;
  }, []);

  const incrementTriggerCount = useCallback(() => {
    optimizationTriggerRef.current += 1;
    console.log('NAVIGATION: Trigger count:', optimizationTriggerRef.current);
  }, []);

  return {
    shouldOptimize,
    markOptimizationStarted,
    markOptimizationCompleted,
    markDataModified,
    getTriggerCount,
    incrementTriggerCount,
    navigationState
  };
};
