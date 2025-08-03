import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Upload, Trash2, AlertTriangle, User, Bot, Edit2, Check, X, History, RefreshCw, Edit3 } from 'lucide-react';
import { useExistingDataDetection } from '@/hooks/useExistingDataDetection';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { useSetupWizardStore } from '@/store/setupWizardStoreRefactored';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface UploadStepProps {
  lastImportFileName?: string | null;
  lastImportTime?: string | null;
  isDragging: boolean;
  error: string | null;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDropAreaClick: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLoadDataset?: (dataset: any) => void;
  loadedDatasetFile?: string;
  context?: 'forecast' | 'setup';
  onProceedToNextStep?: () => Promise<void>;
  // New prop for organizational structure information
  orgStructure?: {
    importLevel?: 'company' | 'division' | null;
    divisionCsvType?: 'withDivisionColumn' | 'withoutDivisionColumn' | null;
    hasMultipleDivisions?: boolean;
    hasMultipleClusters?: boolean;
  };
  // New props for divisions data
  divisions?: Array<{
    id: number;
    name: string;
    description: string;
    industry: string | null;
    fieldMapping: string | null;
  }>;
  pendingDivisions?: Array<{
    name: string;
    description: string;
    industry: string;
    fieldMapping: string;
  }>;
  importedCsvs?: Array<{
    fileName: string;
    divisions: string[];
    clusters: string[];
    divisionName?: string;
  }>;
  // New prop for clusters data to calculate cluster counts
  clusters?: Array<{
    id: number;
    name: string;
    description: string;
    country_code: string | null;
    region: string | null;
    division_id: number;
    fieldMapping: string | null;
  }>;
  // New prop to disable import functionality
  disableImport?: boolean;
}

export const UploadStep: React.FC<UploadStepProps> = ({
  lastImportFileName,
  lastImportTime,
  isDragging,
  error,
  onDrop,
  onDragOver,
  onDragLeave,
  onDropAreaClick,
  onFileChange,
  onLoadDataset,
  loadedDatasetFile,
  context = 'forecast',
  onProceedToNextStep,
  orgStructure,
  divisions = [],
  pendingDivisions = [],
  importedCsvs = [],
  clusters = [],
  disableImport = false,
}) => {
  // Move the hook to the top level of the component
  const setupWizardStore = useSetupWizardStore();
  
  // Division selection is now handled by the parent component (CSV import step)
  const [editingDataset, setEditingDataset] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [autoFrequency, setAutoFrequency] = useState<Record<number, boolean>>({});
  const [manualFrequency, setManualFrequency] = useState<Record<number, string>>({});
  const [timezoneSearch, setTimezoneSearch] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [currencySearch, setCurrencySearch] = useState('');
  const [datasets, setDatasets] = useState<any[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const { isLoading, error: detectError, refreshDatasets, setLastLoadedDataset } = useExistingDataDetection();
  const { toast } = useToast();

  const frequencyOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' },
  ];

  const handleEditClick = (dataset: any) => {
    setEditingDataset(dataset.id);
    setEditName(dataset.name);
  };

  const handleEditCancel = () => {
    setEditingDataset(null);
    setEditName('');
  };

  const handleEditSave = async (dataset: any) => {
    setSaving(true);
    await fetch('/api/save-dataset-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datasetId: dataset.id, name: editName })
    });
    setSaving(false);
    setEditingDataset(null);
    setEditName('');
    refreshDatasets();
  };

  const handleLoadDataset = async (dataset: any) => {
    // Track this as the last loaded dataset
    setLastLoadedDataset(dataset);
    if (onLoadDataset) {
      onLoadDataset(dataset);
    }
  };

  const handleFrequencyChange = async (dataset: any, value: string) => {
    setManualFrequency(prev => ({ ...prev, [dataset.id]: value }));
    await fetch('/api/update-dataset-frequency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datasetId: dataset.id, frequency: value })
    });
    refreshDatasets();
  };

  const handleAutoDetectFrequency = async (dataset: any) => {
    await fetch('/api/auto-detect-dataset-frequency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datasetId: dataset.id })
    });
    refreshDatasets();
  };

  const handleDeleteDataset = async (dataset: any) => {
    // In setup context, handle multiple CSV import scenarios
    if (context === 'setup') {
      // Check if this is a multiple CSV import scenario
      if (setupWizardStore.orgStructure.multipleCsvImport.isEnabled && 
          setupWizardStore.orgStructure.multipleCsvImport.importedCsvs.length > 0) {
        
        // Find the CSV in the imported list
        const importedCsv = setupWizardStore.orgStructure.multipleCsvImport.importedCsvs.find(
          csv => csv.fileName === dataset.filename || csv.fileName === dataset.name
        );
        
        if (importedCsv) {
          // Remove the specific CSV from the tracking
          setupWizardStore.removeImportedCsv(importedCsv.fileName);
          
          // Show success toast
          toast({
            title: "CSV Removed",
            description: `"${importedCsv.fileName}" has been removed from the import list. You can upload it again if needed.`,
            variant: "default",
          });
          
          // Refresh the component to show the updated state
          if (onLoadDataset) {
            onLoadDataset(null);
          }
          return;
        }
      }
      
      // Fallback: clear CSV mapping data for single CSV scenarios
      setupWizardStore.clearCsvMappingData();
      
      // Show success toast
      toast({
        title: "CSV Data Cleared",
        description: "CSV mapping data has been cleared. You can upload a new CSV file.",
        variant: "default",
      });
      
      // Refresh the component to show the cleared state
      if (onLoadDataset) {
        onLoadDataset(null);
      }
      return;
    }
    
    // Original functionality for forecast context
    const datasetName = dataset.name || dataset.filename || `Dataset ${dataset.id}`;
    
    try {
      console.log(`[DELETE] Attempting to delete dataset: "${datasetName}" (ID: ${dataset.id})`);
      
      const response = await fetch(`/api/datasets/${dataset.id}`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'X-Dataset-Name': datasetName,
          'X-Operation': 'delete-dataset'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`[DELETE] Successfully deleted dataset: "${datasetName}"`, result);
        
        // Show success toast with detailed information
        toast({
          title: "Dataset Deleted Successfully",
          description: `"${datasetName}" has been permanently removed. Deleted ${result.deletedTimeSeriesRecords} time series records and ${result.deletedJobRecords} optimization jobs.`,
          variant: "default",
        });
        
        refreshDatasets();
      } else {
        const error = await response.json();
        console.error(`[DELETE] Failed to delete dataset "${datasetName}":`, error);
        
        // Show error toast
        toast({
          title: "Delete Failed",
          description: `Failed to delete "${datasetName}": ${error.error || 'Unknown error'}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error(`[DELETE] Error deleting dataset "${datasetName}":`, error);
      
      // Show error toast
      toast({
        title: "Delete Error",
        description: `Error deleting "${datasetName}". Please try again.`,
        variant: "destructive",
      });
    }
  };

  // Add error boundary for the entire component
  try {
    return (
      <div className="space-y-8">
        {/* Continue with Existing Data - only show in forecast context */}
        {context !== 'setup' && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <History className="h-5 w-5 text-blue-600" />
                Continue with Existing Data
              </div>
              <Button variant="ghost" size="sm" onClick={refreshDatasets} aria-label="Refresh" title="Refresh">
                <RefreshCw className="w-5 h-5" />
              </Button>
            </div>
        {isLoading ? (
          <div className="text-slate-500 text-sm mb-4">Detecting datasets...</div>
        ) : detectError ? (
          <div className="text-red-600 text-sm mb-4">{detectError}</div>
        ) : (
          <div className="text-slate-500 text-sm mb-4">Found {datasets.length} dataset{datasets.length !== 1 ? 's' : ''} with cleaned data</div>
        )}
        {/* Datasets container with scroll */}
        <div className="max-h-80 overflow-y-auto pr-2 pt-2 pb-2 space-y-4">
          {/* Sort so loaded dataset is first */}
          {[...datasets].sort((a, b) => {
            const loadedFileName = typeof loadedDatasetFile === 'string' ? loadedDatasetFile.split('/').pop() : null;
            if (a.filename === loadedFileName) return -1;
            if (b.filename === loadedFileName) return 1;
            return 0;
          }).map(dataset => {
            const loadedFileName = typeof loadedDatasetFile === 'string' ? loadedDatasetFile.split('/').pop() : null;
            const isLoaded = loadedFileName && dataset.filename === loadedFileName;
            return (
              <div
                key={dataset.id}
                className={`relative border rounded p-4 flex flex-col md:flex-row md:items-center md:justify-between bg-slate-50 transition-all duration-200
                  ${isLoaded ? 'border-2 border-blue-300 bg-blue-100 shadow-2xl ring-2 ring-blue-300' : 'border-slate-100'}
                `}
                style={isLoaded ? { boxShadow: '0 0 0 4px #3b82f6, 0 4px 24px 0 rgba(132, 173, 240, 0.1)' } : {}}
              >
                {isLoaded && <div className="absolute left-0 top-0 h-full w-1 bg-blue-500 rounded-l" />}
                <div>
                  <div className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
                    {editingDataset === Number(dataset.id) ? (
                      <form
                        onSubmit={e => {
                          e.preventDefault();
                          handleEditSave(dataset);
                        }}
                        className="flex items-center"
                      >
                        <input
                          className="border rounded px-2 py-1 text-sm mr-2 w-96"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          disabled={saving}
                          autoFocus
                        />
                        <Button size="sm" className="mr-1" type="submit" disabled={saving || !editName.trim()}>{saving ? 'Saving...' : 'Save'}</Button>
                      </form>
                    ) : (
                      <>
                        {dataset.name}
                        <Button size="sm" variant="ghost" className="ml-1 px-2 py-0.5 flex items-center gap-1" onClick={() => handleEditClick(dataset)} aria-label="Edit name" title="Edit name">
                          <Edit3 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${dataset.type === 'AI Import' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                      {dataset.type === 'AI Import' ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                      {dataset.type}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 mb-1">Created: {new Date(dataset.timestamp).toLocaleDateString()}</div>
                  <div className="text-xs text-slate-600 mb-1">File: {dataset.filename}</div>
                  <div className="text-xs text-slate-600 mb-1">SKUs: {dataset.summary?.skuCount ?? 'N/A'}</div>
                  <div className="text-xs text-slate-600">Data Range: {dataset.summary?.dateRange ? `${dataset.summary.dateRange[0]} to ${dataset.summary.dateRange[1]}` : 'N/A'}</div>
                  <div className="flex flex-col gap-1 mt-2">
                    <label className="text-xs font-semibold text-gray-600">Data Frequency</label>
                    <div className="flex items-center gap-4">
                      <Switch
                        checked={autoFrequency[dataset.id] ?? true}
                        onCheckedChange={checked => {
                          setAutoFrequency(prev => ({ ...prev, [dataset.id]: checked }));
                          if (checked) handleAutoDetectFrequency(dataset);
                        }}
                        id={`auto-frequency-${dataset.id}`}
                      />
                      <label htmlFor={`auto-frequency-${dataset.id}`} className="cursor-pointer text-sm">
                        Auto
                      </label>
                      <Select
                        value={autoFrequency[dataset.id] ?? true ? dataset.summary?.frequency || '' : manualFrequency[dataset.id] || dataset.summary?.frequency || ''}
                        onValueChange={value => handleFrequencyChange(dataset, value)}
                        disabled={autoFrequency[dataset.id] ?? true}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          {frequencyOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto mt-4 md:mt-0 md:ml-8">
                <Button
                    className={`w-full md:w-40 h-10 ${isLoaded ? 'bg-blue-800 text-white border-blue-800' : ''}`}
                  variant={isLoaded ? 'default' : 'default'}
                  disabled={isLoaded}
                  onClick={() => !isLoaded && handleLoadDataset(dataset)}
                >
                  {isLoaded ? 'Loaded' : 'Load Dataset'}
                </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="w-full md:w-auto h-10"
                              disabled={isLoaded}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              {(context as string) === 'setup' ? 
                                (() => {
                                  const setupWizardStore = useSetupWizardStore();
                                  const isMultipleCsvScenario = setupWizardStore.orgStructure.multipleCsvImport.isEnabled && 
                                                               setupWizardStore.orgStructure.multipleCsvImport.importedCsvs.length > 0;
                                  const importedCsv = isMultipleCsvScenario ? 
                                    setupWizardStore.orgStructure.multipleCsvImport.importedCsvs.find(
                                      csv => csv.fileName === dataset.filename || csv.fileName === dataset.name
                                    ) : null;
                                  
                                  return isMultipleCsvScenario && importedCsv ? 'Remove CSV' : 'Clear CSV';
                                })()
                                : 'Delete'}
                            </Button>
                          </TooltipTrigger>
                          {(context as string) === 'setup' && setupWizardStore?.orgStructure?.csvImportData?.csvFileName && (
                            <TooltipContent>
                              <p>Clear CSV file: {setupWizardStore.orgStructure.csvImportData.csvFileName}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {(context as string) === 'setup' ? 
                            (() => {
                              const setupWizardStore = useSetupWizardStore();
                              const isMultipleCsvScenario = setupWizardStore.orgStructure.multipleCsvImport.isEnabled && 
                                                           setupWizardStore.orgStructure.multipleCsvImport.importedCsvs.length > 0;
                              const importedCsv = isMultipleCsvScenario ? 
                                setupWizardStore.orgStructure.multipleCsvImport.importedCsvs.find(
                                  csv => csv.fileName === dataset.filename || csv.fileName === dataset.name
                                ) : null;
                              
                              return isMultipleCsvScenario && importedCsv ? 'Remove CSV from Import List' : 'Clear CSV Data';
                            })()
                            : 'Delete Dataset'}
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                          <div>
                            {(context as string) === 'setup' ? (
                              (() => {
                                const setupWizardStore = useSetupWizardStore();
                                const isMultipleCsvScenario = setupWizardStore.orgStructure.multipleCsvImport.isEnabled && 
                                                             setupWizardStore.orgStructure.multipleCsvImport.importedCsvs.length > 0;
                                
                                // Find if this is a specific CSV in the multiple import list
                                const importedCsv = isMultipleCsvScenario ? 
                                  setupWizardStore.orgStructure.multipleCsvImport.importedCsvs.find(
                                    csv => csv.fileName === dataset.filename || csv.fileName === dataset.name
                                  ) : null;
                                
                                if (isMultipleCsvScenario && importedCsv) {
                                  return (
                                    <>
                                      Are you sure you want to remove "{importedCsv.fileName}" from the import list? This will:
                                      <ul className="list-disc list-inside mt-2 space-y-1">
                                        <li>Remove this CSV from the multiple import tracking</li>
                                        <li>Allow you to upload this file again if needed</li>
                                        <li>Update the import progress count</li>
                                      </ul>
                                      <p className="mt-2 text-sm text-slate-600">
                                        This action does not affect any data already imported to the database.
                                      </p>
                                    </>
                                  );
                                } else {
                                  return (
                                    <>
                                      Are you sure you want to clear the CSV mapping data? This will:
                                      <ul className="list-disc list-inside mt-2 space-y-1">
                                        <li>Remove the uploaded CSV file from memory</li>
                                        <li>Clear all column mappings and configurations</li>
                                        <li>Allow you to upload a new CSV file</li>
                                      </ul>
                                      <p className="mt-2 text-sm text-slate-600">
                                        This action does not affect any data already imported to the database.
                                      </p>
                                    </>
                                  );
                                }
                              })()
                            ) : (
                              <>
                                Are you sure you want to delete "{dataset.name}"? This action cannot be undone and will permanently remove:
                                <ul className="list-disc list-inside mt-2 space-y-1">
                                  <li>The dataset and all its metadata</li>
                                  <li>All time series data ({dataset.summary?.skuCount ?? 'N/A'} SKUs)</li>
                                  <li>All associated optimization jobs</li>
                                </ul>
                              </>
                            )}
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteDataset(dataset)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {(context as string) === 'setup' ? 
                            (() => {
                              const setupWizardStore = useSetupWizardStore();
                              const isMultipleCsvScenario = setupWizardStore.orgStructure.multipleCsvImport.isEnabled && 
                                                           setupWizardStore.orgStructure.multipleCsvImport.importedCsvs.length > 0;
                              const importedCsv = isMultipleCsvScenario ? 
                                setupWizardStore.orgStructure.multipleCsvImport.importedCsvs.find(
                                  csv => csv.fileName === dataset.filename || csv.fileName === dataset.name
                                ) : null;
                              
                              return isMultipleCsvScenario && importedCsv ? 'Remove CSV' : 'Clear CSV Data';
                            })()
                            : 'Delete Dataset'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      </div>
        )}

      {/* Multiple CSV Import Progress Banner - only show in setup context */}
      {/* REMOVED: This banner is now shown on the main CsvImportStep screen instead */}

      {/* Division selection is now handled by the parent component (CSV import step) */}



      {/* Upload Historical Sales Data */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6">
        <div className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-2">
          <Upload className="h-5 w-5 text-blue-600" />
          {context === 'setup' ? 'Upload Organizational Structure Data' : 'Upload Historical Sales Data'}
        </div>
        
        <div className="text-slate-500 text-sm mb-4">
          {context === 'setup' 
            ? 'Upload a CSV file containing your organizational structure data (divisions and/or clusters)'
            : 'Upload a CSV file containing your historical sales data with columns: Date, SKU, Sales'
          }
        </div>

        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300 ${
            (() => {
              // Disable upload for company-wide import when file already imported
              const shouldDisableCompanyUpload = disableImport;
              
          if (shouldDisableCompanyUpload) {
                return 'border-slate-200 bg-slate-100 cursor-not-allowed opacity-50';
              }
              
              if (isDragging) {
                return 'border-blue-500 bg-blue-50 cursor-pointer';
              }
              
              return 'border-slate-300 bg-slate-50 hover:border-slate-400 cursor-pointer';
            })()
          }`}
          onDrop={(e) => {
            // Block upload for company-wide import when file already imported
            const shouldBlockCompanyUpload = disableImport;
            
            if (shouldBlockCompanyUpload) {
              e.preventDefault();
              toast({
                title: "File Already Imported",
                description: "A CSV file has already been imported. Delete the file to import a new one.",
                variant: "destructive",
              });
              return;
            }
            onDrop(e);
          }}
          onDragOver={(e) => {
            // Block upload for company-wide import when file already imported
            const shouldBlockCompanyUpload = disableImport;
            
            if (shouldBlockCompanyUpload) {
              e.preventDefault();
              return;
            }
            onDragOver(e);
          }}
        onDragLeave={onDragLeave}
          onClick={() => {
            // Block upload for company-wide import when file already imported
            const shouldBlockCompanyUpload = disableImport;
            
            if (shouldBlockCompanyUpload) {
              toast({
                title: "File Already Imported",
                description: "A CSV file has already been imported. Delete the file to import a new one.",
                variant: "destructive",
              });
              return;
            }
            onDropAreaClick();
          }}
        >
          <Upload className={`h-12 w-12 mx-auto transition-colors ${
            (() => {
              // Show disabled state for company-wide import when file already imported
              const shouldShowCompanyDisabledState = disableImport;
              
              if (shouldShowCompanyDisabledState) {
                return 'text-slate-300';
              }
              
              if (isDragging) {
                return 'text-blue-600';
              }
              
              return 'text-slate-400';
            })()
          }`} />
        <div>
            {(() => {
              // Show company-wide disabled text when file already imported
              const shouldShowCompanyDisabledText = disableImport;
              
              if (shouldShowCompanyDisabledText) {
                return (
                  <>
                    <h3 className="text-lg font-semibold text-slate-400">File already imported</h3>
                    <p className="text-slate-400">Delete the file to import a new one</p>
                  </>
                );
              }
              
              return (
                <>
          <h3 className="text-lg font-semibold text-slate-700">Drop your CSV file here</h3>
          <p className="text-slate-500">or click to browse files</p>
                </>
              );
            })()}
        </div>
      </div>
      <input
        id="csv-upload-input"
        type="file"
        accept=".csv,text/csv"
        onChange={onFileChange}
        className="hidden"
      />
        {error && <div className="text-red-600 mt-2">{error}</div>}
      </div>
    </div>
  );
  } catch (error) {
    console.error('[UploadStep] Error rendering component:', error);
    return (
      <div className="space-y-8">
        <div className="bg-white border border-red-200 rounded-lg shadow-sm p-6">
          <div className="text-lg font-semibold text-red-800 flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Error Loading Component
          </div>
          <div className="text-red-600 text-sm mb-4">
            There was an error loading the upload component. Please refresh the page or try again.
          </div>
          <div className="text-red-500 text-xs">
            Error details: {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        </div>
      </div>
    );
  }
}; 