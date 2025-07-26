import React, { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Upload, RefreshCw, Info, Sparkles, Bot, User, Settings, ArrowRight, Zap, FileText, ChevronsRight, AlertTriangle, Brain } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { parseDateWithFormat, autoDetectDateFormat } from '@/utils/dateUtils';
import { autoDetectNumberFormat, parseNumberWithFormat as frontendParseNumberWithFormat, autoDetectSeparator } from '@/utils/csvUtils';
import { transformDataWithAI, AITransformResult } from '@/utils/aiDataTransform';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { aiService, AIQuestion, AIResponse } from '@/services/aiService';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import { useAISettings } from '@/hooks/useAISettings';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
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
import { ErrorHandler } from './CsvImportWizard/ErrorHandler';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useExistingDataDetection } from '@/hooks/useExistingDataDetection';
import { useSetupWizardStore } from '../store/setupWizardStore';

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
  datasetId: number;
  sourceFilePath?: string;   // Optional: actual file path for audit (e.g., uploads/file.csv)
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
  // New props for setup wizard context
  context?: 'forecast' | 'setup';
  onSetupDataReady?: (divisions: string[], clusters: string[], divisionClusterMap?: Record<string, string[]>, lifecyclePhases?: string[], isSingleCsvReplacement?: boolean, csvFileName?: string) => void;
  onProceedToNextStep?: () => Promise<void>;
  // New prop to disable import functionality
  disableImport?: boolean;
}

const SEPARATORS = [',', ';', '\t', '|'];
const PREVIEW_ROW_LIMIT = 15;

function transpose(matrix: any[][]): any[][] {
  return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
}

const COLUMN_ROLES = ['Material Code', 'Description', 'Date', 'Division', 'Cluster', 'Lifecycle Phase', 'Ignore'] as const;
type ColumnRole = string;

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

export const CsvImportWizard: React.FC<CsvImportWizardProps> = ({ 
  onDataReady, 
  onConfirm, 
  onFileNameChange, 
  lastImportFileName, 
  lastImportTime, 
  onAIFailure, 
  onLoadExistingData, 
  currentLoadedFile, 
  setLastLoadedDataset,
  context = 'forecast',
  onSetupDataReady,
  onProceedToNextStep,
  disableImport = false
}) => {
  // Get setup wizard store state for dynamic field mapping
  const setupWizardStore = useSetupWizardStore();
  
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

  // Add flags to track if user has manually set formats
  const [userSetDateFormat, setUserSetDateFormat] = useState<boolean>(false);
  const [userSetNumberFormat, setUserSetNumberFormat] = useState<boolean>(false);

  // New state for AI-powered flow
  const [aiStep, setAiStep] = useState<'upload' | 'describe' | 'ai-preview' | 'ai-mapping' | 'manual' | 'config'>('upload');
  const [aiTransformedData, setAiTransformedData] = useState<any[] | null>(null);
  const [aiResultColumns, setAiResultColumns] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);
  const [originalCsv, setOriginalCsv] = useState<string>('');

  // New state for original headers
  const [originalHeaders, setOriginalHeaders] = useState<string[]>([]);

  // New state for selected division (for division-level without division column workflow)
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null);

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

  // Add state for CSV replacement confirmation dialog
  const [showCsvReplacementDialog, setShowCsvReplacementDialog] = useState(false);

  const DATE_FORMAT_OPTIONS = [
    { value: 'dd/mm/yyyy', label: 'dd/mm/yyyy' },
    { value: 'mm/dd/yyyy', label: 'mm/dd/yyyy' },
    { value: 'yyyy-mm-dd', label: 'yyyy-mm-dd' },
    { value: 'dd-mm-yyyy', label: 'dd-mm-yyyy' },
    { value: 'yyyy/mm/dd', label: 'yyyy/mm/dd' },
  ];

  const NUMBER_FORMAT_OPTIONS = [
    '1,234.56',
    '1.234,56',
    '1234.56',
    '1234,56',
    '1 234,56',
    '1 234.56',
    '1234',
  ];

  const [numberFormat, setNumberFormat] = useState<string>('1,234.56');

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
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    // Check if this is a setup wizard context and if there's already an imported CSV
    if (context === 'setup') {
      const setupWizardStore = useSetupWizardStore.getState();
      const hasExistingImport = setupWizardStore.orgStructure.multipleCsvImport.importedCsvs.length > 0;
      
      if (hasExistingImport) {
        // Show confirmation dialog for any existing import
        setPendingFile(selectedFile);
        setShowCsvReplacementDialog(true);
        return;
      }
    }

    // Proceed with file processing
    processSelectedFile(selectedFile);
  };

  // New function to process the selected file
  const processSelectedFile = (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setStep('preview');
    setAiStep('describe');
    setPreviewLoading(false);
    setManualConfirmLoading(false);
    setConfigLoading(false);
    setConfigError(null);
    setGeneratedConfig(null);
    setConfigApplied(false);
    setConfigProcessingStage('initializing');
    setUploadResult(null);
    setAiTransformedData(null);
    setAiResultColumns([]);
    setAiColumnRoles([]);
    setAiLoading(false);
    setAiError(null);
    setAiReasoning('');
    setConfigReasoning('');
    setShowReasoning(false);
    setShowDebug(false);
    setDebugInfo(null);
    setLargeFileDetected(false);
    setShowLargeFileAlert(true);
    setAiProcessingStage('initializing');
    setDuplicateCheckResult(null);
    setColumnRoles([]);
    setDateRange({ start: -1, end: -1 });
    setCustomAggTypes([]);
    setData([]);
    setHeader([]);
    setTransposed(false);
    setUserSetDateFormat(false);
    setUserSetNumberFormat(false);

    if (onFileNameChange) {
      onFileNameChange(selectedFile.name);
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const csvData = event.target?.result as string;
      setOriginalCsv(csvData);
      // Debug: Log first few lines of CSV
      // console.log('📄 First 5 lines of uploaded CSV:', csvData.split('\n').slice(0, 5));

      // --- Auto-detect separator ---
      const firstLine = csvData.split('\n')[0];
      let detectedSeparator = autoDetectSeparator(firstLine);
      if (!detectedSeparator) detectedSeparator = ',';
      // console.log('🟢 Auto-detected separator:', detectedSeparator);

      // --- Parse header and a few rows ---
      const rows = csvData.split('\n').map(line => line.trim()).filter(Boolean);
      const headerRow = rows[0]?.split(detectedSeparator) || [];
      const dataRows = rows.slice(1, 6).map(row => row.split(detectedSeparator));

      // --- Auto-detect date format ---
      const dateDetection = autoDetectDateFormat(headerRow);
      const detectedDateFormat = dateDetection.bestGuess || 'dd/mm/yyyy';
      // console.log('🟢 Auto-detected date format:', detectedDateFormat);

      // --- Auto-detect number format ---
      // Collect numeric-looking values from the first few data rows
      const numericSamples = [];
      for (let i = 0; i < headerRow.length; i++) {
        for (let j = 0; j < dataRows.length; j++) {
          const val = dataRows[j][i];
          if (val && /[0-9]/.test(val)) numericSamples.push(val);
        }
      }
      let detectedNumberFormat = '1,234.56';
      if (numericSamples.length > 0) {
        const numberDetection = autoDetectNumberFormat(numericSamples);
        if (numberDetection.bestGuess) detectedNumberFormat = numberDetection.bestGuess;
      }
      // console.log('🟢 Auto-detected number format:', detectedNumberFormat);

      // --- Generate initial preview with detected values ---
      // console.log('🟢 Initial preview regeneration (file upload, auto-detected):', {
      //   separator: detectedSeparator,
      //   dateFormat: detectedDateFormat,
      //   numberFormat: detectedNumberFormat,
      //   transposed: false
      // });
      await handlePreviewRegeneration({ separator: detectedSeparator, transposed: false, dateFormat: detectedDateFormat, numberFormat: detectedNumberFormat }, csvData);

      // Now update the dropdowns to match what was used for preview
      setSeparator(detectedSeparator);
      setDateFormat(detectedDateFormat);
      setNumberFormat(detectedNumberFormat);
      // console.log('[handleFileChange] setDateFormat:', detectedDateFormat);
      // console.log('[handleFileChange] setNumberFormat:', detectedNumberFormat);
    };
    reader.readAsText(selectedFile);
  };

  const handlePreviewRegeneration = async (
    overrides: { 
      separator?: string; 
      transposed?: boolean; 
      dateFormat?: string; 
      numberFormat?: string; 
    },
    csvDataOverride?: string
  ) => {
    const csvToUse = csvDataOverride || originalCsv;
    if (!csvToUse) return;
    setPreviewLoading(true);

    // Preserve existing settings if not being overridden, but prioritize what's in the override.
    const newSeparator = 'separator' in overrides ? overrides.separator : separator;
    const newTransposed = 'transposed' in overrides ? overrides.transposed : transposed;
    const newDateFormat = 'dateFormat' in overrides ? overrides.dateFormat : dateFormat;
    const newNumberFormat = 'numberFormat' in overrides ? overrides.numberFormat : numberFormat;

    // Debug: Log config for preview regeneration
    // console.log('🟡 Preview regeneration config:', {
    //   separator: newSeparator,
    //   dateFormat: newDateFormat,
    //   numberFormat: newNumberFormat,
    //   transposed: newTransposed
    // });
    // Debug: Log first few lines of CSV
    // console.log('📄 First 5 lines of CSV sent to backend:', csvToUse.split('\n').slice(0, 5));

    try {
      const response = await fetch('/api/generate-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvData: csvToUse,
          separator: newSeparator,
          transposed: newTransposed,
          dateFormat: newDateFormat,
          numberFormat: newNumberFormat
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to regenerate preview.' }));
        throw new Error(errorData.error || `HTTP Error: ${response.status}`);
      }

      const result = await response.json();

      // Debug: Log backend response
      // console.log('🟢 Backend preview regeneration response:', result);

      setHeader(result.headers);
      setData(result.previewRows);
      // Store original headers for data access if available
      if (result.originalHeaders) {
        setOriginalHeaders(result.originalHeaders);
      } else {
        // Fallback: use processed headers as original headers
        setOriginalHeaders(result.headers);
      }
      // The backend now drives these states
      setSeparator(result.separator);
      setTransposed(result.transposed);
      setColumnRoles(result.columnRoles);
      // Set the formats from the backend response
      if (result.dateFormat) {
        setDateFormat(result.dateFormat);
        // console.log('[handlePreviewRegeneration] setDateFormat:', result.dateFormat);
      }
      if (result.numberFormat) {
        setNumberFormat(result.numberFormat);
        // console.log('[handlePreviewRegeneration] setNumberFormat:', result.numberFormat);
      }

    } catch (err: any) {
      console.error('Preview Regeneration Error:', err);
      // Show user-friendly error message
      setError(err.message || 'Failed to process CSV data. Please check your file format and settings.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSeparatorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSeparator = e.target.value;
    // console.log('🔧 Separator changed to:', newSeparator);
    setSeparator(newSeparator); // Optimistically update the UI for the dropdown itself
    // Reset user format flags since separator change might affect format detection
    setUserSetDateFormat(false);
    setUserSetNumberFormat(false);
    handlePreviewRegeneration({ separator: newSeparator, transposed });
  };
  
  const handleTransposeChange = (isChecked: boolean) => {
    setTransposed(isChecked); // Optimistically update the UI for the switch
    // Reset user format flags since transpose change might affect format detection
    setUserSetDateFormat(false);
    setUserSetNumberFormat(false);
    handlePreviewRegeneration({ transposed: isChecked, separator });
  };

  const handleDateFormatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDateFormat = e.target.value;
    // console.log('📅 Date format changed to:', newDateFormat);
    setDateFormat(newDateFormat);
    setUserSetDateFormat(true); // Mark that user has manually set the format
    // Debug: Log config change
    // console.log('🟠 Date format change triggers preview regeneration:', {
    //   separator,
    //   dateFormat: newDateFormat,
    //   numberFormat,
    //   transposed
    // });
    handlePreviewRegeneration({ dateFormat: newDateFormat, separator, transposed, numberFormat });
  };

  const handleNumberFormatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newNumberFormat = e.target.value;
    // console.log('[handleNumberFormatChange] setNumberFormat:', newNumberFormat);
    setNumberFormat(newNumberFormat);
    setUserSetNumberFormat(true); // Mark that user has manually set the format
    // Debug: Log config change
    // console.log('🟠 Number format change triggers preview regeneration:', {
    //   separator,
    //   dateFormat,
    //   numberFormat: newNumberFormat,
    //   transposed
    // });
    handlePreviewRegeneration({ numberFormat: newNumberFormat, separator, transposed, dateFormat });
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

  // Get available column roles based on context and organizational structure
  const getAvailableColumnRoles = () => {
    // Use the correct base roles that the system actually expects
    const baseRoles = ['Material Code', 'Description', 'Date', 'Ignore'];
    
    if (context === 'setup') {
      const { hasMultipleDivisions, hasMultipleClusters, enableLifecycleTracking, importLevel, divisionCsvType } = setupWizardStore.orgStructure;
      
      // Only show Division field if:
      // 1. Multiple divisions are enabled AND
      // 2. Either company-level import OR division-level import with division column
      if (hasMultipleDivisions && 
          (importLevel === 'company' || 
           (importLevel === 'division' && divisionCsvType === 'withDivisionColumn'))) {
        baseRoles.splice(3, 0, 'Division'); // Insert after Date
      }
      
      // Only show Cluster field if:
      // 1. Multiple clusters are enabled AND
      // 2. Either company-level import OR division-level import (any type)
      if (hasMultipleClusters && 
          (importLevel === 'company' || importLevel === 'division')) {
        // Insert Cluster after Division (if present) or after Date
        const insertIndex = baseRoles.includes('Division') ? 4 : 3;
        baseRoles.splice(insertIndex, 0, 'Cluster');
      }
      
      // Only show Lifecycle Phase field if lifecycle tracking is enabled
      if (enableLifecycleTracking) {
        // Insert Lifecycle Phase after Cluster (if present) or after Division (if present) or after Date
        let insertIndex = 3; // After Date
        if (baseRoles.includes('Division')) insertIndex++;
        if (baseRoles.includes('Cluster')) insertIndex++;
        baseRoles.splice(insertIndex, 0, 'Lifecycle Phase');
      }
    }
    
    return baseRoles;
  };

  // Get context-appropriate fixed roles
  const getContextFixedRoles = () => {
    // Use the correct base roles that the system actually expects
    const baseRoles = ['Material Code', 'Description', 'Date', 'Ignore'];
    
    if (context === 'setup') {
      const availableRoles = getAvailableColumnRoles();
      return availableRoles.map(role => ({ value: role, label: role }));
    }
    
    return baseRoles.map(role => ({ value: role, label: role }));
  };

  // Build dynamic aggregatable field options from CSV header
  const manualDropdownOptions = useMemo(() => {
    const contextFixedRoles = getContextFixedRoles();
    const dynamicRoles = previewHeader
      .filter((h, i) => {
        // Exclude fixed roles by value
        if (contextFixedRoles.some(f => f.value === h)) {
          return false;
        }
        // Exclude columns that have been identified as a Date role
        if (columnRoles[i] === 'Date') {
          return false;
        }
        // Exclude columns that are valid dates in the selected format
        if (parseDateWithFormat(h, dateFormat) !== null) {
          return false;
        }
        return true;
      })
      .map(h => ({ value: h, label: h })); // Remove Σ prefix, let getRoleIcon handle icons

    const customRoles = customAggTypes.map(t => ({ value: t, label: t })); // Remove Σ prefix

    return [
      ...contextFixedRoles,
      ...dynamicRoles,
      ...customRoles,
    ].filter(option => option.value);
  }, [previewHeader, customAggTypes, columnRoles, dateFormat, context]);

  const aiAggregatableFields = useMemo(() => {
    return aiTransformedData && aiTransformedData.length > 0 ? aiTransformedData.map((col) => ({ value: col, label: col })) : [];
  }, [aiTransformedData]);

  const aiDropdownOptions = useMemo(() => {
    const headers = aiResultColumns;
    if (headers.length === 0) return [];

    const contextFixedRoles = getContextFixedRoles();
    const dynamicRoles = headers
      .filter((h: string, i: number) => {
        if (!h) return false;
        if (contextFixedRoles.some(f => f.value === h)) return false;
        if (aiColumnRoles[i] === 'Date') return false;
        return true;
      })
      .map((h: string) => ({ value: h, label: h })); // Remove Σ prefix, let getRoleIcon handle icons
    
    const customRoles = customAggTypes.map(t => ({ value: t, label: t })); // Remove Σ prefix

    return [
    ...contextFixedRoles,
      ...dynamicRoles,
      ...customRoles,
    ].filter(option => option.value);
  }, [aiResultColumns, customAggTypes, aiColumnRoles, context]);

  // Handler for changing a column's role
  const handleRoleChange = (colIdx: number, role: ColumnRole) => {
    // Validate that the selected role is available in the current context
    const availableRoles = getAvailableColumnRoles();
    if (!availableRoles.includes(role)) {
      setError(`Role "${role}" is not available in the current context. Please check your organizational structure settings.`);
      return;
    }
    
    if (role === 'Date') {
      // Validate that the column actually contains dates in the selected format
      const columnValues = previewRows.map(row => row[previewHeader[colIdx]]);
      const validDates = columnValues.filter(val => {
        if (!val || typeof val !== 'string') return false;
        return parseDateWithFormat(val, dateFormat) !== null;
      });
      
      // Only allow mapping as Date if at least 50% of values are valid dates
      if (validDates.length < columnValues.length * 0.5) {
        setError(`Column "${previewHeader[colIdx]}" doesn't appear to contain valid dates in the selected format (${dateFormat}). Please check your date format selection or choose a different column.`);
        return;
      }
    }
    
    const newRoles = [...columnRoles];
    newRoles[colIdx] = role;
    setColumnRoles(newRoles);
    setError(null);
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
      originalName: col,
      csvColumn: col // Add csvColumn for compatibility with review step
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
            // Don't parse lifecycle phases, divisions, or clusters as numbers - keep them as text
            if (m.role === 'Lifecycle Phase' || m.role === 'Division' || m.role === 'Cluster') {
              entry[m.role] = row[m.originalName];
            } else {
              const parsed = frontendParseNumberWithFormat(row[m.originalName], numberFormat);
              entry[m.role] = Number.isNaN(parsed) ? row[m.originalName] : parsed;
            }
          });
          // Use the selected date format for parsing
          const parsedDate = parseDateWithFormat(previewHeader[i], dateFormat);
          let formattedDate = previewHeader[i];
          if (parsedDate) {
            const pad = (n: number) => n.toString().padStart(2, '0');
            formattedDate = `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-${pad(parsedDate.getDate())}`;
          }
          entry['Date'] = formattedDate;
          // Convert sales value to number using selected number format
          // The sales value is in the row data at the date column index
          const salesValue = row[previewHeader[i]];
          const num = parseFloat(salesValue);
          entry['Sales'] = (salesValue === '' || !Number.isFinite(num)) ? 0 : num;
          // Only add entries that have required fields
          if (entry['Material Code'] && entry['Date'] !== undefined) {
            result.push(entry);
          }
        }
      }
    }
    return result;
  }, [previewRows, columnRoles, dateRange, previewHeader, columnMappings, dateFormat, numberFormat]);

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
  const manualMappingHasMaterialCode = columnRoles.includes('Material Code');

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
        datasetId: applyResult.datasetId,
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
      // Set csvImportActive to false when config processing is complete
      if (context === 'setup') {
        setupWizardStore.setOrgStructure({ csvImportActive: false });
      }
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

      // Build finalColumnRoles for normalized output columns
      
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

      console.log('Sending manual import payload:', {
        headersLength: payload.headers?.length,
        dataLength: payload.data?.length,
        mappingsLength: payload.mappings?.length,
        finalColumnRolesLength: payload.finalColumnRoles?.length,
        dateRange: payload.dateRange,
        dateFormat: payload.dateFormat,
        transpose: payload.transpose
      });

      const sessionToken = localStorage.getItem('sessionToken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      const response = await fetch('/api/process-manual-import', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) {
        console.error('Backend error response:', result);
        throw new Error(result.error || result.details || 'Failed to process manual import on the backend.');
      }
      
      // The backend now returns datasetId
      // We need to set the uploadResult state before calling onDataReady
      const uploadResult = {
        success: true,
        datasetId: result.datasetId,
        summary: result.summary,
        skuList: result.skuList || [],
      };
      setUploadResult(uploadResult);
      onDataReady(uploadResult);
      
      // Extract organizational structure data for setup context
      //console.log('🔍 Checking setup context:', { context, hasOnSetupDataReady: !!onSetupDataReady });
      if ((context as 'forecast' | 'setup') === 'setup' && onSetupDataReady) {
        //console.log('🔍 Setup context detected, extracting org data...');
        const orgData = extractOrgStructureData();
        if (orgData) {
          // Pass the division-cluster mapping and lifecycle phases as parameters
          onSetupDataReady(orgData.divisions, orgData.clusters, orgData.divisionClusterMap, orgData.lifecyclePhases);
          
          // Add CSV to tracking system for trash can functionality (all scenarios)
          // But first, remove any existing CSV to maintain single file behavior if this is a single CSV scenario
          const isMultipleCsvScenario = setupWizardStore.orgStructure.multipleCsvImport.isEnabled && 
                                       setupWizardStore.orgStructure.importLevel === 'division';
          
          if (!isMultipleCsvScenario && setupWizardStore.orgStructure.multipleCsvImport.importedCsvs.length > 0) {
            // Remove all existing CSVs (should only be one in single CSV scenario)
            setupWizardStore.orgStructure.multipleCsvImport.importedCsvs.forEach(existingCsv => {
              setupWizardStore.removeImportedCsv(existingCsv.fileName);
            });
            
            // Set a flag to indicate this is a single CSV replacement (not merge)
            setupWizardStore.setOrgStructure({
              isSingleCsvReplacement: true
            });
          }
          
          setupWizardStore.addImportedCsv(
            file?.name || 'setup-import.csv',
            orgData.divisions,
            orgData.clusters,
            selectedDivision
          );

        } else {
          console.log('❌ No org data extracted');
        }
      } else {
        console.log('❌ Setup context not detected or onSetupDataReady not provided');
      }
      
      console.log('🔄 Manual import completion - calling onConfirm');
      await onConfirm(uploadResult);
      
      console.log('🔄 Manual import completion - resetting form');
      // Reset the form to allow for multiple imports
      setFile(null);
      setOriginalCsv('');
      setHeader([]);
      setData([]);
      setColumnRoles([]);
      setStep('upload');
      setAiStep('upload');
      
      // Show success message
      toast.success(`CSV imported successfully! You can import another file or proceed to the next step.`);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setManualConfirmLoading(false);
      // Set csvImportActive to false when manual import is complete
      if (context === 'setup') {
        setupWizardStore.setOrgStructure({ csvImportActive: false });
      }
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
      const response = await fetch(`/api/load-processed-data?datasetId=${duplicateCheckResult.existingDataset.id}`);
      const fileData = await response.json();
      const result = {
        success: true,
        datasetId: duplicateCheckResult.existingDataset.id, // Use dataset ID for consistency
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
  };

  // Handler for division selection
  const handleDivisionSelect = (divisionName: string | null) => {
    setSelectedDivision(divisionName);
    console.log('Division selected in CsvImportWizard:', divisionName);
  };

  // Extract organizational structure data for setup context
  const extractOrgStructureData = () => {
    if (context !== 'setup') return null;

    const divisionIdx = columnRoles.findIndex(role => role === 'Division');
    const clusterIdx = columnRoles.findIndex(role => role === 'Cluster');
    const lifecycleIdx = columnRoles.findIndex(role => role === 'Lifecycle Phase');

    if (divisionIdx === -1) {
      console.log('❌ No Division column found in columnRoles');
      return null;
    }

    const divisions = new Set<string>();
    const clusters = new Set<string>();
    const lifecyclePhases = new Set<string>();
    const divisionClusterMap = new Map<string, Set<string>>();

    // Extract unique divisions, clusters, and lifecycle phases from the data, preserving relationships
    data.forEach((row, index) => {
      const divisionName = divisionIdx !== -1 && row[header[divisionIdx]] 
        ? row[header[divisionIdx]].toString().trim() 
        : null;
      const clusterName = clusterIdx !== -1 && row[header[clusterIdx]] 
        ? row[header[clusterIdx]].toString().trim() 
        : null;
      const lifecyclePhase = lifecycleIdx !== -1 && row[header[lifecycleIdx]] 
        ? row[header[lifecycleIdx]].toString().trim() 
        : null;

      if (divisionName) {
        divisions.add(divisionName);
        
        // Initialize division's cluster set if it doesn't exist
        if (!divisionClusterMap.has(divisionName)) {
          divisionClusterMap.set(divisionName, new Set());
        }
        
        // Add cluster to division's set
        if (clusterName) {
          clusters.add(clusterName);
          divisionClusterMap.get(divisionName)!.add(clusterName);
        }
      }

      // Add lifecycle phase to set
      if (lifecyclePhase) {
        lifecyclePhases.add(lifecyclePhase);
      }
    });

    // Convert Map to Record for compatibility
    const divisionClusterRecord: Record<string, string[]> = {};
    divisionClusterMap.forEach((clusters, division) => {
      divisionClusterRecord[division] = Array.from(clusters);
    });

    const result = {
      divisions: Array.from(divisions),
      clusters: Array.from(clusters),
      lifecyclePhases: Array.from(lifecyclePhases),
      divisionClusterMap: divisionClusterRecord
    };

    return result;
  };

  // Handle CSV mapping confirmation for setup wizard
  const handleMappingConfirm = async () => {
    
    if (context === 'setup') {
      // Store CSV mapping data for later import instead of importing immediately
      const mappingData = {
        originalCsv: originalCsv,
        headers: header,
        data: data,
        columnRoles: columnRoles,
        columnMappings: columnMappings,
        dateFormat: dateFormat,
        numberFormat: numberFormat,
        separator: separator,
        transpose: transposed,
        finalColumnRoles: manualMappingNormalizedHeaders.map((header) => {
          if (header === 'Material Code') {
            const mapping = columnMappings.find(m => m.role === 'Material Code');
            return mapping ? mapping.role : 'Material Code';
          }
          if (header === 'Description') {
            const mapping = columnMappings.find(m => m.role === 'Description');
            return mapping ? mapping.role : 'Description';
          }
          if (header === 'Date') return 'Date';
          if (header === 'Sales') return 'Sales';
          // For other headers, find the first non-standard mapping
          const mapping = columnMappings.find(m => 
            m.role !== 'Material Code' && 
            m.role !== 'Description' && 
            m.role !== 'Date' && 
            m.role !== 'Sales' && 
            m.role !== 'Ignore'
          );
          return mapping ? mapping.role : 'Ignore';
        }),
        csvFileName: file?.name || 'setup-import.csv',
        csvHash: originalCsv ? btoa(originalCsv).slice(0, 30) : null,
        // Add selected division for division-level without division column workflow
        selectedDivision: selectedDivision
      };

      // Store the mapping data in the setup wizard store
      setupWizardStore.storeCsvMappingData(mappingData);

      // Save mapping and data to setup wizard store for org structure
      const lifecycleColumn = columnRoles.find((role, idx) => role === 'Lifecycle Phase') !== undefined ? 
        previewHeader[columnRoles.findIndex((role) => role === 'Lifecycle Phase')] : null;
      
      // Determine if this is a multiple CSV scenario
      const isMultipleCsvScenario = setupWizardStore.orgStructure.multipleCsvImport.isEnabled && 
                                   setupWizardStore.orgStructure.importLevel === 'division';

      // Handle single CSV auto-replacement logic
      let isSingleCsvReplacement = false;
      if (!isMultipleCsvScenario && setupWizardStore.orgStructure.multipleCsvImport.importedCsvs.length > 0) {
        // Check if there are existing pending items to replace BEFORE removing the CSV
        const hasExistingPendingItems = setupWizardStore.orgStructure.pendingDivisions.length > 0 || setupWizardStore.orgStructure.pendingClusters.length > 0;
        
        // Remove all existing CSVs (should only be one in single CSV scenario)
        setupWizardStore.orgStructure.multipleCsvImport.importedCsvs.forEach(existingCsv => {
          setupWizardStore.removeImportedCsv(existingCsv.fileName);
        });
        
        // Set flag to indicate this is a single CSV replacement (not merge)
        // Only set to true if there were existing pending items to replace
        if (hasExistingPendingItems) {
          isSingleCsvReplacement = true;
        }
      }
      
      setupWizardStore.setOrgStructure({
        csvMapping: {
          divisionColumn: columnRoles.find((role, idx) => role === 'Division') !== undefined ? previewHeader[columnRoles.findIndex((role) => role === 'Division')] : null,
          clusterColumn: columnRoles.find((role, idx) => role === 'Cluster') !== undefined ? previewHeader[columnRoles.findIndex((role) => role === 'Cluster')] : null,
          lifecycleColumn: lifecycleColumn,
          materialNameColumn: null,
          descriptionColumn: null,
        },
        uploadedCsvData: previewRows,
        csvHeaders: previewHeader,
        isSingleCsvReplacement: isSingleCsvReplacement
      });
      
      // Add a small delay to ensure the store update completes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Extract org structure (divisions/clusters) from mapped data directly
      const extractedDivisions: string[] = [];
      const extractedClusters: string[] = [];
      const extractedLifecyclePhases: string[] = [];
      const divisionClusterMap: Record<string, string[]> = {};
      
      // Extract divisions, clusters, and lifecycle phases with their relationships
      const divisionColumnIndex = columnRoles.findIndex(role => role === 'Division');
      const clusterColumnIndex = columnRoles.findIndex(role => role === 'Cluster');
      const lifecycleColumnIndex = columnRoles.findIndex(role => role === 'Lifecycle Phase');
      
      if (divisionColumnIndex !== -1) {
        const divisions = new Set<string>();
        const clusters = new Set<string>();
        const lifecyclePhases = new Set<string>();
        const tempDivisionClusterMap = new Map<string, Set<string>>();
        
        // Extract unique divisions, clusters, and lifecycle phases from the data, preserving relationships
        previewRows.forEach((row, index) => {
          const divisionName = row[previewHeader[divisionColumnIndex]] 
            ? row[previewHeader[divisionColumnIndex]].toString().trim() 
            : null;
          const clusterName = clusterColumnIndex !== -1 && row[previewHeader[clusterColumnIndex]] 
            ? row[previewHeader[clusterColumnIndex]].toString().trim() 
            : null;
          const lifecyclePhase = lifecycleColumnIndex !== -1 && row[previewHeader[lifecycleColumnIndex]] 
            ? row[previewHeader[lifecycleColumnIndex]].toString().trim() 
            : null;



          if (divisionName) {
            divisions.add(divisionName);
            
            // Initialize division's cluster set if it doesn't exist
            if (!tempDivisionClusterMap.has(divisionName)) {
              tempDivisionClusterMap.set(divisionName, new Set());
            }
            
            // Add cluster to division's set
            if (clusterName) {
              clusters.add(clusterName);
              tempDivisionClusterMap.get(divisionName)!.add(clusterName);
            }
          }

          // Add lifecycle phase to set
          if (lifecyclePhase) {
            lifecyclePhases.add(lifecyclePhase);
          }
        });

        extractedDivisions.push(...Array.from(divisions).filter(Boolean));
        extractedClusters.push(...Array.from(clusters).filter(Boolean));
        extractedLifecyclePhases.push(...Array.from(lifecyclePhases).filter(Boolean));
        
        // Convert Map to Record
        tempDivisionClusterMap.forEach((clusterSet, division) => {
          divisionClusterMap[division] = Array.from(clusterSet);
        });
        
        
      }

      // Call onSetupDataReady if available
      if (context === 'setup' && onSetupDataReady) {
        
        // Pass the flag value directly to avoid store timing issues
                    onSetupDataReady(extractedDivisions, extractedClusters, divisionClusterMap, extractedLifecyclePhases, isSingleCsvReplacement, file?.name || 'unknown.csv');
        //console.log('🔍 onSetupDataReady called successfully');
      }

      // Add the imported CSV to the tracking system for all CSV imports
      // This enables the new trash can functionality for both single and multiple CSV scenarios
      if (setupWizardStore.orgStructure.importLevel === 'division' && 
          setupWizardStore.orgStructure.multipleCsvImport.isEnabled) {
        // Multiple CSV import scenario
        setupWizardStore.addImportedCsv(
          file?.name || 'setup-import.csv',
          extractedDivisions,
          extractedClusters,
          selectedDivision // For division-level without division column workflow
        );
       
        
        // For multiple CSV import, reset the form and stay on upload step
        // Don't proceed to next step automatically - let user decide when to move on
        // --- Ensure org structure is captured before reset ---
        if (context === 'setup' && onSetupDataReady) {
          const orgData = extractOrgStructureData();
          console.log('DEBUG: orgData before reset (manual import)', orgData);
          if (orgData) {
            console.log('DEBUG: Calling onSetupDataReady (manual import) with', orgData);
            onSetupDataReady(orgData.divisions, orgData.clusters, orgData.divisionClusterMap, orgData.lifecyclePhases, isSingleCsvReplacement, file?.name || 'unknown.csv');
          }
        }
        setFile(null);
        setOriginalCsv('');
        setHeader([]);
        setData([]);
        setColumnRoles([]);
        setStep('upload');
        setAiStep('upload');
        // Show success message
        toast.success(`CSV imported successfully! You can import more files or proceed to the next step.`);
        return; // Exit early, don't proceed to next step
      } else {
        // Single CSV import scenario - still add to tracking for trash can functionality
        // Note: CSV removal and flag setting already handled above
        
        setupWizardStore.addImportedCsv(
          file?.name || 'setup-import.csv',
          extractedDivisions,
          extractedClusters,
          selectedDivision
        );
        
        // For single CSV import, reset the form and stay on upload step
        // This allows users to import multiple files even in single CSV mode
        // Note: org structure is already captured in the multiple CSV branch above
        setFile(null);
        setOriginalCsv('');
        setHeader([]);
        setData([]);
        setColumnRoles([]);
        setStep('upload');
        setAiStep('upload');
        
        // Show success message
        toast.success(`CSV imported successfully! You can import more files or proceed to the next step.`);
        
        // Set csvImportActive to false when import is complete
        setupWizardStore.setOrgStructure({ csvImportActive: false });
      }
    }
  };

  // Handle CSV replacement confirmation
  const handleCsvReplacementConfirm = () => {
    if (!pendingFile) return;
    
    // Clear existing CSV data
    const setupWizardStore = useSetupWizardStore.getState();
    const existingCsvs = setupWizardStore.orgStructure.multipleCsvImport.importedCsvs;
    
    // Remove all existing CSV imports
    existingCsvs.forEach(csv => {
      setupWizardStore.removeImportedCsv(csv.fileName);
    });
    
    // Process the new file
    processSelectedFile(pendingFile);
    
    // Reset dialog state
    setShowCsvReplacementDialog(false);
    setPendingFile(null);
  };

  // Handle CSV replacement cancellation
  const handleCsvReplacementCancel = () => {
    setShowCsvReplacementDialog(false);
    setPendingFile(null);
    
    // Reset the file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  // Main render logic:
  const renderContent = () => {
    if (step === 'upload') {
      // Debug logging for setup context
      if (context === 'setup') {
        console.log('🔍 CsvImportWizard debug - setup context data:', {
          setupWizardStore: setupWizardStore,
          orgStructure: setupWizardStore.orgStructure,
          divisions: setupWizardStore.divisions,
          pendingDivisions: setupWizardStore.orgStructure.pendingDivisions,
          clusters: setupWizardStore.clusters,
          importedCsvs: setupWizardStore.orgStructure.multipleCsvImport.importedCsvs
        });
      }
      
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
          context={context}
          multipleCsvProgress={context === 'setup' && setupWizardStore.orgStructure.importLevel === 'division' ? setupWizardStore.getNextImportInfo() : undefined}
          onProceedToNextStep={onProceedToNextStep}
          orgStructure={context === 'setup' ? setupWizardStore.orgStructure : undefined}
          divisions={context === 'setup' ? setupWizardStore.divisions : undefined}
          pendingDivisions={context === 'setup' ? setupWizardStore.orgStructure.pendingDivisions : undefined}
          importedCsvs={context === 'setup' ? setupWizardStore.orgStructure.multipleCsvImport.importedCsvs : undefined}
          clusters={context === 'setup' ? setupWizardStore.clusters : undefined}
          onDivisionSelect={handleDivisionSelect}
          disableImport={disableImport}
          onLoadDataset={async (dataset) => {
            // Fetch the dataset from the backend using dataset ID
            const response = await fetch(`/api/load-processed-data?datasetId=${dataset.id}`);
            const fileData = await response.json();
            const result = {
              success: true,
              datasetId: dataset.id,
              summary: dataset.summary,
              skuList: Array.isArray(fileData.data) ? fileData.data.map((row: any) => String(row['Material Code'])).filter(Boolean) : []
            };
            if (onLoadExistingData) {
              onLoadExistingData(result);
            }
            setUploadResult(result);
            setStep('preview');
          }}
          loadedDatasetFile={currentLoadedFile || (uploadResult?.datasetId ? `dataset_${uploadResult.datasetId}` : undefined)}
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
          originalHeaders={originalHeaders}
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
          dateFormat={dateFormat}
          onDateFormatChange={handleDateFormatChange}
          numberFormat={numberFormat}
          onNumberFormatChange={handleNumberFormatChange}
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
          isAiMapping={isAiFlowEnabled && aiStep === 'ai-mapping'}
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
          context={context}
          handleConfirmClick={async () => {
            if ((context as 'forecast' | 'setup') === 'setup') {
              // For setup wizard, always use handleMappingConfirm (which will handle org structure and import)
              await handleMappingConfirm();
            } else if (isAIMapping) {
              setManualConfirmLoading(true);
              setError(null);
              try {
                // Build finalColumnRoles for normalized output columns (AI flow)
                const finalColumnRoles = aiMappingNormalizedHeaders.map((header) => {
                  if (header === 'Material Code') return aiColumnRoles[aiResultColumns.indexOf('Material Code')] ?? 'Material Code';
                  if (header === 'Description') return aiColumnRoles[aiResultColumns.indexOf('Description')] ?? 'Description';
                  if (header === 'Date') return 'Date';
                  if (header === 'Sales') return 'Sales';
                  const idx = aiResultColumns.indexOf(header);
                  return idx !== -1 ? aiColumnRoles[idx] : 'Ignore';
                });
                const payload = {
                  transformedData: aiTransformedData,
                  columns: aiResultColumns,
                  columnRoles: aiColumnRoles,
                  finalColumnRoles,
                  originalCsvData: previewRows,
                  originalCsvString: originalCsv
                };
                const sessionToken = localStorage.getItem('sessionToken');
                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                
                if (sessionToken) {
                  headers['Authorization'] = `Bearer ${sessionToken}`;
                }

                const response = await fetch('/api/process-ai-import', {
                  method: 'POST',
                  headers,
                  body: JSON.stringify(payload)
                });
                const result = await response.json();
                if (!response.ok) {
                  throw new Error(result.error || 'Failed to process AI import on the backend.');
                }
                const uploadResult = {
                  success: true,
                  datasetId: result.datasetId,
                  summary: result.summary,
                  skuList: result.skuList || [],
                };
                setUploadResult(uploadResult);
                onDataReady(uploadResult);
                
                // Extract organizational structure data for setup context (AI import)
                if ((context as 'forecast' | 'setup') === 'setup' && onSetupDataReady) {
                  const orgData = extractOrgStructureData();
                  console.log('DEBUG: orgData before reset (AI import)', orgData);
                  if (orgData) {
                    console.log('DEBUG: Calling onSetupDataReady (AI import) with', orgData);
                    onSetupDataReady(orgData.divisions, orgData.clusters, orgData.divisionClusterMap, orgData.lifecyclePhases, undefined, file?.name || 'unknown.csv');
                  }
                }
                // Reset the form to allow for multiple imports
                setFile(null);
                setOriginalCsv('');
                setHeader([]);
                setData([]);
                setColumnRoles([]);
                setStep('upload');
                setAiStep('upload');
                
                console.log('🔄 AI import completion - showing success message');
                // Show success message
                toast.success(`CSV imported successfully! You can import another file or proceed to the next step.`);
              } catch (err: any) {
                setError(err.message);
              } finally {
                setManualConfirmLoading(false);
                // Set csvImportActive to false when AI import is complete
                if (context === 'setup') {
                  setupWizardStore.setOrgStructure({ csvImportActive: false });
                }
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
          dateFormat={dateFormat}
          onProceedToNextStep={onProceedToNextStep}
        />
    );
  }
    return null;
  };

  // Update csvImportActive state based on current step
  useEffect(() => {
    if (context === 'setup') {
      // CSV import is active when we're in preview or mapping steps
      // It's not active when we're in upload step or when no file is loaded
      const isActive = (step === 'preview' || step === 'mapping') && file !== null;
      setupWizardStore.setOrgStructure({ csvImportActive: isActive });
    }
  }, [step, file, context]);
  
  // Clean up csvImportActive when component unmounts
  useEffect(() => {
    return () => {
      if (context === 'setup') {
        setupWizardStore.setOrgStructure({ csvImportActive: false });
      }
    };
  }, [context]);

  // When file, separator, or header changes, auto-detect date format from header
  useEffect(() => {
    // console.log('[useEffect:autoDetectDateFormat] Starting check:', {
    //   hasHeader: !!header?.length,
    //   userSetDateFormat,
    //   currentDateFormat: dateFormat
    // });
    
    if (header && header.length > 0 && !userSetDateFormat) {
      // Only auto-detect if user hasn't manually set the format
      // AND if we don't already have a detected format from the backend
      // Check if the current dateFormat is the default (meaning backend hasn't set it yet)
      if (dateFormat === 'dd/mm/yyyy') {
        // console.log('[useEffect:autoDetectDateFormat] Proceeding with auto-detection (current format is default)');
        const candidates = header.filter(h => /\d/.test(h));
        if (candidates.length > 0) {
          const detection = autoDetectDateFormat(candidates);
          if (detection.bestGuess) {
            setDateFormat(detection.bestGuess);
            // console.log('[useEffect:autoDetectDateFormat] setDateFormat:', detection.bestGuess);
          }
        }
      }
    }
  }, [header, separator, file, userSetDateFormat, dateFormat]);

  // When file, separator, header, or previewRows change, auto-detect number format from numeric-looking values
  useEffect(() => {
    // console.log('[useEffect:autoDetectNumberFormat] Starting check:', {
    //   hasPreviewRows: !!previewRows?.length,
    //   hasHeader: !!header?.length,
    //   userSetNumberFormat,
    //   currentNumberFormat: numberFormat
    // });
    
    if (previewRows && previewRows.length > 0 && header && header.length > 0 && !userSetNumberFormat) {
      // Only auto-detect if user hasn't manually set the format
      // AND if we don't already have a detected format from the backend
      // Check if the current numberFormat is the default (meaning backend hasn't set it yet)
      if (numberFormat === '1,234.56') {
        // console.log('[useEffect:autoDetectNumberFormat] Proceeding with auto-detection (current format is default)');
        const numericSamples: string[] = [];
        for (let i = 0; i < header.length; i++) {
          // Only sample columns that are not mapped as Date, Material Code, or Description
          if (columnRoles[i] === 'Date' || columnRoles[i] === 'Material Code' || columnRoles[i] === 'Description') continue;
          for (let j = 0; j < Math.min(10, previewRows.length); j++) {
            const val = previewRows[j][header[i]];
            if (typeof val === 'string' && /[0-9]/.test(val)) {
              numericSamples.push(val);
            }
          }
        }
        if (numericSamples.length > 0) {
          const detection = autoDetectNumberFormat(numericSamples);
          if (detection.bestGuess && NUMBER_FORMAT_OPTIONS.includes(detection.bestGuess)) {
            setNumberFormat(detection.bestGuess);
            // console.log('[useEffect:autoDetectNumberFormat] setNumberFormat:', detection.bestGuess);
          } else {
            setNumberFormat('1,234.56'); // fallback default
            // console.log('[useEffect:autoDetectNumberFormat] setNumberFormat: fallback 1,234.56');
          }
        }
      } else {
        // console.log('[useEffect:autoDetectNumberFormat] Skipping auto-detection - backend already set format to:', numberFormat);
      }
    } else {
      // console.log('[useEffect:autoDetectNumberFormat] Skipping auto-detection - conditions not met');
    }
  }, [previewRows, header, columnRoles, separator, file, userSetNumberFormat, numberFormat]);

  return (
    <>
      {renderContent()}
      
      {/* CSV Replacement Confirmation Dialog */}
      <AlertDialog open={showCsvReplacementDialog} onOpenChange={setShowCsvReplacementDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace Existing CSV Import?</AlertDialogTitle>
            <AlertDialogDescription>
              You already have a CSV file imported. Importing a new file will remove all data from the previous import, including any divisions, clusters, and lifecycle phases that were extracted.
              <br /><br />
              Are you sure you want to continue? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCsvReplacementCancel}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleCsvReplacementConfirm}>
              Replace Import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
