
import { useState, useCallback, useEffect } from 'react';
import { SalesData } from '@/types/sales';
import { useDatasetFingerprint } from './useDatasetFingerprint';

interface DatasetOptimizationState {
  fingerprint: string;
  completed: boolean;
  timestamp: number;
}

const OPTIMIZATION_STATE_KEY = 'dataset_optimization_state';
const CACHE_EXPIRY_HOURS = 24;

export const useOptimizationState = () => {
  const [optimizationState, setOptimizationState] = useState<DatasetOptimizationState | null>(null);
  const [cacheStats, setCacheStats] = useState({ hits: 0, misses: 0, skipped: 0 });
  const { generateDatasetFingerprint } = useDatasetFingerprint();

  // Load optimization state from localStorage on mount
  useEffect(() => {
    try {
      const storedState = localStorage.getItem(OPTIMIZATION_STATE_KEY);
      if (storedState) {
        const parsedState = JSON.parse(storedState);
        const now = Date.now();
        if (now - parsedState.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000) {
          setOptimizationState(parsedState);
          console.log(`OPTIMIZATION STATE: Loaded state - fingerprint: ${parsedState.fingerprint}, completed: ${parsedState.completed}`);
        }
      }
    } catch (error) {
      console.error('OPTIMIZATION STATE: Failed to load from localStorage:', error);
    }
  }, []);

  // Save optimization state to localStorage when it changes
  useEffect(() => {
    if (optimizationState) {
      try {
        localStorage.setItem(OPTIMIZATION_STATE_KEY, JSON.stringify(optimizationState));
        console.log(`OPTIMIZATION STATE: Saved state - fingerprint: ${optimizationState.fingerprint}, completed: ${optimizationState.completed}`);
      } catch (error) {
        console.error('OPTIMIZATION STATE: Failed to save state to localStorage:', error);
      }
    }
  }, [optimizationState]);

  // Check if optimization is complete for this dataset
  const isOptimizationComplete = useCallback((data: SalesData[]): boolean => {
    const currentFingerprint = generateDatasetFingerprint(data);
    
    console.log(`OPTIMIZATION STATE: Checking completion - current: ${currentFingerprint}, stored: ${optimizationState?.fingerprint}, completed: ${optimizationState?.completed}`);
    
    if (optimizationState && 
        optimizationState.fingerprint === currentFingerprint && 
        optimizationState.completed) {
      console.log('OPTIMIZATION STATE: ✅ OPTIMIZATION ALREADY COMPLETE - SKIPPING');
      setCacheStats(prev => ({ ...prev, skipped: prev.skipped + 1 }));
      return true;
    }
    
    console.log('OPTIMIZATION STATE: ❌ Optimization needed');
    return false;
  }, [optimizationState, generateDatasetFingerprint]);

  // Mark optimization as complete
  const markOptimizationComplete = useCallback((data: SalesData[]) => {
    const fingerprint = generateDatasetFingerprint(data);
    const newState: DatasetOptimizationState = {
      fingerprint,
      completed: true,
      timestamp: Date.now()
    };
    
    setOptimizationState(newState);
    console.log(`OPTIMIZATION STATE: ✅ MARKED OPTIMIZATION COMPLETE for fingerprint: ${fingerprint}`);
  }, [generateDatasetFingerprint]);

  const getDatasetFingerprintString = useCallback((data: SalesData[]): string => {
    return generateDatasetFingerprint(data);
  }, [generateDatasetFingerprint]);

  return {
    optimizationState,
    cacheStats,
    setCacheStats,
    isOptimizationComplete,
    markOptimizationComplete,
    getDatasetFingerprintString
  };
};
