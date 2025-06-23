import Papa from 'papaparse';

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
function applyTransformations(csvData, config) {
  try {
    console.log('[applyTransformations] Starting. Received config:', JSON.stringify(config, null, 2));
    console.log(`[applyTransformations] Received ${csvData?.length ?? 0} rows.`);
    if (csvData?.length > 0) {
      console.log('[applyTransformations] Initial data sample (first row):', JSON.stringify(csvData[0], null, 2));
    }

    if (!csvData || !Array.isArray(csvData) || csvData.length === 0) {
      console.warn('applyTransformations called with invalid or empty csvData');
      return { data: [], columns: [] };
    }
    
    if (!config || !config.operations || !Array.isArray(config.operations)) {
      console.warn('applyTransformations called with invalid config');
      return { data: csvData, columns: Object.keys(csvData[0] || {}) };
    }

    let result = [...csvData];
    let pivotColumns = null;
    
    console.log('Starting transformation with config:', JSON.stringify(config, null, 2));
    if (result.length > 0) {
      console.log('Initial data sample:', result[0]);
    }
    
    for (let i = 0; i < config.operations.length; i++) {
      const operation = config.operations[i];
      if (!result || !Array.isArray(result) || result.length === 0) {
        console.warn(`No data left to process before operation ${i}: ${operation.operation}`);
        break;
      }
      console.log(`Applying operation ${i}: ${operation.operation}`, operation);
      
      try {
        console.log(`[applyTransformations] Before op ${i} (${operation.operation}): ${result.length} rows. Sample:`, JSON.stringify(result[0] || {}, null, 2));
        switch (operation.operation) {
          case 'rename':
            result = result.map(row => {
              const newRow = { ...row };
              if (newRow[operation.old_name] !== undefined) {
                newRow[operation.new_name] = newRow[operation.old_name];
                delete newRow[operation.old_name];
              }
              return newRow;
            });
            break;
          case 'combine':
            result = result.map(row => {
              const newRow = { ...row };
              if (operation.cols && operation.cols.every(c => row[c] !== undefined)) {
                const year = row['YEAR'];
                const month = row['MONTH'];
                if (year && month) {
                  const paddedMonth = month.toString().padStart(2, '0');
                  newRow[operation.new_col] = `${year}-${paddedMonth}-01`;
                }
              }
              return newRow;
            });
            break;
          case 'filter': {
            if (!operation.condition) break;
            const evaluate = (row, condition) => {
                const parts = condition.split(' and ').map(p => p.trim());
                return parts.every(part => {
                    if (part.startsWith('is_numeric')) {
                        const col = part.match(/\(([^)]+)\)/)[1];
                        return row[col] && !isNaN(parseFloat(row[col])) && isFinite(row[col]);
                    }
                    if (part.startsWith('not is_blank')) {
                        const col = part.match(/\('([^)]+)'\)/)[1].trim();
                        return row[col] !== null && row[col] !== undefined && row[col].toString().trim() !== '';
                    }
                    const operators = ['>=', '<=', '==', '!=', '>', '<'];
                    const op = operators.find(o => part.includes(o));
                    if (op) {
                        const [col, valStr] = part.split(op).map(s => s.trim());
                        const val = valStr.replace(/'/g, ''); // remove quotes
                        const rowVal = row[col];
                        if (rowVal === undefined || rowVal === null) return false;
                        switch (op) {
                            case '>=': return parseFloat(rowVal) >= parseFloat(val);
                            case '<=': return parseFloat(rowVal) <= parseFloat(val);
                            case '==': return rowVal == val;
                            case '!=': return rowVal != val;
                            case '>': return parseFloat(rowVal) > parseFloat(val);
                            case '<': return parseFloat(rowVal) < parseFloat(val);
                        }
                    }
                    return true;
                });
            };
            result = result.filter(row => evaluate(row, operation.condition));
            break;
          }
          case 'select': {
            const selectedCols = operation.cols;
            if (!selectedCols || !Array.isArray(selectedCols)) {
              console.warn('select operation missing or invalid cols array');
              break;
            }
            result = result.map(row => {
              const newRow = {};
              selectedCols.forEach(col => {
                newRow[col] = row[col];
              });
              return newRow;
            });
            break;
          }
          case 'pivot_wider': {
              const { names_from, values_from, values_fill } = operation;
              if (!result[0] || !names_from || !values_from) {
                console.warn('pivot_wider operation missing required fields or no data');
                break;
              }
              const id_cols = Object.keys(result[0]).filter(c => c !== names_from && c !== values_from);

              const grouped = result.reduce((acc, row) => {
                  const key = id_cols.map(c => row[c]).join('---');
                  if (!acc[key]) {
                      acc[key] = {};
                      id_cols.forEach(c => acc[key][c] = row[c]);
                  }
                  const dateKey = row[names_from];
                  if(dateKey){
                    acc[key][dateKey] = row[values_from];
                  }
                  return acc;
              }, {});
              
              const allDateKeys = [...new Set(result.map(row => row[names_from]))].filter(Boolean).sort();
              
              result = Object.values(grouped).map((group) => {
                  allDateKeys.forEach(dateKey => {
                      if (group[dateKey] === undefined) {
                          group[dateKey] = values_fill || '0';
                      }
                  });
                  return group;
              });
              pivotColumns = [...id_cols, ...allDateKeys];
              break;
          }
          default:
            console.log(`Unknown operation type: ${operation.operation}`);
            break;
        }
      } catch (opError) {
        console.error(`Error applying operation ${i} (${operation.operation}):`, opError);
        // Don't break the loop, continue with next operation
      }
      
      // Safe check for result after each operation
      if (result && Array.isArray(result) && result.length > 0) {
        console.log(`After operation ${i} (${operation.operation}): ${result.length} rows, sample:`, result[0]);
        console.log(`[applyTransformations] After op ${i} (${operation.operation}): ${result.length} rows. Sample:`, JSON.stringify(result[0] || {}, null, 2));
      } else {
        console.log(`After operation ${i} (${operation.operation}): 0 rows or invalid result.`);
        console.log(`[applyTransformations] After op ${i} (${operation.operation}): 0 rows or invalid result.`);
        result = []; // Ensure result is always an array
      }
    }

    if (pivotColumns) {
        console.log('[applyTransformations] Finished with pivot. Returning columns:', pivotColumns);
        return { data: result, columns: pivotColumns };
    }

    // Fallback if no pivot happened
    const finalColumns = (result && Array.isArray(result) && result.length > 0) ? Object.keys(result[0]) : [];
    console.log('[applyTransformations] Finished without pivot. Returning columns:', finalColumns);
    return { data: result || [], columns: finalColumns };

  } catch (error) {
    console.error('Error in applyTransformations:', error.message, error.stack);
    return { data: [], columns: [] };
  }
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

function normalizeAndPivotData(data, mappings, dateRange, dateFormat) {
  console.log('Starting manual data normalization...');
  console.log(`Date range: ${dateRange.start} to ${dateRange.end}, Format: ${dateFormat}`);

  const materialIdx = mappings.findIndex(m => m.role === 'Material Code');
  const descIdx = mappings.findIndex(m => m.role === 'Description');
  
  if (materialIdx === -1) {
    throw new Error('"Material Code" column mapping is required.');
  }

  const pivotedData = {};
  const allDateColumns = new Set();

  data.forEach(row => {
    const materialCode = row[materialIdx];
    if (!materialCode) return; // Skip rows without a material code

    if (!pivotedData[materialCode]) {
      pivotedData[materialCode] = {
        'Material Code': materialCode,
        'Description': descIdx !== -1 ? row[descIdx] : ''
      };
    }

    for (let i = dateRange.start; i <= dateRange.end; i++) {
      if (mappings[i].role === 'Date') {
        const dateHeader = mappings[i].originalName;
        // Basic date normalization - assumes YYYY-MM-DD or similar sortable format
        // A more robust library like date-fns would be better for production
        try {
          // Attempt to create a valid date object for sorting later
          const d = new Date(dateHeader);
          if (!isNaN(d.getTime())) {
              const normalizedDate = d.toISOString().split('T')[0];
              pivotedData[materialCode][normalizedDate] = row[i] || 0;
              allDateColumns.add(normalizedDate);
          }
        } catch(e) {
            console.warn(`Could not parse date: ${dateHeader}`);
        }
      }
    }
  });

  const sortedDateColumns = Array.from(allDateColumns).sort();
  const finalColumns = ['Material Code', 'Description', ...sortedDateColumns];
  const finalData = Object.values(pivotedData);

  console.log(`Normalization complete. Pivoted ${finalData.length} SKUs.`);
  return { data: finalData, columns: finalColumns };
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
