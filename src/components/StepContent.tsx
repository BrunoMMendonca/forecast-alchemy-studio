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
import { CsvUploadResult } from '@/components/CsvImportWizard';
import { CsvImportWizard } from '@/components/CsvImportWizard';
import { useOutletContext } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useExistingDataDetection } from '@/hooks/useExistingDataDetection';
import { ForecastEngine } from '@/components/ForecastEngine';
import { ForecastWizard } from '@/components/ForecastWizard';
import { useSKUStore } from '@/store/skuStore';
import { useBestResultsMapping } from '@/hooks/useBestResultsMapping';
import { applyCleaningMetadata } from '../utils/csvUtils';

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
  onDataCleaning: (data: NormalizedSalesData[], changedSKUs?: string[], datasetId?: number) => void;
  onImportDataCleaning: (skus: string[], datasetId?: number, data?: NormalizedSalesData[]) => void;
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
  const [bestResults, setBestResults] = useState<any[]>([]);

  // Get the setLastLoadedDataset function from the hook
  const { setLastLoadedDataset } = useExistingDataDetection();

  // Use the best results mapping hook (mimic ForecastEngine)
  const { bestResults: mappedBestResults } = useBestResultsMapping(
    models,
    selectedSKUForResults || '',
    updateModel,
    processedDataInfo?.datasetId,
    [],
    selectedSKUForResults || '',
    processedDataInfo?.datasetId ? `dataset_${processedDataInfo.datasetId}` : ''
  );

  useEffect(() => {
    setBestResults(mappedBestResults);
  }, [mappedBestResults]);

  // Reset cleanedData and salesData only when switching to a new dataset
  const prevDatasetIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (
      processedDataInfo?.datasetId &&
      processedDataInfo.datasetId !== prevDatasetIdRef.current
    ) {
      setCleanedData([]);
      setSalesData([]);
      prevDatasetIdRef.current = processedDataInfo.datasetId;
    }
  }, [processedDataInfo?.datasetId]);

  // Load sales data when we reach Clean & Prepare step and have processedDataInfo
  useEffect(() => {
    const loadSalesData = async () => {
      console.log('🔍 [StepContent] loadSalesData called:', {
        currentStep,
        processedDataInfo,
        hasDatasetId: !!processedDataInfo?.datasetId
      });
      if (currentStep === 1 && processedDataInfo?.datasetId) {
        setIsLoadingData(true);
        try {
          let data;
          // Load data from database using datasetId
          const response = await fetch(`/api/load-processed-data?datasetId=${processedDataInfo.datasetId}`);
          if (response.ok) {
            data = await response.json();
            console.log('Loaded data from database:', {
              datasetId: processedDataInfo.datasetId,
              dataLength: data.data?.length,
              sampleData: data.data?.slice(0, 2),
              columns: data.columns,
              columnRoles: data.columnRoles
            });
          } else {
            console.error('Failed to load processed data from database with datasetId:', processedDataInfo.datasetId);
            setIsLoadingData(false);
            return;
          }
          setSalesData(data.data || []);
          setCleanedData([]);
        } catch (err) {
          console.error('Error loading sales data:', err);
        } finally {
          setIsLoadingData(false);
        }
      }
    };
    loadSalesData();
  }, [currentStep, processedDataInfo?.datasetId]);

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

  const handleDataCleaning = (data: NormalizedSalesData[], changedSKUs?: string[], datasetId?: number) => {
    setCleanedData(data);
    onDataCleaning(data, changedSKUs, datasetId);
  };

  // Intercept onConfirm to show name prompt
  const handleConfirmWithNamePrompt = async (result: CsvUploadResult) => {
    console.log('🔄 handleConfirmWithNamePrompt called');
    // For now, just call onConfirm directly to test the reset functionality
    await onConfirm(result);
    console.log('🔄 onConfirm completed - CSV import wizard should be reset');
    
    // TODO: Re-enable name prompt after confirming reset works
    // setTimeout(() => {
    //   console.log('🔄 Showing name prompt dialog');
    //   // Suggest a name: "Sales Data (YYYY-MM-DD, startDate to endDate)"
    //   const today = new Date();
    //   const uploadDate = today.toISOString().slice(0, 10);
    //   const dateRange = result.summary?.dateRange || ['N/A', 'N/A'];
    //   const suggestedName = `Dataset ${uploadDate} - From ${dateRange[0]} to ${dateRange[1]} (${result.summary?.skuCount || 0} products)`;
    //   setNameInput(suggestedName);
    //   setPendingUploadResult(result);
    //   setShowNamePrompt(true);
    // }, 100);
  };

  // Save the name and proceed
  const handleSaveNameAndProceed = async () => {
    if (!pendingUploadResult) return;
    setSavingName(true);
    try {
      await fetch(`/api/datasets/${pendingUploadResult.datasetId}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput })
      });
      setShowNamePrompt(false);
      setSavingName(false);
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
                currentLoadedFile={processedDataInfo?.datasetId?.toString()}
                setLastLoadedDataset={setLastLoadedDataset}
              />
              {processedDataInfo && (
                <div className="mt-6 flex justify-end">
                  <Button onClick={() => handleStepChange(1)}>
                    Proceed to Data Cleaning
                  </Button>
                </div>
              )}
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
                canonicalDatasetId={processedDataInfo?.datasetId}
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
              <DataVisualization 
                data={cleanedData.length > 0 ? cleanedData : salesData} 
                processedDataInfo={processedDataInfo}
              />
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
          <div className="space-y-6">
            <ForecastWizard
                data={cleanedData.length > 0 ? cleanedData : salesData}
                forecastPeriods={forecastPeriods}
                onForecastGeneration={onForecastGeneration}
                aiForecastModelOptimizationEnabled={aiForecastModelOptimizationEnabled}
                isOptimizing={isOptimizing}
                batchId={batchId}
                models={models}
                updateModel={updateModel}
                processedDataInfo={processedDataInfo}
                datasetId={processedDataInfo?.datasetId}
                setForecastResults={setForecastResults}
              />
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
