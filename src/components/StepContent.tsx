import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataVisualization } from '@/components/DataVisualization';
import { OutlierDetection } from '@/components/OutlierDetection';
import { ForecastModels } from '@/components/ForecastModels';
import { ForecastResults } from '@/components/ForecastResults';
import { ForecastFinalization } from '@/components/ForecastFinalization';
import { BarChart3, TrendingUp, Upload, Zap, Eye, Database } from 'lucide-react';
import { Icon } from 'lucide-react';
import { broom } from '@lucide/lab';
import type { NormalizedSalesData, ForecastResult, ModelConfig } from '@/types/forecast';
import { CsvImportWizard, CsvUploadResult } from '@/components/CsvImportWizard';
import { useOutletContext } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useExistingDataDetection } from '@/hooks/useExistingDataDetection';
import { ForecastEngine } from '@/components/ForecastEngine';
import { useSKUStore } from '@/store/skuStore';

interface StepContentProps {
  currentStep: number;
  processedDataInfo: CsvUploadResult | null;
  forecastResults: ForecastResult[];
  selectedSKUForResults: string | null;
  queueSize: number;
  forecastPeriods: number;
  aiForecastModelOptimizationEnabled: boolean;
  isAutoLoading?: boolean;
  isOptimizing?: boolean;
  onDataUpload?: (result: CsvUploadResult) => void;
  onConfirm: (result: CsvUploadResult, isExistingData?: boolean) => Promise<void>;
  onDataCleaning: (data: NormalizedSalesData[], changedSKUs?: string[], filePath?: string) => void;
  onImportDataCleaning: (skus: string[]) => void;
  onForecastGeneration: (results: ForecastResult[], selectedSKU: string) => void;
  onStepChange: (step: number) => void;
  onAIFailure: (errorMessage: string) => void;
  lastImportFileName: string | null;
  lastImportTime: string | null;
  batchId?: string | null;
  models: ModelConfig[];
  updateModel: (modelId: string, updates: Partial<ModelConfig>) => void;
  setForecastResults: (results: ForecastResult[]) => void;
}

interface OutletContextType {
  processedDataInfo: CsvUploadResult | null;
  forecastResults: ForecastResult[];
  selectedSKUForResults: string | null;
}

export const StepContent: React.FC<StepContentProps> = ({
  currentStep,
  processedDataInfo,
  forecastResults,
  selectedSKUForResults,
  queueSize,
  forecastPeriods,
  aiForecastModelOptimizationEnabled,
  isAutoLoading,
  isOptimizing,
  onDataUpload,
  onConfirm,
  onDataCleaning,
  onImportDataCleaning,
  onForecastGeneration,
  onStepChange,
  onAIFailure,
  lastImportFileName,
  lastImportTime,
  batchId,
  models,
  updateModel,
  setForecastResults
}) => {
  // Debug logging for models
  useEffect(() => {
    // console.log('[StepContent] Models received:', models);
  }, [models]);
  
  const [localFileName, setLocalFileName] = useState<string | null>(null);
  const [salesData, setSalesData] = useState<NormalizedSalesData[]>([]);
  const [cleanedData, setCleanedData] = useState<NormalizedSalesData[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [pendingUploadResult, setPendingUploadResult] = useState<CsvUploadResult | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Get the setLastLoadedDataset function from the hook
  const { setLastLoadedDataset } = useExistingDataDetection();

  // Reset cleanedData and salesData only when switching to a new dataset
  const prevFilePathRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      processedDataInfo?.filePath &&
      processedDataInfo.filePath !== prevFilePathRef.current
    ) {
      setCleanedData([]);
      setSalesData([]);
      prevFilePathRef.current = processedDataInfo.filePath;
    }
  }, [processedDataInfo?.filePath]);

  // Load sales data when we reach Clean & Prepare step and have processedDataInfo
  useEffect(() => {
    const loadSalesData = async () => {
      if (currentStep === 1 && processedDataInfo?.filePath) {
        setIsLoadingData(true);
        try {
          // Extract baseName and hash from the filePath
          const match = processedDataInfo.filePath.match(/Original_CSV_Upload-(\d+)-([a-f0-9]{8})-processed\.json/);
          let baseName = '';
          let hash = '';
          if (match) {
            baseName = `Original_CSV_Upload-${match[1]}`;
            hash = match[2];
          } else {
            // console.error('Could not extract baseName and hash from filePath:', processedDataInfo.filePath);
            setIsLoadingData(false);
            return;
          }
          
          // Load processed data
          const response = await fetch(`/api/load-processed-data?baseName=${encodeURIComponent(baseName)}&hash=${encodeURIComponent(hash)}`);
          if (response.ok) {
            const data = await response.json();
            // console.log('LOADING DATA: Loaded processed data from backend:', data);
            // console.log('LOADING DATA: Columns:', data.columns);
            // console.log('LOADING DATA: ColumnRoles:', data.columnRoles);
            
            // Transform to long format if needed
            let longFormatData: NormalizedSalesData[];
            if (data.data && data.data.length > 0 && typeof data.data[0].Date !== 'undefined' && typeof data.data[0].Sales !== 'undefined') {
              // console.log('LOADING DATA: Data is already long-format, using as-is.');
              longFormatData = data.data;
            } else {
              // fallback: transform if needed
              longFormatData = transformWideToLongFormat(data.data || [], data.columns || [], data.columnRoles || []);
              // console.log('LOADING DATA: Transformed long-format data:', longFormatData);
            }
            
            setSalesData(longFormatData);
            
            // Check if there's existing cleaning data for this dataset
            try {
              const cleaningResponse = await fetch(`/api/load-cleaning-data?baseName=${encodeURIComponent(baseName)}&hash=${encodeURIComponent(hash)}`);
              if (cleaningResponse.ok) {
                const cleaningData = await cleaningResponse.json();
                // console.log('LOADING DATA: Found existing cleaning data, using it:', cleaningData);
                setCleanedData(cleaningData.data || longFormatData);
              } else {
                // console.log('LOADING DATA: No existing cleaning data found, using processed data as initial cleaned data');
                setCleanedData(longFormatData);
              }
            } catch (cleaningError) {
              // console.log('LOADING DATA: Error checking for cleaning data, using processed data as initial cleaned data:', cleaningError);
              setCleanedData(longFormatData);
            }
          } else {
            // console.error('Failed to load processed data');
          }
        } catch (error) {
          // console.error('Error loading processed data:', error);
        } finally {
          setIsLoadingData(false);
        }
      }
    };

    loadSalesData();
  }, [currentStep, processedDataInfo?.filePath]);

  // Transform wide-format data (from backend) to long-format data (for outlier detection)
  const transformWideToLongFormat = (wideData: any[], columns: string[], columnRoles: string[]): NormalizedSalesData[] => {
    if (!wideData || wideData.length === 0 || !columns || columns.length === 0 || !columnRoles || columnRoles.length === 0) {
      return [];
    }

    const longData: NormalizedSalesData[] = [];

    // Find indices for Material Code, Description
    const materialIdx = columnRoles.findIndex(role => role === 'Material Code');
    const descIdx = columnRoles.findIndex(role => role === 'Description');
    const dateIndices = columnRoles
      .map((role, idx) => (role === 'Date' ? idx : -1))
      .filter(idx => idx !== -1);

    wideData.forEach(row => {
      dateIndices.forEach(dateIdx => {
        const entry: any = {};
        if (materialIdx !== -1) entry['Material Code'] = row[columns[materialIdx]];
        if (descIdx !== -1) entry['Description'] = row[columns[descIdx]];
        entry['Date'] = columns[dateIdx];
        const salesValue = row[columns[dateIdx]];
        entry['Sales'] = Number(salesValue) || 0;
        if (entry['Material Code'] && entry['Date'] !== undefined) {
          longData.push(entry);
        }
      });
    });

    return longData;
  };

  const handleDataCleaning = (data: NormalizedSalesData[], changedSKUs?: string[], filePath?: string) => {
    setCleanedData(data);
    onDataCleaning(data, changedSKUs, filePath);
  };

  // Intercept onConfirm to show name prompt
  const handleConfirmWithNamePrompt = async (result: CsvUploadResult) => {
    // Suggest a name: "Sales Data (YYYY-MM-DD, startDate to endDate)"
    const today = new Date();
    const uploadDate = today.toISOString().slice(0, 10);
    const dateRange = result.summary?.dateRange || ['N/A', 'N/A'];
    const suggestedName = `Dataset ${uploadDate} - From ${dateRange[0]} to ${dateRange[1]} (${result.summary?.skuCount || 0} products)`;
    setNameInput(suggestedName);
    setPendingUploadResult(result);
    setShowNamePrompt(true);
  };

  // Save the name and proceed
  const handleSaveNameAndProceed = async () => {
    if (!pendingUploadResult) return;
    setSavingName(true);
    try {
      await fetch('/api/save-dataset-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: pendingUploadResult.filePath, name: nameInput })
      });
      setShowNamePrompt(false);
      setSavingName(false);
      await onConfirm(pendingUploadResult);
      setPendingUploadResult(null);
    } catch (err) {
      setSavingName(false);
      alert('Failed to save dataset name');
    }
  };

  // Wrap the original onStepChange to also reset showCsvImport when going to step 0
  const handleStepChange = (step: number) => {
    if (step === 0) {
      setShowNamePrompt(false);
    }
    onStepChange(step);
  };

  const selectedSKU = useSKUStore(state => state.selectedSKU);
  const setSelectedSKU = useSKUStore(state => state.setSelectedSKU);

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        const handleFileNameChange = (fileName: string) => {
          setLocalFileName(fileName);
        };

        // Show loading state while auto-loading
        if (isAutoLoading) {
          return (
            <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-600" />
                  Choose your data
                </CardTitle>
                <CardDescription>
                  Loading your last dataset...
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Auto-loading your last dataset...</p>
                </div>
              </CardContent>
            </Card>
          );
        }

        return (
          <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-600" />
                Choose your data
              </CardTitle>
              <CardDescription>
                Continue with existing data or upload new data to begin forecasting.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CsvImportWizard 
                onDataReady={() => {}} 
                onConfirm={handleConfirmWithNamePrompt}
                onFileNameChange={handleFileNameChange} 
                lastImportFileName={lastImportFileName} 
                lastImportTime={lastImportTime}
                onAIFailure={onAIFailure}
                onLoadExistingData={async (result) => {
                  await onConfirm(result, true);
                  handleStepChange(1);
                }}
                currentLoadedFile={processedDataInfo?.filePath}
                setLastLoadedDataset={setLastLoadedDataset}
              />
            </CardContent>
          </Card>
        );
      case 1:
        return (
          <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon iconNode={broom} className="h-5 w-5 text-blue-600" />
                Clean & Prepare
              </CardTitle>
              <CardDescription>
                Identify and remove outliers from your data to improve forecast accuracy
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingData ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading your data...</p>
                </div>
              ) : salesData.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">No data available for cleaning. Please upload data first.</p>
                </div>
              ) : (
              <OutlierDetection
                  data={salesData}
                  cleanedData={cleanedData}
                  onDataCleaning={handleDataCleaning}
                onImportDataCleaning={onImportDataCleaning}
                queueSize={queueSize}
              />
              )}
              {processedDataInfo && salesData.length > 0 && (
                <div className="mt-6 flex justify-end">
                  <Button onClick={() => handleStepChange(2)}>
                    Proceed to Explore
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      case 2:
        return (
          <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Explore
              </CardTitle>
              <CardDescription>
                Explore your cleaned sales data across different SKUs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataVisualization data={cleanedData.length > 0 ? cleanedData : salesData} />
              {processedDataInfo && (
                <div className="mt-6 flex justify-end">
                  <Button onClick={() => handleStepChange(3)}>
                    Proceed to Forecasting
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      case 3:
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white/80 backdrop-blur-sm shadow-xl border-0 rounded-lg">
              <ForecastEngine
                data={cleanedData.length > 0 ? cleanedData : salesData}
                forecastPeriods={forecastPeriods}
                onForecastGeneration={onForecastGeneration}
                aiForecastModelOptimizationEnabled={aiForecastModelOptimizationEnabled}
                isOptimizing={isOptimizing}
                batchId={batchId}
                models={models}
                updateModel={updateModel}
                processedDataInfo={processedDataInfo}
                filePath={processedDataInfo?.filePath}
                setForecastResults={setForecastResults}
              />
            </div>

            <Card className="bg-white/80 /*backdrop-blur-sm*/ shadow-xl border-0" style={{ overflow: 'visible' }}>
              <CardHeader>
                <CardTitle>Forecast Results</CardTitle>
                <CardDescription>
                  Compare predictions from different models for {selectedSKU || 'selected product'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ForecastResults 
                  results={forecastResults} 
                  selectedSKU={selectedSKU}
                />
              </CardContent>
            </Card>
          </div>
        );
      case 4:
        return (
          <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-600" />
                Finalize & Export Forecasts
              </CardTitle>
              <CardDescription>
                Review, edit, and export your forecasts for Sales & Operations Planning
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ForecastFinalization 
                historicalData={salesData}
                cleanedData={cleanedData}
                forecastResults={forecastResults}
              />
            </CardContent>
          </Card>
        );
      default:
        return <div>Invalid step</div>;
    }
  };

  return (
    <div className="w-full">
      {showNamePrompt && (
        <Dialog open={showNamePrompt} onOpenChange={setShowNamePrompt}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Name Your Dataset</DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <Input
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder="Enter a friendly name for this dataset"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter' && nameInput.trim() && !savingName) {
                    handleSaveNameAndProceed();
                  }
                }}
              />
            </div>
            <DialogFooter>
              <Button onClick={handleSaveNameAndProceed} disabled={savingName || !nameInput.trim()}>
                {savingName ? 'Saving...' : 'Save & Continue'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {renderStepContent()}
    </div>
  );
};
