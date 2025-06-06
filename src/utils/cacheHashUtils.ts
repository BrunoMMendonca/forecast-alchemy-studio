
import { SalesData } from '@/pages/Index';

/**
 * UNIFIED HASH GENERATION - Single source of truth for all cache operations
 */
export const generateDataHash = (skuData: SalesData[]): string => {
  if (!skuData || skuData.length === 0) {
    console.log('🗄️ CACHE: Empty SKU data, returning empty hash');
    return 'empty';
  }

  // Sort by date to ensure consistent ordering
  const sorted = [...skuData].sort((a, b) => a.date.localeCompare(b.date));
  
  // Create a deterministic hash from the data
  const dataPoints = sorted.map(d => {
    const sales = Math.round(d.sales * 1000) / 1000; // Round to 3 decimals for consistency
    const outlier = d.isOutlier ? '1' : '0';
    const note = d.note ? '1' : '0';
    return `${d.date}:${sales}:${outlier}:${note}`;
  });
  
  const hash = `v2-${sorted.length}-${dataPoints.join('|')}`;
  
  console.log('🗄️ CACHE: Generated unified hash:', hash.substring(0, 100), '...');
  return hash;
};
