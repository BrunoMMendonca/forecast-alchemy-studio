import React, { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Upload, RefreshCw, Info } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { parseDateWithFormat } from '@/utils/dateUtils';

interface CsvImportWizardProps {
  onDataReady: (data: any[][]) => void;
  onFileNameChange?: (fileName: string) => void;
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

export const CsvImportWizard: React.FC<CsvImportWizardProps> = ({ onDataReady, onFileNameChange }) => {
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
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [customAggTypes, setCustomAggTypes] = useState<string[]>([]);
  const [dateFormat, setDateFormat] = useState<string>('dd/mm/yyyy');

  const DATE_FORMAT_OPTIONS = [
    { value: 'dd/mm/yyyy', label: 'dd/mm/yyyy' },
    { value: 'mm/dd/yyyy', label: 'mm/dd/yyyy' },
    { value: 'yyyy-mm-dd', label: 'yyyy-mm-dd' },
    { value: 'dd-mm-yyyy', label: 'dd-mm-yyyy' },
    { value: 'yyyy/mm/dd', label: 'yyyy/mm/dd' },
  ];

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
        const detected = autoDetectSeparator(text.split('\n')[0]);
        setSeparator(detected);
        parseCsv(text, detected);
      };
      reader.readAsText(f);
    }
  };

  const parseCsv = (csvText: string, sep: string) => {
    Papa.parse(csvText, {
      delimiter: sep === '\t' ? '\t' : sep,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError('CSV parsing error: ' + results.errors[0].message);
          setData([]);
          setHeader([]);
        } else {
          const rows = results.data as string[][];
          const trimmed = trimEmptyRowsAndColumns(rows);
          setHeader(trimmed[0]);
          setData(trimmed.slice(1, 11)); // Show first 10 rows for preview
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
  const aggregatableFields = useMemo(() => {
    return previewHeader
      .filter((col) =>
        !FIXED_ROLES.some(r => r.value === col) &&
        !isDateString(col)
      )
      .map(col => ({ value: col, label: `Σ ${col}` }));
  }, [previewHeader]);

  const DROPDOWN_OPTIONS = [
    ...FIXED_ROLES,
    ...aggregatableFields,
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    const csvFile = files.find(file => file.type === 'text/csv' || file.name.endsWith('.csv'));
    if (csvFile) {
      setUploadedFileName(csvFile.name);
      handleFileChange({ target: { files: [csvFile] } } as any);
    } else {
      setError('Please upload a CSV file');
    }
  };

  const handleDropAreaClick = () => {
    document.getElementById('csv-upload-input')?.click();
  };

  const hasMaterialCode = columnRoles.includes('Material Code');

  return (
    <div className="max-w-3xl mx-auto p-8 bg-white rounded-lg shadow-lg mt-8">
      <h2 className="text-2xl font-bold mb-4">Import CSV - Step 1: Upload & Preview</h2>
      {step === 'upload' && (
        <div className="space-y-4">
          {/* Drag and Drop Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300 cursor-pointer ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-slate-400'}`}
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={handleDropAreaClick}
          >
            {uploadedFileName ? (
              <div className="space-y-4">
                <Upload className="h-12 w-12 text-green-600 mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold text-green-800">File Uploaded Successfully</h3>
                  <p className="text-green-600">{uploadedFileName}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className={`h-12 w-12 mx-auto transition-colors ${isDragging ? 'text-blue-600' : 'text-slate-400'}`} />
                <div>
                  <h3 className="text-lg font-semibold text-slate-700">Drop your CSV file here</h3>
                  <p className="text-slate-500">or click to browse files</p>
                </div>
              </div>
            )}
          </div>
          {/* Hidden File Input */}
          <input
            id="csv-upload-input"
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
          />
          {error && <div className="text-red-600">{error}</div>}
          <div className="flex justify-end">
            <Button onClick={() => setStep('preview')} disabled={!file}>
              Next
            </Button>
          </div>
        </div>
      )}
      {step === 'preview' && (
        <div className="space-y-4">
          <div className="mb-4">
            {/* Explanatory text at the top */}
            <div className="font-medium text-slate-800 mb-1">We expect your CSV to have <span className="text-blue-600 font-bold">dates as columns</span> (one row per product/SKU).</div>
            <div className="text-slate-600 text-sm mb-2">If your file has dates as rows, click the button below to switch the orientation.</div>
            {/* Diagram and explanation */}
            <div className="flex flex-col md:flex-row items-center gap-4 max-w-7xl w-full mx-auto">
              {/* Diagram container: min 90% width on md+ */}
              <div id="csv-orientation-diagram" className="bg-slate-50 rounded p-2 border w-full md:min-w-[90%] md:max-w-[90%] flex items-center justify-center">
                {/* SVG diagram here */}
                <svg width="1125" height="225" viewBox="0 0 1125 375" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Dates as Rows (left) */}
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
                  {/* Arrow */}
                  <polygon points="450,180 585,180 585,200 450,200" fill="#38bdf8"/>
                  <polygon points="600,188 585,170 585,210" fill="#38bdf8"/>
                  <text x="520" y="172.5" fontSize="27" fill="#38bdf8" textAnchor="middle">Transpose</text>
                  {/* Dates as Columns (right) */}
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
          </div>
          <div className="flex items-center gap-4 mb-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Transpose</label>
              <Switch
                checked={transposed}
                onCheckedChange={setTransposed}
                id="transpose-switch"
              />
              <span className="ml-2 text-xs text-slate-500">{transposed ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="date-format-select" className="text-sm font-medium">Date Format</label>
              <select
                id="date-format-select"
                value={dateFormat}
                onChange={e => setDateFormat(e.target.value)}
                className="border rounded px-1 py-0.5 text-xs"
              >
                {DATE_FORMAT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto border rounded">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  {previewHeader.map((h, i) => <th key={i} className="px-2 py-1 bg-slate-100 border-b">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => <td key={j} className="px-2 py-1 border-b">{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error && <div className="text-red-600">{error}</div>}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
            <Button onClick={() => setStep('mapping')}>
              Next: Mapping
            </Button>
          </div>
        </div>
      )}
      {step === 'mapping' && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">Step 2: Map Columns</h3>
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
                      setColumnRoles(prev => prev.map(role => role === type ? 'Ignore' : role));
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
                  {previewHeader.map((h, i) => (
                    <th key={i} className="px-2 py-1 bg-slate-100 border-b">
                      <div>{h}</div>
                      <select
                        value={columnRoles[i] || 'Ignore'}
                        onChange={e => handleRoleChange(i, e.target.value as ColumnRole)}
                        className="mt-1 border rounded px-1 py-0.5 text-xs"
                      >
                        {DROPDOWN_OPTIONS.filter(opt => {
                          // Remove Σ X if X is mapped as Material Code or Description and X is not a custom field
                          if (
                            opt.label.startsWith('Σ ') &&
                            !customAggTypes.includes(opt.value) &&
                            previewHeader.some((header, idx) =>
                              idx !== i &&
                              (columnRoles[idx] === 'Material Code' || columnRoles[idx] === 'Description') &&
                              header === opt.value
                            )
                          ) {
                            return false;
                          }
                          // Only show 'Date' if header is a valid date or all cells are numbers or blank
                          if (
                            opt.value === 'Date' &&
                            !(
                              isDateString(previewHeader[i]) ||
                              previewRows.every(row => {
                                const cell = row[i];
                                return cell === '' || cell === undefined || !isNaN(Number(cell));
                              })
                            )
                          ) {
                            return false;
                          }
                          return true;
                        }).map(opt => {
                          // Only allow 'Ignore' and 'Date' to be assigned multiple times
                          const isMultiAllowed = opt.value === 'Ignore' || opt.value === 'Date';
                          const isAssignedElsewhere = columnRoles.some((role, idx) => idx !== i && role === opt.value);
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
                {previewRows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => <td key={j} className="px-2 py-1 border-b">{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Date range controls if there are date columns */}
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
                    {normalizedHeaders.map(h => <th key={h} className="px-2 py-1 bg-slate-100 border-b">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {normalizedData.slice(0, 10).map((row, i) => (
                    <tr key={i}>
                      {normalizedHeaders.map(h => <td key={h} className="px-2 py-1 border-b">{row[h]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={() => setStep('preview')}>Back</Button>
            <div className="flex flex-col items-end">
              <Button onClick={() => onDataReady(normalizedData)} disabled={normalizedData.length === 0 || !hasMaterialCode}>
                Confirm Mapping & Import
              </Button>
              {!hasMaterialCode && (
                <span className="text-xs text-red-600 mt-1">You must map at least one column as <b>Material Code</b> to continue.</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 