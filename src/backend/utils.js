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

function isDateString(str, dateFormat = null) {
  if (!str || typeof str !== 'string') return false;
  const normalizedStr = str.trim();
  
  // If a specific date format is provided, use parseDateWithFormat
  if (dateFormat) {
    return parseDateWithFormat(normalizedStr, dateFormat) !== null;
  }
  
  // Fallback to existing patterns for auto-detection
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/, /^\d{2}\/\d{2}\/\d{4}$/, /^\d{2}-\d{2}-\d{4}$/,
    /^\d{4}\/\d{2}\/\d{2}$/, /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, /^\d{1,2}-\d{1,2}-\d{2,4}$/,
    /^\d{8}$/, /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*\d{4}$/i,
  ];
  return datePatterns.some(pattern => pattern.test(normalizedStr));
}

function isLikelyDateColumn(header, allHeaders, dateFormat = null) {
  const normalizedHeader = header.toLowerCase().trim();
  
  // If a specific date format is provided, use parseDateWithFormat
  if (dateFormat) {
    const isDate = parseDateWithFormat(header, dateFormat) !== null;
    console.log(`[DEBUG] Checking if "${header}" is date with format "${dateFormat}": ${isDate}`);
    return isDate;
  }
  
  // Fallback to existing patterns for auto-detection
  const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/, /^\d{2}\/\d{2}\/\d{4}$/, /^\d{2}-\d{2}-\d{4}$/,
      /^\d{4}\/\d{2}\/\d{2}$/, /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, /^\d{1,2}-\d{1,2}-\d{2,4}$/,
      /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*\d{4}$/i, /^q[1-4]|quarter/i,
      /^week|wk/i, /^month|mon/i, /^year|yr/i,
  ];
  if (datePatterns.some(pattern => pattern.test(normalizedHeader))) return true;
  if (/^\d{8}$/.test(normalizedHeader) && parseInt(normalizedHeader.substring(4, 6)) <= 12 && parseInt(normalizedHeader.substring(6, 8)) <= 31) return true;
  if (/^\d{4}$/.test(normalizedHeader) && parseInt(normalizedHeader) >= 1900 && parseInt(normalizedHeader) <= 2100) return true;
  return false;
}

function detectColumnRole(header, index, allHeaders, dateFormat = null) {
  const normalizedHeader = header.toLowerCase().trim();
  
  // More specific Material Code detection
  if (/material|sku|product.?code|item.?code|part.?number|product.?id|item.?id|part.?id|produto|producto/i.test(normalizedHeader)) {
      return 'Material Code';
  }
  
  // More restrictive pattern for alphanumeric codes that look like SKUs
  // Only match if it's a short code (2-6 chars) followed by numbers, or specific patterns
  if (/^[a-z]{2,6}\d{2,}$/i.test(normalizedHeader) && 
      !/date|year|month|day|week|quarter|period|time/i.test(normalizedHeader)) {
      return 'Material Code';
  }
  
  // Description detection
  if (/description|name|material.?name|product.?name|item.?name|title|product.?title|nome|designacao|designação|descricao|descrição|nombre|designacion|designación|descripción|descripcion/i.test(normalizedHeader) || /^desc/i.test(normalizedHeader)) {
      return 'Description';
  }
  
  // Division detection
  if (/division|business.?unit|bu|region|area|zone|territory|market|segment|group|department|unit|divisao|divisão|división/i.test(normalizedHeader)) {
      return 'Division';
  }
  
  // Cluster detection
  if (/cluster|location|site|plant|factory|warehouse|distribution.?center|dc|hub|center|centre|facility|outlet|store|branch|grupo/i.test(normalizedHeader)) {
      return 'Cluster';
  }
  
  // Lifecycle Phase detection
  if (/lifecycle|life.?cycle|phase|stage|status|product.?stage|sales.?status|product.?status|maturity|growth|launch|end.?of.?life|eol|estado/i.test(normalizedHeader)) {
      return 'Lifecycle Phase';
  }
  
  // Date detection - for wide-format CSVs, headers that look like dates should be detected as Date
  // regardless of the selected date format, since the format is for parsing the header itself
  if (isDateString(header) || isLikelyDateColumn(header, allHeaders)) {
      console.log(`[DEBUG] Column "${header}" detected as Date`);
      return 'Date';
  }
  
  console.log(`[DEBUG] Column "${header}" detected as aggregatable field (header name)`);
  return header; // Default to header name
}

function detectColumnRoles(headers, dateFormat = null) {
  if (!headers || !Array.isArray(headers)) {
    console.warn('detectColumnRoles called with invalid headers:', headers);
    return [];
  }
  return headers.map((header, index) => ({
    originalName: header,
    role: detectColumnRole(header, index, headers, dateFormat)
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
    
    // Additional filtering for essentially blank rows
    data = data.filter(row => {
      return Object.values(row).some(value => 
        value !== null && 
        value !== undefined && 
        value !== '' && 
        String(value).trim() !== ''
      );
    });
    
    // Phase 2: Apply transformations from config if they exist
    if (config.operations) {
      data = await applyOperations(data, config.operations);
    }

    // Phase 3: If manual import, apply pivot logic from CsvImportWizard
    if (!config.operations) {
      const { mappings, dateRange, dateFormat, transpose } = config;

      let rawData = Papa.parse(csvData, { skipEmptyLines: true }).data;
      
      // Additional filtering for essentially blank rows
      rawData = rawData.filter(row => {
        return row.some(value => 
          value !== null && 
          value !== undefined && 
          value !== '' && 
          String(value).trim() !== ''
        );
      });
      
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
    // Check if this row has any non-zero sales values across all date columns
    let hasNonZeroSales = false;
    for (const dateMap of dateMappings) {
      const salesValue = row[originalHeaders.indexOf(dateMap.originalName)];
      const num = Number(salesValue);
      if (salesValue !== '' && Number.isFinite(num) && num > 0) {
        hasNonZeroSales = true;
        break;
      }
    }
    
    // Skip rows that have no meaningful sales data
    if (!hasNonZeroSales) {
      continue;
    }
    
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
      // Sales - Fix: Use the correct index in the data row
      const salesValue = row[originalHeaders.indexOf(dateMap.originalName)];
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

  // Convert data to matrix format for easier transposition
  const matrix = [headers, ...data.map(row => headers.map(header => row[header]))];
  
  // Transpose the matrix
  const transposedMatrix = matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
  
  // The first row becomes the new headers
  const newHeaders = transposedMatrix[0];
  const newDataRows = transposedMatrix.slice(1);
  
  // Convert back to object format
  const transposedData = newDataRows.map(row => {
    const rowObj = {};
    newHeaders.forEach((header, index) => {
      rowObj[header] = row[index];
    });
    return rowObj;
  });

  return {
    data: transposedData,
    headers: newHeaders
  };
}

function parseCsvWithHeaders(csvData, separator = null) {
  if (!csvData) {
    return { data: [], headers: [], separator: ',' };
  }

  // Use provided separator or auto-detect
  const detectedSeparator = separator || autoDetectSeparator(csvData.split('\n')[0]);
  
  const parsed = Papa.parse(csvData, {
    skipEmptyLines: true,
    delimiter: detectedSeparator,
    header: false,
  });

  if (!parsed.data || parsed.data.length === 0) {
    return { data: [], headers: [], separator: detectedSeparator };
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
  }).filter(row => {
    // Filter out rows that are essentially blank
    const hasContent = Object.values(row).some(value => 
      value !== null && 
      value !== undefined && 
      value !== '' && 
      String(value).trim() !== ''
    );
    return hasContent;
  });

  return { data, headers: finalHeaders, separator: detectedSeparator };
}

/**
 * Parses a date string according to the given format.
 * Supported formats: dd/mm/yyyy, mm/dd/yyyy, yyyy-mm-dd, dd-mm-yyyy, yyyy/mm/dd
 */
function parseDateWithFormat(dateStr, format) {
  if (!dateStr) return null;
  let day, month, year, parts, match;
  let result = null;

  switch (format) {
    case 'dd/mm/yyyy':
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) break;
      parts = dateStr.split('/');
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
      result = new Date(year, month, day);
      break;
    case 'mm/dd/yyyy':
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) break;
      parts = dateStr.split('/');
      month = parseInt(parts[0], 10) - 1;
      day = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
      result = new Date(year, month, day);
      break;
    case 'yyyy-mm-dd':
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) break;
      parts = dateStr.split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
      result = new Date(year, month, day);
      break;
    case 'dd-mm-yyyy':
      if (!/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) break;
      parts = dateStr.split('-');
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
      result = new Date(year, month, day);
      break;
    case 'yyyy/mm/dd':
      if (!/^\d{4}\/\d{2}\/\d{2}$/.test(dateStr)) break;
      parts = dateStr.split('/');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
      result = new Date(year, month, day);
      break;
    case 'yyyy':
      if (!/^\d{4}$/.test(dateStr)) break;
      year = parseInt(dateStr, 10);
      result = new Date(year, 0, 1);
      break;
    case 'yyyy-ww':
      match = dateStr.match(/^(\d{4})-W(\d{2})$/);
      if (!match) break;
      year = parseInt(match[1], 10);
      let week = parseInt(match[2], 10);
      result = getDateOfISOWeek(year, week);
      break;
    case 'ww-yyyy':
      match = dateStr.match(/^W(\d{2})-(\d{4})$/);
      if (!match) break;
      week = parseInt(match[1], 10);
      year = parseInt(match[2], 10);
      result = getDateOfISOWeek(year, week);
      break;
    case 'yyyy/ww':
      match = dateStr.match(/^(\d{4})\/W(\d{2})$/);
      if (!match) break;
      year = parseInt(match[1], 10);
      week = parseInt(match[2], 10);
      result = getDateOfISOWeek(year, week);
      break;
    case 'ww/yyyy':
      match = dateStr.match(/^W(\d{2})\/(\d{4})$/);
      if (!match) break;
      week = parseInt(match[1], 10);
      year = parseInt(match[2], 10);
      result = getDateOfISOWeek(year, week);
      break;
    case 'yyyy-wwrange':
      match = dateStr.match(/^(\d{4})-W(\d{2})-W(\d{2})$/);
      if (!match) break;
      year = parseInt(match[1], 10);
      week = parseInt(match[2], 10);
      result = getDateOfISOWeek(year, week);
      break;
    case 'weekrange':
      match = dateStr.match(/^W(\d{2})-W(\d{2})$/);
      if (!match) break;
      // Use current year for weekrange
      year = new Date().getFullYear();
      week = parseInt(match[1], 10);
      result = getDateOfISOWeek(year, week);
      break;
    default:
      result = null;
  }

  // Final validation: if result is an invalid date, return null
  if (result instanceof Date && isNaN(result.getTime())) result = null;

  // Debug log
  // Remove or comment out in production
  console.log(`[parseDateWithFormat] Input: "${dateStr}", Format: "${format}", Result:`, result);

  return result;
}

// Helper for ISO week to date
function getDateOfISOWeek(year, week) {
  // January 4th is always in the first week of the year
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7; // 1 (Mon) - 7 (Sun)
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - (jan4Day - 1));
  const targetDate = new Date(firstMonday);
  targetDate.setDate(firstMonday.getDate() + (week - 1) * 7);
  return targetDate;
}

/**
 * Parses a string as a number using the selected number format.
 * Handles thousands and decimal separators for formats like 1,234.56, 1.234,56, etc.
 * Returns NaN if the format doesn't match the expected pattern.
 */
function parseNumberWithFormat(value, format) {
  if (typeof value !== 'string') return NaN;
  const trimmed = value.trim();
  let pattern;
  switch (format) {
    case '1,234.56': // comma thousands, dot decimal
      if (trimmed.length >= 4 && !trimmed.includes(',')) {
        console.log(`[parseNumberWithFormat] REJECT: "${trimmed}" as "${format}" (missing comma for thousands)`);
        return NaN;
      }
      pattern = /^(\d{1,3}(,\d{3})*|\d{1,3})(\.\d+)?$/;
      if (!pattern.test(trimmed)) {
        console.log(`[parseNumberWithFormat] REJECT: "${trimmed}" as "${format}" (regex mismatch)`);
        return NaN;
      }
      return parseFloat(trimmed.replace(/,/g, ''));
    case '1.234,56': // dot thousands, comma decimal
      if (trimmed.length >= 4 && !trimmed.includes('.')) {
        console.log(`[parseNumberWithFormat] REJECT: "${trimmed}" as "${format}" (missing dot for thousands)`);
        return NaN;
      }
      pattern = /^(\d{1,3}(\.\d{3})*|\d{1,3})(,\d+)?$/;
      if (!pattern.test(trimmed)) {
        console.log(`[parseNumberWithFormat] REJECT: "${trimmed}" as "${format}" (regex mismatch)`);
        return NaN;
      }
      return parseFloat(trimmed.replace(/\./g, '').replace(/,/g, '.'));
    case '1234.56': // no thousands, dot decimal
      if (trimmed.includes(',') || trimmed.includes(' ')) {
        console.log(`[parseNumberWithFormat] REJECT: "${trimmed}" as "${format}" (unexpected thousands separator)`);
        return NaN;
      }
      pattern = /^\d+(\.\d+)?$/;
      if (!pattern.test(trimmed)) {
        console.log(`[parseNumberWithFormat] REJECT: "${trimmed}" as "${format}" (regex mismatch)`);
        return NaN;
      }
      return parseFloat(trimmed);
    case '1234,56': // no thousands, comma decimal
      if (trimmed.includes('.') || trimmed.includes(' ')) {
        console.log(`[parseNumberWithFormat] REJECT: "${trimmed}" as "${format}" (unexpected thousands separator)`);
        return NaN;
      }
      pattern = /^\d+(,\d+)?$/;
      if (!pattern.test(trimmed)) {
        console.log(`[parseNumberWithFormat] REJECT: "${trimmed}" as "${format}" (regex mismatch)`);
        return NaN;
      }
      return parseFloat(trimmed.replace(/,/g, '.'));
    case '1 234,56': // space thousands, comma decimal
      if (trimmed.length >= 4 && !trimmed.includes(' ')) {
        console.log(`[parseNumberWithFormat] REJECT: "${trimmed}" as "${format}" (missing space for thousands)`);
        return NaN;
      }
      pattern = /^(\d{1,3}( \d{3})*|\d{1,3})(,\d+)?$/;
      if (!pattern.test(trimmed)) {
        console.log(`[parseNumberWithFormat] REJECT: "${trimmed}" as "${format}" (regex mismatch)`);
        return NaN;
      }
      return parseFloat(trimmed.replace(/ /g, '').replace(/,/g, '.'));
    case '1 234.56': // space thousands, dot decimal
      if (trimmed.length >= 4 && !trimmed.includes(' ')) {
        console.log(`[parseNumberWithFormat] REJECT: "${trimmed}" as "${format}" (missing space for thousands)`);
        return NaN;
      }
      pattern = /^(\d{1,3}( \d{3})*|\d{1,3})(\.\d+)?$/;
      if (!pattern.test(trimmed)) {
        console.log(`[parseNumberWithFormat] REJECT: "${trimmed}" as "${format}" (regex mismatch)`);
        return NaN;
      }
      return parseFloat(trimmed.replace(/ /g, ''));
    case '1234': // integer
      if (trimmed.includes(',') || trimmed.includes('.') || trimmed.includes(' ')) {
        console.log(`[parseNumberWithFormat] REJECT: "${trimmed}" as "${format}" (unexpected separator in integer)`);
        return NaN;
      }
      pattern = /^\d+$/;
      if (!pattern.test(trimmed)) {
        console.log(`[parseNumberWithFormat] REJECT: "${trimmed}" as "${format}" (regex mismatch)`);
        return NaN;
      }
      return parseFloat(trimmed);
    default:
      return parseFloat(trimmed);
  }
}

// Infer frequency from an array of date strings
function inferDateFrequency(dateStrings) {
  console.log('[inferDateFrequency] Input dateStrings:', dateStrings);
  if (!Array.isArray(dateStrings) || dateStrings.length < 2) return 'unknown';
  // Parse and sort dates
  const dates = dateStrings
    .map(d => new Date(d))
    .filter(d => d instanceof Date && !isNaN(d))
    .sort((a, b) => a - b);
  console.log('[inferDateFrequency] Parsed and sorted dates:', dates.map(d => d.toISOString()));
  if (dates.length < 2) return 'unknown';
  // Compute intervals in days
  const intervals = [];
  for (let i = 1; i < dates.length; i++) {
    const diff = (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24);
    intervals.push(Math.round(diff));
  }
  console.log('[inferDateFrequency] Intervals (days):', intervals);
  if (intervals.length === 0) return 'unknown';
  // Find the most common interval
  const counts = {};
  for (const int of intervals) counts[int] = (counts[int] || 0) + 1;
  const mostCommon = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const days = parseInt(mostCommon, 10);
  // Map to frequency
  let freq = 'unknown';
  if (days <= 1) freq = 'daily';
  else if (days >= 6 && days <= 8) freq = 'weekly';
  else if (days >= 28 && days <= 31) freq = 'monthly';
  else if (days >= 89 && days <= 92) freq = 'quarterly';
  else if (days >= 360 && days <= 370) freq = 'yearly';
  console.log('[inferDateFrequency] Most common interval:', days, '=> Frequency:', freq);
  return freq;
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
  parseCsvWithHeaders,
  inferDateFrequency,
  parseDateWithFormat,
  parseNumberWithFormat
};
