import { SalesData } from '@/types/sales';

export interface CleaningRecord {
  sku: string;
  date: string;
  originalSales: number;
  cleanedSales: number;
  changeAmount: number;
  note?: string;
  wasOutlier: boolean;
  zScore: number;
}

export const exportCleaningData = (
  originalData: SalesData[], 
  cleanedData: SalesData[], 
  threshold: number
): void => {
  const cleaningRecords: CleaningRecord[] = [];

  // Process all SKUs that have been through cleaning
  const processedSKUs = new Set(cleanedData.map(d => d.sku));
  
  processedSKUs.forEach(sku => {
    const skuOriginal = originalData.filter(d => d.sku === sku);
    const skuCleaned = cleanedData.filter(d => d.sku === sku);
    
    // Calculate statistics for outlier detection
    const sales = skuCleaned.map(d => d.sales);
    const mean = sales.reduce((sum, s) => sum + s, 0) / sales.length;
    const variance = sales.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / sales.length;
    const stdDev = Math.sqrt(variance);
    
    skuCleaned.forEach(cleanedItem => {
      const originalItem = skuOriginal.find(o => o.date === cleanedItem.date);
      if (originalItem) {
        const zScore = stdDev > 0 ? Math.abs((cleanedItem.sales - mean) / stdDev) : 0;
        const wasOutlier = zScore > threshold;
        
        cleaningRecords.push({
          sku: cleanedItem.sku,
          date: cleanedItem.date,
          originalSales: originalItem.sales,
          cleanedSales: cleanedItem.sales,
          changeAmount: cleanedItem.sales - originalItem.sales,
          note: cleanedItem.note,
          wasOutlier,
          zScore: Math.round(zScore * 100) / 100
        });
      }
    });
  });

  // Sort by SKU, then by date
  cleaningRecords.sort((a, b) => {
    if (a.sku !== b.sku) return a.sku.localeCompare(b.sku);
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  // Create CSV content
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const headers = [
    '# Data Cleaning Export',
    `# Exported: ${new Date().toLocaleString()}`,
    `# Threshold: ${threshold}`,
    `# Total Records: ${cleaningRecords.length}`,
    `# SKUs: ${processedSKUs.size}`,
    '',
    'SKU,Date,Original_Sales,Cleaned_Sales,Change_Amount,Note,Was_Outlier,Z_Score'
  ].join('\n');

  const csvRows = cleaningRecords.map(record => [
    record.sku,
    record.date,
    record.originalSales,
    record.cleanedSales,
    record.changeAmount,
    record.note ? `"${record.note.replace(/"/g, '""')}"` : '',
    record.wasOutlier ? 'Yes' : 'No',
    record.zScore
  ].join(','));

  const csvContent = headers + '\n' + csvRows.join('\n');

  // Download the file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `data_cleaning_export_${timestamp}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export interface ImportPreview {
  sku: string;
  date: string;
  currentSales: number;
  newSales: number;
  changeAmount: number;
  note?: string;
  action: 'modify' | 'add_note' | 'no_change';
}

export const parseCleaningCSV = (csvText: string): {
  previews: ImportPreview[];
  errors: string[];
  metadata: { threshold?: number; exportDate?: string; totalRecords?: number };
} => {
  const lines = csvText.split('\n').map(line => line.trim()).filter(line => line);
  const errors: string[] = [];
  const previews: ImportPreview[] = [];
  const metadata: { threshold?: number; exportDate?: string; totalRecords?: number } = {};

  // Parse metadata from header comments
  let dataStartIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#')) {
      if (line.includes('Threshold:')) {
        const match = line.match(/Threshold:\s*([\d.]+)/);
        if (match) metadata.threshold = parseFloat(match[1]);
      } else if (line.includes('Exported:')) {
        const match = line.match(/Exported:\s*(.+)/);
        if (match) metadata.exportDate = match[1];
      } else if (line.includes('Total Records:')) {
        const match = line.match(/Total Records:\s*(\d+)/);
        if (match) metadata.totalRecords = parseInt(match[1]);
      }
    } else if (line.toLowerCase().includes('sku,date')) {
      dataStartIndex = i + 1;
      break;
    }
  }

  if (dataStartIndex === 0) {
    errors.push('Could not find CSV header row');
    return { previews, errors, metadata };
  }

  // Parse data rows
  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    try {
      const values = parseCSVRow(line);
      
      if (values.length < 8) {
        errors.push(`Row ${i + 1}: Insufficient columns (expected 8, got ${values.length})`);
        continue;
      }

      const [sku, date, originalSales, cleanedSales, changeAmount, note, wasOutlier, zScore] = values;
      
      if (!sku || !date) {
        errors.push(`Row ${i + 1}: Missing SKU or Date`);
        continue;
      }

      const cleanedSalesNum = parseFloat(cleanedSales);
      const originalSalesNum = parseFloat(originalSales);
      
      if (isNaN(cleanedSalesNum) || isNaN(originalSalesNum)) {
        errors.push(`Row ${i + 1}: Invalid sales values`);
        continue;
      }

      previews.push({
        sku,
        date,
        currentSales: originalSalesNum,
        newSales: cleanedSalesNum,
        changeAmount: cleanedSalesNum - originalSalesNum,
        note: note || undefined,
        action: cleanedSalesNum !== originalSalesNum ? 'modify' : note ? 'add_note' : 'no_change'
      });
    } catch (error) {
      errors.push(`Row ${i + 1}: Parse error - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { previews, errors, metadata };
};

const parseCSVRow = (row: string): string[] => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current.trim());
  return values;
};

export const applyImportChanges = (
  currentData: SalesData[],
  previews: ImportPreview[]
): SalesData[] => {
  const updatedData = [...currentData];
  
  previews.forEach(preview => {
    if (preview.action === 'no_change') return;
    
    const index = updatedData.findIndex(
      item => item.sku === preview.sku && item.date === preview.date
    );
    
    if (index !== -1) {
      updatedData[index] = {
        ...updatedData[index],
        sales: preview.newSales,
        note: preview.note
      };
    }
  });
  
  return updatedData;
};
