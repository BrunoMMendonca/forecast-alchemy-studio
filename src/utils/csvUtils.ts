import { NormalizedSalesData } from '@/types/forecast';

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
  originalData: NormalizedSalesData[], 
  cleanedData: NormalizedSalesData[], 
  threshold: number,
  separator: string = ','
): void => {
  const cleaningRecords: CleaningRecord[] = [];

  // Process all SKUs that have been through cleaning
  const processedSKUs = new Set(cleanedData.map(d => d['Material Code']));
  
  processedSKUs.forEach(sku => {
    const skuOriginal = originalData.filter(d => d['Material Code'] === sku);
    const skuCleaned = cleanedData.filter(d => d['Material Code'] === sku);
    
    // Calculate statistics for outlier detection
    const sales = skuCleaned.map(d => d['Sales']);
    const mean = sales.reduce((sum, s) => sum + s, 0) / sales.length;
    const variance = sales.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / sales.length;
    const stdDev = Math.sqrt(variance);
    
    skuCleaned.forEach(cleanedItem => {
      const originalItem = skuOriginal.find(o => o['Date'] === cleanedItem['Date']);
      if (originalItem) {
        const zScore = stdDev > 0 ? Math.abs((cleanedItem['Sales'] - mean) / stdDev) : 0;
        const wasOutlier = zScore > threshold;
        
        cleaningRecords.push({
          sku: cleanedItem['Material Code'],
          date: cleanedItem['Date'],
          originalSales: originalItem['Sales'],
          cleanedSales: cleanedItem['Sales'],
          changeAmount: cleanedItem['Sales'] - originalItem['Sales'],
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
    'Material Code,Date,Original_Sales,Cleaned_Sales,Change_Amount,Note,Was_Outlier,Z_Score'
  ].join('\n');

  const csvRows = cleaningRecords.map(record => {
    const row: string[] = [
      String(record.sku),
      String(record.date),
      String(record.originalSales),
      String(record.cleanedSales),
      String(record.changeAmount),
      record.note ? `"${String(record.note).replace(/"/g, '""')}"` : '',
      record.wasOutlier ? 'Yes' : 'No',
      String(record.zScore)
    ];
    return row.join(separator);
  });

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
    } else if (
      line.toLowerCase().includes('material code,date')
    ) {
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

      const [materialCode, date, originalSales, cleanedSales, changeAmount, note, wasOutlier, zScore] = values;
      
      if (!materialCode || !date) {
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
        sku: materialCode,
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
  currentData: NormalizedSalesData[],
  previews: ImportPreview[]
): NormalizedSalesData[] => {
  const updatedData = [...currentData];
  
  previews.forEach(preview => {
    if (preview.action === 'no_change') return;
    
    const index = updatedData.findIndex(
      item => String(item['Material Code']) === String(preview.sku) && String(item['Date']) === String(preview.date)
    );
    
    if (index !== -1) {
      updatedData[index] = {
        ...updatedData[index],
        ['Sales']: preview.newSales,
        note: preview.note
      };
    }
  });
  
  return updatedData;
};

export interface TransformedCSVData {
  headers: string[];
  rows: string[][];
}

export const transformYearMonthCSV = (csvText: string, delimiter: string = ';'): TransformedCSVData => {
  const lines = csvText.split('\n').map(line => line.trim()).filter(line => line);
  if (lines.length < 2) return { headers: [], rows: [] };

  // Parse headers
  const headers = lines[0].split(delimiter).map(h => h.trim());
  const yearIdx = headers.findIndex(h => h.toUpperCase() === 'YEAR');
  const monthIdx = headers.findIndex(h => h.toUpperCase() === 'MONTH');
  const valueIdx = headers.findIndex(h => h.toUpperCase() === 'RETAIL SALES');
  const itemCodeIdx = headers.findIndex(h => h.toUpperCase() === 'ITEM CODE');
  const itemDescIdx = headers.findIndex(h => h.toUpperCase() === 'ITEM DESCRIPTION');

  if (yearIdx === -1 || monthIdx === -1 || valueIdx === -1) {
    throw new Error('Required columns (YEAR, MONTH, RETAIL SALES) not found');
  }

  // Group data by item code and description
  const itemGroups = new Map<string, { desc: string; dates: Map<string, string> }>();

  // Process data rows
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delimiter).map(cell => cell.trim());
    if (cells.length < Math.max(yearIdx, monthIdx, valueIdx) + 1) continue;

    const year = cells[yearIdx];
    const month = cells[monthIdx].padStart(2, '0');
    const value = parseFloat(cells[valueIdx]) || 0;
    const itemCode = cells[itemCodeIdx] || '';
    const itemDesc = cells[itemDescIdx] || '';

    const date = `${year}-${month}-01`;
    const key = `${itemCode}|${itemDesc}`;

    if (!itemGroups.has(key)) {
      itemGroups.set(key, { desc: itemDesc, dates: new Map() });
    }
    itemGroups.get(key)!.dates.set(date, value.toString());
  }

  // Get all unique dates
  const allDates = new Set<string>();
  itemGroups.forEach(group => {
    group.dates.forEach((_, date) => allDates.add(date));
  });
  const sortedDates = Array.from(allDates).sort();

  // Create new headers
  const newHeaders = ['Material Code', 'Description', ...sortedDates];

  // Create new rows
  const newRows: string[][] = [];
  itemGroups.forEach((group, key) => {
    const [itemCode] = key.split('|');
    const row = [itemCode, group.desc];
    sortedDates.forEach(date => {
      row.push((group.dates.get(date) || 0).toString());
    });
    newRows.push(row);
  });

  return {
    headers: newHeaders,
    rows: newRows
  };
};
