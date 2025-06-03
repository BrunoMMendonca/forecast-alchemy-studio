
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
    
    // Create a stable fingerprint based on data content, not object references
    const sortedData = [...data].sort((a, b) => {
      const skuCompare = a.sku.localeCompare(b.sku);
      if (skuCompare !== 0) return skuCompare;
      return a.date.localeCompare(b.date);
    });
    
    const dataContent = sortedData.map(d => `${d.sku}-${d.date}-${d.sales}-${d.isOutlier ? '1' : '0'}`).join('|');
    const fingerprint = btoa(dataContent).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
    
    console.log('NAVIGATION: Generated fingerprint:', fingerprint);
    return fingerprint;
  }, []);

  const shouldOptimize = useCallback((data: SalesData[], currentRoute: string = '/'): boolean => {
    if (!data || data.length === 0) {
      console.log('NAVIGATION: ❌ No data - skipping optimization');
      return false;
    }

    const currentFingerprint = generateStableFingerprint(data);
    const now = Date.now();

    // Check if this is the same data we've seen before
    if (lastDataRef.current === currentFingerprint) {
      console.log('NAVIGATION: ❌ Same data as before - skipping optimization');
      return false;
    }

    // Check navigation state
    if (navigationState) {
      // Same dataset and already optimized
      if (navigationState.datasetFingerprint === currentFingerprint && 
          navigationState.optimizationCompleted) {
        console.log('NAVIGATION: ❌ Dataset already optimized - skipping');
        return false;
      }

      // Cooling off period check
      if (now - navigationState.lastOptimizationTime < COOLING_OFF_PERIOD) {
        console.log('NAVIGATION: ❌ In cooling off period - skipping');
        return false;
      }
    }

    console.log('NAVIGATION: ✅ Optimization needed');
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
    console.log('NAVIGATION: ✅ Marked optimization started');
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
    console.log('NAVIGATION: ✅ Marked optimization completed');
  }, [navigationState, generateStableFingerprint]);

  const markDataModified = useCallback(() => {
    if (navigationState) {
      setNavigationState({
        ...navigationState,
        optimizationCompleted: false,
        dataModificationTime: Date.now()
      });
      console.log('NAVIGATION: ✅ Marked data as modified');
    }
    lastDataRef.current = '';
  }, [navigationState]);

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
