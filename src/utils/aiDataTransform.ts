import { parseDateWithFormat } from './dateUtils';

export interface ColumnAnalysis {
  type: 'date' | 'number' | 'text' | 'identifier' | 'category';
  confidence: number;
  suggestions: string[];
  patterns: string[];
}

export interface DataPattern {
  type: 'year_month' | 'date_columns' | 'date_rows' | 'mixed';
  confidence: number;
  description: string;
}

export interface AITransformResult {
  transformedData: any[][];
  columnMappings: { [key: string]: string };
  dateFormat: string;
  dataPattern: DataPattern;
  suggestions: string[];
}

function analyzeColumn(values: string[]): ColumnAnalysis {
  const nonEmptyValues = values.filter(v => v && v.trim() !== '');
  if (nonEmptyValues.length === 0) {
    return { type: 'text', confidence: 0, suggestions: [], patterns: [] };
  }

  // Check for date patterns
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
    /^\d{2}-\d{2}-\d{4}$/, // DD-MM-YYYY
    /^\d{4}\/\d{2}\/\d{2}$/, // YYYY/MM/DD
  ];

  const isDate = datePatterns.some(pattern => 
    nonEmptyValues.every(v => pattern.test(v))
  );

  if (isDate) {
    return {
      type: 'date',
      confidence: 0.9,
      suggestions: ['Date'],
      patterns: ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD-MM-YYYY', 'YYYY/MM/DD']
    };
  }

  // Check for year-month pattern
  const isYearMonth = nonEmptyValues.every(v => 
    /^\d{4}$/.test(v) || /^\d{1,2}$/.test(v)
  );

  if (isYearMonth) {
    return {
      type: 'date',
      confidence: 0.8,
      suggestions: ['Year', 'Month'],
      patterns: ['YYYY', 'MM']
    };
  }

  // Check for numbers
  const isNumber = nonEmptyValues.every(v => !isNaN(Number(v)));
  if (isNumber) {
    return {
      type: 'number',
      confidence: 0.9,
      suggestions: ['Sales', 'Quantity', 'Value'],
      patterns: ['numeric']
    };
  }

  // Check for identifiers (codes, SKUs)
  const isIdentifier = nonEmptyValues.every(v => 
    /^[A-Z0-9-_]+$/i.test(v) && v.length <= 20
  );
  if (isIdentifier) {
    return {
      type: 'identifier',
      confidence: 0.8,
      suggestions: ['Material Code', 'SKU', 'Product Code'],
      patterns: ['alphanumeric']
    };
  }

  // Check for categories
  const uniqueValues = new Set(nonEmptyValues).size;
  const isCategory = uniqueValues < nonEmptyValues.length * 0.3;
  if (isCategory) {
    return {
      type: 'category',
      confidence: 0.7,
      suggestions: ['Category', 'Type', 'Group'],
      patterns: ['categorical']
    };
  }

  return {
    type: 'text',
    confidence: 0.6,
    suggestions: ['Description', 'Name', 'Label'],
    patterns: ['text']
  };
}

function detectDataPattern(headers: string[], data: any[][]): DataPattern {
  // Check for year-month pattern
  const hasYear = headers.some(h => h.toLowerCase().includes('year'));
  const hasMonth = headers.some(h => h.toLowerCase().includes('month'));
  
  if (hasYear && hasMonth) {
    return {
      type: 'year_month',
      confidence: 0.9,
      description: 'Data has separate Year and Month columns'
    };
  }

  // Check for date columns
  const dateColumns = headers.filter(h => 
    parseDateWithFormat(h, 'yyyy-mm-dd') !== null ||
    parseDateWithFormat(h, 'mm/dd/yyyy') !== null
  );

  if (dateColumns.length > 0) {
    return {
      type: 'date_columns',
      confidence: 0.8,
      description: 'Data has dates as columns'
    };
  }

  // Check for date rows
  const firstColumnValues = data.map(row => row[0]);
  const isDateRows = firstColumnValues.every(v => 
    parseDateWithFormat(v, 'yyyy-mm-dd') !== null ||
    parseDateWithFormat(v, 'mm/dd/yyyy') !== null
  );

  if (isDateRows) {
    return {
      type: 'date_rows',
      confidence: 0.8,
      description: 'Data has dates as rows'
    };
  }

  return {
    type: 'mixed',
    confidence: 0.5,
    description: 'Mixed data format'
  };
}

export function transformDataWithAI(data: any[][]): AITransformResult {
  if (!data || data.length < 2) {
    throw new Error('Invalid data format');
  }

  const headers = data[0];
  const rows = data.slice(1);

  // Analyze each column
  const columnAnalysis = headers.map((header, index) => {
    const values = rows.map(row => row[index]);
    return {
      header,
      analysis: analyzeColumn(values)
    };
  });

  // Detect data pattern
  const dataPattern = detectDataPattern(headers, rows);

  // Generate column mappings
  const columnMappings: { [key: string]: string } = {};
  const suggestions: string[] = [];

  columnAnalysis.forEach(({ header, analysis }) => {
    if (analysis.type === 'identifier' && analysis.confidence > 0.7) {
      columnMappings[header] = 'Material Code';
    } else if (analysis.type === 'text' && analysis.confidence > 0.6) {
      columnMappings[header] = 'Description';
    } else if (analysis.type === 'date') {
      if (dataPattern.type === 'year_month') {
        if (header.toLowerCase().includes('year')) {
          columnMappings[header] = 'Year';
        } else if (header.toLowerCase().includes('month')) {
          columnMappings[header] = 'Month';
        }
      } else {
        columnMappings[header] = 'Date';
      }
    } else if (analysis.type === 'number') {
      columnMappings[header] = 'Sales';
    }
  });

  // Transform data based on pattern
  let transformedData = [...data];
  let dateFormat = 'yyyy-mm-dd';

  if (dataPattern.type === 'year_month') {
    // Combine year and month into date
    const yearCol = headers.findIndex(h => columnMappings[h] === 'Year');
    const monthCol = headers.findIndex(h => columnMappings[h] === 'Month');
    
    if (yearCol !== -1 && monthCol !== -1) {
      const newHeaders = headers.filter((_, i) => i !== yearCol && i !== monthCol);
      newHeaders.push('Date');
      
      transformedData = rows.map(row => {
        const year = row[yearCol];
        const month = row[monthCol].padStart(2, '0');
        const date = `${year}-${month}-01`;
        return [...row.filter((_, i) => i !== yearCol && i !== monthCol), date];
      });
      
      transformedData = [newHeaders, ...transformedData];
    }
  }

  // Add suggestions
  if (dataPattern.type === 'year_month') {
    suggestions.push('Detected Year-Month format. Combined into Date column.');
  }
  if (Object.keys(columnMappings).length < headers.length) {
    suggestions.push('Some columns could not be automatically mapped. Please review the mappings.');
  }

  return {
    transformedData,
    columnMappings,
    dateFormat,
    dataPattern,
    suggestions
  };
} 