import React, { useCallback, useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { StepContent } from '@/components/StepContent';
import { toast } from '@/components/ui/use-toast';
import { useDataHandlers } from '@/hooks/useDataHandlers';
import { JobSummary } from '@/hooks/useBackendJobStatus';
import { GlobalSettings } from '@/hooks/useGlobalSettings';
import { CsvUploadResult } from '@/components/CsvImportWizard';
import { ForecastResult } from '@/types/forecast';

interface ForecastPageContext {
  summary: JobSummary;
  globalSettings: GlobalSettings & { [key: string]: any };
  currentStep: number;
  setCurrentStep: (step: number) => void;
  processedDataInfo: CsvUploadResult | null;
  setProcessedDataInfo: (result: CsvUploadResult | null) => void;
  forecastResults: ForecastResult[];
  setForecastResults: (results: ForecastResult[]) => void;
  selectedSKU: string | null;
  setSelectedSKU: (sku: string | null) => void;
  aiError: string | null;
  setAiError: (error: string | null) => void;
}

const ForecastPage = () => {
  const context = useOutletContext<ForecastPageContext>();
  
  // Get ALL page state from parent layout
  const {
    currentStep,
    setCurrentStep,
    processedDataInfo,
    setProcessedDataInfo,
    forecastResults,
    setForecastResults,
    selectedSKU,
    setSelectedSKU,
    aiError,
    setAiError,
    summary,
    globalSettings
  } = context;

  // State hooks
  const [lastImportFileName, setLastImportFileName] = useState<string | null>(null);
  const [lastImportTime, setLastImportTime] = useState<string | null>(null);
  
  const uniqueSKUCount = useMemo(() => {
    return processedDataInfo?.summary.skuCount ?? 0;
  }, [processedDataInfo]);
  
  // Data handlers now get all setters from context
  const { handleDataUpload, handleImportDataCleaning } = useDataHandlers({
    setCurrentStep,
    setProcessedDataInfo,
    setForecastResults,
  });

  const handleAIFailure = useCallback((errorMessage: string) => {
    toast({
      variant: "destructive",
      title: "AI Processing Failed",
      description: `${errorMessage}. Falling back to manual import.`,
    });
    setAiError(errorMessage);
  }, [setAiError]);
  
  return (
      <StepContent
        currentStep={currentStep}
        processedDataInfo={processedDataInfo}
        forecastResults={forecastResults}
        selectedSKUForResults={selectedSKU}
        queueSize={summary?.total ?? 0}
        forecastPeriods={globalSettings?.forecastPeriods ?? 12}
        aiForecastModelOptimizationEnabled={globalSettings?.aiForecastModelOptimizationEnabled ?? false}
        onDataUpload={handleDataUpload}
        onDataCleaning={() => {}} // This needs to be re-wired to a new data cleaning flow
        onImportDataCleaning={handleImportDataCleaning}
        onForecastGeneration={setForecastResults}
        onSKUChange={setSelectedSKU}
        onStepChange={setCurrentStep}
        onAIFailure={handleAIFailure}
        lastImportFileName={lastImportFileName}
        lastImportTime={lastImportTime}
      />
  );
};

export default ForecastPage; 