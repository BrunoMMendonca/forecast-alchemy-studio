import React from 'react';
import { parseDateWithFormat } from '@/utils/dateUtils';

// Helper function to get icon for column role
const getRoleIcon = (role: string, context: string, orgStructure?: any) => {
  switch (role) {
    case 'Material Code':
      return '🔢';
    case 'Description':
      return '📄';
    case 'Date':
      return '📅';
    case 'Division':
      // Only show special icon if Division is enabled AND available in current context
      console.log('🔍 [GET ROLE ICON] Division role check:', {
        context,
        hasMultipleDivisions: orgStructure?.hasMultipleDivisions,
        importLevel: orgStructure?.importLevel,
        divisionCsvType: orgStructure?.divisionCsvType
      });
      
      if (context === 'setup' && orgStructure?.hasMultipleDivisions) {
        // Check if Division role is actually available (same logic as getAvailableColumnRoles)
        const { importLevel, divisionCsvType } = orgStructure;
        const isDivisionAvailable = importLevel === 'company' || 
                                  (importLevel === 'division' && divisionCsvType === 'withDivisionColumn');
        
        console.log('🔍 [GET ROLE ICON] Division availability check:', {
          importLevel,
          divisionCsvType,
          isDivisionAvailable
        });
        
        if (isDivisionAvailable) {
          console.log('✅ [GET ROLE ICON] Returning building icon for Division');
          return '🏢';
        }
      }
      console.log('❌ [GET ROLE ICON] Returning sigma symbol for Division');
      return 'Σ'; // Show aggregatable field icon when disabled or unavailable
    case 'Cluster':
      // Only show special icon if Cluster is enabled in organizational structure
      if (context === 'setup' && orgStructure?.hasMultipleClusters) {
        return '📍';
      }
      return 'Σ'; // Show aggregatable field icon when disabled
    case 'Lifecycle Phase':
      // Only show special icon if Lifecycle tracking is enabled in organizational structure
      if (context === 'setup' && orgStructure?.enableLifecycleTracking) {
        return '❤️'; // Red heart - represents the life/vitality of the product through its lifecycle
      }
      return 'Σ'; // Show aggregatable field icon when disabled
    case 'Ignore':
      return '❌';
    default:
      // For any other role (including Division/Cluster when they become aggregatable fields),
      // show the standard aggregatable field icon
      return 'Σ';
  }
};

interface InteractiveMappingTableProps {
  headers: string[];
  rows: any[];
  columnRoles: string[];
  dropdownOptions: { value: string; label: string }[];
  dateFormat: string;
  context?: 'forecast' | 'setup';
  orgStructure?: any;
  onRoleChange?: (colIdx: number, role: string) => void;
  isReadOnly?: boolean;
  rowLimit?: number;
  showSampleInfo?: boolean;
}

export const InteractiveMappingTable: React.FC<InteractiveMappingTableProps> = ({
  headers,
  rows,
  columnRoles,
  dropdownOptions,
  dateFormat,
  context = 'forecast',
  orgStructure,
  onRoleChange,
  isReadOnly = false,
  rowLimit = 10,
  showSampleInfo = true
}) => {
  // Helper function to check if a column contains valid dates
  const isDateColumn = (colIdx: number): boolean => {
    if (!rows || rows.length === 0) return false;
    
    const columnValues = rows.map(row => row[headers[colIdx]]);
    const validDates = columnValues.filter(val => {
      if (!val || typeof val !== 'string') return false;
      return parseDateWithFormat(val, dateFormat) !== null;
    });
    
    // At least 50% of values should be valid dates
    return validDates.length >= columnValues.length * 0.5;
  };

  // Helper to safely render cell values
  const safeCellValue = (val: any) => {
    if (val === undefined || val === null || val === '' || (typeof val === 'number' && isNaN(val)) || val === 'NaN') {
      return '';
    }
    return String(val);
  };

  return (
    <div className="space-y-4">
      {showSampleInfo && (
        <div className="text-sm text-slate-600 text-center">
          📊 Showing sample of {Math.min(rows.length, rowLimit)} rows from your dataset
          {rows.length > rowLimit && (
            <span className="block text-xs text-slate-500 mt-1">
              (Total dataset has {rows.length} rows)
            </span>
          )}
        </div>
      )}
      
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-xs">
          <thead>
            <tr>
              {(Array.isArray(headers) ? headers : []).map((h, i) => (
                <th key={i} className="px-2 py-1 bg-slate-100 border-b">
                  <div>{h}</div>
                  {!isReadOnly ? (
                    <select
                      value={columnRoles[i] || 'Ignore'}
                      onChange={e => onRoleChange?.(i, e.target.value)}
                      className="mt-1 border rounded px-1 py-0.5 text-xs"
                      disabled={columnRoles[i] === 'Date'}
                    >
                      {columnRoles[i] === 'Date' ? (
                        <>
                          <option value="Date">📅 Date</option>
                          <option value="Ignore">❌ Ignore</option>
                        </>
                      ) : (
                        dropdownOptions.filter(opt => {
                          const isMultiAllowed = opt.value === 'Ignore' || opt.value === 'Date';
                          const isAssignedElsewhere = columnRoles.some((role, idx) => idx !== i && role === opt.value);
                          // Only show "Date" option if the column contains valid dates
                          if (opt.value === 'Date' && !isDateColumn(i)) {
                            return false;
                          }
                          return !(!isMultiAllowed && isAssignedElsewhere);
                        }).map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {getRoleIcon(opt.value, context, orgStructure)} {opt.label}
                          </option>
                        ))
                      )}
                    </select>
                  ) : (
                    <div className="mt-1 px-1 py-0.5 text-xs bg-gray-50 rounded">
                      {getRoleIcon(columnRoles[i] || 'Ignore', context, orgStructure)} {columnRoles[i] || 'Ignore'}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {rows.slice(0, rowLimit).map((row, rowIdx) => (
              <tr key={rowIdx}>
                {headers.map((header, colIdx) => (
                  <td key={colIdx} className="px-4 py-2 whitespace-nowrap text-sm text-slate-700">
                    {safeCellValue(row[header])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}; 