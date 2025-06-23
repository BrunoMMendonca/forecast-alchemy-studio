import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface MapStepProps {
  isAIMapping: boolean;
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
}

export const MapStep: React.FC<MapStepProps> = ({
  isAIMapping,
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
}) => {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Step 2: Map Columns</h3>
      {aiTransformResult && isAIMapping && (
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
                  if (isAIMapping) {
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
                if (val && !customAggTypes.includes(val)) {
                  setCustomAggTypes(prev => [...prev, val]);
                  e.currentTarget.value = '';
                }
              }
            }}
          />
        </div>
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
                      if (isAIMapping) {
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
                  >
                    {DROPDOWN_OPTIONS.filter(opt => {
                      const isMultiAllowed = opt.value === 'Ignore' || opt.value === 'Date';
                      const isAssignedElsewhere = mappingRoles.some((role, idx) => idx !== i && role === opt.value);
                      return !(!isMultiAllowed && isAssignedElsewhere);
                    }).map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
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
                    {row[header]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dateRange.start !== -1 && dateRange.end !== -1 && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs">Date columns from</span>
          <select
            value={dateRange.start}
            onChange={e => handleDateRangeChange('start', Number(e.target.value))}
            className="border rounded px-1 py-0.5 text-xs"
          >
            {(Array.isArray(mappingRoles) ? mappingRoles : []).map((role, i) => role === 'Date' && <option key={i} value={i}>{(Array.isArray(previewHeader) ? previewHeader : [])[i]}</option>)}
          </select>
          <span className="text-xs">to</span>
          <select
            value={dateRange.end}
            onChange={e => handleDateRangeChange('end', Number(e.target.value))}
            className="border rounded px-1 py-0.5 text-xs"
          >
            {(Array.isArray(mappingRoles) ? mappingRoles : []).map((role, i) => role === 'Date' && <option key={i} value={i}>{(Array.isArray(previewHeader) ? previewHeader : [])[i]}</option>)}
          </select>
        </div>
      )}
      <div className="mt-4">
        <h4 className="font-medium mb-2">Preview Normalized Data</h4>
        <div className="overflow-x-auto border rounded-lg bg-white">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {(Array.isArray(mappingNormalizedHeaders) ? mappingNormalizedHeaders : []).map(h => <th key={h} className="px-2 py-1 bg-slate-100 border-b">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {mappingNormalizedData.slice(0, 10).map((row, i) => (
                <tr key={i}>
                  {mappingNormalizedHeaders.map(header => (
                    <td key={header} className="px-4 py-2 whitespace-nowrap text-sm text-slate-700">{row[header]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex justify-between mt-4">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <div className="flex flex-col items-end">
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