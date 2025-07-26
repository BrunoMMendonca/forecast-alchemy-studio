import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Upload, FileText, Calendar, Hash } from 'lucide-react';
import { useSetupWizardStore } from '@/store/setupWizardStore';
import { InteractiveMappingTable } from '@/components/CsvImportWizard/InteractiveMappingTable';
import { parseNumberWithFormat } from '@/utils/csvUtils';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
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

interface CsvMappingStepProps {
  onNext: () => void;
  onBack: () => void;
}

const CsvMappingStep: React.FC<CsvMappingStepProps> = ({ onNext, onBack }) => {
  const { orgStructure, fieldMappings } = useSetupWizardStore();
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<string>('');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [originalHeaders, setOriginalHeaders] = useState<string[]>([]);
  const [columnRoles, setColumnRoles] = useState<string[]>([]);
  const [separator, setSeparator] = useState<string>(',');
  const [dateFormat, setDateFormat] = useState<string>('dd/mm/yyyy');
  const [numberFormat, setNumberFormat] = useState<string>('1,234.56');
  const [transposed, setTransposed] = useState<boolean>(false);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [aiStep, setAiStep] = useState<'upload' | 'describe' | 'ai-preview' | 'ai-mapping' | 'manual' | 'config'>('upload');
  const [aiTransformedData, setAiTransformedData] = useState<any[] | null>(null);
  const [aiResultColumns, setAiResultColumns] = useState<string[]>([]);
  const [aiReasoning, setAiReasoning] = useState<string>('');
  const [configReasoning, setConfigReasoning] = useState<string>('');

  // Get available column roles for dropdown
  const dropdownOptions = React.useMemo(() => {
    const baseRoles = ['Material Code', 'Description', 'Date', 'Ignore'];
    
    if (orgStructure.hasMultipleDivisions && 
        (orgStructure.importLevel === 'company' || 
         (orgStructure.importLevel === 'division' && orgStructure.divisionCsvType === 'withDivisionColumn'))) {
      baseRoles.push('Division');
    }
    
    if (orgStructure.hasMultipleClusters) {
      baseRoles.push('Cluster');
    }
    
    if (orgStructure.enableLifecycleTracking) {
      baseRoles.push('Lifecycle Phase');
    }
    
    // Add dynamic roles from CSV headers
    const dynamicRoles = headers?.filter((h, i) => {
      if (baseRoles.includes(h)) return false;
      if (columnRoles?.[i] === 'Date') return false;
      return true;
    }).map(h => ({ value: h, label: h })) || [];
    
    return [
      ...baseRoles.map(role => ({ value: role, label: role })),
      ...dynamicRoles
    ];
  }, [headers, orgStructure, columnRoles]);

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setCsvData(text);
        generatePreview(text);
      };
      reader.readAsText(file);
    }
  };

  // Generate preview from CSV data
  const generatePreview = async (csvText: string) => {
    setPreviewLoading(true);
    try {
      const response = await fetch('/api/generate-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          csvData: csvText,
          separator,
          dateFormat,
          numberFormat,
          transposed
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setPreviewData(result.previewData || []);
        setHeaders(result.columns || []);
        setOriginalHeaders(result.originalColumns || []);
        setColumnRoles(result.columnRoles || []);
        setAiReasoning(result.aiReasoning || '');
        setConfigReasoning(result.configReasoning || '');
        
        if (result.aiTransformedData) {
          setAiTransformedData(result.aiTransformedData);
          setAiResultColumns(result.aiResultColumns || []);
          setAiStep('ai-preview');
        } else {
          setAiStep('manual');
        }
      } else {
        console.error('Failed to generate preview');
      }
    } catch (error) {
      console.error('Error generating preview:', error);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Handle format changes
  const handleSeparatorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSeparator = e.target.value;
    setSeparator(newSeparator);
    if (csvData) {
      generatePreview(csvData);
    }
  };

  const handleDateFormatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDateFormat = e.target.value;
    setDateFormat(newDateFormat);
    if (csvData) {
      generatePreview(csvData);
    }
  };

  const handleNumberFormatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newNumberFormat = e.target.value;
    setNumberFormat(newNumberFormat);
    if (csvData) {
      generatePreview(csvData);
    }
  };

  const handleTransposeChange = (isChecked: boolean) => {
    setTransposed(isChecked);
    if (csvData) {
      generatePreview(csvData);
    }
  };

  // Handle role changes
  const handleRoleChange = (colIdx: number, role: string) => {
    const newRoles = [...columnRoles];
    newRoles[colIdx] = role;
    setColumnRoles(newRoles);
  };

  // Save mapping configuration
  const handleSaveMapping = () => {
    const mappingConfig = {
      mappings: columnRoles.map((role, index) => ({
        csvColumn: headers[index],
        role: role
      })),
      dateFormat,
      numberFormat,
      separator,
      transposed,
      sampleFile: file?.name || 'sample.csv'
    };

    useSetupWizardStore.getState().setOrgStructure({
      columnMappingConfig: mappingConfig
    });

    onNext();
  };

  // Check for validation errors
  const hasValidationErrors = () => {
    if (!previewData.length || !headers.length) return false;
    
    // Check for insufficient columns
    if (headers.length < 4) return true;
    
    // Check for format errors
    for (let i = 0; i < Math.min(10, previewData.length); i++) {
      const row = previewData[i];
      for (const headerName of headers) {
        const cellValue = row[headerName];
        if (typeof cellValue === 'string' && cellValue.includes('❌ Invalid')) {
          return true;
        }
      }
    }
    
    return false;
  };

  // Helper function to scroll to format selectors
  const handleFormatHelp = (type: 'date' | 'number') => {
    const selectorId = type === 'date' ? 'dateFormat' : 'numberFormat';
    const element = document.getElementById(selectorId);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element?.focus();
  };

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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" />
            CSV Column Mapping Configuration
          </CardTitle>
          <CardDescription>
            Upload a sample CSV file to configure how your columns map to our system fields. 
            This configuration will be used for all future data imports.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload Section */}
          {!file && (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Upload Sample CSV File
              </h3>
              <p className="text-gray-600 mb-4">
                Upload a sample CSV file with your data structure to configure column mappings.
              </p>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
                className="hidden"
                id="csv-file-input"
              />
              <label
                htmlFor="csv-file-input"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
              >
                Choose File
              </label>
            </div>
          )}

          {/* File Info */}
          {file && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-800">
                  {file.name} uploaded successfully
                </span>
              </div>
              <p className="text-sm text-green-700 mt-1">
                Configure the column mappings below using the preview data.
              </p>
            </div>
          )}

          {/* Format Configuration */}
          {file && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">CSV Format Configuration</h4>
              <div className="text-slate-600 text-sm mb-4 text-center">
                We expect your CSV to have <a href="#" className="text-blue-600 underline">dates as columns</a> (one row per product/SKU).<br />
                If the preview below looks wrong, adjust the settings below.
              </div>
              <TransposeDiagramSVG />
              
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <label htmlFor="separator" className="text-sm">Separator:</label>
                  <select
                    id="separator"
                    value={separator}
                    onChange={handleSeparatorChange}
                    disabled={previewLoading}
                    className="border rounded px-2 py-1 text-sm bg-white"
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
                    onChange={handleDateFormatChange}
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
                    onChange={handleNumberFormatChange}
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
                    onCheckedChange={handleTransposeChange}
                    disabled={previewLoading}
                  />
                </div>
              </div>
            </div>
          )}

          {/* AI Preview */}
          {aiStep === 'ai-preview' && aiTransformedData && (
            <div className="space-y-4">
              <div className="font-semibold">AI-Transformed Preview</div>
              
              {/* AI Instructions Display */}
              <div className="border border-slate-200 rounded-lg bg-slate-50/50">
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <button className="flex justify-between items-center w-full p-3">
                      <div className="flex items-center gap-2">
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
                <div className="border border-slate-200 rounded-lg bg-slate-50/50">
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <button className="flex justify-between items-center w-full p-3">
                        <div className="flex items-center gap-2">
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
              
              <InteractiveMappingTable
                headers={aiResultColumns}
                rows={aiTransformedData}
                columnRoles={columnRoles}
                dropdownOptions={dropdownOptions}
                dateFormat={dateFormat}
                context="setup"
                orgStructure={orgStructure}
                onRoleChange={handleRoleChange}
                isReadOnly={false}
                rowLimit={5}
                showSampleInfo={true}
              />
            </div>
          )}

          {/* Manual Preview */}
          {aiStep === 'manual' && previewData.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Data Preview & Column Mapping</h4>
              
              {/* Validation Errors */}
              {hasValidationErrors() && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Format issues detected:</strong> Please adjust the format settings above to resolve validation errors before proceeding.
                  </AlertDescription>
                </Alert>
              )}
              
              <InteractiveMappingTable
                headers={headers}
                rows={previewData}
                columnRoles={columnRoles}
                dropdownOptions={dropdownOptions}
                dateFormat={dateFormat}
                context="setup"
                orgStructure={orgStructure}
                onRoleChange={handleRoleChange}
                isReadOnly={false}
                rowLimit={5}
                showSampleInfo={true}
              />
            </div>
          )}

          {/* Loading State */}
          {previewLoading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Generating preview...</p>
            </div>
          )}

          {/* Mapping Summary */}
          {columnRoles.length > 0 && (
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium mb-2">Mapping Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Mapped Columns:</span>{' '}
                  {columnRoles.filter(role => role && role !== 'Ignore').length}
                </div>
                <div>
                  <span className="font-medium">Unmapped Columns:</span>{' '}
                  {columnRoles.filter(role => !role || role === 'Ignore').length}
                </div>
                <div>
                  <span className="font-medium">Date Columns:</span>{' '}
                  {columnRoles.filter(role => role === 'Date').length}
                </div>
                <div>
                  <span className="font-medium">Value Columns:</span>{' '}
                  {columnRoles.filter(role => role === 'Sales').length}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Button 
                  onClick={handleSaveMapping}
                  disabled={!file || previewLoading || hasValidationErrors()}
                  className={(!file || previewLoading || hasValidationErrors()) ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  Save Mapping Configuration
                </Button>
              </div>
            </TooltipTrigger>
            {(!file || previewLoading || hasValidationErrors()) && (
              <TooltipContent>
                <p>
                  {!file ? 'Please upload a sample CSV file first' :
                   previewLoading ? 'Please wait for preview generation to complete' :
                   'Please fix the format validation errors before proceeding'}
                </p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

export default CsvMappingStep; 