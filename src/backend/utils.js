import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function isDateString(str) {
  if (!str || typeof str !== 'string') return false;
  const normalizedStr = str.trim();
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/, /^\d{2}\/\d{2}\/\d{4}$/, /^\d{2}-\d{2}-\d{4}$/,
    /^\d{4}\/\d{2}\/\d{2}$/, /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, /^\d{1,2}-\d{1,2}-\d{2,4}$/,
    /^\d{8}$/, /^jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i,
  ];
  return datePatterns.some(pattern => pattern.test(normalizedStr));
}

function isLikelyDateColumn(header, allHeaders) {
  const normalizedHeader = header.toLowerCase().trim();
  const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/, /^\d{2}\/\d{2}\/\d{4}$/, /^\d{2}-\d{2}-\d{4}$/,
      /^\d{4}\/\d{2}\/\d{2}$/, /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, /^\d{1,2}-\d{1,2}-\d{2,4}$/,
      /^jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i, /^q[1-4]|quarter/i,
      /^week|wk/i, /^month|mon/i, /^year|yr/i,
  ];
  if (datePatterns.some(pattern => pattern.test(normalizedHeader))) return true;
  if (/^\d{8}$/.test(normalizedHeader) && parseInt(normalizedHeader.substring(4, 6)) <= 12 && parseInt(normalizedHeader.substring(6, 8)) <= 31) return true;
  if (/^\d{4}$/.test(normalizedHeader) && parseInt(normalizedHeader) >= 1900 && parseInt(normalizedHeader) <= 2100) return true;
  return false;
}

function detectColumnRole(header, index, allHeaders) {
  const normalizedHeader = header.toLowerCase().trim();
  
  // More specific Material Code detection
  if (/material|sku|product.?code|item.?code|part.?number|product.?id|item.?id|part.?id/i.test(normalizedHeader)) {
      return 'Material Code';
  }
  
  // More restrictive pattern for alphanumeric codes that look like SKUs
  // Only match if it's a short code (2-6 chars) followed by numbers, or specific patterns
  if (/^[a-z]{2,6}\d{2,}$/i.test(normalizedHeader) && 
      !/date|year|month|day|week|quarter|period|time/i.test(normalizedHeader)) {
      return 'Material Code';
  }
  
  // Description detection
  if (/description|name|product.?name|item.?name|title|product.?title/i.test(normalizedHeader) || /^desc/i.test(normalizedHeader)) {
      return 'Description';
  }
  
  // Date detection
  if (isDateString(header) || isLikelyDateColumn(header, allHeaders)) {
      return 'Date';
  }
  
  return header; // Default to header name
}

function detectColumnRoles(headers) {
  if (!headers || !Array.isArray(headers)) {
    console.warn('detectColumnRoles called with invalid headers:', headers);
    return [];
  }
  return headers.map((header, index) => ({
    originalName: header,
    role: detectColumnRole(header, index, headers)
  }));
}

// Helper function to safely apply transformations based on configuration
async function applyTransformations(csvData, config) {
  try {
    // Phase 1: Parse CSV data from raw string
    const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
    let data = parsed.data;

    if (!data || data.length === 0) {
      console.warn('applyTransformations called with invalid or empty csvData');
      return {};
    }
    
    // Phase 2: Apply transformations from config if they exist
    if (config.operations) {
      data = await applyOperations(data, config.operations);
    }

    // Phase 3: If manual import, apply pivot logic from CsvImportWizard
    if (!config.operations) {
      const { mappings, dateRange, dateFormat, transpose } = config;

      let rawData = Papa.parse(csvData, { skipEmptyLines: true }).data;
      if (transpose) {
        rawData = rawData[0].map((_, colIndex) => rawData.map(row => row[colIndex]));
      }
      
      const headers = rawData[0];
      const dataRows = rawData.slice(1);

      // We need to map headers to their roles for the pivot function
      const headerMappings = headers.map((header, i) => {
        const mapping = mappings.find(m => m.originalName === header);
        return {
          role: mapping ? mapping.role : 'Ignore',
          originalName: header
        };
                });

      const pivotResult = normalizeAndPivotData(dataRows, headerMappings, dateRange, dateFormat, headers);
      data = pivotResult.data;
      // Overwrite columns with the ones from the pivot
      config.pivotColumns = pivotResult.columns; 
    }


    const finalColumns = config.pivotColumns || (data.length > 0 ? Object.keys(data[0]) : []);
    
    // Phase 4: Save results and generate final payload
    const fileName = `processed-data-${config.operations ? 'ai' : 'manual'}-${Date.now()}.json`;
    const filePath = path.join(UPLOADS_DIR, fileName);
    fs.writeFileSync(filePath, JSON.stringify({ data, columns: finalColumns }, null, 2));

    const materialCodeKey = finalColumns[0]; // Assuming first column is always the SKU
    const skuList = data.map(row => row[materialCodeKey]).filter(Boolean);
    
    const summary = {
      skuCount: skuList.length,
      dateRange: finalColumns.length > 1 ? [finalColumns[1], finalColumns[finalColumns.length - 1]] : ["N/A", "N/A"],
      totalPeriods: finalColumns.length > 1 ? finalColumns.length - 1 : 0,
    };
    
    return {
      filePath: `uploads/${fileName}`,
      summary,
      skuList,
      columns: finalColumns,
      previewData: data.slice(0, 10),
    };

  } catch (error) {
    console.error('Error in applyTransformations:', error.message, error.stack);
    throw error; // Re-throw to be caught by the route handler
  }
}

async function applyOperations(data, operations) {
    let result = [...data];
    for (const operation of operations) {
        // ... (existing switch logic for operations)
    }
    return result;
}

// Helper for dynamic field guessing
function findField(row, possibleNames) {
  for (const name of possibleNames) {
    if (row.hasOwnProperty(name)) return row[name];
  }
  return '';
}

function isDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(str)) return false;
  const d = new Date(str);
  return d instanceof Date && !isNaN(d);
}

function pivotTable(data, indexFields, columnField, valueField) {
  const result = [];
  const indexMap = new Map();
  let allColumns = new Set();
  
  console.log('--- Pivot Table Debug ---');

  // Determine if the column to pivot is a date column
  const firstValidColumnValue = data.find(r => r[columnField])?.[columnField];
  const isDateColumn = firstValidColumnValue && isDate(firstValidColumnValue);

  // First pass: group data by index and collect column values
  for (const row of data) {
    const indexKey = indexFields.map(f => row[f]).join('|');
    
    if (!indexMap.has(indexKey)) {
      const newRow = {};
      for (const f of indexFields) {
        newRow[f] = row[f];
      }
      indexMap.set(indexKey, newRow);
    }
    
    const col = row[columnField];
    if (col) {
      // Normalize date column values to YYYY-MM-DD for consistent keying
      const columnKey = isDateColumn ? new Date(col.split('T')[0]).toISOString().split('T')[0] : col;

      // Always add the *normalized* column value to our set
      allColumns.add(columnKey);
      
      const value = parseFloat(row[valueField]);
      indexMap.get(indexKey)[columnKey] = (indexMap.get(indexKey)[columnKey] || 0) + (isNaN(value) ? 0 : value);
    }
  }

  console.log('Columns before sorting:', Array.from(allColumns));

  // Ensure all rows have all columns, default to 0
  const sortedColumns = Array.from(allColumns).sort((a, b) => {
    // If we're dealing with dates, sort them chronologically
    if (isDateColumn && isDate(a) && isDate(b)) {
      return new Date(a) - new Date(b);
    }
    // Otherwise, use string sort
    return a.localeCompare(b);
  });

  console.log('Columns after sorting:', sortedColumns);
  console.log('--- End Pivot Table Debug ---');

  for (const [key, value] of indexMap.entries()) {
    for (const col of sortedColumns) {
      if (!value.hasOwnProperty(col)) {
        value[col] = 0;
      }
    }
    result.push(value);
  }

  return { data: result, columns: [...indexFields, ...sortedColumns] };
}

function normalizeAndPivotData(data, mappings, dateRange, dateFormat, originalHeaders) {
  console.log('Starting manual data normalization with new logic...');

  // 1. Identify roles
  const materialMapping = mappings.find(m => m.role === 'Material Code');
  if (!materialMapping) {
    throw new Error('"Material Code" column mapping is required.');
  }
  const descMapping = mappings.find(m => m.role === 'Description');
  const aggMappings = mappings.filter(m => (
    m.role !== 'Material Code' && m.role !== 'Description' && m.role !== 'Date' && m.role !== 'Ignore'
  ));
  let dateMappings = mappings
    .map((m, i) => ({ ...m, idx: i }))
    .filter(m => m.role === 'Date');
  if (dateRange && typeof dateRange.start === 'number' && typeof dateRange.end === 'number') {
    dateMappings = dateMappings.filter(m => m.idx >= dateRange.start && m.idx <= dateRange.end);
  }

  // 2. Build normalized rows
  const result = [];
  for (const row of data) {
    for (const dateMap of dateMappings) {
      const entry = {};
      entry['Material Code'] = row[originalHeaders.indexOf(materialMapping.originalName)];
      if (descMapping) entry['Description'] = row[originalHeaders.indexOf(descMapping.originalName)];
      for (const agg of aggMappings) {
        entry[agg.role] = row[originalHeaders.indexOf(agg.originalName)];
      }
      // Date
      const parsedDate = parseDateWithFormat(dateMap.originalName, dateFormat);
      let formattedDate = dateMap.originalName;
      if (parsedDate) {
        const pad = n => n.toString().padStart(2, '0');
        formattedDate = `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-${pad(parsedDate.getDate())}`;
      }
      entry['Date'] = formattedDate;
      // Sales
      const salesValue = row[dateMap.idx];
      const num = Number(salesValue);
      entry['Sales'] = (salesValue === '' || !Number.isFinite(num)) ? 0 : num;

      if (entry['Material Code'] && entry['Date']) {
        result.push(entry);
      }
    }
  }

  // 3. Build output columns
  const columns = [
    'Material Code',
    ...(descMapping ? ['Description'] : []),
    ...aggMappings.map(m => m.role),
    'Date',
    'Sales'
  ];

  return { data: result, columns };
}

// Auto-detect CSV separator from the first line
function autoDetectSeparator(firstLine) {
  if (!firstLine) return ',';
  
  const separators = [',', ';', '\t', '|'];
  const counts = {};
  
  for (const sep of separators) {
    counts[sep] = (firstLine.match(new RegExp(`\\${sep}`, 'g')) || []).length;
  }
  
  // Return the separator with the highest count, defaulting to comma
  const maxCount = Math.max(...Object.values(counts));
  const detectedSep = Object.keys(counts).find(sep => counts[sep] === maxCount);
  
  return detectedSep || ',';
}

// Transpose data (swap rows and columns)
function transposeData(data, headers) {
  if (!data || data.length === 0 || !headers || headers.length === 0) {
    return { data: [], headers: [] };
  }

  // The first column's values become the new headers.
  const newHeaders = [headers[0], ...data.map(row => row[headers[0]])];

  const transposedData = [];
  // Start from the second original header, as the first is the new header column.
  for (let i = 1; i < headers.length; i++) {
    const header = headers[i];
    const newRow = {
      [newHeaders[0]]: header, // The new first column is the original header
    };
    // Map original rows to new columns
    data.forEach((row, rowIndex) => {
      const newHeader = newHeaders[rowIndex + 1]; // +1 to skip the header column
      newRow[newHeader] = row[header];
    });
    transposedData.push(newRow);
  }

  return {
    data: transposedData,
    headers: newHeaders
  };
}

function parseCsvWithHeaders(csvData) {
  if (!csvData) {
    return { data: [], headers: [] };
  }

  const detectedSeparator = autoDetectSeparator(csvData.split('\\n')[0]);
  
  const parsed = Papa.parse(csvData, {
    skipEmptyLines: true,
    delimiter: detectedSeparator,
    header: false,
  });

  if (!parsed.data || parsed.data.length === 0) {
    return { data: [], headers: [] };
  }

  const rawHeaders = parsed.data[0];
  const dataRows = parsed.data.slice(1);

  // Map non-empty headers to their original index
  const headerMapping = [];
  rawHeaders.forEach((h, i) => {
    if (h && h.trim() !== '') {
      headerMapping.push({ originalIndex: i, name: h.trim() });
    }
  });

  // Ensure header names are unique
  const counts = {};
  const finalHeaders = headerMapping.map(h => {
    let newName = h.name;
    if (counts[newName]) {
      counts[newName]++;
      newName = `${newName}_${counts[newName]}`;
    } else {
      counts[newName] = 1;
    }
    return newName;
  });

  // Map rows to objects with unique headers as keys
  const data = dataRows.map(row => {
    const newRow = {};
    headerMapping.forEach((h, i) => {
      // Use finalHeaders[i] as the key
      if (row && typeof row[h.originalIndex] !== 'undefined') {
        newRow[finalHeaders[i]] = row[h.originalIndex];
      }
    });
    return newRow;
  }).filter(row => Object.keys(row).length > 0);

  return { data, headers: finalHeaders };
}

/**
 * Parses a date string according to the given format.
 * Supported formats: dd/mm/yyyy, mm/dd/yyyy, yyyy-mm-dd, dd-mm-yyyy, yyyy/mm/dd
 */
function parseDateWithFormat(dateStr, format) {
  if (!dateStr) return null;
  let day, month, year, parts;
  switch (format) {
    case 'dd/mm/yyyy':
      parts = dateStr.split('/');
      if (parts.length !== 3) return null;
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
      break;
    case 'mm/dd/yyyy':
      parts = dateStr.split('/');
      if (parts.length !== 3) return null;
      month = parseInt(parts[0], 10) - 1;
      day = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
      break;
    case 'yyyy-mm-dd':
      parts = dateStr.split('-');
      if (parts.length !== 3) return null;
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
      break;
    case 'dd-mm-yyyy':
      parts = dateStr.split('-');
      if (parts.length !== 3) return null;
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
      break;
    case 'yyyy/mm/dd':
      parts = dateStr.split('/');
      if (parts.length !== 3) return null;
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
      break;
    default:
      return null;
  }
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  return new Date(year, month, day);
}

export {
  isDateString,
  isLikelyDateColumn,
  detectColumnRole,
  detectColumnRoles,
  applyTransformations,
  findField,
  isDate,
  pivotTable,
  normalizeAndPivotData,
  autoDetectSeparator,
  transposeData,
  parseCsvWithHeaders
};
