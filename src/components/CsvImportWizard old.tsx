import React, { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Upload, RefreshCw, Info, Sparkles, Bot, User, Settings, ArrowRight, Zap, FileText, ChevronsRight, AlertTriangle, Brain } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { parseDateWithFormat } from '@/utils/dateUtils';
import { transformDataWithAI, AITransformResult } from '@/utils/aiDataTransform';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { aiService, AIQuestion, AIResponse } from '@/services/aiService';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import { useAISettings } from '@/hooks/useAISettings';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import MarkdownRenderer from './ui/MarkdownRenderer';
import { NormalizedSalesData } from '@/types/forecast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export interface CsvUploadResult {
  success: boolean;
  filePath: string;
  summary: {
    skuCount: number;
    dateRange: [string, string];
    totalPeriods: number;
  };
  skuList: string[];
}

interface CsvImportWizardProps {
  onDataReady: (result: CsvUploadResult) => void;
  onConfirm: (result: CsvUploadResult) => Promise<void>;
  onFileNameChange?: (fileName: string) => void;
  lastImportFileName?: string | null;
  lastImportTime?: string | null;
  onAIFailure: (errorMessage: string) => void;
}

const SEPARATORS = [',', ';', '\t', '|'];
const PREVIEW_ROW_LIMIT = 15;

function transpose(matrix: any[][]): any[][] {
  return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
}

const COLUMN_ROLES = ['Material Code', 'Description', 'Date', 'Ignore'] as const;
type ColumnRole = string;

const FIXED_ROLES = [
  { value: 'Material Code', label: '🔢 Material Code' },
  { value: 'Description', label: '📝 Description' },
  { value: 'Date', label: '📅 Date' },
];

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

export const CsvImportWizard: React.FC<CsvImportWizardProps> = ({ onDataReady, onConfirm, onFileNameChange, lastImportFileName, lastImportTime, onAIFailure }) => {
  const [file, setFile] = useState<File | null>(null);
  const [separator, setSeparator] = useState<string>(',');
  const [data, setData] = useState<any[]>([]);
  const [header, setHeader] = useState<string[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'mapping'>('upload');
  
  console.log('[CsvImportWizard] Rendering with props:', { lastImportFileName, lastImportTime });
  console.log('[CsvImportWizard] Current step:', step);
  
  const [error, setError] = useState<string | null>(null);
  const [transposed, setTransposed] = useState(false);
  const [columnRoles, setColumnRoles] = useState<ColumnRole[]>([]);
  const [aiColumnRoles, setAiColumnRoles] = useState<ColumnRole[]>([]);
  const [dateRange, setDateRange] = useState<{ start: number; end: number }>({ start: -1, end: -1 });
  const [isDragging, setIsDragging] = useState(false);
  const [customAggTypes, setCustomAggTypes] = useState<string[]>([]);
  const [dateFormat, setDateFormat] = useState<string>('dd/mm/yyyy');
  const [aiTransformResult, setAiTransformResult] = useState<AITransformResult | null>(null);
  const [showAiSuggestions, setShowAiSuggestions] = useState(true);
  const { aiCsvImportEnabled, largeFileProcessingEnabled, largeFileThreshold, aiReasoningEnabled } = useGlobalSettings();
  const { enabled: aiFeaturesEnabled } = useAISettings();

  // New state for AI-powered flow
  const [aiStep, setAiStep] = useState<'upload' | 'describe' | 'ai-preview' | 'ai-mapping' | 'manual' | 'config'>('upload');
  const [aiTransformedData, setAiTransformedData] = useState<any[] | null>(null);
  const [aiResultColumns, setAiResultColumns] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);
  const [originalCsv, setOriginalCsv] = useState<string>('');

  // Add a loading state for manual preview parsing
  const [previewLoading, setPreviewLoading] = useState(false);
  const [manualConfirmLoading, setManualConfirmLoading] = useState(false);

  // State for configuration-based large file processing
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [generatedConfig, setGeneratedConfig] = useState<any>(null);
  const [configApplied, setConfigApplied] = useState(false);
  const [configProcessingStage, setConfigProcessingStage] = useState<'initializing' | 'generating_config' | 'applying_config' | 'parsing_result'>('initializing');
  const [uploadResult, setUploadResult] = useState<CsvUploadResult | null>(null);

  // New state for AI reasoning capture
  const [aiReasoning, setAiReasoning] = useState<string>('');
  const [configReasoning, setConfigReasoning] = useState<string>('');
  const [showReasoning, setShowReasoning] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // New state for large file detection
  const [largeFileDetected, setLargeFileDetected] = useState(false);
  const [showLargeFileAlert, setShowLargeFileAlert] = useState(true);

  // Add new state for AI processing stages
  const [aiProcessingStage, setAiProcessingStage] = useState<'initializing' | 'preparing_request' | 'waiting_for_ai' | 'parsing_response' | 'applying_transform' | 'finalizing'>('initializing');

  const DATE_FORMAT_OPTIONS = [
    { value: 'dd/mm/yyyy', label: 'dd/mm/yyyy' },
    { value: 'mm/dd/yyyy', label: 'mm/dd/yyyy' },
    { value: 'yyyy-mm-dd', label: 'yyyy-mm-dd' },
    { value: 'dd-mm-yyyy', label: 'dd-mm-yyyy' },
    { value: 'yyyy/mm/dd', label: 'yyyy/mm/dd' },
  ];

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    const csvFile = files.find(file => file.type === 'text/csv' || file.name.endsWith('.csv'));
    if (csvFile) {
      handleFileChange({ target: { files: [csvFile] } } as any);
    } else {
      setError('Please upload a CSV file');
    }
  };

  const handleDropAreaClick = () => {
    document.getElementById('csv-upload-input')?.click();
  };

  const hasMaterialCode = columnRoles.includes('Material Code');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      setError(null);
      if (typeof onFileNameChange === 'function') {
        onFileNameChange(f.name);
      }
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        setOriginalCsv(text);
        
        // --- FIX: Detect large file based on its size and settings ---
        if (largeFileProcessingEnabled && text.length > largeFileThreshold) {
          setLargeFileDetected(true);
        } else {
          setLargeFileDetected(false);
        }
        
        // --- NEW: Call backend for preview ---
        setPreviewLoading(true);
        try {
          const response = await fetch('/api/generate-preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ csvData: text }),
          });
          const result = await response.json();
          if (!response.ok) {
            throw new Error(result.error || 'Failed to generate preview from backend.');
          }

          setHeader(result.headers);
          setData(result.previewRows);
          setColumnRoles(result.columnRoles);
          setSeparator(result.separator);
          setTransposed(result.transposed);
          
          // Now that preview is ready, decide the next step
          if (aiCsvImportEnabled) {
          setAiStep('describe');
          } else {
            setAiStep('manual');
          }
          setStep('preview');

        } catch (err: any) {
          setError(err.message);
          // Fallback to an error state, do not attempt to process on client
        } finally {
          setPreviewLoading(false);
        }
        // --- END NEW ---
      };
      reader.readAsText(f);
    }
  };

  const handlePreviewRegeneration = async (overrides: { separator?: string; transposed?: boolean }) => {
    if (!originalCsv) return;
    setPreviewLoading(true);

    // Preserve existing settings if not being overridden, but prioritize what's in the override.
    const newSeparator = 'separator' in overrides ? overrides.separator : separator;
    const newTransposed = 'transposed' in overrides ? overrides.transposed : transposed;

    try {
      const response = await fetch('/api/generate-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvData: originalCsv,
          separator: newSeparator,
          transposed: newTransposed
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to regenerate preview.' }));
        throw new Error(errorData.error || `HTTP Error: ${response.status}`);
      }

      const result = await response.json();

      setHeader(result.headers);
      setData(result.previewRows);
      // The backend now drives these states
      setSeparator(result.separator);
      setTransposed(result.transposed);
      setColumnRoles(result.columnRoles);

    } catch (err: any) {
      console.error('Preview Regeneration Error:', err);
      // You might want to show a toast notification to the user here.
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSeparatorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSeparator = e.target.value;
    setSeparator(newSeparator); // Optimistically update the UI for the dropdown itself
    handlePreviewRegeneration({ separator: newSeparator, transposed });
  };
  
  const handleTransposeChange = (isChecked: boolean) => {
    setTransposed(isChecked); // Optimistically update the UI for the switch
    handlePreviewRegeneration({ transposed: isChecked, separator });
  };

  // Compute preview header/rows based on transpose
  // This logic is now greatly simplified as the backend provides the direct preview
  const previewHeader = header;
  const previewRows = data;

  // Auto-detect column roles and date range on preview
  useEffect(() => {
    // This effect is now simplified. The backend sends the roles.
    // We just need to find the date range from the roles provided.
    if (columnRoles.length > 0) {
      const dateCols = columnRoles.map((r, i) => r === 'Date' ? i : -1).filter(i => i !== -1);
      if (dateCols.length > 0) {
        setDateRange({ start: dateCols[0], end: dateCols[dateCols.length - 1] });
      } else {
        setDateRange({ start: -1, end: -1 });
      }
    }
  }, [columnRoles]);

  // Build dynamic aggregatable field options from CSV header
  const manualDropdownOptions = useMemo(() => {
    const dynamicRoles = previewHeader
      .filter((h, i) => {
        // Exclude fixed roles by value
        if (FIXED_ROLES.some(f => f.value === h)) {
          return false;
        }
        // Exclude columns that have been identified as a Date role
        if (columnRoles[i] === 'Date') {
          return false;
        }
        return true;
      })
      .map(h => ({ value: h, label: `Σ ${h}` })); // Add a generic icon

    const customRoles = customAggTypes.map(t => ({ value: t, label: `Σ ${t}` }));

    return [
      ...FIXED_ROLES,
      ...dynamicRoles,
      ...customRoles,
      { value: 'Ignore', label: 'Ignore' },
    ].filter(option => option.value);
  }, [previewHeader, customAggTypes, columnRoles]);

  const aiAggregatableFields = useMemo(() => {
    return aiTransformedData && aiTransformedData.length > 0 ? aiTransformedData.map((col) => ({ value: col, label: `Σ ${col}` })) : [];
  }, [aiTransformedData]);

  const aiDropdownOptions = useMemo(() => {
    const headers = aiResultColumns;
    if (headers.length === 0) return [];

    const dynamicRoles = headers
      .filter((h: string, i: number) => {
        if (!h) return false;
        if (FIXED_ROLES.some(f => f.value === h)) return false;
        if (aiColumnRoles[i] === 'Date') return false;
        return true;
      })
      .map((h: string) => ({ value: h, label: `Σ ${h}` }));
    
    const customRoles = customAggTypes.map(t => ({ value: t, label: `Σ ${t}` }));

    return [
    ...FIXED_ROLES,
      ...dynamicRoles,
      ...customRoles,
    { value: 'Ignore', label: 'Ignore' },
    ].filter(option => option.value);
  }, [aiResultColumns, customAggTypes, aiColumnRoles]);

  // Handler for changing a column's role
  const handleRoleChange = (colIdx: number, role: ColumnRole) => {
    const newRoles = [...columnRoles];
    newRoles[colIdx] = role;
    setColumnRoles(newRoles);
    // If role is Date, update date range
    if (role === 'Date') {
      const dateCols = newRoles.map((r, i) => r === 'Date' ? i : -1).filter(i => i !== -1);
      if (dateCols.length > 0) {
        setDateRange({ start: dateCols[0], end: dateCols[dateCols.length - 1] });
      } else {
        setDateRange({ start: -1, end: -1 });
      }
    }
  };

  // Handler for adjusting date range
  const handleDateRangeChange = (which: 'start' | 'end', idx: number) => {
    setDateRange(r => ({ ...r, [which]: idx }));
    // Update roles
    const newRoles = [...columnRoles];
    for (let i = 0; i < newRoles.length; ++i) {
      if (i >= (which === 'start' ? idx : dateRange.start) && i <= (which === 'end' ? idx : dateRange.end)) {
        newRoles[i] = 'Date';
      }
    }
    setColumnRoles(newRoles);
  };

  // In the mapping step, build a mapping from column index to {role, originalName}
  const columnMappings = useMemo(() => {
    return previewHeader.map((col, i) => ({
      role: columnRoles[i],
      originalName: col
    }));
  }, [previewHeader, columnRoles]);

  // Normalize data to long format
  const normalizedData = useMemo(() => {
    if (previewRows.length === 0 || columnRoles.length === 0 || dateRange.start === -1 || dateRange.end === -1) return [];
    // Find indices for Material Code, Description
    const materialIdx = columnRoles.findIndex(role => role === 'Material Code');
    const descIdx = columnRoles.findIndex(role => role === 'Description');
    // Aggregatable fields: all columns with a unique CSV name and not Material/Description/Date/Ignore
    const aggregatableMappings = columnMappings.filter(m =>
      m.role !== 'Material Code' &&
      m.role !== 'Description' &&
      m.role !== 'Date' &&
      m.role !== 'Ignore'
    );
    const result: any[] = [];
    for (const row of previewRows) {
      for (let i = dateRange.start; i <= dateRange.end; ++i) {
        if (columnRoles[i] === 'Date') {
          const entry: any = {};
          if (materialIdx !== -1) entry['Material Code'] = row[previewHeader[materialIdx]];
          if (descIdx !== -1) entry['Description'] = row[previewHeader[descIdx]];
          aggregatableMappings.forEach(m => { 
            entry[m.role] = row[m.originalName];
          });
          // Use the selected date format for parsing
          const parsedDate = parseDateWithFormat(previewHeader[i], dateFormat);
          let formattedDate = previewHeader[i];
          if (parsedDate) {
            const pad = (n: number) => n.toString().padStart(2, '0');
            formattedDate = `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-${pad(parsedDate.getDate())}`;
          }
          entry['Date'] = formattedDate;
          // Convert sales value to number, defaulting to 0 if invalid
          const salesValue = row[previewHeader[i]];
          const num = Number(salesValue);
          entry['Sales'] = (salesValue === '' || !Number.isFinite(num)) ? 0 : num;
          // Only add entries that have required fields
          if (entry['Material Code'] && entry['Date'] !== undefined) {
            result.push(entry);
          }
        }
      }
    }
    return result;
  }, [previewRows, columnRoles, dateRange, previewHeader, columnMappings, dateFormat]);

  // In the normalized data preview table, show all unique keys from the first row
  const normalizedHeaders = useMemo(() => {
    if (normalizedData.length === 0) return ['Material Code', 'Description', 'Date', 'Sales'];
    return Object.keys(normalizedData[0]);
  }, [normalizedData]);

  // AI-powered transform function
  const handleAITransform = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiReasoning('');
    try {
      setAiProcessingStage('initializing');
      const estimatedTokens = Math.ceil(originalCsv.length / 4);
      const maxTokens = 100000;
      
      if (estimatedTokens > maxTokens) {
        throw new Error(`File too large for AI processing (estimated ${estimatedTokens.toLocaleString()} tokens). Please use manual import for files larger than ~${Math.round(maxTokens * 4 / 1024)}KB.`);
      }

      setAiProcessingStage('preparing_request');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      setAiProcessingStage('waiting_for_ai');
      const response = await fetch('http://localhost:3001/api/grok-transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          csvData: originalCsv, 
          reasoningEnabled: aiReasoningEnabled 
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        
        if (response.status === 400 && errorMessage.includes('maximum prompt length')) {
          throw new Error('File too large for AI processing. Please use manual import for large files.');
        }
        
        throw new Error(errorMessage);
      }
      
      setAiProcessingStage('parsing_response');
      const result = await response.json();
      
      console.log('🤖 Full API Response:', result);
      console.log('🤖 Response keys:', Object.keys(result));
      
      if (result.reasoning) {
        setAiReasoning(result.reasoning);
        console.log('🤖 AI Reasoning:', result.reasoning);
      } else {
        console.log('🤖 No reasoning found in response');
        setAiReasoning('No reasoning provided by AI');
      }
      
      if (result.columnRoles) {
        setAiColumnRoles(result.columnRoles);
      }
      
      setAiProcessingStage('applying_transform');
      const transformedData = result.transformedData || result.csv || result;
      const columns = result.columns || [];
      
      if (Array.isArray(transformedData)) {
        const headers = columns.length > 0 ? columns : (transformedData.length > 0 ? Object.keys(transformedData[0]) : []);
        setAiResultColumns(headers);
        setAiTransformedData(transformedData);
      } else {
        console.error("AI did not return a valid JSON array.", transformedData);
        throw new Error('The AI response was not in the expected format. Please try manual import.');
      }
      
      setAiStep('ai-preview');
      setStep('preview');

    } catch (err: any) {
      console.error('AI Transform Error:', err);
      
      // Show custom error dialog instead of alert
      setAiError(err.message);
      setIsErrorDialogOpen(true);
      
      // Fallback to manual import
      setAiStep('manual');
      setStep('preview');
      // No longer need to client-side parse, backend provides initial preview.
      // If AI fails, the user can still use the manual controls.
      onAIFailure(err.message || 'An unknown error occurred during AI processing.');

    } finally {
      setAiLoading(false);
      setAiProcessingStage('initializing');
    }
  };

  // Top-level hooks for mapping (AI and manual)
  const manualMappingHeader = previewHeader;
  const manualMappingRows = previewRows;
  const manualMappingRoles = columnRoles;
  const manualMappingNormalizedHeaders = normalizedHeaders;
  const manualMappingNormalizedData = normalizedData;
  const manualMappingHasMaterialCode = manualMappingRoles.includes('Material Code');

  // AI mapping now uses the direct array of objects
  const aiMappingNormalizedData = useMemo(() => {
    if (!aiTransformedData || !aiResultColumns || aiColumnRoles.length === 0) return [];
    
    // Find indices for Material Code, Description
    const materialHeader = aiResultColumns[aiColumnRoles.findIndex(role => role === 'Material Code')];
    const descHeader = aiResultColumns[aiColumnRoles.findIndex(role => role === 'Description')];
    
    // Aggregatable fields: all columns with roles that are not Material/Description/Date/Ignore
    const aggregatableHeaders = aiColumnRoles
      .map((role, idx) => ({ role, header: aiResultColumns[idx] }))
      .filter(({ role }) => 
        role !== 'Material Code' && 
        role !== 'Description' && 
        role !== 'Date' && 
        role !== 'Ignore'
      );
    
    const result: any[] = [];
    
    for (const row of aiTransformedData) {
      // Find all date columns
      const dateHeaders = aiColumnRoles
        .map((role, idx) => ({ role, header: aiResultColumns[idx] }))
        .filter(({ role }) => role === 'Date');
      
      for (const { header: dateHeader } of dateHeaders) {
        const entry: any = {};
        
        // Add Material Code if mapped
        if (materialHeader) {
          entry['Material Code'] = row[materialHeader];
        }
        
        // Add Description if mapped
        if (descHeader) {
          entry['Description'] = row[descHeader];
        }
        
        // Add aggregatable fields
        aggregatableHeaders.forEach(({ role, header }) => {
          entry[role] = row[header];
        });
        
        // Add Date
        entry['Date'] = dateHeader;
        
        // Add Sales (convert to number)
        const salesValue = row[dateHeader];
        const num = Number(salesValue);
        entry['Sales'] = (salesValue === '' || !Number.isFinite(num)) ? 0 : num;
        
        // Only add entries that have required fields
        if (entry['Material Code'] && entry['Date'] !== undefined) {
          result.push(entry);
        }
      }
    }
    
    return result;
  }, [aiTransformedData, aiResultColumns, aiColumnRoles]);
  
  const aiMappingHasMaterialCode = aiColumnRoles.includes('Material Code');
  
  const aiMappingNormalizedHeaders = useMemo(() => {
    if (aiMappingNormalizedData.length === 0) return ['Material Code', 'Description', 'Date', 'Sales'];
    return Object.keys(aiMappingNormalizedData[0]);
  }, [aiMappingNormalizedData]);

  const allAIEnabled = aiCsvImportEnabled && largeFileProcessingEnabled && aiFeaturesEnabled;
  const showLargeFileAI = largeFileDetected && allAIEnabled;
  const showLargeFileAIDisabled = largeFileDetected && aiCsvImportEnabled && !largeFileProcessingEnabled;

  const handleConfigProcessing = async () => {
    setConfigLoading(true);
    setConfigError(null);
    setConfigReasoning('');
    setDebugInfo(null);
    try {
      setConfigProcessingStage('initializing');
      // Parse a sample of the CSV for AI analysis
      const lines = originalCsv.split('\n');
      const sampleLines = lines.slice(0, 15); // Use 15 lines for better context
      const sampleCsv = sampleLines.join('\n');

      // Parse the sample CSV into an array of objects
      let sampleJson: any[] = [];
      Papa.parse(sampleCsv, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          sampleJson = results.data;
        },
        error: (err) => {
          throw new Error(`Failed to parse CSV sample: ${err.message}`);
        }
      });
      
      if (sampleJson.length === 0) {
        throw new Error("Could not parse any data from the CSV sample. Please check the file format.");
      }

      // Generate configuration using AI
      setConfigProcessingStage('generating_config');
      const response = await fetch('http://localhost:3001/api/grok-generate-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          csvChunk: sampleJson, // Send the parsed JSON array
          fileSize: originalCsv.length,
          reasoningEnabled: aiReasoningEnabled
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      console.log('🤖 Config API Response:', result);
      console.log('🤖 Config Response keys:', Object.keys(result));

      // Capture reasoning if available
      if (result.reasoning) {
        setConfigReasoning(result.reasoning);
        console.log('🤖 Config Generation Reasoning:', result.reasoning);
      } else {
        console.log('🤖 No reasoning found in config response');
        setConfigReasoning('No reasoning provided by AI');
      }

      setGeneratedConfig(result.config);

      // Apply configuration to full CSV
      setConfigProcessingStage('applying_config');
      const applyResponse = await fetch('/api/apply-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData: originalCsv, config: result.config })
      });

      const applyResult = await applyResponse.json();
      if (!applyResponse.ok) {
        throw new Error(applyResult.error || 'Failed to apply configuration on the backend.');
      }
      
      // The backend now returns the same CsvUploadResult object
      // We need to set the uploadResult state before calling onDataReady
      const uploadResult = {
        success: true,
        filePath: applyResult.filePath,
        summary: applyResult.summary,
        skuList: applyResult.skuList || [],
      };
      setUploadResult(uploadResult);
      onDataReady(uploadResult);
      

      setConfigProcessingStage('parsing_result');
      // Use the preview data from the backend for the UI
      const headers = applyResult.columns || [];
      
      setAiResultColumns(headers);
      setAiTransformedData(applyResult.previewData || []);

      if (applyResult.columnRoles) {
        setAiColumnRoles(applyResult.columnRoles);
      }

      setConfigApplied(true);
      setAiStep('ai-preview');
    } catch (err: any) {
      setConfigError(err.message);
      // Fallback to manual import
      setTimeout(() => {
        setAiStep('manual');
        setStep('preview');
        // NO LONGER PARSE ON CLIENT: The preview data should already be loaded.
        // If an error happened this severe, we might need a better "error state" view.
      }, 3000);
      onAIFailure(err.message || 'An unknown error occurred during AI processing.');
    } finally {
      setConfigLoading(false);
    }
  };

  const handleManualConfirm = async () => {
    if (!originalCsv || columnRoles.length === 0) {
      setError("Cannot process manual import without data and column roles.");
      return;
    }
    setManualConfirmLoading(true);
    setError(null);
    try {
      const payload = {
        csvData: originalCsv,
        mappings: columnMappings,
        dateRange,
        dateFormat,
        transpose: transposed,
      };

      const response = await fetch('/api/process-manual-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to process manual import on the backend.');
      }
      
      // The backend now returns the same CsvUploadResult object
      // We need to set the uploadResult state before calling onDataReady
      const uploadResult = {
        success: true,
        filePath: result.filePath,
        summary: result.summary,
        skuList: result.skuList || [],
      };
      setUploadResult(uploadResult);
      onDataReady(uploadResult);
      

    } catch (err: any) {
      console.error('Manual Import Confirm Error:', err);
      setError(err.message);
    } finally {
      setManualConfirmLoading(false);
    }
  };

  const renderErrorDialog = () => (
    <AlertDialog open={isErrorDialogOpen} onOpenChange={setIsErrorDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-red-500" />
            AI Processing Failed
          </AlertDialogTitle>
          <AlertDialogDescription className="pt-2">
            {aiError || "An unexpected error occurred."}
            <br /><br />
            We've switched to the manual import flow for you to continue.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => setIsErrorDialogOpen(false)}>
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // Main render logic:
  const renderContent = () => {
    console.log('[CsvImportWizard] renderContent called with step:', step);
    
    if (step === 'upload') {
      console.log('[CsvImportWizard] Rendering upload step');
      return (
        <div className="space-y-4">
          {lastImportFileName && (
            <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4 flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-semibold text-blue-800 mb-1">A file has already been loaded.</div>
                <div className="text-sm text-blue-700">File: <span className="font-mono">{lastImportFileName}</span></div>
                {lastImportTime && <div className="text-xs text-blue-600">Imported on: {lastImportTime}</div>}
                <div className="text-xs text-blue-600 mt-1">You can continue with your current file or upload a new one below.</div>
              </div>
              <Button
                className="mt-4 md:mt-0 md:ml-8"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    const event = new CustomEvent('goToStep', { detail: { step: 1 } });
                    window.dispatchEvent(event);
                  }
                }}
                variant="default"
              >
                Continue with Current File
              </Button>
            </div>
          )}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300 cursor-pointer ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-slate-400'}`}
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={handleDropAreaClick}
          >
                <Upload className={`h-12 w-12 mx-auto transition-colors ${isDragging ? 'text-blue-600' : 'text-slate-400'}`} />
                <div>
                  <h3 className="text-lg font-semibold text-slate-700">Drop your CSV file here</h3>
                  <p className="text-slate-500">or click to browse files</p>
                </div>
              </div>
          <input
            id="csv-upload-input"
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
          />
          {error && <div className="text-red-600">{error}</div>}
        </div>
      );
    }

    if (step === 'preview') {
      console.log('[CsvImportWizard] Rendering preview step');
      if (aiCsvImportEnabled && aiStep === 'describe') {
        return (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center min-h-[300px] py-12">
              <div className="mb-8 text-center">
                <div className="text-slate-700 text-lg font-semibold mb-2">How would you like to import your data?</div>
                <div className="text-slate-500 text-base">You've already uploaded your file. We can now process it.</div>
              </div>
              <div className="flex flex-row gap-8 justify-center mt-8">
                
                  <button
                    className={`relative flex flex-col items-center justify-center border-2 rounded-xl shadow-md px-10 py-8 transition-all duration-200 w-72 focus:outline-none bg-yellow-50 hover:bg-yellow-100 border-yellow-300 hover:border-yellow-400`}
                    onClick={async () => {
                      if (largeFileDetected) {
                        await handleConfigProcessing();
                      } else {
                        await handleAITransform();
                      }
                    }}
                    disabled={
                      (largeFileDetected && !largeFileProcessingEnabled) || 
                      aiLoading || 
                      configLoading
                    }
                  >
                    {(aiLoading || configLoading) && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl z-10">
                        <RefreshCw className="w-8 h-8 text-yellow-600 animate-spin mb-3" />
                        <span className="text-sm font-medium text-slate-700 mb-2">
                           {configLoading ? 'Processing Large File...' : 'AI Processing...'}
                        </span>
                         <span className="text-xs text-slate-600">
                           {configLoading ? {
                             'initializing': 'Initializing...',
                             'generating_config': 'Generating configuration...',
                             'applying_config': 'Applying configuration...',
                             'parsing_result': 'Parsing result...'
                           }[configProcessingStage] : {
                             'initializing': 'Initializing...',
                             'preparing_request': 'Preparing request...',
                             'waiting_for_ai': 'Waiting for AI...',
                             'parsing_response': 'Parsing response...',
                             'applying_transform': 'Applying transform...',
                             'finalizing': 'Finalizing...'
                            }[aiProcessingStage]}
                          </span>
                      </div>
                    )}
                    <div className="relative">
                      {largeFileDetected && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="absolute -top-2 -right-2 flex h-6 w-6">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-6 w-6 bg-yellow-500 items-center justify-center text-xs text-white">
                                  <Zap size={15}/>
                          </span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">
                                <b>Large File Processing</b><br></br>
                                Because of AI prompt size limitations, for large files, the AI first generates a transformation plan based on a sample that we then apply to the entire file. This approach is faster and more reliable.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <Bot className="w-10 h-10 text-yellow-600 mb-3" />
                    </div>
                    <span className="text-xl font-bold text-yellow-600 mb-1">AI-Powered Import</span>
                    <span className="text-yellow-600 text-base mb-2 text-center">Let AI automatically clean, pivot, and prepare your data.</span>
                  </button>

                <button
                    className="relative flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 hover:border-slate-400 rounded-xl shadow-md px-10 py-8 transition-all duration-200 w-72 focus:outline-none"
                  onClick={() => {
                    setAiStep('manual');
                    setStep('preview');
                    }}
                    disabled={aiLoading || configLoading}
                  >
                    {previewLoading && (
                       <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl z-10">
                         <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
                         <span className="text-sm font-medium text-slate-700 mb-2">
                           Preparing Preview...
                          </span>
                       </div>
                    )}
                  <User className="w-10 h-10 text-slate-600 mb-3" />
                  <span className="text-xl font-bold text-slate-800 mb-1">Manual Import</span>
                  <span className="text-slate-700 text-base mb-2 text-center">Manually review, map, and import your CSV data step by step.</span>
                </button>
              </div>
            </div>
            <div className="flex justify-start mt-4">
              <Button variant="outline" onClick={() => {
                setStep('upload');
                setAiStep('upload');
              }}>
                Back to Upload
              </Button>
            </div>
          </div>
        );
      }

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
              <Button variant="outline" onClick={() => setAiStep('describe')}>Back</Button>
              <Button
                onClick={() => {
                  setAiStep('ai-mapping');
                  setStep('mapping');
                }}
              >
                Next: Mapping
                </Button>
              </div>
            </div>
        );
      }
      
      // Manual preview or AI-generated preview
      const isAIManagedPreview = aiStep === 'ai-preview';
      const previewCols = isAIManagedPreview ? (aiResultColumns.length > 0 ? aiResultColumns : []) : previewHeader;
      const previewData = isAIManagedPreview ? (aiTransformedData || []) : previewRows;
      const totalRows = isAIManagedPreview ? (aiTransformedData ? aiTransformedData.length : 0) : data.length;

      if (previewLoading) {
        return (
          <div className="text-blue-600 text-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Parsing CSV and preparing preview...
          </div>
        );
      }

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
                <label className="text-sm">Data appears transposed:</label>
                      <Switch
                        checked={transposed}
                  onCheckedChange={handleTransposeChange}
                  disabled={previewLoading}
                      />
                    </div>
          </div>
            {data.length > 0 ? (
              <>
          <div className="overflow-x-auto border rounded">
                    <table className="min-w-full text-xs">
              <thead>
                <tr>
                          {previewHeader.map((h, i) => (
                            <th key={i} className="px-2 py-1 bg-slate-100 border-b whitespace-nowrap">{h}</th>
                          ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} className="bg-white border-b hover:bg-gray-50">
                    {previewHeader.map((header, j) => (
                      <td key={j} className="px-4 py-2 whitespace-nowrap">{row[header]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
                  <div className="flex justify-between mt-4">
                    <Button variant="outline" onClick={() => {
                      if (aiCsvImportEnabled) {
                        setAiStep('describe');
                      } else {
                        setStep('upload');
                        setAiStep('upload');
                      }
                    }}>Back</Button>
                    <Button onClick={() => setStep('mapping')}>Next: Mapping</Button>
          </div>
              </>
            ) : (
              <div>
                <div className="text-center py-8 border border-dashed rounded-lg bg-slate-50">
                  <div className="text-slate-500">No data to preview.</div>
                  <div className="text-xs text-slate-400 mt-1">Please check your file or adjust the separator/transpose settings above.</div>
                </div>
                <div className="flex justify-start mt-4">
                   <Button variant="outline" onClick={() => {
                      if (aiCsvImportEnabled) {
                        setAiStep('describe');
                      } else {
                        setStep('upload');
                        setAiStep('upload');
                      }
                   }}>Back</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (step === 'mapping') {
      console.log('[CsvImportWizard] Rendering mapping step');
      const isAIMapping = aiStep === 'ai-mapping';
      const mappingHeader = isAIMapping ? aiResultColumns : manualMappingHeader;
      const mappingRows = isAIMapping ? (aiTransformedData || []) : manualMappingRows;
      const mappingRoles = isAIMapping ? aiColumnRoles : columnRoles;
      const mappingNormalizedHeaders = isAIMapping ? aiMappingNormalizedHeaders : manualMappingNormalizedHeaders;
      const mappingNormalizedData = isAIMapping ? aiMappingNormalizedData : manualMappingNormalizedData;
      const mappingHasMaterialCode = isAIMapping ? aiMappingHasMaterialCode : manualMappingHasMaterialCode;
      const DROPDOWN_OPTIONS = isAIMapping ? aiDropdownOptions : manualDropdownOptions;
      const mappingRowLimit = PREVIEW_ROW_LIMIT;
      const totalMappingRows = Array.isArray(mappingRows) ? mappingRows.length : 0;
    
      const handleConfirmClick = async () => {
        if (isAIMapping) {
          if (uploadResult) {
            onDataReady(uploadResult);
            await onConfirm(uploadResult);
          } else {
            console.error("AI import confirmed without a valid upload result.");
            setError("An error occurred during AI import. Please try again.");
          }
        } else {
          // Manual import path
          await handleManualConfirm();
        }
      };
      
      return (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">Step 2: Map Columns</h3>
          {aiTransformResult && isAIMapping && (
            <div className="mb-4">
              <h4 className="font-medium mb-2">AI-Suggested Mappings</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(aiTransformResult.columnMappings).map(([header, role]) => (
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
                          const newRoles = [...aiColumnRoles];
                          newRoles[i] = e.target.value as ColumnRole;
                          setAiColumnRoles(newRoles);
                        } else {
                          handleRoleChange(i, e.target.value as ColumnRole);
                        }
                      }}
                        className="mt-1 border rounded px-1 py-0.5 text-xs"
                      >
                        {DROPDOWN_OPTIONS.filter(opt => {
                          const isMultiAllowed = opt.value === 'Ignore' || opt.value === 'Date';
                        const isAssignedElsewhere = mappingRoles.some((role, idx) => idx !== i && role === opt.value);
                          return !(!isMultiAllowed && isAssignedElsewhere);
                        }).map(opt => {
                          return (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          );
                        })}
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
                {(Array.isArray(columnRoles) ? columnRoles : []).map((role, i) => role === 'Date' && <option key={i} value={i}>{(Array.isArray(previewHeader) ? previewHeader : [])[i]}</option>)}
              </select>
              <span className="text-xs">to</span>
              <select
                value={dateRange.end}
                onChange={e => handleDateRangeChange('end', Number(e.target.value))}
                className="border rounded px-1 py-0.5 text-xs"
              >
                {(Array.isArray(columnRoles) ? columnRoles : []).map((role, i) => role === 'Date' && <option key={i} value={i}>{(Array.isArray(previewHeader) ? previewHeader : [])[i]}</option>)}
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
          {/* From Mapping to Preview */}
          <Button variant="outline" onClick={() => {
            if (aiStep === 'ai-mapping') {
              setAiStep('ai-preview'); // Go back to AI preview
              setStep('preview');
            } else if (aiCsvImportEnabled) {
              setAiStep('describe'); // Go back to AI/Manual choice
              setStep('preview');
            } else {
              setStep('preview'); // Go back to manual preview
            }
          }}>Back</Button>
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
  }
  
  console.log('[CsvImportWizard] No matching step, returning null');
  return null; // Should not be reached if logic is correct
};

  return (
    <>
      {renderErrorDialog()}
      {renderContent()}
    </>
  );
}; 