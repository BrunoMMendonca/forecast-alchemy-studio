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
import { UploadStep } from './CsvImportWizard/UploadStep';
import { ChoiceStep } from './CsvImportWizard/ChoiceStep';
import { PreviewStep } from './CsvImportWizard/PreviewStep';
import { MapStep } from './CsvImportWizard/MapStep';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useExistingDataDetection } from '@/hooks/useExistingDataDetection';

/*
 * CsvImportWizard Component
 * -------------------------
 * This component acts as the main container and orchestrator for the multi-step CSV import process.
 * It manages all the state and logic, and it renders the appropriate step-based sub-component
 * based on the current state of the import flow.
 *
 * The step-based sub-components are:
 * - UploadStep: Handles the initial file upload UI. Located at './CsvImportWizard/UploadStep.tsx'.
 * - ChoiceStep: Allows the user to choose between an AI-powered or manual import. Located at './CsvImportWizard/ChoiceStep.tsx'.
 * - PreviewStep: Displays a preview of the data, either transformed by AI or adjusted manually. Located at './CsvImportWizard/PreviewStep.tsx'.
 * - MapStep: Handles the column mapping and final data normalization before import. Located at './CsvImportWizard/MapStep.tsx'.
 */

export interface CsvUploadResult {
  success: boolean;
  filePath: string;
  summary: {
    skuCount: number;
    dateRange: [string, string];
    totalPeriods: number;
    frequency?: string;
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
  onLoadExistingData?: (result: CsvUploadResult) => void;
  currentLoadedFile?: string;
  setLastLoadedDataset?: (dataset: any) => void;
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

export const CsvImportWizard: React.FC<CsvImportWizardProps> = ({ onDataReady, onConfirm, onFileNameChange, lastImportFileName, lastImportTime, onAIFailure, onLoadExistingData, currentLoadedFile, setLastLoadedDataset }) => {
  const [file, setFile] = useState<File | null>(null);
  const [separator, setSeparator] = useState<string>(',');
  const [data, setData] = useState<any[]>([]);
  const [header, setHeader] = useState<string[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'mapping'>('upload');
  
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

  const isAiFlowEnabled = aiCsvImportEnabled && aiFeaturesEnabled;

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

  const [duplicateCheckResult, setDuplicateCheckResult] = useState<any>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

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

  const checkCsvDuplicate = async (csvData: string) => {
    const response = await fetch('/api/check-csv-duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvData }),
    });
    return response.json();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[FileInput] handleFileChange called', e);
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
        // Duplicate check
        console.log('[DuplicateCheck] Checking for duplicate...');
        const dupResult = await checkCsvDuplicate(text);
        console.log('[DuplicateCheck] Result:', dupResult);
        if (dupResult.duplicate) {
          setDuplicateCheckResult(dupResult);
          setPendingFile(f);
          return;
        }
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
          if (isAiFlowEnabled) {
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
      const response = await fetch('/api/grok-transform', {
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
      const response = await fetch('/api/grok-generate-config', {
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
    if (!header.length || !data.length || columnRoles.length === 0) {
      setError("Cannot process manual import without cleaned data and column roles.");
      return;
    }
    setManualConfirmLoading(true);
    setError(null);
    try {
      // Debug log for roles and mappings
      console.log('Manual Confirm: columnRoles', columnRoles);
      console.log('Manual Confirm: columnMappings', columnMappings);
      console.log('Manual Confirm: manualMappingNormalizedHeaders', manualMappingNormalizedHeaders);
      // Build finalColumnRoles for normalized output columns
      console.log('Manual Confirm: manualMappingNormalizedHeaders', manualMappingNormalizedHeaders);
      // Assume normalizedHeaders and columnMappings are in sync with normalizedData
      const finalColumnRoles = manualMappingNormalizedHeaders.map((header) => {
        // If it's a known output (Material Code, Description, Date, Sales), map accordingly
        if (header === 'Material Code') return columnRoles[columnMappings.findIndex(m => m.role === 'Material Code')] ?? 'Material Code';
        if (header === 'Description') return columnRoles[columnMappings.findIndex(m => m.role === 'Description')] ?? 'Description';
        if (header === 'Date') return 'Date';
        if (header === 'Sales') return 'Sales';
        // For aggregatable fields, use the role from the mapping
        const mapping = columnMappings.find(m => m.role !== 'Material Code' && m.role !== 'Description' && m.role !== 'Date' && m.role !== 'Sales' && m.role !== 'Ignore');
        return mapping ? mapping.role : 'Ignore';
      });

      const payload = {
        headers: header, // cleaned, non-empty headers
        data: data,      // cleaned, non-empty rows (wide format)
        mappings: columnMappings,
        dateRange,
        dateFormat,
        transpose,
        finalColumnRoles,
        originalCsvData: previewRows, // Send original CSV data for detection logic
        originalCsvString: originalCsv // Send raw CSV string for consistent hashing
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
      await onConfirm(uploadResult);
      

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

  // Modal actions
  const handleLoadExisting = async () => {
    if (duplicateCheckResult?.existingDataset && onLoadExistingData) {
      // Fetch the dataset JSON from the backend
      const response = await fetch(`/api/load-processed-data?filePath=uploads/${duplicateCheckResult.existingDataset.filename}`);
      const fileData = await response.json();
      const result = {
        success: true,
        filePath: `uploads/${duplicateCheckResult.existingDataset.filename}`,
        summary: duplicateCheckResult.existingDataset.summary,
        skuList: Array.isArray(fileData.data) ? fileData.data.map((row: any) => String(row['Material Code'])).filter(Boolean) : []
      };
      
      // Track this as the last loaded dataset
      if (setLastLoadedDataset) {
        setLastLoadedDataset(duplicateCheckResult.existingDataset);
      }
      
      onLoadExistingData(result);
    }
  };
  const handleUploadAnyway = () => {
    if (pendingFile) {
      setDuplicateCheckResult(null); // Close the modal
      setFile(pendingFile);
      setError(null);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        setOriginalCsv(text);
        // --- Detect large file based on its size and settings ---
        if (largeFileProcessingEnabled && text.length > largeFileThreshold) {
          setLargeFileDetected(true);
        } else {
          setLargeFileDetected(false);
        }
        // --- Call backend for preview ---
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
          if (isAiFlowEnabled) {
            setAiStep('describe');
          } else {
            setAiStep('manual');
          }
          setStep('preview');
        } catch (err: any) {
          setError(err.message);
        } finally {
          setPreviewLoading(false);
        }
      };
      reader.readAsText(pendingFile);
    }
  };
  const handleCancelDuplicate = () => {
    setDuplicateCheckResult(null);
    setPendingFile(null);
  };

  // Main render logic:
  const renderContent = () => {
    if (step === 'upload') {
      return (
        <UploadStep
          lastImportFileName={lastImportFileName}
          lastImportTime={lastImportTime}
          isDragging={isDragging}
          error={error}
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
          onDropAreaClick={handleDropAreaClick}
          onFileChange={handleFileChange}
          onLoadDataset={async (dataset) => {
            // Fetch the dataset JSON from the backend
            const response = await fetch(`/api/load-processed-data?filePath=uploads/${dataset.filename}`);
            const fileData = await response.json();
            const result = {
              success: true,
              filePath: `uploads/${dataset.filename}`,
              summary: dataset.summary,
              skuList: Array.isArray(fileData.data) ? fileData.data.map((row: any) => String(row['Material Code'])).filter(Boolean) : []
            };
            if (onLoadExistingData) {
              onLoadExistingData(result);
            }
            setUploadResult(result);
            setStep('preview');
          }}
          loadedDatasetFile={currentLoadedFile || uploadResult?.filePath}
        />
      );
    }
    if (step === 'preview' && isAiFlowEnabled && aiStep === 'describe') {
        return (
        <ChoiceStep
          aiCsvImportEnabled={isAiFlowEnabled}
          largeFileDetected={largeFileDetected}
          largeFileProcessingEnabled={largeFileProcessingEnabled}
          aiLoading={aiLoading}
          configLoading={configLoading}
          previewLoading={previewLoading}
          aiProcessingStage={aiProcessingStage}
          configProcessingStage={configProcessingStage}
          onAITransform={handleAITransform}
          onConfigProcessing={handleConfigProcessing}
          onManualChoice={() => { setAiStep('manual'); setStep('preview'); }}
          onBackToUpload={() => { setStep('upload'); setAiStep('upload'); }}
        />
        );
      }
    if (step === 'preview') {
        return (
        <PreviewStep
          aiCsvImportEnabled={isAiFlowEnabled}
          aiStep={aiStep}
          aiTransformedData={aiTransformedData}
          aiResultColumns={aiResultColumns}
          aiReasoning={aiReasoning}
          configReasoning={configReasoning}
          previewLoading={previewLoading}
          separator={separator}
          transposed={transposed}
          data={data}
          header={header}
          onSeparatorChange={handleSeparatorChange}
          onTransposeChange={handleTransposeChange}
          onBackToChoice={() => {
                      if (isAiFlowEnabled) {
                        setAiStep('describe');
                      } else {
                        setStep('upload');
                        setAiStep('upload');
                      }
          }}
          onBackToUpload={() => { setStep('upload'); setAiStep('upload'); }}
          onNextToMapping={() => {
            if (aiStep === 'ai-preview') {
              setAiStep('ai-mapping');
            }
            setStep('mapping');
          }}
        />
      );
    }
    if (step === 'mapping') {
      const isAIMapping = aiStep === 'ai-mapping';
      const mappingHeader = isAIMapping ? aiResultColumns : manualMappingHeader;
      const mappingRows = isAIMapping ? (aiTransformedData || []) : manualMappingRows;
      const mappingRoles = isAIMapping ? aiColumnRoles : columnRoles;
      const mappingNormalizedHeaders = isAIMapping ? aiMappingNormalizedHeaders : manualMappingNormalizedHeaders;
      const mappingNormalizedData = isAIMapping ? aiMappingNormalizedData : manualMappingNormalizedData;
      const mappingHasMaterialCode = isAIMapping ? aiMappingHasMaterialCode : manualMappingHasMaterialCode;
      const DROPDOWN_OPTIONS = isAIMapping ? aiDropdownOptions : manualDropdownOptions;
      const mappingRowLimit = PREVIEW_ROW_LIMIT;
      return (
        <MapStep
          isAIMapping={isAIMapping}
          mappingHeader={mappingHeader}
          mappingRows={mappingRows}
          mappingRoles={mappingRoles}
          mappingNormalizedHeaders={mappingNormalizedHeaders}
          mappingNormalizedData={mappingNormalizedData}
          mappingHasMaterialCode={mappingHasMaterialCode}
          DROPDOWN_OPTIONS={DROPDOWN_OPTIONS}
          mappingRowLimit={mappingRowLimit}
          customAggTypes={customAggTypes}
          setCustomAggTypes={setCustomAggTypes}
          setAiColumnRoles={setAiColumnRoles}
          setColumnRoles={setColumnRoles}
          handleRoleChange={handleRoleChange}
          aiTransformResult={aiTransformResult}
          dateRange={dateRange}
          handleDateRangeChange={handleDateRangeChange}
          previewHeader={previewHeader}
          manualConfirmLoading={manualConfirmLoading}
          handleConfirmClick={async () => {
        if (isAIMapping) {
          setManualConfirmLoading(true);
          setError(null);
          try {
            // Build finalColumnRoles for normalized output columns (AI flow)
            const finalColumnRoles = aiMappingNormalizedHeaders.map((header) => {
              // If it's a known output (Material Code, Description, Date, Sales), map accordingly
              if (header === 'Material Code') return aiColumnRoles[aiResultColumns.indexOf('Material Code')] ?? 'Material Code';
              if (header === 'Description') return aiColumnRoles[aiResultColumns.indexOf('Description')] ?? 'Description';
              if (header === 'Date') return 'Date';
              if (header === 'Sales') return 'Sales';
              // For any other columns, try to find the mapping by header name
              const idx = aiResultColumns.indexOf(header);
              return idx !== -1 ? aiColumnRoles[idx] : 'Ignore';
            });
            console.log('AI Confirm: finalColumnRoles', finalColumnRoles);
            const payload = {
              transformedData: aiTransformedData,
              columns: aiResultColumns,
              columnRoles: aiColumnRoles,
              finalColumnRoles, // NEW: pass roles for normalized output columns
              originalCsvData: previewRows, // Send original CSV data for detection logic
              originalCsvString: originalCsv // Send raw CSV string for consistent hashing
            };

            const response = await fetch('/api/process-ai-import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (!response.ok) {
              throw new Error(result.error || 'Failed to process AI import on the backend.');
            }
            
            // The backend returns the same CsvUploadResult object
            const uploadResult = {
              success: true,
              filePath: result.filePath,
              summary: result.summary,
              skuList: result.skuList || [],
            };
            setUploadResult(uploadResult);
            onDataReady(uploadResult);
            await onConfirm(uploadResult);
          } catch (err: any) {
            console.error('AI Import Confirm Error:', err);
            setError(err.message);
          } finally {
            setManualConfirmLoading(false);
          }
        } else {
          await handleManualConfirm();
        }
          }}
          onBack={() => {
            if (aiStep === 'ai-mapping') {
              setAiStep('ai-preview');
              setStep('preview');
            } else if (isAiFlowEnabled) {
              setAiStep('describe');
              setStep('preview');
            } else {
              setStep('preview');
            }
          }}
        />
    );
  }
    return null;
};

const renderDuplicateModal = () => duplicateCheckResult && (
  <Dialog open={true} onOpenChange={handleCancelDuplicate}>
    <DialogContent>
      <DialogTitle>Duplicate File Detected</DialogTitle>
      <div className="mb-4">
        A dataset with this file already exists.<br/>
        <b>{duplicateCheckResult.existingDataset?.name}</b><br/>
        SKUs: {duplicateCheckResult.existingDataset?.summary?.skuCount}<br/>
        Date Range: {duplicateCheckResult.existingDataset?.summary?.dateRange?.join(' to ')}
      </div>
      <DialogFooter>
        <Button onClick={handleLoadExisting}>Load Existing</Button>
        <Button onClick={handleUploadAnyway} variant="outline">Upload Anyway</Button>
        <Button onClick={handleCancelDuplicate} variant="ghost">Cancel</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

useEffect(() => {
  if (uploadResult) {
    console.log('Loaded uploadResult:', uploadResult);
  }
}, [uploadResult]);

  return (
    <>
      {renderErrorDialog()}
    {renderDuplicateModal()}
      {renderContent()}
    </>
  );
}; 