import { useState, useCallback } from 'react';
import { SalesData } from '@/types/sales';

interface NavigationState {
  optimizationCompleted: boolean;
  datasetFingerprint: string;
}

export const useNavigationAwareOptimization = () => {
  const [triggerCount, setTriggerCount] = useState(0);
  const [navigationState, setNavigationState] = useState<NavigationState | null>(null);

  const generateStableFingerprint = useCallback((data: SalesData[]): string => {
    // Sort data to ensure consistent ordering
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

  const shouldOptimize = useCallback((data: SalesData[], path: string): boolean => {
    const fingerprint = generateStableFingerprint(data);
    
    if (navigationState && 
        navigationState.datasetFingerprint === fingerprint && 
        navigationState.optimizationCompleted) {
      console.log(`NAVIGATION: Optimization already completed for fingerprint: ${fingerprint}`);
      return false;
    }
    
    console.log(`NAVIGATION: Optimization needed for fingerprint: ${fingerprint}`);
    return true;
  }, [navigationState, generateStableFingerprint]);

  const markOptimizationStarted = useCallback((data: SalesData[], path: string) => {
    const fingerprint = generateStableFingerprint(data);
    
    setNavigationState({
      optimizationCompleted: false,
      datasetFingerprint: fingerprint
    });
    
    console.log(`NAVIGATION: Marked optimization started for fingerprint: ${fingerprint}`);
  }, [generateStableFingerprint]);

  const markOptimizationCompleted = useCallback((data: SalesData[], path: string) => {
    const fingerprint = generateStableFingerprint(data);
    
    setNavigationState({
      optimizationCompleted: true,
      datasetFingerprint: fingerprint
    });
    
    console.log(`NAVIGATION: Marked optimization completed for fingerprint: ${fingerprint}`);
  }, [generateStableFingerprint]);

  const incrementTriggerCount = useCallback(() => {
    setTriggerCount(prev => prev + 1);
  }, []);

  const getTriggerCount = useCallback(() => triggerCount, [triggerCount]);

  return {
    shouldOptimize,
    markOptimizationStarted,
    markOptimizationCompleted,
    getTriggerCount,
    incrementTriggerCount,
    navigationState,
    generateStableFingerprint
  };
};
