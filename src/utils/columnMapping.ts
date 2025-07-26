/**
 * Column Mapping Utilities
 * 
 * This module provides utilities for mapping between user's original column names
 * and internal role names used by the system.
 */

export interface ColumnMapping {
  originalName: string;  // User's original column name (e.g., "SKU", "Product Code")
  role: string;          // Internal role name (e.g., "Material Code", "Description")
}

export interface ColumnMappingConfig {
  columnRoles: string[];           // Array of role names in order
  columnMappings: ColumnMapping[]; // Mapping from original names to roles
  originalColumns: string[];       // Original column names in order
}

/**
 * Get the original column name for a given role
 */
export function getOriginalColumnName(mappingConfig: ColumnMappingConfig, role: string): string | null {
  const mapping = mappingConfig.columnMappings.find(m => m.role === role);
  return mapping ? mapping.originalName : null;
}

/**
 * Get the role name for a given original column name
 */
export function getRoleForColumn(mappingConfig: ColumnMappingConfig, originalName: string): string | null {
  const mapping = mappingConfig.columnMappings.find(m => m.originalName === originalName);
  return mapping ? mapping.role : null;
}

/**
 * Get the value from a data row using role name
 */
export function getValueByRole(dataRow: any, mappingConfig: ColumnMappingConfig, role: string): any {
  const originalName = getOriginalColumnName(mappingConfig, role);
  if (!originalName) return null;
  return dataRow[originalName];
}

/**
 * Get the value from a data row using original column name
 */
export function getValueByOriginalName(dataRow: any, originalName: string): any {
  return dataRow[originalName];
}

/**
 * Filter data by SKU using the correct column mapping
 */
export function filterDataBySKU(data: any[], mappingConfig: ColumnMappingConfig, sku: string): any[] {
  const materialCodeRole = 'Material Code';
  const originalName = getOriginalColumnName(mappingConfig, materialCodeRole);
  
  if (!originalName) {
    console.warn('No Material Code column mapping found');
    return [];
  }
  
  return data.filter(row => String(row[originalName]) === sku);
}

/**
 * Get unique SKUs from data using the correct column mapping
 */
export function getUniqueSKUs(data: any[], mappingConfig: ColumnMappingConfig): string[] {
  const materialCodeRole = 'Material Code';
  const originalName = getOriginalColumnName(mappingConfig, materialCodeRole);
  
  if (!originalName) {
    console.warn('No Material Code column mapping found');
    return [];
  }
  
  return Array.from(new Set(data.map(row => String(row[originalName])).filter(Boolean)));
}

/**
 * Get sales values from data using the correct column mapping
 */
export function getSalesValues(data: any[], mappingConfig: ColumnMappingConfig): number[] {
  const salesRole = 'Sales';
  const originalName = getOriginalColumnName(mappingConfig, salesRole);
  
  if (!originalName) {
    console.warn('No Sales column mapping found');
    return [];
  }
  
  return data.map(row => {
    const value = row[originalName];
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  });
}

/**
 * Get date values from data using the correct column mapping
 */
export function getDateValues(data: any[], mappingConfig: ColumnMappingConfig): string[] {
  const dateRole = 'Date';
  const originalName = getOriginalColumnName(mappingConfig, dateRole);
  
  if (!originalName) {
    console.warn('No Date column mapping found');
    return [];
  }
  
  return data.map(row => String(row[originalName] || ''));
}

/**
 * Create a mapping configuration from the processed data structure
 */
export function createMappingConfig(processedData: any): ColumnMappingConfig | null {
  if (!processedData || !processedData.columnRoles || !processedData.columns) {
    return null;
  }
  
  const columnMappings: ColumnMapping[] = [];
  
  // Create mappings from columns to roles
  for (let i = 0; i < processedData.columns.length; i++) {
    const originalName = processedData.columns[i];
    const role = processedData.columnRoles[i];
    
    if (originalName && role) {
      columnMappings.push({
        originalName,
        role
      });
    }
  }
  
  return {
    columnRoles: processedData.columnRoles,
    columnMappings,
    originalColumns: processedData.columns
  };
}

/**
 * Legacy compatibility: Get SKU value using fallback logic
 */
export function getSKUValue(dataRow: any, mappingConfig?: ColumnMappingConfig): string | null {
  if (mappingConfig) {
    // Use the mapping system
    return getValueByRole(dataRow, mappingConfig, 'Material Code');
  } else {
    // Fallback to legacy logic
    return dataRow['Material Code'] || dataRow.sku || dataRow.SKU || null;
  }
}

/**
 * Legacy compatibility: Filter data by SKU using fallback logic
 */
export function filterDataBySKULegacy(data: any[], sku: string, mappingConfig?: ColumnMappingConfig): any[] {
  if (mappingConfig) {
    // Use the mapping system
    return filterDataBySKU(data, mappingConfig, sku);
  } else {
    // Fallback to legacy logic
    return data.filter(row => {
      const rowSku = row['Material Code'] || row.sku || row.SKU;
      return String(rowSku) === sku;
    });
  }
} 