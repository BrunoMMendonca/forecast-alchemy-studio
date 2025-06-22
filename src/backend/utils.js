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
  if (/material|sku|product.?code|item.?code|part.?number|product.?id|item.?id|part.?id/i.test(normalizedHeader) || /^[a-z]{2,4}\d{3,}$/i.test(normalizedHeader) || /^[a-z]+\d+$/i.test(normalizedHeader)) {
      return 'Material Code';
  }
  if (/description|name|product.?name|item.?name|title|product.?title/i.test(normalizedHeader) || /^desc/i.test(normalizedHeader)) {
      return 'Description';
  }
  if (isDateString(header) || isLikelyDateColumn(header, allHeaders)) {
      return 'Date';
  }
  return header; // Default to header name
}

function detectColumnRoles(headers) {
  return headers.map((header, index) => ({
    originalName: header,
    role: detectColumnRole(header, index, headers)
  }));
}

// Helper function to safely apply transformations based on configuration
function applyTransformations(csvData, config) {
  try {
    let result = [...csvData];
    let pivotColumns = null;
    
    console.log('Starting transformation with config:', JSON.stringify(config, null, 2));
    console.log('Initial data sample:', result[0]);
    
    for (let i = 0; i < config.operations.length; i++) {
      const operation = config.operations[i];
      if (!result || result.length === 0) {
        console.warn(`No data left to process before operation ${i}: ${operation.type}`);
        break;
      }
      console.log(`Applying operation ${i}: ${operation.type}`, operation);
      
      try {
      switch (operation.type) {
        case 'filter_rows': {
          if (operation.filters && Array.isArray(operation.filters)) {
            // New explicit filter format
            result = result.filter(row => {
              return operation.filters.every(f => {
                const col = f.column;
                if (!(col in row)) {
                  console.warn(`Filter column '${col}' does not exist in row. Skipping this filter for this row.`);
                  return true; // skip this filter for this row
                }
                const val = row[col];
                switch (f.op) {
                  case 'IS NOT NULL':
                    return val !== undefined && val !== null && val !== '';
                  case '==':
                    return val == f.value;
                  case '!=':
                    return val != f.value;
                  case '>':
                    return parseFloat(val) > parseFloat(f.value);
                  case '>=':
                    return parseFloat(val) >= parseFloat(f.value);
                  case '<':
                    return parseFloat(val) < parseFloat(f.value);
                  case '<=':
                    return parseFloat(val) <= parseFloat(f.value);
                  default:
                    console.warn(`Unknown filter op: ${f.op}`);
                    return true;
                }
              });
            });
          } else if (operation.condition) {
            // Old string-based logic (for backward compatibility)
            const subConditions = operation.condition.split('AND').map(s => s.trim());
            result = result.filter(row => {
              return subConditions.every(cond => {
                // IS NOT NULL
                if (cond.includes('IS NOT NULL')) {
                  const field = cond.split('IS NOT NULL')[0].trim();
                  if (!(field in row)) {
                    console.warn(`Filter field '${field}' does not exist in row. Skipping this condition.`);
                    return true;
                  }
                  return row[field] !== undefined && row[field] !== null && row[field] !== '';
                } else if (cond.includes('>=')) {
                  const [field, value] = cond.split('>=').map(s => s.trim());
                  if (!(field in row)) return true;
                  return parseFloat(row[field]) >= parseFloat(value);
                } else if (cond.includes('>')) {
                  const [field, value] = cond.split('>').map(s => s.trim());
                  if (!(field in row)) return true;
                  return parseFloat(row[field]) > parseFloat(value);
                } else if (cond.includes('<=')) {
                  const [field, value] = cond.split('<=').map(s => s.trim());
                  if (!(field in row)) return true;
                  return parseFloat(row[field]) <= parseFloat(value);
                } else if (cond.includes('<')) {
                  const [field, value] = cond.split('<').map(s => s.trim());
                  if (!(field in row)) return true;
                  return parseFloat(row[field]) < parseFloat(value);
                } else if (cond.includes('==')) {
                  const [field, value] = cond.split('==').map(s => s.trim());
                  if (!(field in row)) return true;
                  return row[field] == value;
                }
                return true;
              });
            });
          }
          break;
        }
        case 'rename_column':
          result = result.map(row => {
            const newRow = { ...row };
            if (newRow[operation.from] !== undefined) {
              newRow[operation.to] = newRow[operation.from];
              delete newRow[operation.from];
            }
            return newRow;
          });
          break;
        case 'combine_date_columns':
          result = result.map(row => {
            const newRow = { ...row };
            const year = row[operation.year_col];
            const month = row[operation.month_col];
            if (year && month) {
              const paddedMonth = month.toString().padStart(2, '0');
              const dateStr = `${year}-${paddedMonth}-01`;
              newRow[operation.output_col] = dateStr;
              delete newRow[operation.year_col];
              delete newRow[operation.month_col];
            }
            return newRow;
          });
          break;
        case 'transpose_data':
          if (operation.if_needed && result.length > 0) {
            const firstRow = result[0];
            const hasDateColumns = Object.keys(firstRow).some(key => 
              key.toLowerCase().includes('date') || 
              key.toLowerCase().includes('year') || 
              key.toLowerCase().includes('month')
            );
            if (!hasDateColumns) {
              console.log('Transposing data to align dates as columns');
              const transposed = [];
              const headers = Object.keys(firstRow);
              for (const row of result) {
                const newRow = {};
                for (const header of headers) {
                  newRow[header] = row[header];
                }
                transposed.push(newRow);
              }
              result = transposed;
            }
          }
          break;
        case 'normalize_format':
          if (operation.target === 'long' && result.length > 0) {
            const dateColumns = Object.keys(result[0]).filter(key => 
              key.toLowerCase().includes('date') || 
              key.toLowerCase().includes('month') ||
              key.toLowerCase().includes('year')
            );
            const valueColumns = Object.keys(result[0]).filter(key => 
              key.toLowerCase().includes('sales') || 
              key.toLowerCase().includes('value') ||
              key.toLowerCase().includes('amount') ||
              key.toLowerCase().includes('retail')
            );
            const normalized = [];
            const fieldMap = operation.field_map || {};
            const skuFieldCandidates = ['ProductCode', 'SKU', 'Material Code', 'ITEM CODE', 'sku', 'product', 'item'];
            const descFieldCandidates = ['Description', 'Product Description', 'ITEM DESCRIPTION', 'description', 'desc'];
            const supplierFieldCandidates = ['SUPPLIER', 'supplier'];
            const typeFieldCandidates = ['ITEM TYPE', 'type'];

            for (const row of result) {
              for (const dateCol of dateColumns) {
                for (const valueCol of valueColumns) {
                  normalized.push({
                    date: row[dateCol],
                    value: row[valueCol],
                    sku: (fieldMap.sku && row[fieldMap.sku]) || findField(row, skuFieldCandidates) || 'Unknown',
                    description: (fieldMap.description && row[fieldMap.description]) || findField(row, descFieldCandidates) || '',
                    supplier: (fieldMap.supplier && row[fieldMap.supplier]) || findField(row, supplierFieldCandidates) || '',
                    type: (fieldMap.type && row[fieldMap.type]) || findField(row, typeFieldCandidates) || ''
                  });
                }
              }
            }
            result = normalized;
          }
          break;
        case 'remove_columns':
          result = result.map(row => {
            const newRow = { ...row };
            operation.columns.forEach(col => delete newRow[col]);
            return newRow;
          });
          break;
        case 'pivot': {
          const indexFields = operation.index || [];
          const columnField = operation.columns;
          const valueField = operation.values;
          if (!indexFields.length || !columnField || !valueField) {
            console.warn('Pivot operation missing required fields. Skipping.');
            break;
          }
          const pivoted = pivotTable(result, indexFields, columnField, valueField);
          result = pivoted.data;
          pivotColumns = pivoted.columns;
          break;
        }
        default:
          console.warn(`Unknown operation type: ${operation.type}`);
      }
        console.log(`After operation ${i} (${operation.type}):`, result.length, 'rows, sample:', result[0]);
      } catch (operationError) {
        console.error(`Error in operation ${i} (${operation.type}):`, operationError);
        console.error('Operation details:', operation);
        console.error('Operation error stack:', operationError.stack);
        throw new Error(`Failed in operation ${i} (${operation.type}): ${operationError.message}`);
      }
    }
    return { data: result, columns: pivotColumns };
  } catch (error) {
    console.error('Error in applyTransformations:', error);
    console.error('Transformations error stack:', error.stack);
    throw error;
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

export {
  isDateString,
  isLikelyDateColumn,
  detectColumnRole,
  detectColumnRoles,
  applyTransformations,
  findField,
  isDate,
  pivotTable,
  normalizeAndPivotData
};
