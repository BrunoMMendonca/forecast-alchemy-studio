import React, { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Upload, RefreshCw, Info, Sparkles, Bot, User, Settings } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { parseDateWithFormat } from '@/utils/dateUtils';
import { transformDataWithAI, AITransformResult } from '@/utils/aiDataTransform';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AIQuestionDialog } from './AIQuestionDialog';
import { aiService, AIQuestion, AIResponse } from '@/services/aiService';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import aiCsvInstructions from '@/config/ai_csv_instructions.txt?raw';

interface CsvImportWizardProps {
  onDataReady: (data: any[][]) => void;
  onFileNameChange?: (fileName: string) => void;
  lastImportFileName?: string | null;
  lastImportTime?: string | null;
}

const SEPARATORS = [',', ';', '\t', '|'];

function autoDetectSeparator(sample: string): string {
  // Try each separator and pick the one with the most columns in the first row
  let bestSep = ',';
  let maxCols = 0;
  for (const sep of SEPARATORS) {
    const cols = sample.split(sep).length;
    if (cols > maxCols) {
      maxCols = cols;
      bestSep = sep;
    }
  }
  return bestSep;
}

function transpose(matrix: any[][]): any[][] {
  return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
}

const COLUMN_ROLES = ['Material Code', 'Description', 'Brand', 'Category', 'Date', 'Ignore'] as const;
type ColumnRole = typeof COLUMN_ROLES[number];

function isDateString(str: string) {
  // Simple check for YYYY-MM-DD or MM/DD/YYYY
  return /\d{4}-\d{2}-\d{2}/.test(str) || /\d{2}\/\d{2}\/\d{4}/.test(str);
}

const FIXED_ROLES = [
  { value: 'Material Code', label: '🔢 Material Code' },
  { value: 'Description', label: '📝 Description' },
  { value: 'Date', label: '📅 Date' },
];

function trimEmptyRowsAndColumns(matrix: any[][]): any[][] {
  if (!matrix.length) return matrix;
  let top = 0, bottom = matrix.length - 1;
  let left = 0, right = matrix[0].length - 1;
  // Trim empty rows from top
  while (top <= bottom && matrix[top].every(cell => !cell || String(cell).trim() === '')) top++;
  // Trim empty rows from bottom
  while (bottom >= top && matrix[bottom].every(cell => !cell || String(cell).trim() === '')) bottom--;
  // Trim empty columns from left
  while (left <= right && matrix.every(row => !row[left] || String(row[left]).trim() === '')) left++;
  // Trim empty columns from right
  while (right >= left && matrix.every(row => !row[right] || String(row[right]).trim() === '')) right--;
  // Slice the matrix
  return matrix.slice(top, bottom + 1).map(row => row.slice(left, right + 1));
}

export const CsvImportWizard: React.FC<CsvImportWizardProps> = ({ onDataReady, onFileNameChange, lastImportFileName, lastImportTime }) => {
  const [file, setFile] = useState<File | null>(null);
  const [separator, setSeparator] = useState<string>(',');
  const [data, setData] = useState<any[][]>([]);
  const [header, setHeader] = useState<string[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'mapping'>('upload');
  const [error, setError] = useState<string | null>(null);
  const [transposed, setTransposed] = useState<boolean>(false);
  const [columnRoles, setColumnRoles] = useState<ColumnRole[]>([]);
  const [dateRange, setDateRange] = useState<{ start: number; end: number }>({ start: -1, end: -1 });
  const [isDragging, setIsDragging] = useState(false);
  const [customAggTypes, setCustomAggTypes] = useState<string[]>([]);
  const [dateFormat, setDateFormat] = useState<string>('dd/mm/yyyy');
  const [aiTransformResult, setAiTransformResult] = useState<AITransformResult | null>(null);
  const [showAiSuggestions, setShowAiSuggestions] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState<AIQuestion | null>(null);
  const { aiCsvImportEnabled, largeFileProcessingEnabled, largeFileThreshold } = useGlobalSettings();

  // New state for AI-powered flow
  const [aiStep, setAiStep] = useState<'upload' | 'describe' | 'ai-preview' | 'ai-mapping' | 'manual' | 'config'>('upload');
  const [aiResult, setAiResult] = useState<any[][] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [originalCsv, setOriginalCsv] = useState<string>('');
  const [aiColumnRoles, setAiColumnRoles] = useState<ColumnRole[]>([]);

  // Add a loading state for manual preview parsing
  const [manualLoading, setManualLoading] = useState(false);

  // State for configuration-based large file processing
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [generatedConfig, setGeneratedConfig] = useState<any>(null);
  const [configApplied, setConfigApplied] = useState(false);

  const DATE_FORMAT_OPTIONS = [
    { value: 'dd/mm/yyyy', label: 'dd/mm/yyyy' },
    { value: 'mm/dd/yyyy', label: 'mm/dd/yyyy' },
    { value: 'yyyy-mm-dd', label: 'yyyy-mm-dd' },
    { value: 'dd-mm-yyyy', label: 'dd-mm-yyyy' },
    { value: 'yyyy/mm/dd', label: 'yyyy/mm/dd' },
  ];

  useEffect(() => {
    const handleAIQuestion = (event: CustomEvent) => {
      setCurrentQuestion(event.detail.question);
    };

    window.addEventListener('ai-question', handleAIQuestion as EventListener);
    return () => {
      window.removeEventListener('ai-question', handleAIQuestion as EventListener);
    };
  }, []);

  const handleAIResponse = async (response: AIResponse) => {
    if (!currentQuestion) return;

    // Handle the response based on the question type
    switch (currentQuestion.id) {
      case 'year-month-pattern':
        if (response.answer === 'yes') {
          // Apply year-month transformation
          const yearCol = data[0].findIndex(h => h.toLowerCase().includes('year'));
          const monthCol = data[0].findIndex(h => h.toLowerCase().includes('month'));
          
          if (yearCol !== -1 && monthCol !== -1) {
            const newData = data.map((row, i) => {
              if (i === 0) {
                // Header row
                return row.filter((_, j) => j !== yearCol && j !== monthCol).concat('Date');
              }
              // Data rows
              const year = row[yearCol];
              const month = row[monthCol].padStart(2, '0');
              const date = `${year}-${month}-01`;
              return row.filter((_, j) => j !== yearCol && j !== monthCol).concat(date);
            });
            setData(newData);
            setHeader(newData[0]);
          }
        }
        break;

      case 'date-format':
        if (response.answer) {
          setDateFormat(response.answer.toLowerCase());
        }
        break;

      // Add more cases for other question types
    }

    setCurrentQuestion(null);
  };

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
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setOriginalCsv(text);
        
        // Check file size
        const fileSize = text.length;
        const isLargeFile = fileSize > largeFileThreshold;
        
        // If AI CSV import is disabled, always go straight to manual
        if (!aiCsvImportEnabled) {
          setAiStep('manual');
          setStep('preview');
          // Auto-detect separator and parse CSV for preview
          const detected = autoDetectSeparator(text.split('\n')[0]);
          setSeparator(detected);
          parseCsv(text, detected);
          return;
        }
        
        // Decide which flow to use
        if (isLargeFile && largeFileProcessingEnabled) {
          // Use configuration-based processing for large files
          setAiStep('config');
          setStep('preview');
          // Parse a small chunk for preview
          const lines = text.split('\n');
          const chunk = lines.slice(0, 10).join('\n'); // First 10 lines for preview
          const detected = autoDetectSeparator(lines[0]);
          setSeparator(detected);
          parseCsv(chunk, detected);
        } else if (aiCsvImportEnabled && !isLargeFile) {
          // Use direct AI processing for small files
          setAiStep('describe');
        } else if (aiCsvImportEnabled && isLargeFile && !largeFileProcessingEnabled) {
          // Large file but configuration processing is disabled
          setError(`File too large for direct AI processing (${(fileSize / 1024).toFixed(1)}KB). Enable "Large File Processing" in settings to use configuration-based processing.`);
          setTimeout(() => {
            setAiStep('manual');
            setStep('preview');
            setError(null);
            const detected = autoDetectSeparator(text.split('\n')[0]);
            setSeparator(detected);
            parseCsv(text, detected);
          }, 3000);
        }
      };
      reader.readAsText(f);
    }
  };

  const parseCsv = (csvText: string, sep: string) => {
    Papa.parse(csvText, {
      delimiter: sep === '\t' ? '\t' : sep,
      skipEmptyLines: true,
      complete: async (results) => {
        if (results.errors.length > 0) {
          setError('CSV parsing error: ' + results.errors[0].message);
          setData([]);
          setHeader([]);
        } else {
          const rows = results.data as string[][];
          const trimmed = trimEmptyRowsAndColumns(rows);
          setHeader(trimmed[0]);
          setData(trimmed.slice(1, 11)); // Show first 10 rows for preview
          
          // Apply AI analysis if enabled
          if (aiCsvImportEnabled) {
            try {
              const questions = await aiService.analyzeData(trimmed);
              for (const question of questions) {
                const response = await aiService.askQuestion(question);
                await handleAIResponse(response);
              }
            } catch (err) {
              console.error('AI analysis error:', err);
            }
          }
          
          setStep('preview');
        }
      },
      error: (err) => {
        setError('CSV parsing error: ' + err.message);
        setData([]);
        setHeader([]);
      }
    });
  };

  const handleSeparatorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sep = e.target.value;
    setSeparator(sep);
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        parseCsv(text, sep);
      };
      reader.readAsText(file);
    }
  };

  // Compute preview header/rows based on transpose
  const previewHeader = useMemo(() => {
    if (transposed && data.length > 0 && header.length > 0) {
      // Transpose the entire CSV (header + data)
      const fullMatrix = [header, ...data];
      const transposedMatrix = transpose(fullMatrix);
      return transposedMatrix[0];
    }
    return header;
  }, [transposed, data, header]);
  const previewRows = useMemo(() => {
    if (transposed && data.length > 0 && header.length > 0) {
      const fullMatrix = [header, ...data];
      const transposedMatrix = transpose(fullMatrix);
      return transposedMatrix.slice(1);
    }
    return data;
  }, [transposed, data, header]);

  // Auto-detect column roles and date range on preview
  useEffect(() => {
    if (step === 'mapping' && previewHeader.length > 0) {
      // Try to auto-detect roles
      const roles: ColumnRole[] = previewHeader.map((col, i) => {
        if (i === 0) return 'Material Code';
        if (i === 1) return 'Description';
        if (/brand/i.test(col)) return 'Brand';
        if (/category/i.test(col)) return 'Category';
        if (isDateString(col)) return 'Date';
        return 'Ignore';
      });
      setColumnRoles(roles);
      // Find first and last date columns
      const dateCols = roles.map((r, i) => r === 'Date' ? i : -1).filter(i => i !== -1);
      if (dateCols.length > 0) {
        setDateRange({ start: dateCols[0], end: dateCols[dateCols.length - 1] });
      } else {
        setDateRange({ start: -1, end: -1 });
      }
    }
  }, [step, previewHeader]);

  // Build dynamic aggregatable field options from CSV header (excluding first two and date columns)
  const manualAggregatableFields = useMemo(() => {
    return previewHeader
      .filter((col) =>
        !FIXED_ROLES.some(r => r.value === col) &&
        !isDateString(col)
      )
      .map(col => ({ value: col, label: `Σ ${col}` }));
  }, [previewHeader]);
  const aiAggregatableFields = useMemo(() => {
    return aiResult && aiResult[0]
      ? aiResult[0]
          .filter((col) =>
            !FIXED_ROLES.some(r => r.value === col) &&
            !isDateString(col)
          )
          .map(col => ({ value: col, label: `Σ ${col}` }))
      : [];
  }, [aiResult]);

  const manualDropdownOptions = [
    ...FIXED_ROLES,
    ...manualAggregatableFields,
    ...customAggTypes.map(type => ({ value: type, label: `Σ ${type}` })),
    { value: 'Ignore', label: 'Ignore' },
  ];
  const aiDropdownOptions = [
    ...FIXED_ROLES,
    ...aiAggregatableFields,
    ...customAggTypes.map(type => ({ value: type, label: `Σ ${type}` })),
    { value: 'Ignore', label: 'Ignore' },
  ];

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
    const materialIdx = columnMappings.findIndex(m => m.role === 'Material Code');
    const descIdx = columnMappings.findIndex(m => m.role === 'Description');
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
          if (materialIdx !== -1) entry['Material Code'] = row[materialIdx];
          if (descIdx !== -1) entry['Description'] = row[descIdx];
          aggregatableMappings.forEach(m => { 
            const colIdx = previewHeader.indexOf(m.originalName);
            entry[m.role] = row[colIdx];
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
          const salesValue = row[i];
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
    try {
      // Check file size before sending to AI
      const estimatedTokens = Math.ceil(originalCsv.length / 4); // Rough estimate: 1 token ≈ 4 characters
      const maxTokens = 100000; // Conservative limit below Grok-3's 131072 limit
      
      if (estimatedTokens > maxTokens) {
        throw new Error(`File too large for AI processing (estimated ${estimatedTokens.toLocaleString()} tokens). Please use manual import for files larger than ~${Math.round(maxTokens * 4 / 1024)}KB.`);
      }

      const response = await fetch('http://localhost:3001/api/grok-transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData: originalCsv, instructions: aiCsvInstructions }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        
        // Handle specific token limit errors
        if (response.status === 400 && errorMessage.includes('maximum prompt length')) {
          throw new Error('File too large for AI processing. Please use manual import for large files.');
        }
        
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      // Assume result is a CSV string; parse it
      const parsed = Papa.parse(result.csv || result, { skipEmptyLines: true }).data as any[][];
      setAiResult(parsed);
      
      // Initialize AI column roles with auto-detection
      const aiHeader = parsed[0];
      const initialRoles: ColumnRole[] = aiHeader.map((col, i) => {
        if (/sku|code|material/i.test(col)) return 'Material Code';
        if (/desc/i.test(col)) return 'Description';
        if (/brand/i.test(col)) return 'Brand';
        if (/cat/i.test(col)) return 'Category';
        if (/\d{4}-\d{2}-\d{2}/.test(col)) return 'Date';
        return 'Ignore';
      });
      setAiColumnRoles(initialRoles);
      
      setAiStep('ai-preview');
    } catch (err: any) {
      setAiError(err.message);
      // Auto-fallback to manual import for large files
      if (err.message.includes('too large') || err.message.includes('maximum prompt length')) {
        setTimeout(() => {
          setAiStep('manual');
        }, 3000); // Show error for 3 seconds then auto-switch
      }
    } finally {
      setAiLoading(false);
    }
  };

  // Configuration-based processing for large files
  const handleConfigProcessing = async () => {
    setConfigLoading(true);
    setConfigError(null);
    try {
      // Parse a sample of the CSV for AI analysis
      const lines = originalCsv.split('\n');
      const sampleLines = lines.slice(0, 5); // First 5 lines for AI analysis
      const sampleCsv = sampleLines.join('\n');
      
      // Generate configuration using AI
      const response = await fetch('http://localhost:3001/api/grok-generate-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          csvChunk: sampleCsv, 
          instructions: aiCsvInstructions,
          fileSize: originalCsv.length 
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      setGeneratedConfig(result.config);
      
      // Apply configuration to full CSV
      const applyResponse = await fetch('http://localhost:3001/api/apply-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          csvData: originalCsv, 
          config: result.config 
        }),
      });
      
      if (!applyResponse.ok) {
        const errorData = await applyResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${applyResponse.status}: ${applyResponse.statusText}`);
      }
      
      const applyResult = await applyResponse.json();
      setAiResult(applyResult.transformedData);
      setConfigApplied(true);
      setAiStep('ai-preview');
      
    } catch (err: any) {
      setConfigError(err.message);
      // Fallback to manual import
      setTimeout(() => {
        setAiStep('manual');
        setStep('preview');
        const detected = autoDetectSeparator(originalCsv.split('\n')[0]);
        setSeparator(detected);
        parseCsv(originalCsv, detected);
      }, 3000);
    } finally {
      setConfigLoading(false);
    }
  };

  // Top-level hooks for mapping (AI and manual)
  const aiMappingHeader = useMemo(() => (aiResult ? aiResult[0] : []), [aiResult]);
  const aiMappingRows = useMemo(() => (aiResult ? aiResult.slice(1) : []), [aiResult]);
  const aiMappingRoles = aiColumnRoles;
  const aiMappingNormalizedData = useMemo(() => {
    if (!aiMappingRows || !aiMappingHeader || aiMappingRoles.length === 0) return [];
    
    // Find indices for Material Code, Description
    const materialIdx = aiMappingRoles.findIndex(role => role === 'Material Code');
    const descIdx = aiMappingRoles.findIndex(role => role === 'Description');
    
    // Aggregatable fields: all columns with roles that are not Material/Description/Date/Ignore
    const aggregatableIndices = aiMappingRoles
      .map((role, idx) => ({ role, idx }))
      .filter(({ role }) => 
        role !== 'Material Code' && 
        role !== 'Description' && 
        role !== 'Date' && 
        role !== 'Ignore'
      );
    
    const result: any[] = [];
    
    for (const row of aiMappingRows) {
      // Find all date columns
      const dateIndices = aiMappingRoles
        .map((role, idx) => ({ role, idx }))
        .filter(({ role }) => role === 'Date');
      
      for (const { idx: dateIdx } of dateIndices) {
        const entry: any = {};
        
        // Add Material Code if mapped
        if (materialIdx !== -1) {
          entry['Material Code'] = row[materialIdx];
        }
        
        // Add Description if mapped
        if (descIdx !== -1) {
          entry['Description'] = row[descIdx];
        }
        
        // Add aggregatable fields
        aggregatableIndices.forEach(({ role, idx }) => {
          entry[role] = row[idx];
        });
        
        // Add Date
        const dateValue = aiMappingHeader[dateIdx];
        entry['Date'] = dateValue;
        
        // Add Sales (convert to number)
        const salesValue = row[dateIdx];
        const num = Number(salesValue);
        entry['Sales'] = (salesValue === '' || !Number.isFinite(num)) ? 0 : num;
        
        // Only add entries that have required fields
        if (entry['Material Code'] && entry['Date'] !== undefined) {
          result.push(entry);
        }
      }
    }
    
    return result;
  }, [aiMappingRows, aiMappingHeader, aiMappingRoles]);
  const aiMappingHasMaterialCode = aiMappingRoles.includes('Material Code');

  const manualMappingHeader = previewHeader;
  const manualMappingRows = previewRows;
  const manualMappingRoles = columnRoles;
  const manualMappingNormalizedHeaders = normalizedHeaders;
  const manualMappingNormalizedData = normalizedData;
  const manualMappingHasMaterialCode = manualMappingRoles.includes('Material Code');

  const aiMappingNormalizedHeaders = useMemo(() => {
    if (aiMappingNormalizedData.length === 0) return ['Material Code', 'Description', 'Date', 'Sales'];
    return Object.keys(aiMappingNormalizedData[0]);
  }, [aiMappingNormalizedData]);

  // Main render logic:
  if (step === 'preview' && aiCsvImportEnabled && aiStep === 'describe') {
    // Render the AI/Manual selection menu (reuse the same JSX as in your aiStep === 'describe' block)
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] py-12">
        <div className="mb-8 text-center">
          <div className="text-slate-700 text-lg font-semibold mb-2">How would you like to import your data?</div>
          <div className="text-slate-500 text-base">Choose a method below to continue.</div>
        </div>
        <div className="flex flex-col md:flex-row gap-8">
          <button
            className="flex flex-col items-center justify-center bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 hover:border-blue-400 rounded-xl shadow-md px-10 py-8 transition-all duration-200 w-72 focus:outline-none"
            onClick={handleAITransform}
            disabled={aiLoading}
          >
            <Bot className="w-10 h-10 text-blue-600 mb-3" />
            <span className="text-xl font-bold text-blue-800 mb-1">Use AI</span>
            <span className="text-slate-700 text-base mb-2 text-center">Let AI automatically clean, map, and transform your data for you.</span>
            {aiLoading && <span className="text-blue-600 mt-2">Processing...</span>}
          </button>
          <button
            className="flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 hover:border-slate-400 rounded-xl shadow-md px-10 py-8 transition-all duration-200 w-72 focus:outline-none"
            onClick={() => {
              setAiStep('manual');
              if (originalCsv) {
                setManualLoading(true);
                const detected = autoDetectSeparator(originalCsv.split('\n')[0]);
                setSeparator(detected);
                parseCsv(originalCsv, detected);
                setTimeout(() => setManualLoading(false), 500);
              }
            }}
          >
            <User className="w-10 h-10 text-slate-600 mb-3" />
            <span className="text-xl font-bold text-slate-800 mb-1">Manual Import</span>
            <span className="text-slate-700 text-base mb-2 text-center">Manually review, map, and import your CSV data step by step.</span>
          </button>
        </div>
      </div>
    );
  }

  // Configuration-based processing step
  if (step === 'preview' && aiCsvImportEnabled && aiStep === 'config') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] py-12">
        <div className="mb-8 text-center">
          <div className="text-slate-700 text-lg font-semibold mb-2">Large File Detected</div>
          <div className="text-slate-500 text-base">
            Your file is {(originalCsv.length / 1024).toFixed(1)}KB. Using configuration-based processing for optimal performance.
          </div>
        </div>
        
        {configError && (
          <Alert className="mb-4 max-w-md">
            <AlertTitle>Processing Error</AlertTitle>
            <AlertDescription>{configError}</AlertDescription>
          </Alert>
        )}
        
        <div className="flex flex-col md:flex-row gap-8">
          <button
            className="flex flex-col items-center justify-center bg-green-50 hover:bg-green-100 border-2 border-green-200 hover:border-green-400 rounded-xl shadow-md px-10 py-8 transition-all duration-200 w-72 focus:outline-none"
            onClick={handleConfigProcessing}
            disabled={configLoading}
          >
            <Bot className="w-10 h-10 text-green-600 mb-3" />
            <span className="text-xl font-bold text-green-800 mb-1">Process with AI</span>
            <span className="text-slate-700 text-base mb-2 text-center">AI will analyze your data and generate a transformation configuration.</span>
            {configLoading && <span className="text-green-600 mt-2">Processing...</span>}
          </button>
          
          <button
            className="flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 hover:border-slate-400 rounded-xl shadow-md px-10 py-8 transition-all duration-200 w-72 focus:outline-none"
            onClick={() => {
              setAiStep('manual');
              setStep('preview');
              if (originalCsv) {
                setManualLoading(true);
                const detected = autoDetectSeparator(originalCsv.split('\n')[0]);
                setSeparator(detected);
                parseCsv(originalCsv, detected);
                setTimeout(() => setManualLoading(false), 500);
              }
            }}
          >
            <User className="w-10 h-10 text-slate-600 mb-3" />
            <span className="text-xl font-bold text-slate-800 mb-1">Manual Import</span>
            <span className="text-slate-700 text-base mb-2 text-center">Manually review, map, and import your CSV data step by step.</span>
          </button>
        </div>
        
        {generatedConfig && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg max-w-md">
            <h4 className="font-medium text-blue-800 mb-2">Generated Configuration</h4>
            <pre className="text-xs text-blue-700 overflow-auto">
              {JSON.stringify(generatedConfig, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }
  
  if (aiCsvImportEnabled && aiStep !== 'upload' && aiStep !== 'manual') {
    if (aiStep === 'describe') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] py-12">
          <div className="mb-8 text-center">
            <div className="text-slate-700 text-lg font-semibold mb-2">How would you like to import your data?</div>
            <div className="text-slate-500 text-base">Choose a method below to continue.</div>
          </div>
          <div className="flex flex-col md:flex-row gap-8">
            <button
              className="flex flex-col items-center justify-center bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 hover:border-blue-400 rounded-xl shadow-md px-10 py-8 transition-all duration-200 w-72 focus:outline-none"
              onClick={handleAITransform}
              disabled={aiLoading}
            >
              <Bot className="w-10 h-10 text-blue-600 mb-3" />
              <span className="text-xl font-bold text-blue-800 mb-1">Use AI</span>
              <span className="text-slate-700 text-base mb-2 text-center">Let AI automatically clean, map, and transform your data for you.</span>
              {aiLoading && <span className="text-blue-600 mt-2">Processing...</span>}
            </button>
            <button
              className="flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 hover:border-slate-400 rounded-xl shadow-md px-10 py-8 transition-all duration-200 w-72 focus:outline-none"
              onClick={() => {
                setAiStep('manual');
                setStep('preview');
                if (originalCsv) {
                  setManualLoading(true);
                  const detected = autoDetectSeparator(originalCsv.split('\n')[0]);
                  setSeparator(detected);
                  parseCsv(originalCsv, detected);
                  setTimeout(() => setManualLoading(false), 500);
                }
              }}
            >
              <User className="w-10 h-10 text-slate-600 mb-3" />
              <span className="text-xl font-bold text-slate-800 mb-1">Manual Import</span>
              <span className="text-slate-700 text-base mb-2 text-center">Manually review, map, and import your CSV data step by step.</span>
            </button>
          </div>
        </div>
      );
    }
    if (aiStep === 'ai-preview' && aiResult) {
      return (
        <div className="space-y-4">
          <div className="font-semibold">AI-Transformed Preview</div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  {aiResult[0].map((col, i) => (
                    <th key={i} className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {aiResult.slice(1).map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
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
    if (currentQuestion) {
      return (
        <AIQuestionDialog
          open={true}
          onClose={() => setCurrentQuestion(null)}
          question={currentQuestion}
          onResponse={handleAIResponse}
        />
      );
    }
  }
  
  // Mapping step - available for both AI and manual flows
  if (step === 'mapping') {
    const isAIMapping = aiStep === 'ai-mapping';
    const mappingHeader = isAIMapping ? aiMappingHeader : manualMappingHeader;
    const mappingRows = isAIMapping ? aiMappingRows : manualMappingRows;
    const mappingRoles = isAIMapping ? aiColumnRoles : columnRoles;
    const mappingNormalizedHeaders = isAIMapping ? aiMappingNormalizedHeaders : manualMappingNormalizedHeaders;
    const mappingNormalizedData = isAIMapping ? aiMappingNormalizedData : manualMappingNormalizedData;
    const mappingHasMaterialCode = isAIMapping ? aiMappingHasMaterialCode : manualMappingHasMaterialCode;
    const DROPDOWN_OPTIONS = isAIMapping ? aiDropdownOptions : manualDropdownOptions;
  
    // Now, use these variables in your return JSX below
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
                {mappingHeader.map((h, i) => (
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
                          if (
                            opt.label.startsWith('Σ ') &&
                            !customAggTypes.includes(opt.value) &&
                          mappingHeader.some((header, idx) =>
                              idx !== i &&
                            (mappingRoles[idx] === 'Material Code' || mappingRoles[idx] === 'Description') &&
                              header === opt.value
                            )
                          ) {
                            return false;
                          }
                          if (
                            opt.value === 'Date' &&
                            !(
                            isDateString(mappingHeader[i]) ||
                            mappingRows.every(row => {
                                const cell = row[i];
                                return cell === '' || cell === undefined || !isNaN(Number(cell));
                              })
                            )
                          ) {
                            return false;
                          }
                          return true;
                        }).map(opt => {
                          const isMultiAllowed = opt.value === 'Ignore' || opt.value === 'Date';
                        const isAssignedElsewhere = mappingRoles.some((role, idx) => idx !== i && role === opt.value);
                          return (
                            <option key={opt.value} value={opt.value} disabled={!isMultiAllowed && isAssignedElsewhere}>
                              {opt.label}
                            </option>
                          );
                        })}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
              {mappingRows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => <td key={j} className="px-2 py-1 border-b">{cell}</td>)}
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
                {columnRoles.map((role, i) => role === 'Date' && <option key={i} value={i}>{previewHeader[i]}</option>)}
              </select>
              <span className="text-xs">to</span>
              <select
                value={dateRange.end}
                onChange={e => handleDateRangeChange('end', Number(e.target.value))}
                className="border rounded px-1 py-0.5 text-xs"
              >
                {columnRoles.map((role, i) => role === 'Date' && <option key={i} value={i}>{previewHeader[i]}</option>)}
              </select>
            </div>
          )}
          <div className="mt-4">
            <h4 className="font-medium mb-2">Preview Normalized Data</h4>
            <div className="overflow-x-auto border rounded">
              <table className="min-w-full text-xs">
                <thead>
                  <tr>
                  {mappingNormalizedHeaders.map(h => <th key={h} className="px-2 py-1 bg-slate-100 border-b">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                {mappingNormalizedData.slice(0, 10).map((row, i) => (
                    <tr key={i}>
                    {mappingNormalizedHeaders.map(h => <td key={h} className="px-2 py-1 border-b">{row[h]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-between mt-4">
          {/* From Mapping to Preview */}
          <Button variant="outline" onClick={() => {
            if (aiCsvImportEnabled) {
              setStep('preview');
            } else {
              setStep('preview');
            }
          }}>Back</Button>
            <div className="flex flex-col items-end">
            <Button onClick={() => {
              // Always use the normalized (long) data for both AI and manual
              const headers = mappingNormalizedHeaders;
              const dataRows = mappingNormalizedData.map(row => headers.map(h => row[h]));
              const finalData = [headers, ...dataRows];
              onDataReady(finalData);
            }} disabled={mappingNormalizedData.length === 0 || !mappingHasMaterialCode}>
                Confirm Mapping & Import
              </Button>
            {!mappingHasMaterialCode && (
                <span className="text-xs text-red-600 mt-1">You must map at least one column as <b>Material Code</b> to continue.</span>
              )}
            </div>
          </div>
      </div>
    );
  }
  
  if (step === 'upload') {
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
                // Go to Clean & Prepare step (step 1)
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
        <div className="flex justify-end">
          <Button onClick={() => document.getElementById('csv-upload-input')?.click()}>
            Browse Files
          </Button>
        </div>
    </div>
  );
  } else if (step === 'preview') {
    // show manual preview UI (classic style with separator)
    return (
      <div className="space-y-4">
        <div className="font-medium text-slate-800 mb-1">Import CSV - Step 1: Upload & Preview</div>
        <div className="text-slate-600 text-sm mb-2">
          We expect your CSV to have <a href="#" className="text-blue-600 underline">dates as columns</a> (one row per product/SKU).<br />
          If your file has dates as rows, click the button below to switch the orientation.
        </div>
        <div className="flex flex-col md:flex-row items-center gap-4 max-w-7xl w-full mx-auto">
          <div id="csv-orientation-diagram" className="bg-slate-50 rounded p-2 border w-full md:min-w-[90%] md:max-w-[90%] flex items-center justify-center">
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
        </div>
        {manualLoading ? (
          <div className="text-blue-600 text-center py-8">Parsing CSV and preparing preview...</div>
        ) : (
          <>
            {data.length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-4 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Transpose</span>
                    <Switch
                      checked={transposed}
                      onCheckedChange={() => {
                        setTransposed(!transposed);
                        const newData = transpose(data);
                        setData(newData);
                        setHeader(newData[0] || []);
                      }}
                      id="transpose-switch"
                    />
                    <span className="text-xs text-slate-500">{transposed ? '' : 'Disabled'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Separator:</span>
                    <select
                      value={separator}
                      onChange={handleSeparatorChange}
                      className="border rounded px-2 py-1 text-sm"
                    >
                      <option value=",">Comma (,)</option>
                      <option value=";">Semicolon (;)</option>
                      <option value="\t">Tab</option>
                      <option value="|">Pipe (|)</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Date Format</span>
                    <select
                      value={dateFormat}
                      onChange={e => setDateFormat(e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                    >
                      {DATE_FORMAT_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="overflow-x-auto border rounded">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr>
                        {header.map((h, i) => (
                          <th key={i} className="px-2 py-1 bg-slate-100 border-b">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.slice(1, 6).map((row, i) => (
                        <tr key={i}>
                          {row.map((cell, j) => (
                            <td key={j} className="px-2 py-1 border-b">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* From Preview to Upload (AI OFF) or Describe (AI ON) */}
                <div className="flex justify-between mt-4">
                  <Button variant="outline" onClick={() => {
                    if (aiCsvImportEnabled) {
                      setAiStep('describe');
                    } else {
                      setStep('upload');
                    }
                  }}>Back</Button>
                  <Button
                    onClick={() => {
                      setStep('mapping');
                      setAiStep('manual');
                    }}
                    disabled={data.length === 0}
                  >
                    Next: Mapping
                  </Button>
                </div>
              </div>
            )}
          </>
      )}
    </div>
  );
  }
  return null;
}; 