import React, { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Upload, RefreshCw, Info, Sparkles, Bot, User, Settings, ArrowRight, Zap, FileText, ChevronsRight, AlertTriangle, Brain, AlertCircle } from 'lucide-react';
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
import { Dialog, DialogContent, DialogTitle, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { useExistingDataDetection } from '@/hooks/useExistingDataDetection';
import { useSetupWizardStore } from '../store/setupWizardStoreRefactored';

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
  // New prop to close the wizard
  onWizardClose?: () => void;
  // New prop for division-specific field mapping
  selectedDivision?: string | null;
  // New prop to prevent duplicate CSV tracking during duplicate division processing
  isProcessingDuplicateDivision?: boolean;
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
  disableImport = false,
  onWizardClose,
  selectedDivision,
  isProcessingDuplicateDivision
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
  // Division selection is handled by the parent component (CSV import step)

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
  const [divisionValidationError, setDivisionValidationError] = useState<string | null>(null);
  const [showDivisionValidationDialog, setShowDivisionValidationDialog] = useState(false);
  
  // Add state for division-specific overwrite dialog
  const [showDivisionOverwriteDialog, setShowDivisionOverwriteDialog] = useState(false);
  const [pendingDivisionOverwrite, setPendingDivisionOverwrite] = useState<{file: File, division: string} | null>(null);
  
  // Add state for validation error dialog
  const [showValidationErrorDialog, setShowValidationErrorDialog] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isDateFormatDialogOpen, setIsDateFormatDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<any>(null);
  const [selectedDateFormat, setSelectedDateFormat] = useState<string>('');

  const DATE_FORMAT_OPTIONS = [
    { value: 'dd/mm/yyyy', label: 'dd/mm/yyyy', example: '25/12/2023' },
    { value: 'mm/dd/yyyy', label: 'mm/dd/yyyy', example: '12/25/2023' },
    { value: 'yyyy-mm-dd', label: 'yyyy-mm-dd', example: '2023-12-25' },
    { value: 'dd-mm-yyyy', label: 'dd-mm-yyyy', example: '25-12-2023' },
    { value: 'yyyy/mm/dd', label: 'yyyy/mm/dd', example: '2023/12/25' },
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
    const sessionToken = localStorage.getItem('sessionToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    
    const response = await fetch('/api/check-csv-duplicate', {
      method: 'POST',
      headers,
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
      
      // Only show replacement dialog for single CSV mode
      // In multiple CSV mode, users should be able to add more files
      // Both division scenarios allow multiple CSV uploads
      const isMultipleCsvMode = setupWizardStore.orgStructure.importLevel === 'division' && 
                               setupWizardStore.orgStructure.multipleCsvImport.isEnabled;
      
      if (!isMultipleCsvMode) {
        // Single CSV mode - check for existing imports
        const hasExistingImport = setupWizardStore.orgStructure.multipleCsvImport.importedCsvs.length > 0 ||
                                 setupWizardStore.orgStructure.csvImportData?.csvFileName;
      
      if (hasExistingImport) {
          // Show confirmation dialog for single CSV mode
        setPendingFile(selectedFile);
        setShowCsvReplacementDialog(true);
        return;
        }
      } else {
        // Multiple CSV mode - check for division-specific duplicates
        if (setupWizardStore.orgStructure.importLevel === 'division') {
          const importedCsvs = setupWizardStore.orgStructure.multipleCsvImport.importedCsvs || [];
          
          // For "withoutDivisionColumn" scenario, check if selected division already has a CSV
          if (setupWizardStore.orgStructure.divisionCsvType === 'withoutDivisionColumn' && selectedDivision) {
            const existingCsvForDivision = importedCsvs.find(csv => 
              csv.divisionName === selectedDivision || csv.divisions?.includes(selectedDivision)
            );
            
            if (existingCsvForDivision) {
              // Show division-specific overwrite dialog
              setPendingDivisionOverwrite({ file: selectedFile, division: selectedDivision });
              setShowDivisionOverwriteDialog(true);
              return;
            }
          }
          
          // For "withDivisionColumn" scenario, we need to parse the CSV first to check for duplicates
          if (setupWizardStore.orgStructure.divisionCsvType === 'withDivisionColumn') {
            // Parse the CSV to extract divisions and check for duplicates
            const reader = new FileReader();
            reader.onload = async (event) => {
              const csvData = event.target?.result as string;
              
              // Parse CSV to get headers and first few rows
              const lines = csvData.split('\n');
              const headers = lines[0].split(',').map(h => h.trim());
              const divisionColumnIndex = headers.findIndex(h => 
                h.toLowerCase().includes('division') || h.toLowerCase().includes('div')
              );
              
              if (divisionColumnIndex !== -1) {
                // Extract unique divisions from the CSV
                const csvDivisions = new Set<string>();
                for (let i = 1; i < Math.min(lines.length, 10); i++) { // Check first 10 rows
                  const values = lines[i].split(',');
                  if (values[divisionColumnIndex]) {
                    csvDivisions.add(values[divisionColumnIndex].trim());
                  }
                }
                
                // Check if any of these divisions already have CSV imports
                const existingDivisions = importedCsvs.flatMap(csv => csv.divisions || []);
                const duplicateDivisions = Array.from(csvDivisions).filter(div => 
                  existingDivisions.includes(div)
                );
                
                if (duplicateDivisions.length > 0) {
                  // Show division-specific overwrite dialog
                  setPendingDivisionOverwrite({ 
                    file: selectedFile, 
                    division: duplicateDivisions[0] // Show first duplicate
                  });
                  setShowDivisionOverwriteDialog(true);
                  return;
                }
              }
              
              // No duplicates found, proceed with import
              processSelectedFile(selectedFile);
            };
            reader.readAsText(selectedFile);
            return; // Exit early, let the reader handle the rest
          }
        }
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
      const sessionToken = localStorage.getItem('sessionToken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      
      const response = await fetch('/api/generate-preview', {
        method: 'POST',
        headers,
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
      
      // Post-process backend roles to convert unavailable special roles to aggregatable fields
      const processedRoles = result.columnRoles.map((role, index) => {
        const specialRoles = ['Division', 'Cluster', 'Lifecycle Phase', 'Material Code', 'Description', 'Date', 'Ignore'];
        
        console.log(`🔍 [POST-PROCESS] Processing role "${role}" for column "${result.headers[index]}"`);
        
        if (specialRoles.includes(role)) {
          const availableRoles = getAvailableColumnRoles();
          console.log(`🔍 [POST-PROCESS] Role "${role}" is special, available roles:`, availableRoles);
          
          if (!availableRoles.includes(role)) {
            // Convert unavailable special role to original column name as aggregatable field
            const originalColumnName = result.headers[index];
            console.log(`[POST-PROCESS] Converting unavailable role "${role}" to aggregatable field "${originalColumnName}"`);
            return originalColumnName;
          } else {
            console.log(`✅ [POST-PROCESS] Role "${role}" is available, keeping as special role`);
          }
        } else {
          console.log(`📝 [POST-PROCESS] Role "${role}" is not special, keeping as is`);
        }
        return role;
      });
      
      setColumnRoles(processedRoles);

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

  const handleDateFormatChangeFromDialog = (newDateFormat: string) => {
    setDateFormat(newDateFormat);
    setUserSetDateFormat(true);
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
      
      console.log('🔍 [GET AVAILABLE ROLES] Current state:', {
        hasMultipleDivisions,
        importLevel,
        divisionCsvType,
        context
      });
      
      // Only show Division field if:
      // 1. Multiple divisions are enabled AND
      // 2. Either company-level import OR division-level import with division column
      // 3. NOT in "without division column" scenario (where division columns should be aggregatable fields)
      if (hasMultipleDivisions && 
          (importLevel === 'company' || 
           (importLevel === 'division' && divisionCsvType === 'withDivisionColumn'))) {
        // Don't add Division role in "without division column" scenario
        // Division columns should be treated as aggregatable fields instead
        if (!(importLevel === 'division' && divisionCsvType === 'withoutDivisionColumn')) {
        baseRoles.splice(3, 0, 'Division'); // Insert after Date
          console.log('✅ [GET AVAILABLE ROLES] Added Division role to available roles');
        } else {
          console.log('❌ [GET AVAILABLE ROLES] Excluded Division role for "without division column" scenario');
        }
      } else {
        console.log('❌ [GET AVAILABLE ROLES] Division role not added - conditions not met');
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
    // Safety check: if previewHeader is empty or undefined, return only available special roles
    if (!previewHeader || previewHeader.length === 0) {
      const availableSpecialRoles = getAvailableColumnRoles();
      return availableSpecialRoles.map(role => ({ value: role, label: role }));
    }
    
    // Get available special roles based on organizational settings
    const availableSpecialRoles = getAvailableColumnRoles();
    const availableSpecialRoleOptions = availableSpecialRoles.map(role => ({ value: role, label: role }));
    
    // Get CSV column names as aggregatable fields (excluding special roles and date columns)
    const csvColumnOptions = previewHeader
      .filter(columnName => {
        // Exclude columns that are special roles
        if (availableSpecialRoles.includes(columnName)) return false;
        // Exclude columns that are valid dates in the selected format
        const isDate = parseDateWithFormat(columnName, dateFormat) !== null;
        if (isDate) {
        }
        return !isDate;
      })
      .map(columnName => ({ value: columnName, label: columnName }));

    // Get custom aggregatable types
    const customRoles = customAggTypes.map(t => ({ value: t, label: t }));

    return [
      ...availableSpecialRoleOptions,
      ...csvColumnOptions,
      ...customRoles,
    ].filter(option => option.value);
  }, [previewHeader, customAggTypes, context, dateFormat]);

  const aiAggregatableFields = useMemo(() => {
    return aiTransformedData && aiTransformedData.length > 0 ? aiTransformedData.map((col) => ({ value: col, label: col })) : [];
  }, [aiTransformedData]);

  const aiDropdownOptions = useMemo(() => {
    const headers = aiResultColumns;
    if (headers.length === 0) return [];

    // Get available special roles based on organizational settings
    const availableSpecialRoles = getAvailableColumnRoles();
    const availableSpecialRoleOptions = availableSpecialRoles.map(role => ({ value: role, label: role }));
    
    // Get CSV column names as aggregatable fields (excluding special roles and date columns)
    const csvColumnOptions = headers
      .filter((columnName: string) => {
        // Exclude columns that are special roles
        if (availableSpecialRoles.includes(columnName)) return false;
        // Exclude columns that are valid dates in the selected format
        const isDate = parseDateWithFormat(columnName, dateFormat) !== null;
        if (isDate) {}
        return !isDate;
      })
      .map((columnName: string) => ({ value: columnName, label: columnName }));
    
    // Get custom aggregatable types
    const customRoles = customAggTypes.map(t => ({ value: t, label: t }));

    return [
      ...availableSpecialRoleOptions,
      ...csvColumnOptions,
      ...customRoles,
    ].filter(option => option.value);
  }, [aiResultColumns, customAggTypes, context, dateFormat]);

  // Handler for changing a column's role
  const handleRoleChange = (colIdx: number, role: ColumnRole) => {
    // Safety check: if previewHeader is empty or undefined, return early
    if (!previewHeader || previewHeader.length === 0) {
      return;
    }
    
    // Define special roles that should be validated against organizational settings
    const specialRoles = ['Division', 'Cluster', 'Lifecycle Phase', 'Material Code', 'Description', 'Date', 'Ignore'];
    
    // Check if this is a special role that needs validation
    if (specialRoles.includes(role)) {
    const availableRoles = getAvailableColumnRoles();
    if (!availableRoles.includes(role)) {
        // Instead of showing an error, treat it as an aggregatable field
        // Use the original column name as the role (which will be treated as aggregatable)
        const originalColumnName = previewHeader[colIdx];
        
        // Check if the original column is a date column
        const isDateColumn = parseDateWithFormat(originalColumnName, dateFormat) !== null;
        console.log(`DEBUG: Checking if "${originalColumnName}" is a date column with format "${dateFormat}": ${isDateColumn}`);
        
        if (isDateColumn) {
          // If it's a date column, set it to 'Ignore' instead of making it aggregatable
          console.log(`Role "${role}" not available in current context. Column "${originalColumnName}" is a date column, setting to 'Ignore'`);
          const newRoles = [...columnRoles];
          newRoles[colIdx] = 'Ignore';
          setColumnRoles(newRoles);
          setError(null);
          return;
        } else {
          // If it's not a date column, make it an aggregatable field
          console.log(`Role "${role}" not available in current context. Converting to aggregatable field: "${originalColumnName}"`);
          const newRoles = [...columnRoles];
          newRoles[colIdx] = originalColumnName; // Use original column name as aggregatable field
          setColumnRoles(newRoles);
          setError(null);
      return;
        }
      }
    }
    
    // For Date role, validate that the column actually contains dates
    if (role === 'Date') {
      // Safety check: if previewRows is empty or undefined, return early
      if (!previewRows || previewRows.length === 0) {
        return;
      }
      
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
    // Safety check: if previewHeader is empty or undefined, return empty array
    if (!previewHeader || previewHeader.length === 0) {
      return [];
    }
    
    return previewHeader.map((col, i) => ({
      role: columnRoles[i],
      originalName: col,
      csvColumn: col // Add csvColumn for compatibility with review step
    }));
  }, [previewHeader, columnRoles]);

  // Normalize data to long format
  const normalizedData = useMemo(() => {
    if (!previewRows || previewRows.length === 0 || columnRoles.length === 0 || dateRange.start === -1 || dateRange.end === -1 || !previewHeader || previewHeader.length === 0) return [];
    

      
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
            // Keep all aggregatable fields as text to preserve formatting like "03" instead of "3"
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
      const sessionToken = localStorage.getItem('sessionToken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      
      const response = await fetch('/api/grok-transform', {
        method: 'POST',
        headers,
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
      const configSessionToken = localStorage.getItem('sessionToken');
      const configHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      
      if (configSessionToken) {
        configHeaders['Authorization'] = `Bearer ${configSessionToken}`;
      }
      
      const response = await fetch('/api/grok-generate-config', {
        method: 'POST',
        headers: configHeaders,
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
        headers: configHeaders,
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
        try {
          const setupWizardStore = useSetupWizardStore.getState();
          const orgData = extractOrgStructureData(setupWizardStore.orgStructure?.importLevel);
        if (orgData) {
          // Handle "without division column" scenario
          let divisions = orgData.divisions;
          let divisionClusterMap = orgData.divisionClusterMap;
          
          if (setupWizardStore.orgStructure.divisionCsvType === 'withoutDivisionColumn' && selectedDivision) {
            // For "without division column" scenario, use the selected division
            divisions = [selectedDivision];
            divisionClusterMap = { [selectedDivision]: orgData.clusters };
          }
          
          // Pass the division-cluster mapping and lifecycle phases as parameters
            onSetupDataReady(
              divisions, 
              orgData.clusters, 
              divisionClusterMap, 
              orgData.lifecyclePhases, 
              false, 
              file?.name || 'setup-import.csv'
            );
          
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
          
          // Note: addImportedCsv is now only called for multiple CSV scenarios
          // Single CSV imports are tracked via csvImportData.csvFileName

        } else {
          console.log('❌ No org data extracted');
          }
        } catch (error) {
          console.error('❌ Error extracting organizational structure data:', error);
          setDivisionValidationError(error instanceof Error ? error.message : 'Failed to validate CSV structure');
          setShowDivisionValidationDialog(true);
          setManualConfirmLoading(false);
          return;
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
      const sessionToken = localStorage.getItem('sessionToken');
      const headers: Record<string, string> = {};
      
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      
      const response = await fetch(`/api/load-processed-data?datasetId=${duplicateCheckResult.existingDataset.id}`, { headers });
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
          const sessionToken = localStorage.getItem('sessionToken');
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          
          if (sessionToken) {
            headers['Authorization'] = `Bearer ${sessionToken}`;
          }
          
          const response = await fetch('/api/generate-preview', {
            method: 'POST',
            headers,
            body: JSON.stringify({ csvData: text }),
          });
          const result = await response.json();
          if (!response.ok) {
            throw new Error(result.error || 'Failed to generate preview from backend.');
          }
          setHeader(result.headers);
          setData(result.previewRows);
          
          // Post-process backend roles to convert unavailable special roles to aggregatable fields
          const processedRoles = result.columnRoles.map((role, index) => {
            const specialRoles = ['Division', 'Cluster', 'Lifecycle Phase', 'Material Code', 'Description', 'Date', 'Ignore'];
            
            console.log(`🔍 [POST-PROCESS 2] Processing role "${role}" for column "${result.headers[index]}"`);
            
            if (specialRoles.includes(role)) {
              const availableRoles = getAvailableColumnRoles();
              console.log(`🔍 [POST-PROCESS 2] Role "${role}" is special, available roles:`, availableRoles);
              
              if (!availableRoles.includes(role)) {
                // Convert unavailable special role to original column name as aggregatable field
                const originalColumnName = result.headers[index];
                console.log(`[POST-PROCESS 2] Converting unavailable role "${role}" to aggregatable field "${originalColumnName}"`);
                return originalColumnName;
              } else {
                console.log(`✅ [POST-PROCESS 2] Role "${role}" is available, keeping as special role`);
              }
            } else {
              console.log(`📝 [POST-PROCESS 2] Role "${role}" is not special, keeping as is`);
            }
            return role;
          });
          
          setColumnRoles(processedRoles);
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

  // Division selection is now handled entirely by the CSV import step
  // The selectedDivision prop is passed from the parent component

  // Extract organizational structure data for setup context
  const extractOrgStructureData = (importLevel?: string) => {
    console.log('🔍 [EXTRACT ORG DATA] Starting extraction with importLevel:', importLevel);
    console.log('🔍 [EXTRACT ORG DATA] Current data:', { header, data, columnRoles });
    
    if (!header || !data || !columnRoles) {
      console.error('❌ Missing required data for org structure extraction');
      throw new Error('Missing required data for organizational structure extraction');
    }

    const divisions = new Set<string>();
    const clusters = new Set<string>();
    const lifecyclePhases = new Set<string>();
    const divisionClusterMap = new Map<string, Set<string>>();

    // Find column indices
    const divisionColumnIndex = columnRoles.findIndex(role => role === 'Division');
    const clusterColumnIndex = columnRoles.findIndex(role => role === 'Cluster');
    const lifecycleColumnIndex = columnRoles.findIndex(role => role === 'Lifecycle Phase');

    console.log('🔍 [EXTRACT ORG DATA] Column indices:', { 
      divisionColumnIndex, 
      clusterColumnIndex, 
      lifecycleColumnIndex 
    });

    // Process each row
    data.forEach((row, rowIndex) => {
      const divisionName = divisionColumnIndex !== -1 ? row[header[divisionColumnIndex]]?.toString().trim() : null;
      const clusterName = clusterColumnIndex !== -1 ? row[header[clusterColumnIndex]]?.toString().trim() : null;
      const lifecyclePhase = lifecycleColumnIndex !== -1 ? row[header[lifecycleColumnIndex]]?.toString().trim() : null;

      console.log(`🔍 [EXTRACT ORG DATA] Row ${rowIndex}:`, { divisionName, clusterName, lifecyclePhase });

      // Add division to set
      if (divisionName) {
        divisions.add(divisionName);
        if (!divisionClusterMap.has(divisionName)) {
          divisionClusterMap.set(divisionName, new Set());
        }
        }
        
        // Add cluster to division's set
        if (clusterName) {
          clusters.add(clusterName);
          divisionClusterMap.get(divisionName)!.add(clusterName);
      }

      // Add lifecycle phase to set
      if (lifecyclePhase) {
        lifecyclePhases.add(lifecyclePhase);
      }
    });

    console.log('🔍 [EXTRACT ORG DATA] Extracted data:', { 
      divisions: Array.from(divisions), 
      clusters: Array.from(clusters), 
      lifecyclePhases: Array.from(lifecyclePhases),
      divisionClusterMap: Object.fromEntries(
        Array.from(divisionClusterMap.entries()).map(([k, v]) => [k, Array.from(v)])
      )
    });

    // Validate division count for division-specific import mode
    if (importLevel === 'division') {
      const uniqueDivisions = Array.from(divisions);
      const isWithoutDivisionColumn = setupWizardStore.orgStructure.divisionCsvType === 'withoutDivisionColumn';
      
      console.log('🔍 [EXTRACT ORG DATA] Validating divisions:', uniqueDivisions);
      console.log('🔍 [EXTRACT ORG DATA] Division CSV type:', setupWizardStore.orgStructure.divisionCsvType);
      
      if (isWithoutDivisionColumn) {
        // For "without division column" scenario, we don't expect divisions in the CSV
        // The division is selected in the UI and associated with the CSV data
        console.log('✅ Division-specific validation passed: CSV does not contain division column, division will be associated from UI selection');
      } else {
        // For "with division column" scenario, validate that CSV contains exactly one division
        if (uniqueDivisions.length > 1) {
          console.error('❌ Multiple divisions found in CSV for division-specific import mode');
          const errorMessage = `This CSV contains ${uniqueDivisions.length} divisions (${uniqueDivisions.join(', ')}). ` +
            `In division-specific import mode, each CSV must contain only one division. ` +
            `Please use organization-wide import mode for CSVs with multiple divisions.`;
          console.error('❌ Throwing error:', errorMessage);
          throw new Error(errorMessage);
        } else if (uniqueDivisions.length === 0) {
          console.error('❌ No divisions found in CSV for division-specific import mode');
          const errorMessage = 'No divisions found in this CSV file. ' +
            'In division-specific import mode, the CSV must contain a Division column with at least one division.';
          console.error('❌ Throwing error:', errorMessage);
          throw new Error(errorMessage);
        }
        
        console.log('✅ Division-specific validation passed: CSV contains exactly one division:', uniqueDivisions[0]);
      }
    }

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

  // Validate CSV contains required columns based on organizational configuration
  const validateRequiredColumns = () => {
    if (context !== 'setup') return { isValid: true, errors: [] };
    
    const setupWizardStore = useSetupWizardStore.getState();
    const orgStructure = setupWizardStore.orgStructure;
    const errors: string[] = [];
    
    console.log('🔍 [VALIDATION] Checking required columns for org structure:', {
      hasMultipleDivisions: orgStructure?.hasMultipleDivisions,
      hasMultipleClusters: orgStructure?.hasMultipleClusters,
      enableLifecycleTracking: orgStructure?.enableLifecycleTracking,
      importLevel: orgStructure?.importLevel,
      divisionCsvType: orgStructure?.divisionCsvType
    });
    
    // Check if divisions are required
    if (orgStructure?.hasMultipleDivisions) {
      // For "withoutDivisionColumn" scenario, division is selected manually, not from CSV
      if (orgStructure?.divisionCsvType === 'withoutDivisionColumn') {
        // No validation needed - division is selected from UI
        console.log('🔍 [VALIDATION] Division validation skipped for withoutDivisionColumn scenario');
      } else {
        const hasDivisionColumn = columnRoles.some(role => role === 'Division');
        if (!hasDivisionColumn) {
          errors.push('Division column is required when "Multiple Divisions" is enabled. Please map a column to "Division" role.');
        }
      }
    }
    
    // Check if clusters are required
    if (orgStructure?.hasMultipleClusters) {
      // For "withoutDivisionColumn" scenario, clusters might be in the CSV or selected manually
      if (orgStructure?.divisionCsvType === 'withoutDivisionColumn') {
        // Still validate clusters in CSV for withoutDivisionColumn scenario
        const hasClusterColumn = columnRoles.some(role => role === 'Cluster');
        if (!hasClusterColumn) {
          errors.push('Cluster column is required when "Multiple Clusters" is enabled. Please map a column to "Cluster" role.');
        }
      } else {
        const hasClusterColumn = columnRoles.some(role => role === 'Cluster');
        if (!hasClusterColumn) {
          errors.push('Cluster column is required when "Multiple Clusters" is enabled. Please map a column to "Cluster" role.');
        }
      }
    }
    
    // Check if lifecycle phases are required
    if (orgStructure?.enableLifecycleTracking) {
      const hasLifecycleColumn = columnRoles.some(role => role === 'Lifecycle Phase');
      if (!hasLifecycleColumn) {
        errors.push('Lifecycle Phase column is required when "Lifecycle Management" is enabled. Please map a column to "Lifecycle Phase" role.');
      }
    }
    
    console.log('🔍 [VALIDATION] Validation result:', { isValid: errors.length === 0, errors });
    return { isValid: errors.length === 0, errors };
  };

  // Handle CSV mapping confirmation for setup wizard
  const handleMappingConfirm = async () => {
    
    if (context === 'setup') {
      // Safety check: if previewHeader or previewRows is empty, return early
      if (!previewHeader || previewHeader.length === 0 || !previewRows || previewRows.length === 0) {
        console.log('❌ No preview data available for mapping confirmation');
        return;
      }
      
      // Validate required columns based on organizational configuration
      const validation = validateRequiredColumns();
      if (!validation.isValid) {
        console.log('❌ Validation failed:', validation.errors);
        setValidationErrors(validation.errors);
        setShowValidationErrorDialog(true);
        return;
      }
      
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
        finalColumnRoles: columnRoles,
        csvFileName: file?.name || 'setup-import.csv',
        csvHash: originalCsv ? btoa(originalCsv).slice(0, 30) : null,
        // Add selected division for division-level without division column workflow
        selectedDivision: selectedDivision
      };

      // Store the mapping data in the setup wizard store
      if (setupWizardStore.orgStructure?.importLevel === 'division') {
        if (setupWizardStore.orgStructure?.divisionCsvType === 'withoutDivisionColumn' && selectedDivision) {
          // For "without division column" scenario, use the manually selected division
          console.log('🔍 [CSV STORAGE] Storing CSV data for manually selected division:', selectedDivision);
          console.log('🔍 [CSV STORAGE] Mapping data keys:', Object.keys(mappingData || {}));
          setupWizardStore.storeCsvMappingData(mappingData, selectedDivision);
          console.log('🔍 [CSV STORAGE] After storing, checking if data exists for division:', selectedDivision);
          const storedData = setupWizardStore.getCurrentCsvData(selectedDivision);
          console.log('🔍 [CSV STORAGE] Retrieved data for division:', selectedDivision, ':', storedData);
        } else {
          // For "with division column" scenario, extract division from CSV data
          const orgData = extractOrgStructureData(setupWizardStore.orgStructure?.importLevel);
          console.log('🔍 [CSV STORAGE] Extracted org data for withDivisionColumn:', orgData);
          if (orgData && orgData.divisions.length > 0) {
            // Use the actual division from the CSV, not the selected division card
            const csvDivision = orgData.divisions[0]; // We know there's exactly one division
            console.log('🔍 [CSV STORAGE] Storing CSV data for CSV division:', csvDivision);
            setupWizardStore.storeCsvMappingData(mappingData, csvDivision);
          } else {
            // Fallback to global storage if no division found
            console.log('🔍 [CSV STORAGE] No division found in CSV, storing globally');
      setupWizardStore.storeCsvMappingData(mappingData);
          }
        }
      } else {
        // Store global CSV data
        setupWizardStore.storeCsvMappingData(mappingData);
      }

      // Save mapping and data to setup wizard store for org structure
      const lifecycleColumn = columnRoles.find((role, idx) => role === 'Lifecycle Phase') !== undefined ? 
        previewHeader[columnRoles.findIndex((role) => role === 'Lifecycle Phase')] : null;
      
      console.log('🔍 [CSV IMPORT WIZARD] Before setOrgStructure call:', {
        currentCsvImportData: setupWizardStore.orgStructure?.csvImportData,
        mappingDataKeys: Object.keys(mappingData || {}),
        selectedDivision
      });
      
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
      
      console.log('🔍 [CSV IMPORT WIZARD] After setOrgStructure call:', {
        updatedCsvImportData: setupWizardStore.orgStructure?.csvImportData
      });
      
      // Add a small delay to ensure the store update completes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Extract org structure (divisions/clusters) from mapped data directly
      try {
        const setupWizardStore = useSetupWizardStore.getState();
        console.log('🔍 [MAPPING CONFIRM] About to extract org structure data');
        const orgData = extractOrgStructureData(setupWizardStore.orgStructure?.importLevel);
        console.log('🔍 [MAPPING CONFIRM] Org data extracted successfully:', orgData);
        if (orgData) {
          // Check for duplicates BEFORE adding to tracking
          const hasDuplicates = setupWizardStore.orgStructure?.importLevel === 'division' && 
                               setupWizardStore.orgStructure?.multipleCsvImport?.isEnabled &&
                               setupWizardStore.orgStructure?.divisionCsvType === 'withDivisionColumn';
          
          if (hasDuplicates) {
            // Check if any of the divisions already exist in pending divisions or imported CSVs
            const divisions = orgData.divisions;
            const existingCsvs = setupWizardStore.orgStructure?.multipleCsvImport?.importedCsvs || [];
            const existingCsvForDivision = existingCsvs.find(csv => 
              csv.divisionName === divisions[0] || csv.divisions?.includes(divisions[0])
            );
            
            const duplicates = divisions.filter(divisionName => 
              setupWizardStore.orgStructure?.pendingDivisions?.some((pendingDiv: any) => 
                pendingDiv.name === divisionName
              )
            );
            
            if (duplicates.length > 0 || existingCsvForDivision) {
              console.log('🔍 [DUPLICATE DETECTED] Found duplicates before adding to tracking:', { duplicates, existingCsvForDivision });
              // Don't add to tracking - let the duplicate handling in CsvImportStep handle it
              // Handle "without division column" scenario for duplicate detection
              let divisions = orgData.divisions;
              let divisionClusterMap = orgData.divisionClusterMap;
              
              if (setupWizardStore.orgStructure.divisionCsvType === 'withoutDivisionColumn' && selectedDivision) {
                divisions = [selectedDivision];
                divisionClusterMap = { [selectedDivision]: orgData.clusters };
              }
              
              // Just call onSetupDataReady to trigger the duplicate dialog
              onSetupDataReady(
                divisions, 
                orgData.clusters, 
                divisionClusterMap, 
                orgData.lifecyclePhases, 
                isSingleCsvReplacement, 
                file?.name || 'setup-import.csv'
              );
              
              // Close wizard without showing toast
              if (onWizardClose) {
                onWizardClose();
              }
              return; // Exit early, don't proceed with normal flow
            }
          }
          
          // Handle "without division column" scenario for successful import
          let divisions = orgData.divisions;
          let divisionClusterMap = orgData.divisionClusterMap;
          
          if (setupWizardStore.orgStructure.divisionCsvType === 'withoutDivisionColumn' && selectedDivision) {
            divisions = [selectedDivision];
            divisionClusterMap = { [selectedDivision]: orgData.clusters };
          }
          
          // Call onSetupDataReady with the extracted data (only if no duplicates detected)
          onSetupDataReady(
            divisions, 
            orgData.clusters, 
            divisionClusterMap, 
            orgData.lifecyclePhases, 
            isSingleCsvReplacement, 
            file?.name || 'setup-import.csv'
          );
        }
      } catch (error) {
        console.error('❌ Error extracting organizational structure data:', error);
        console.log('🔍 [MAPPING CONFIRM] Setting division validation error and dialog');
        setDivisionValidationError(error instanceof Error ? error.message : 'Failed to validate CSV structure');
        setShowDivisionValidationDialog(true);
        console.log('🔍 [MAPPING CONFIRM] Dialog state set:', { 
          showDivisionValidationDialog: true, 
          divisionValidationError: error instanceof Error ? error.message : 'Failed to validate CSV structure' 
        });
        return;
      }

      // Add the imported CSV to the tracking system for all CSV imports
      // This enables the new trash can functionality for both single and multiple CSV scenarios
      console.log('🔍 DEBUG: CSV Import Conditions:', {
        importLevel: setupWizardStore.orgStructure.importLevel,
        multipleCsvEnabled: setupWizardStore.orgStructure.multipleCsvImport.isEnabled,
        divisionCsvType: setupWizardStore.orgStructure.divisionCsvType,
        isProcessingDuplicateDivision,
        condition: setupWizardStore.orgStructure.importLevel === 'division' && 
                  setupWizardStore.orgStructure.multipleCsvImport.isEnabled &&
                  setupWizardStore.orgStructure.divisionCsvType === 'withDivisionColumn' &&
                  !isProcessingDuplicateDivision
      });
      
      if (setupWizardStore.orgStructure.importLevel === 'division' && 
          setupWizardStore.orgStructure.multipleCsvImport.isEnabled &&
          !isProcessingDuplicateDivision) {
        // Multiple CSV import scenario - for division-specific imports (both with and without division column)
        console.log('🔍 DEBUG: Adding to multiple CSV tracking - isProcessingDuplicateDivision:', isProcessingDuplicateDivision);
        const orgData = extractOrgStructureData(setupWizardStore.orgStructure.importLevel);
        if (orgData) {
          if (setupWizardStore.orgStructure.divisionCsvType === 'withDivisionColumn') {
            // Use the actual division from the CSV
        setupWizardStore.addImportedCsv(
          file?.name || 'setup-import.csv',
              orgData.divisions,
              orgData.clusters,
              orgData.divisions[0]
            );
          } else if (setupWizardStore.orgStructure.divisionCsvType === 'withoutDivisionColumn') {
            // Use the selected division from the UI
            setupWizardStore.addImportedCsv(
              file?.name || 'setup-import.csv',
              selectedDivision ? [selectedDivision] : [],
              orgData.clusters,
              selectedDivision
            );
          }
        }
      } else {
        console.log('🔍 DEBUG: NOT adding to multiple CSV tracking - single CSV scenario or duplicate processing. isProcessingDuplicateDivision:', isProcessingDuplicateDivision);
      }
      
        // Show success message
        toast.success(`CSV imported successfully! You can import more files or proceed to the next step.`);
      
      // Close the wizard instead of resetting to upload step
      if (onWizardClose) {
        onWizardClose();
      }
        return; // Exit early, don't proceed to next step
      } else {
      // Single CSV import scenario - don't add to multiple CSV tracking
      // Single CSV imports are tracked via csvImportData.csvFileName
      
      // For single CSV import, close the wizard after successful mapping
        // Note: org structure is already captured in the multiple CSV branch above
        
        // Show success message
        toast.success(`CSV imported successfully! You can import more files or proceed to the next step.`);
        
        // Set csvImportActive to false when import is complete
        setupWizardStore.setOrgStructure({ csvImportActive: false });
      
      // Close the wizard instead of resetting to upload step
      if (onWizardClose) {
        onWizardClose();
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

  // Handle division-specific overwrite confirmation
  const handleDivisionOverwriteConfirm = () => {
    if (pendingDivisionOverwrite) {
      const setupWizardStore = useSetupWizardStore.getState();
      const importedCsvs = setupWizardStore.orgStructure.multipleCsvImport.importedCsvs || [];
      
      // Find the existing CSV file for this division
      const existingCsv = importedCsvs.find(csv => 
        csv.divisionName === pendingDivisionOverwrite.division || 
        csv.divisions?.includes(pendingDivisionOverwrite.division)
      );
      
      if (existingCsv) {
        // Use the proper removeImportedCsv function to clean up all related data
        setupWizardStore.removeImportedCsv(existingCsv.fileName);
      }
      
      // Close dialog and proceed with the new file
      setShowDivisionOverwriteDialog(false);
      setPendingDivisionOverwrite(null);
      processSelectedFile(pendingDivisionOverwrite.file);
    }
  };

  // Handle division-specific overwrite cancellation
  const handleDivisionOverwriteCancel = () => {
    setShowDivisionOverwriteDialog(false);
    setPendingDivisionOverwrite(null);
    
    // Reset the file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  // Handle division validation error acknowledgment
  const handleDivisionValidationAcknowledge = () => {
    setShowDivisionValidationDialog(false);
    setDivisionValidationError(null);
    
    // Close the wizard
    if (onWizardClose) {
      onWizardClose();
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
          onProceedToNextStep={onProceedToNextStep}
          orgStructure={context === 'setup' ? setupWizardStore.orgStructure : undefined}
          divisions={context === 'setup' ? setupWizardStore.divisions : undefined}
          pendingDivisions={context === 'setup' ? setupWizardStore.orgStructure.pendingDivisions : undefined}
          importedCsvs={context === 'setup' ? (() => {
            const { multipleCsvImport, csvImportData, uploadedCsvData, csvHeaders, extractedDivisions, extractedClusters } = setupWizardStore.orgStructure;
            
            console.log('[CsvImportWizard] Debug importedCsvs:', {
              context,
              multipleCsvImport,
              csvImportData,
              uploadedCsvData,
              csvHeaders,
              extractedDivisions,
              extractedClusters
            });
            
            // For multiple CSV imports, use the existing importedCsvs
            if (multipleCsvImport.importedCsvs && multipleCsvImport.importedCsvs.length > 0) {
              console.log('[CsvImportWizard] Using multiple CSV imports:', multipleCsvImport.importedCsvs);
              return multipleCsvImport.importedCsvs;
            }
            
            // For single CSV imports, check both csvImportData and uploadedCsvData
            if (csvImportData && csvImportData.csvFileName && csvImportData.data && csvImportData.data.length > 0) {
              const singleCsvImport = [{
                fileName: csvImportData.csvFileName,
                divisions: extractedDivisions || [],
                clusters: extractedClusters || [],
                divisionName: undefined
              }];
              console.log('[CsvImportWizard] Using single CSV import from csvImportData:', singleCsvImport);
              return singleCsvImport;
            }
            
            // Check if we have uploaded CSV data (the actual data structure being used)
            if (uploadedCsvData && uploadedCsvData.length > 0 && extractedDivisions && extractedDivisions.length > 0) {
              const singleCsvImport = [{
                fileName: 'CSV Imported File', // We don't have the filename in this structure
                divisions: extractedDivisions || [],
                clusters: extractedClusters || [],
                divisionName: undefined
              }];
              console.log('[CsvImportWizard] Using single CSV import from uploadedCsvData:', singleCsvImport);
              return singleCsvImport;
            }
            
            console.log('[CsvImportWizard] No imported CSVs found');
            return [];
          })() : undefined}
          clusters={context === 'setup' ? setupWizardStore.clusters : undefined}
          disableImport={disableImport}
          onLoadDataset={async (dataset) => {
            // Fetch the dataset from the backend using dataset ID
            const loadSessionToken = localStorage.getItem('sessionToken');
            const loadHeaders: Record<string, string> = {};
            
            if (loadSessionToken) {
              loadHeaders['Authorization'] = `Bearer ${loadSessionToken}`;
            }
            
            const response = await fetch(`/api/load-processed-data?datasetId=${dataset.id}`, { headers: loadHeaders });
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
                    // Handle "without division column" scenario for AI import
                    let divisions = orgData.divisions;
                    let divisionClusterMap = orgData.divisionClusterMap;
                    
                    if (setupWizardStore.orgStructure.divisionCsvType === 'withoutDivisionColumn' && selectedDivision) {
                      divisions = [selectedDivision];
                      divisionClusterMap = { [selectedDivision]: orgData.clusters };
                    }
                    
                    console.log('DEBUG: Calling onSetupDataReady (AI import) with', { divisions, clusters: orgData.clusters, divisionClusterMap, lifecyclePhases: orgData.lifecyclePhases });
                    onSetupDataReady(divisions, orgData.clusters, divisionClusterMap, orgData.lifecyclePhases, undefined, file?.name || 'unknown.csv');
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

  // When file, separator, header changes, auto-detect date format from header
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
    <div className="relative">
      {renderContent()}
      
      {/* Error Dialog */}
      {error && (
        <Dialog open={!!error} onOpenChange={() => setError(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                Import Error
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-gray-700">{error}</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setError(null)}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Division Validation Error Dialog */}
      {showDivisionValidationDialog && divisionValidationError && (
        <Dialog open={showDivisionValidationDialog} onOpenChange={setShowDivisionValidationDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Division Validation Error
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-gray-700">{divisionValidationError}</p>
              <div className="flex justify-end gap-2">
                <Button onClick={handleDivisionValidationAcknowledge}>
                  I Understand
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      
      {/* CSV Replacement Confirmation Dialog */}
      {showCsvReplacementDialog && (
        <Dialog open={showCsvReplacementDialog} onOpenChange={setShowCsvReplacementDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Replace Existing CSV?</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-gray-700">
                You already have a CSV file imported. Uploading a new file will replace the existing one.
                Are you sure you want to continue?
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleCsvReplacementCancel}>
              Cancel
                </Button>
                <Button onClick={handleCsvReplacementConfirm}>
                  Replace
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Division-Specific Overwrite Confirmation Dialog */}
      {showDivisionOverwriteDialog && pendingDivisionOverwrite && (
        <Dialog open={showDivisionOverwriteDialog} onOpenChange={setShowDivisionOverwriteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Replace CSV for {pendingDivisionOverwrite.division}?</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-gray-700">
                You already have a CSV file imported for {pendingDivisionOverwrite.division}. 
                Uploading a new file will replace the existing one for this division.
                Are you sure you want to continue?
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleDivisionOverwriteCancel}>
                  Cancel
                </Button>
                <Button 
                  variant="destructive"
                  className="bg-orange-600 hover:bg-orange-700"
                  onClick={handleDivisionOverwriteConfirm}
                >
                  Replace
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Validation Error Dialog */}
      {showValidationErrorDialog && (
        <Dialog open={showValidationErrorDialog} onOpenChange={setShowValidationErrorDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Required Columns Missing
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-gray-700">
                Your CSV file is missing required columns based on your organizational configuration:
              </p>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <ul className="space-y-2">
                  {validationErrors.map((error, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                      <span className="text-orange-700 text-sm">{error}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-sm text-gray-600">
                Please map the required columns to their appropriate roles before proceeding.
              </p>
              <div className="flex justify-end gap-2">
                <Button onClick={() => setShowValidationErrorDialog(false)}>
                  I Understand
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Date Format Dialog */}
      {isDateFormatDialogOpen && editingMapping && (
        <Dialog open={isDateFormatDialogOpen} onOpenChange={setIsDateFormatDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Select Date Format</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-gray-700">
                Select the correct date format for the column: <strong>{editingMapping.originalName}</strong>
              </p>
              <div className="grid grid-cols-1 gap-2">
                {DATE_FORMAT_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant={selectedDateFormat === option.value ? "default" : "outline"}
                    onClick={() => handleDateFormatChangeFromDialog(option.value)}
                    className="justify-start"
                  >
                    {option.label} <span className="text-gray-500 ml-2">({option.example})</span>
                  </Button>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDateFormatDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => {
                  handleDateFormatChangeFromDialog(selectedDateFormat);
                  setIsDateFormatDialogOpen(false);
                }}>
                  Apply
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
