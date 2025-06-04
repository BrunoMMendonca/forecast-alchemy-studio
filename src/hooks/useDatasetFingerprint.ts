
import { useCallback } from 'react';
import { SalesData } from '@/types/sales';

export const useDatasetFingerprint = () => {
  const generateDatasetFingerprint = useCallback((data: SalesData[]): string => {
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

  const generateDataHash = useCallback((skuData: SalesData[]): string => {
    const sorted = [...skuData].sort((a, b) => a.date.localeCompare(b.date));
    const salesValues = sorted.map(d => Math.round(d.sales * 100) / 100).join('-');
    const outlierFlags = sorted.map(d => d.isOutlier ? '1' : '0').join('');
    const noteFlags = sorted.map(d => d.note ? '1' : '0').join('');
    
    return `${sorted.length}-${salesValues.substring(0, 50)}-${outlierFlags}-${noteFlags}`.substring(0, 100);
  }, []);

  return {
    generateDatasetFingerprint,
    generateDataHash
  };
};
