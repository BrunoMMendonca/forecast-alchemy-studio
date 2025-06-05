
import { useState, useCallback, useEffect } from 'react';
import { SalesData } from '@/pages/Index';

interface DatasetOptimizationState {
  fingerprint: string;
  completed: boolean;
  timestamp: number;
}

const OPTIMIZATION_STATE_KEY = 'dataset_optimization_state';
const CACHE_EXPIRY_HOURS = 24;

export const useDatasetOptimization = () => {
  const [optimizationState, setOptimizationState] = useState<DatasetOptimizationState | null>(null);

  // Load optimization state from localStorage on mount
  useEffect(() => {
    try {
      const storedState = localStorage.getItem(OPTIMIZATION_STATE_KEY);
      if (storedState) {
        const parsedState = JSON.parse(storedState);
        const now = Date.now();
        if (now - parsedState.timestamp < CACHE_EXPIRY_HOURS * 60 * 60 * 1000) {
          setOptimizationState(parsedState);
          console.log(`DATASET: Loaded optimization state - fingerprint: ${parsedState.fingerprint}, completed: ${parsedState.completed}`);
        }
      }
    } catch (error) {
      console.error('DATASET: Failed to load from localStorage:', error);
    }
  }, []);

  // Save optimization state to localStorage when it changes
  useEffect(() => {
    if (optimizationState) {
      try {
        localStorage.setItem(OPTIMIZATION_STATE_KEY, JSON.stringify(optimizationState));
        console.log(`DATASET: Saved optimization state - fingerprint: ${optimizationState.fingerprint}, completed: ${optimizationState.completed}`);
      } catch (error) {
        console.error('DATASET: Failed to save optimization state to localStorage:', error);
      }
    }
  }, [optimizationState]);

  const generateDatasetFingerprint = useCallback((data: SalesData[]): string => {
    const sortedData = [...data].sort((a, b) => {
      const skuCompare = a.sku.localeCompare(b.sku);
      if (skuCompare !== 0) return skuCompare;
      return a.date.localeCompare(b.date);
    });
    
    const skus = Array.from(new Set(sortedData.map(d => d.sku))).sort();
    const totalSales = Math.round(sortedData.reduce((sum, d) => sum + d.sales, 0));
    const outliersCount = sortedData.filter(d => d.isOutlier).length;
    const notesCount = sortedData.filter(d => d.note && d.note.trim()).length;
    
    const fingerprint = `${skus.length}-${sortedData.length}-${totalSales}-${outliersCount}-${notesCount}`;
    return btoa(fingerprint).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  }, []);

  const isOptimizationComplete = useCallback((data: SalesData[]): boolean => {
    const currentFingerprint = generateDatasetFingerprint(data);
    
    console.log(`DATASET: Checking optimization completion - current: ${currentFingerprint}, stored: ${optimizationState?.fingerprint}, completed: ${optimizationState?.completed}`);
    
    if (optimizationState && 
        optimizationState.fingerprint === currentFingerprint && 
        optimizationState.completed) {
      console.log('DATASET: ✅ OPTIMIZATION ALREADY COMPLETE - SKIPPING');
      return true;
    }
    
    console.log('DATASET: ❌ Optimization needed');
    return false;
  }, [optimizationState, generateDatasetFingerprint]);

  const markOptimizationComplete = useCallback((data: SalesData[]) => {
    const fingerprint = generateDatasetFingerprint(data);
    const newState: DatasetOptimizationState = {
      fingerprint,
      completed: true,
      timestamp: Date.now()
    };
    
    setOptimizationState(newState);
    console.log(`DATASET: ✅ MARKED OPTIMIZATION COMPLETE for fingerprint: ${fingerprint}`);
  }, [generateDatasetFingerprint]);

  const clearOptimizationState = useCallback(() => {
    setOptimizationState(null);
    try {
      localStorage.removeItem(OPTIMIZATION_STATE_KEY);
      console.log('DATASET: Cleared optimization state');
    } catch (error) {
      console.error('DATASET: Failed to clear optimization state:', error);
    }
  }, []);

  return {
    generateDatasetFingerprint,
    isOptimizationComplete,
    markOptimizationComplete,
    clearOptimizationState
  };
};
