import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Bot, Brain, AlertCircle, Calendar, Hash, FileText } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { ErrorHandler } from './ErrorHandler';
import MarkdownRenderer from '../ui/MarkdownRenderer';
import { parseNumberWithFormat } from '@/utils/csvUtils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const PREVIEW_ROW_LIMIT = 15;

const TransposeDiagramSVG = () => {
  return (
    <div className="flex justify-center my-4">
      <svg width="1125" height="225" viewBox="0 0 1125 375" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="30" y="45" width="375" height="330" rx="27" fill="#fbe9e7" stroke="#fbbf24"/>
        <text x="225" y="90" textAnchor="middle" fontSize="33" fontWeight="bold" fill="#b45309">Dates as Rows</text>
        <text x="75" y="157.5" fontSize="22.5" fontWeight="bold" fill="#b45309">Date</text>
        <text x="180" y="157.5" fontSize="22.5" fontWeight="bold" fill="#b45309">SKU A</text>
        <text x="300" y="157.5" fontSize="22.5" fontWeight="bold" fill="#b45309">SKU B</text>
        <text x="75" y="210" fontSize="22.5" fill="#b45309">01/01</text>
        <rect x="150" y="187.5" width="75" height="39" fill="#fff" stroke="#fbbf24" rx="7.5"/>
        <text x="187.5" y="214.5" fontSize="22.5" fill="#b45309" textAnchor="middle">100</text>
        <rect x="270" y="187.5" width="75" height="39" fill="#fff" stroke="#fbbf24" rx="7.5"/>
        <text x="307.5" y="214.5" fontSize="22.5" fill="#b45309" textAnchor="middle">200</text>
        <text x="75" y="262.5" fontSize="22.5" fill="#b45309">01/02</text>
        <rect x="150" y="240" width="75" height="39" fill="#fff" stroke="#fbbf24" rx="7.5"/>
        <text x="187.5" y="267" fontSize="22.5" fill="#b45309" textAnchor="middle">120</text>
        <rect x="270" y="240" width="75" height="39" fill="#fff" stroke="#fbbf24" rx="7.5"/>
        <text x="307.5" y="267" fontSize="22.5" fill="#b45309" textAnchor="middle">210</text>
        <text x="75" y="315" fontSize="22.5" fill="#b45309">01/03</text>
        <rect x="150" y="292.5" width="75" height="39" fill="#fff" stroke="#fbbf24" rx="7.5"/>
        <text x="187.5" y="319.5" fontSize="22.5" fill="#b45309" textAnchor="middle">130</text>
        <rect x="270" y="292.5" width="75" height="39" fill="#fff" stroke="#fbbf24" rx="7.5"/>
        <text x="307.5" y="319.5" fontSize="22.5" fill="#b45309" textAnchor="middle">220</text>
        <polygon points="450,180 585,180 585,200 450,200" fill="#38bdf8"/>
        <polygon points="600,188 585,170 585,210" fill="#38bdf8"/>
        <text x="520" y="172.5" fontSize="27" fill="#38bdf8" textAnchor="middle">Transpose</text>
        <rect x="630" y="45" width="450" height="270" rx="27" fill="#e0e7ef" stroke="#b6c2d9"/>
        <text x="855" y="90" textAnchor="middle" fontSize="33" fontWeight="bold" fill="#1e293b">Dates as Columns</text>
        <text x="675" y="157.5" fontSize="22.5" fontWeight="bold" fill="#475569">SKU</text>
        <text x="780" y="157.5" fontSize="22.5" fontWeight="bold" fill="#475569">01/01</text>
        <text x="885" y="157.5" fontSize="22.5" fontWeight="bold" fill="#475569">01/02</text>
        <text x="990" y="157.5" fontSize="22.5" fontWeight="bold" fill="#475569">01/03</text>
        <text x="675" y="210" fontSize="22.5" fill="#475569">A</text>
        <rect x="765" y="187.5" width="75" height="39" fill="#fff" stroke="#b6c2d9" rx="7.5"/>
        <text x="802.5" y="214.5" fontSize="22.5" fill="#334155" textAnchor="middle">100</text>
        <rect x="870" y="187.5" width="75" height="39" fill="#fff" stroke="#b6c2d9" rx="7.5"/>
        <text x="907.5" y="214.5" fontSize="22.5" fill="#334155" textAnchor="middle">120</text>
        <rect x="975" y="187.5" width="75" height="39" fill="#fff" stroke="#b6c2d9" rx="7.5"/>
        <text x="1012.5" y="214.5" fontSize="22.5" fill="#334155" textAnchor="middle">130</text>
        <text x="675" y="262.5" fontSize="22.5" fill="#475569">B</text>
        <rect x="765" y="240" width="75" height="39" fill="#fff" stroke="#b6c2d9" rx="7.5"/>
        <text x="802.5" y="267" fontSize="22.5" fill="#334155" textAnchor="middle">200</text>
        <rect x="870" y="240" width="75" height="39" fill="#fff" stroke="#b6c2d9" rx="7.5"/>
        <text x="907.5" y="267" fontSize="22.5" fill="#334155" textAnchor="middle">210</text>
        <rect x="975" y="240" width="75" height="39" fill="#fff" stroke="#b6c2d9" rx="7.5"/>
        <text x="1012.5" y="267" fontSize="22.5" fill="#334155" textAnchor="middle">220</text>
      </svg>
    </div>
  );
};

interface PreviewStepProps {
  aiCsvImportEnabled: boolean;
  aiStep: 'upload' | 'describe' | 'ai-preview' | 'ai-mapping' | 'manual' | 'config';
  aiTransformedData: any[] | null;
  aiResultColumns: string[];
  aiReasoning: string;
  configReasoning: string;
  previewLoading: boolean;
  separator: string;
  transposed: boolean;
  data: any[];
  header: string[];
  originalHeaders: string[];
  onSeparatorChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onTransposeChange: (isChecked: boolean) => void;
  onBackToChoice: () => void;
  onBackToUpload: () => void;
  onNextToMapping: () => void;
  dateFormat: string;
  onDateFormatChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  numberFormat: string;
  onNumberFormatChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

export const PreviewStep: React.FC<PreviewStepProps> = ({
  aiCsvImportEnabled,
  aiStep,
  aiTransformedData,
  aiResultColumns,
  aiReasoning,
  configReasoning,
  previewLoading,
  separator,
  transposed,
  data,
  header,
  originalHeaders,
  onSeparatorChange,
  onTransposeChange,
  onBackToChoice,
  onBackToUpload,
  onNextToMapping,
  dateFormat,
  onDateFormatChange,
  numberFormat,
  onNumberFormatChange,
}) => {
  console.log('[renderContent] PreviewStep numberFormat:', numberFormat);

  // AI Preview
  if (aiCsvImportEnabled && aiStep === 'ai-preview' && aiTransformedData) {
    const totalRows = aiTransformedData.length;
    const previewCols = aiResultColumns;
    
    return (
      <div className="space-y-4">
        <div className="font-semibold">AI-Transformed Preview</div>
        
        {/* AI Instructions Display */}
        <div className="mt-4 border border-slate-200 rounded-lg bg-slate-50/50">
          <Collapsible>
            <CollapsibleTrigger asChild>
              <button className="flex justify-between items-center w-full p-3">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-slate-600" />
                  <span className="font-semibold text-slate-700">AI Instructions</span>
                </div>
                <div className="text-sm text-blue-600 hover:underline">
                  Show Details
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="p-4 pt-0">
              <div className="border-t border-slate-200 pt-3">
                <p className="text-sm text-slate-600">The AI was instructed to analyze the CSV and transform it into a standard format (one row per product, dates as columns), identifying product codes, descriptions, and sales values automatically.</p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
        
        {/* AI Reasoning Display */}
        {(aiReasoning || configReasoning) && (
          <div className="mt-4 border border-slate-200 rounded-lg bg-slate-50/50">
            <Collapsible>
              <CollapsibleTrigger asChild>
                <button className="flex justify-between items-center w-full p-3">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-slate-600" />
                    <span className="font-semibold text-slate-700">AI Reasoning</span>
                  </div>
                  <div className="text-sm text-blue-600 hover:underline">
                    Show Details
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="p-4 pt-0">
                <div className="border-t border-slate-200 pt-3">
                  <MarkdownRenderer content={aiReasoning || configReasoning} />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
        
        <div className="mb-2 text-sm text-slate-600 text-center">
          📊 Showing sample of {Math.min(totalRows, PREVIEW_ROW_LIMIT)} rows from your dataset
          {totalRows > PREVIEW_ROW_LIMIT && (
            <span className="block text-xs text-slate-500 mt-1">
              (Total dataset has {totalRows} rows)
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                {previewCols.map((col, i) => (
                  <th key={i} className="px-6 py-3 bg-slate-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(aiTransformedData || []).slice(0, PREVIEW_ROW_LIMIT).map((row, i) => (
                <tr key={i}>
                  {previewCols.map((col, j) => (
                    <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row[col]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {totalRows > PREVIEW_ROW_LIMIT && (
            <div className="text-xs text-slate-500 mt-2">Showing first {PREVIEW_ROW_LIMIT} of {totalRows} rows.</div>
          )}
        </div>
        <div className="flex justify-between mt-4">
          <Button variant="outline" onClick={onBackToChoice}>Back</Button>
          <Button onClick={onNextToMapping}>
            Next: Mapping
          </Button>
        </div>
      </div>
    );
  }

  // Manual Preview
  if (previewLoading) {
    return <ErrorHandler errorType="loading" />;
  }

  // Helper function to scroll to format selectors
  const handleFormatHelp = (type: 'date' | 'number') => {
    const selectorId = type === 'date' ? 'dateFormat' : 'numberFormat';
    const element = document.getElementById(selectorId);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element?.focus();
  };

  // Check for format validation errors in the preview data
  const hasFormatErrors = () => {
    if (!data || !data.length || !header || !header.length) return false;
    
    // Check for invalid format markers in the data
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i];
      for (const headerName of header) {
        const cellValue = row[headerName];
        if (typeof cellValue === 'string' && cellValue.includes('❌ Invalid')) {
          return true;
        }
      }
    }
    
    // Check for invalid format markers in headers
    for (const headerName of header) {
      if (typeof headerName === 'string' && headerName.includes('❌ Invalid')) {
        return true;
      }
    }
    
    return false;
  };

  // Check if CSV has too few columns (likely separator mismatch)
  const hasInsufficientColumns = () => {
    return !header || header.length < 4;
  };

  // Check for any validation issues that should block progression
  const hasValidationErrors = () => {
    return hasFormatErrors() || hasInsufficientColumns();
  };

  // Find the first numeric-looking value in the data for preview
  const getSampleNumericValue = () => {
    // Safety check: if header or data is empty/undefined, return null
    if (!header || header.length === 0 || !data || data.length === 0) {
      return null;
    }
    
    for (let i = 0; i < header.length; i++) {
      for (let j = 0; j < Math.min(10, data.length); j++) {
        const val = data[j][header[i]];
        if (typeof val === 'string' && /[0-9]/.test(val)) {
          return val;
        }
      }
    }
    return null;
  };
  const sampleValue = getSampleNumericValue();
  const parsedSample = sampleValue ? parseNumberWithFormat(sampleValue, numberFormat) : null;

  // Accept NUMBER_FORMAT_OPTIONS as a prop or define it here
  const NUMBER_FORMAT_OPTIONS = [
    '1,234.56',
    '1.234,56',
    '1234.56',
    '1234,56',
    '1 234,56',
    '1 234.56',
    '1234',
  ];

  return (
    <div className="space-y-4">
      <div className="font-medium text-slate-800 mb-1">Import CSV - Step 1: Upload & Preview</div>
      <div className="text-slate-600 text-sm mb-2 text-center">
        We expect your CSV to have <a href="#" className="text-blue-600 underline">dates as columns</a> (one row per product/SKU).<br />
        If the preview below looks wrong, click the button below to switch the orientation.
      </div>
      <TransposeDiagramSVG />
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="separator" className="text-sm">Separator:</label>
            <select
              id="separator"
              value={separator}
              onChange={onSeparatorChange}
              disabled={previewLoading}
              className={`border rounded px-2 py-1 text-sm bg-white ${
                hasInsufficientColumns() ? 'border-red-400 bg-red-50' : ''
              }`}
            >
              <option value=",">,</option>
              <option value=";">;</option>
              <option value="\t">Tab</option>
              <option value="|">|</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
                            <label htmlFor="dateFormat" className="text-sm">Date format:</label>
            <select
              id="dateFormat"
              value={dateFormat}
              onChange={onDateFormatChange}
              disabled={previewLoading}
              className="border rounded px-2 py-1 text-sm bg-white"
            >
              <option value="yyyy-mm-dd">YYYY-MM-DD (2023-12-31)</option>
              <option value="dd/mm/yyyy">DD/MM/YYYY (31/12/2023)</option>
              <option value="mm/dd/yyyy">MM/DD/YYYY (12/31/2023)</option>
              <option value="dd-mm-yyyy">DD-MM-YYYY (31-12-2023)</option>
              <option value="yyyy/mm/dd">YYYY/MM/DD (2023/12/31)</option>
              <option value="yyyy">YYYY (2023)</option>
              <option value="yyyy-ww">YYYY-WW (2023-W05)</option>
              <option value="ww-yyyy">WW-YYYY (W05-2023)</option>
              <option value="yyyy/ww">YYYY/WW (2023/W05)</option>
              <option value="ww/yyyy">WW/YYYY (W05/2023)</option>
              <option value="yyyy-wwrange">YYYY-WWW-WWW (2023-W01-W05)</option>
              <option value="weekrange">WW-WW (W01-W05)</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
                            <label htmlFor="numberFormat" className="text-sm">Numbers format:</label>
            <select
              id="numberFormat"
              value={numberFormat}
              onChange={onNumberFormatChange}
              disabled={previewLoading}
              className="border rounded px-2 py-1 text-sm bg-white"
            >
              {NUMBER_FORMAT_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{
                  opt === '1,234.56' ? '1,234.56 (comma thousands, dot decimal)' :
                  opt === '1.234,56' ? '1.234,56 (dot thousands, comma decimal)' :
                  opt === '1234.56' ? '1234.56 (no thousands, dot decimal)' :
                  opt === '1234,56' ? '1234,56 (no thousands, comma decimal)' :
                  opt === '1 234,56' ? '1 234,56 (space thousands, comma decimal)' :
                  opt === '1 234.56' ? '1 234.56 (space thousands, dot decimal)' :
                  opt === '1234' ? '1234 (integer)' : opt
                }</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm">Data appears transposed:</label>
            <Switch
              checked={transposed}
              onCheckedChange={onTransposeChange}
              disabled={previewLoading}
            />
          </div>
        </div>
        {data && data.length > 0 ? (
          <>
            <div className="mb-2 text-sm text-slate-600 text-center">
              📊 Showing sample of {data.length} rows from your dataset
              {data.length >= PREVIEW_ROW_LIMIT}
            </div>
            <div className="overflow-x-auto border rounded">
              <table className="min-w-full text-xs">
                <thead>
                  <tr>
                    {header && header.map((h, i) => {
                      const hasError = typeof h === 'string' && h.includes('❌ Invalid');
                      return (
                        <th 
                          key={i} 
                          className={`px-2 py-1 border-b whitespace-nowrap ${
                            hasError ? 'bg-red-100 border-red-400' : 'bg-slate-100'
                          }`}
                        >
                          {h}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {data && data.map((row, i) => (
                    <tr key={i} className="bg-white border-b hover:bg-gray-50">
                      {header && header.map((displayHeader, j) => {
                        // Use original header for data access, display header for display
                        const originalHeader = originalHeaders[j] || displayHeader;
                        const cellValue = row[originalHeader];
                        const hasError = typeof cellValue === 'string' && cellValue.includes('❌ Invalid');
                        return (
                          <td 
                            key={j} 
                            className={`px-4 py-2 whitespace-nowrap ${
                              hasError ? 'bg-red-50 border-l-4 border-red-400' : ''
                            }`}
                          >
                            {cellValue}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Validation warning - using ErrorHandler style */}
            {hasValidationErrors() && (
              <div className="mt-4 text-center py-6 border border-dashed rounded-lg bg-slate-50">
                <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                <div className="text-slate-700 font-medium mb-2">
                  {hasInsufficientColumns() && hasFormatErrors() 
                    ? 'Multiple validation issues detected'
                    : hasInsufficientColumns()
                    ? 'Insufficient columns detected'
                    : 'Format validation issues detected'
                  }
                </div>
                <div className="text-slate-500 text-sm mb-4">
                  {hasInsufficientColumns() && hasFormatErrors()
                    ? 'Your CSV has both column count and format issues that need to be resolved.'
                    : hasInsufficientColumns()
                    ? `Your CSV appears to have too few columns (${header ? header.length : 0} detected).`
                    : 'Some dates or numbers don\'t match the selected formats.'
                  }
                </div>
                
                <div className="text-left max-w-md mx-auto">
                  <div className="text-xs text-slate-600 font-medium mb-2">Suggestions:</div>
                  <ul className="text-xs text-slate-500 space-y-1 mb-4">
                    {hasInsufficientColumns() && (
                      <li className="flex items-start">
                        <span className="text-slate-400 mr-2">•</span>
                        <span>Try changing the separator setting above (currently: {separator})</span>
                      </li>
                    )}
                    {hasInsufficientColumns() && (
                      <li className="flex items-start">
                        <span className="text-slate-400 mr-2">•</span>
                        <span>Check if your CSV uses a different delimiter (comma, semicolon, tab, pipe)</span>
                      </li>
                    )}
                    {hasFormatErrors() && (
                      <li className="flex items-start">
                        <span className="text-slate-400 mr-2">•</span>
                        <span>Review the date and number format settings above</span>
                      </li>
                    )}
                    {hasFormatErrors() && (
                      <li className="flex items-start">
                        <span className="text-slate-400 mr-2">•</span>
                        <span>Ensure consistent formatting throughout your file</span>
                      </li>
                    )}
                  </ul>
                </div>

                {/* Helpful links */}
                <div className="border-t pt-4 mt-4">
                  <div className="text-xs text-slate-600 font-medium mb-2">Need help with formats?</div>
                  <div className="flex flex-wrap gap-2 justify-center text-xs">
                    <button
                      onClick={() => handleFormatHelp('date')}
                      className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                    >
                      <Calendar className="w-3 h-3" />
                      Date Format Help
                    </button>
                    <button
                      onClick={() => handleFormatHelp('number')}
                      className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                    >
                      <Hash className="w-3 h-3" />
                      Number Format Help
                    </button>
                    <button
                      onClick={() => {
                        // Open CSV structure help
                        window.open('https://help.example.com/csv-structure', '_blank');
                      }}
                      className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                    >
                      <FileText className="w-3 h-3" />
                      CSV Structure Guide
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={onBackToChoice}>Back</Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Button 
                        onClick={onNextToMapping}
                        disabled={hasValidationErrors()}
                        className={hasValidationErrors() ? 'opacity-50 cursor-not-allowed' : ''}
                      >
                        Next: Mapping
                      </Button>
                    </div>
                  </TooltipTrigger>
                  {hasValidationErrors() && (
                    <TooltipContent>
                      <p>
                        {hasInsufficientColumns() && hasFormatErrors()
                          ? 'Please fix the column count and format validation errors before proceeding'
                          : hasInsufficientColumns()
                          ? 'Please fix the column count issue (try changing the separator) before proceeding'
                          : 'Please fix the format validation errors before proceeding'
                        }
                      </p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          </>
        ) : (
          <ErrorHandler 
            errorType="no-data" 
            onBack={onBackToChoice}
            onFormatHelp={handleFormatHelp}
          />
        )}
      </div>
    </div>
  );
}; 