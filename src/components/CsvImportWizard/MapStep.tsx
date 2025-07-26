import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { parseDateWithFormat } from '@/utils/dateUtils';
import { useSetupWizardStore } from '@/store/setupWizardStore';

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
      // Only show special icon if Division is enabled in organizational structure
      if (context === 'setup' && orgStructure?.hasMultipleDivisions) {
        return '🏢';
      }
      return 'Σ'; // Show aggregatable field icon when disabled
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

interface MapStepProps {
  isAiMapping: boolean;
  mappingHeader: string[];
  mappingRows: any[];
  mappingRoles: string[];
  mappingNormalizedHeaders: string[];
  mappingNormalizedData: any[];
  mappingHasMaterialCode: boolean;
  DROPDOWN_OPTIONS: { value: string; label: string }[];
  mappingRowLimit: number;
  customAggTypes: string[];
  setCustomAggTypes: (fn: (prev: string[]) => string[]) => void;
  setAiColumnRoles: (fn: (prev: string[]) => string[]) => void;
  setColumnRoles: (fn: (prev: string[]) => string[]) => void;
  handleRoleChange: (colIdx: number, role: string) => void;
  aiTransformResult: any;
  dateRange: { start: number; end: number };
  handleDateRangeChange: (which: 'start' | 'end', idx: number) => void;
  previewHeader: string[];
  manualConfirmLoading: boolean;
  handleConfirmClick: () => Promise<void>;
  onBack: () => void;
  dateFormat: string;
  context?: 'forecast' | 'setup';
  onProceedToNextStep?: () => Promise<void>;
}

export const MapStep: React.FC<MapStepProps> = ({
  isAiMapping,
  mappingHeader,
  mappingRows,
  mappingRoles,
  mappingNormalizedHeaders,
  mappingNormalizedData,
  mappingHasMaterialCode,
  DROPDOWN_OPTIONS,
  mappingRowLimit,
  customAggTypes,
  setCustomAggTypes,
  setAiColumnRoles,
  setColumnRoles,
  handleRoleChange,
  aiTransformResult,
  dateRange,
  handleDateRangeChange,
  previewHeader,
  manualConfirmLoading,
  handleConfirmClick,
  onBack,
  dateFormat,
  context = 'forecast',
  onProceedToNextStep,
}) => {
  // Get setup wizard store for organizational structure
  const setupWizardStore = useSetupWizardStore();
  const orgStructure = context === 'setup' ? setupWizardStore.orgStructure : null;

  // Helper function to check if a column contains valid dates
  const isDateColumn = (colIdx: number): boolean => {
    if (!mappingRows || mappingRows.length === 0) return false;
    
    const columnValues = mappingRows.map(row => row[mappingHeader[colIdx]]);
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
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Step 2: Map Columns</h3>
      

      {aiTransformResult && isAiMapping && (
        <div className="mb-4">
          <h4 className="font-medium mb-2">AI-Suggested Mappings</h4>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(aiTransformResult.columnMappings) as [string, string][]).map(([header, role]) => (
              <span key={header} className="bg-blue-100 text-blue-800 rounded px-2 py-1 text-xs">
                {header} → {role}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="mb-4">
        <h4 className="font-medium mb-2">Custom Aggregatable Fields</h4>
        <div className="flex flex-wrap gap-2 items-center">
          {customAggTypes.map((type) => (
            <span key={type} className="flex items-center bg-blue-100 text-blue-800 rounded px-2 py-1 text-xs">
              Σ {type}
              <button
                className="ml-1 text-blue-500 hover:text-red-500"
                onClick={() => {
                  setCustomAggTypes(prev => prev.filter(t => t !== type));
                  if (isAiMapping) {
                    setAiColumnRoles(prev => prev.map(role => role === type ? 'Ignore' : role));
                  } else {
                    setColumnRoles(prev => prev.map(role => role === type ? 'Ignore' : role));
                  }
                }}
                aria-label={`Remove custom field ${type}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            className="border rounded px-1 py-0.5 text-xs w-32"
            placeholder="Add custom field..."
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const val = e.currentTarget.value.trim();
                if (
                  val &&
                  !customAggTypes.includes(val) &&
                  !mappingHeader.includes(val)
                ) {
                  setCustomAggTypes(prev => [...prev, val]);
                  e.currentTarget.value = '';
                }
              }
            }}
          />
        </div>
      </div>
      <div className="mb-2 text-sm text-slate-600 text-center">
        📊 Showing sample of {Math.min(mappingRows.length, mappingRowLimit)} rows from your dataset
        {mappingRows.length > mappingRowLimit && (
          <span className="block text-xs text-slate-500 mt-1">
            (Total dataset has {mappingRows.length} rows)
          </span>
        )}
      </div>
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-xs">
          <thead>
            <tr>
              {(Array.isArray(mappingHeader) ? mappingHeader : []).map((h, i) => (
                <th key={i} className="px-2 py-1 bg-slate-100 border-b">
                  <div>{h}</div>
                  <select
                    value={mappingRoles[i] || 'Ignore'}
                    onChange={e => {
                      if (isAiMapping) {
                        setAiColumnRoles(prev => {
                          const newRoles = [...prev];
                          newRoles[i] = e.target.value;
                          return newRoles;
                        });
                      } else {
                        handleRoleChange(i, e.target.value);
                      }
                    }}
                    className="mt-1 border rounded px-1 py-0.5 text-xs"
                    disabled={mappingRoles[i] === 'Date'}
                  >
                    {mappingRoles[i] === 'Date' ? (
                      <>
                        <option value="Date">📅 Date</option>
                        <option value="Ignore">❌ Ignore</option>
                      </>
                    ) : (
                      DROPDOWN_OPTIONS.filter(opt => {
                        const isMultiAllowed = opt.value === 'Ignore' || opt.value === 'Date';
                        const isAssignedElsewhere = mappingRoles.some((role, idx) => idx !== i && role === opt.value);
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
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {mappingRows.slice(0, mappingRowLimit).map((row, rowIdx) => (
              <tr key={rowIdx}>
                {mappingHeader.map((header, colIdx) => (
                  <td key={colIdx} className="px-4 py-2 whitespace-nowrap text-sm text-slate-700">
                    {safeCellValue(row[header])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
            </div>
      
      <div className="flex justify-between mt-4">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <div className="flex flex-col items-end gap-2">
          <Button onClick={handleConfirmClick} disabled={manualConfirmLoading || !mappingHasMaterialCode}>
            {manualConfirmLoading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Confirm Mapping & Import'
            )}
          </Button>
          

          
          {!mappingHasMaterialCode && (
            <span className="text-xs text-red-600 mt-1">You must map at least one column as <b>Material Code</b> to continue.</span>
          )}
        </div>
      </div>
    </div>
  );
}; 