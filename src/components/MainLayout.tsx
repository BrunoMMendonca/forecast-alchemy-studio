import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FloatingSettingsButton } from '@/components/FloatingSettingsButton';
import { StepNavigation } from '@/components/StepNavigation';
import { List, Loader2, CheckCircle, XCircle, X } from 'lucide-react';
import { useUnifiedState } from '@/hooks/useUnifiedState';
import { fetchAvailableModels } from '@/utils/modelConfig';
import { JobSummary, useBackendJobStatus } from '@/hooks/useBackendJobStatus';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import { useExistingDataDetection } from '@/hooks/useExistingDataDetection';
import { cn } from '@/lib/utils';
import { OptimizationQueuePopup } from '@/components/OptimizationQueuePopup';
import { useToast } from '@/hooks/use-toast';
import { Job } from '@/types/optimization';
import { CsvUploadResult } from '@/components/CsvImportWizard';
import { ForecastResult, ModelConfig } from '@/types/forecast';
import { useSKUStore } from '@/store/skuStore';

interface JobMonitorButtonProps {
  summary: JobSummary;
  onOpen: () => void;
}

const defaultSummary: JobSummary = {
  total: 0,
  pending: 0,
  running: 0,
  completed: 0,
  failed: 0,
  cancelled: 0,
  isOptimizing: false,
  progress: 0,
  batchTotal: 0,
  batchCompleted: 0
};

const JobMonitorButton = ({ summary = defaultSummary, onOpen }: JobMonitorButtonProps) => {
  const getButtonContent = () => {
    if (summary.isOptimizing) {
      return {
        icon: <Loader2 className="h-4 w-4 mr-2 animate-spin" />,
        text: `Processing jobs: ${summary.batchCompleted}/${summary.batchTotal}`,
        variant: 'default',
        className: 'bg-blue-600 hover:bg-blue-700 text-white',
      };
    }
    const totalProcessable = summary.total - summary.cancelled;
    if (summary.total > 0 && summary.completed + summary.failed === totalProcessable) {
       if (summary.failed > 0) {
        return {
          icon: <XCircle className="h-4 w-4 mr-2" />,
          text: `Finished (${summary.failed} Failed${summary.cancelled > 0 ? `, ${summary.cancelled} Cancelled` : ''})`,
          variant: 'destructive',
          className: '',
        };
      }
      return {
        icon: <CheckCircle className="h-4 w-4 mr-2" />,
        text: `Processing Complete${summary.cancelled > 0 ? ` (${summary.cancelled} Cancelled)` : ''}`,
        variant: 'default',
        className: 'bg-green-600 hover:bg-green-700 text-white',
      };
    }
    return {
      icon: <List className="h-4 w-4 mr-2" />,
      text: 'View Job Monitor',
      variant: 'outline',
      className: '',
    };
  };

  const { icon, text, variant, className } = getButtonContent();

  return (
        <div
          className={cn(
            "shadow-lg rounded-full flex items-center transition-all h-12",
            className
          )}
        >
          <Button
              variant={variant as any}
              className="rounded-full h-12 px-6 flex items-center"
              onClick={onOpen}
          >
              {icon}
              <span className="font-semibold">{text}</span>
          </Button>
        </div>
  );
};

export const MainLayout: React.FC = () => {
  const location = useLocation();
  const showFloatingButton = location.pathname.startsWith('/forecast');
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // === Hoisted State for ForecastPage ===
  const [currentStep, setCurrentStep] = useState(0);
  const [processedDataInfo, setProcessedDataInfo] = useState<CsvUploadResult | null>(null);
  const [forecastResults, setForecastResults] = useState<ForecastResult[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [isAutoLoading, setIsAutoLoading] = useState(true);
  const [models, setModels] = useState<ModelConfig[]>([]); // Local model state
  const [datasetCount, setDatasetCount] = useState<number>(1);
  // =====================================

  const { jobs, summary, isPaused, setIsPaused } = useBackendJobStatus(batchId);
  const globalSettings = useGlobalSettings({
    onSettingsChange: async (changedSetting: string) => {
      // Trigger optimization when metric weights change
      if (['mapeWeight', 'rmseWeight', 'maeWeight', 'accuracyWeight'].includes(changedSetting)) {
        if (processedDataInfo && processedDataInfo.skuList && processedDataInfo.skuList.length > 0) {
          try {
            // Get available models
            const models = await fetchAvailableModels();
            const modelIds = models.map(m => m.id);
            
            // Determine which methods to run
            const methodsToRun = ['grid'];
            if (globalSettings.aiForecastModelOptimizationEnabled) {
              methodsToRun.push('ai');
            }
            
            let totalJobsCreated = 0;
            
            // Create optimization jobs for all SKUs with metric weight change reason
            for (const method of methodsToRun) {
              const response = await fetch('/api/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  skus: processedDataInfo.skuList,
                  models: modelIds,
                  method,
                  reason: 'metric_weight_change',
                  filePath: processedDataInfo.filePath,
                  batchId: Date.now().toString()
                }),
              });

              if (response.ok) {
                const result = await response.json();
                totalJobsCreated += result.jobsCreated || 0;
              } else {
                throw new Error(`Failed to create ${method} optimization jobs`);
              }
            }
            
            if (totalJobsCreated > 0) {
              toast({
                title: "Optimization Triggered",
                description: `Metric weights changed. Started optimization for ${processedDataInfo.skuList.length} SKUs using ${methodsToRun.join(' and ')} methods.`,
                variant: "default",
              });
            }
          } catch (error) {
            console.error('Error triggering optimization for metric weight change:', error);
            toast({
              title: "Error",
              description: "Failed to trigger optimization for metric weight change.",
              variant: "destructive",
            });
          }
        }
      }
    }
  });
  const { toast } = useToast();
  const { autoLoadLastDataset } = useExistingDataDetection();

  const selectedSKU = useSKUStore(state => state.selectedSKU);
  const setSelectedSKU = useSKUStore(state => state.setSelectedSKU);

  // Auto-load last dataset on app start
  useEffect(() => {
    const loadLastDataset = async () => {
      // Only auto-load if we're on the forecast page and no data is currently loaded
      if (location.pathname.startsWith('/forecast') && !processedDataInfo) {
        try {
          const result = await autoLoadLastDataset();
          if (result) {
            setProcessedDataInfo(result);
            setCurrentStep(1); // Navigate to step 1 (Clean & Prepare)
            toast({
              title: "Dataset Auto-Loaded",
              description: `Loaded your last dataset: ${result.summary.skuCount} products`,
              variant: "default",
            });
          }
        } catch (error) {
          console.error('[MainLayout] Failed to auto-load last dataset:', error);
        } finally {
          setIsAutoLoading(false);
        }
      } else {
        // If we're not on forecast page or already have data, stop loading immediately
        setIsAutoLoading(false);
      }
    };

    // Small delay to ensure the app is fully initialized
    const timer = setTimeout(loadLastDataset, 500);
    return () => clearTimeout(timer);
  }, [location.pathname, processedDataInfo, autoLoadLastDataset, setProcessedDataInfo, setCurrentStep, toast]);

  // Auto-select first SKU after data load if none is selected
  useEffect(() => {
    if (
      processedDataInfo &&
      (!selectedSKU || !processedDataInfo.skuList?.includes(selectedSKU)) &&
      processedDataInfo.skuList &&
      processedDataInfo.skuList.length > 0
    ) {
      setSelectedSKU(processedDataInfo.skuList[0]);
    }
  }, [processedDataInfo, selectedSKU, setSelectedSKU]);

  // Fetch models from backend on app start
  useEffect(() => {
    async function loadModels() {
      try {
        const backendModels = await fetchAvailableModels();
        
        if (!backendModels || backendModels.length === 0) {
          setModels([]);
          return;
        }
        
        // Transform backend model metadata to frontend ModelConfig format
        const transformedModels = backendModels.map((model: any) => {
          const transformed = {
            id: model.id,
            name: model.displayName || model.id,
            displayName: model.displayName,
            description: model.description || '',
            enabled: model.enabled !== false, // Default to enabled unless explicitly disabled
            // --- Parameter sets ---
            manualParameters: { ...model.defaultParameters },
            gridParameters: undefined,
            aiParameters: undefined,
            parameters: { ...model.defaultParameters }, // Active set starts as manual
            bestSource: undefined,
            // --- Legacy/compatibility fields ---
            defaultParameters: { ...model.defaultParameters }, // Store original defaults
            isSeasonal: model.isSeasonal || false,
            category: model.category || 'Other',
            icon: undefined, // Backend models don't have icons, will be handled by UI
            // Deprecated fields for compatibility
            optimizationConfidence: undefined,
            optimizationReasoning: undefined,
            optimizationMethod: undefined,
            isWinner: false,
            // --- Add parameter metadata for UI ---
            parametersMeta: model.parameters || [],
          };
          return transformed;
        });
        
        setModels(transformedModels);
      } catch (err) {
        setModels([]); // Set empty array on error
      }
    }
    loadModels();
  }, [setModels]);

  useEffect(() => {
    async function fetchDatasetCount() {
      try {
        const res = await fetch('/api/datasets/count');
        if (res.ok) {
          const data = await res.json();
          setDatasetCount(data.count || 1);
        }
      } catch (e) {
        setDatasetCount(1);
      }
    }
    fetchDatasetCount();
  }, []);

  const handleStepClick = (stepIndex: number) => {
    setCurrentStep(stepIndex);
  };

  // Model update function
  const updateModel = useCallback((modelId: string, updates: Partial<ModelConfig>) => {
    setModels(prev => prev.map(model =>
      model.id === modelId ? { ...model, ...updates } : model
    ));
  }, []);

  const outletContext = {
    summary,
    ...globalSettings,
    currentStep,
    setCurrentStep,
    processedDataInfo,
    setProcessedDataInfo,
    forecastResults,
    setForecastResults,
    aiError,
    setAiError,
    batchId,
    setBatchId,
    isAutoLoading,
    models,
    updateModel,
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white dark:bg-gray-800 shadow-sm">
          <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          </div>
          <StepNavigation
            currentStep={currentStep}
            onStepClick={handleStepClick}
            uploadSummary={processedDataInfo?.summary ?? null}
            forecastResultsLength={forecastResults.length}
          />
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet context={outletContext} />
        </main>
      </div>
      <OptimizationQueuePopup
          isOpen={isQueueOpen}
          onOpenChange={setIsQueueOpen}
          jobs={jobs as Job[]}
          summary={summary}
          isPaused={isPaused}
          setIsPaused={setIsPaused}
          currentDataset={processedDataInfo ? {
            filePath: processedDataInfo.filePath,
            filename: processedDataInfo.filePath?.split('/').pop(),
            name: processedDataInfo.filePath?.split('/').pop()?.replace(/\.(csv|json)$/, '')
          } : null}
          selectedSKU={selectedSKU}
          skuCount={processedDataInfo?.skuList ? new Set(processedDataInfo.skuList).size : (processedDataInfo?.summary?.skuCount || 1)}
          datasetCount={datasetCount}
      />
      {/* Floating container for Job Monitor and Setup button */}
      <div className="fixed top-6 right-6 z-50 flex flex-row items-center gap-4 min-w-[260px]">
        <JobMonitorButton summary={summary} onOpen={() => setIsQueueOpen(true)} />
        <FloatingSettingsButton
          {...globalSettings}
          settingsOpen={settingsOpen}
          setSettingsOpen={setSettingsOpen}
          currentDataset={processedDataInfo ? {
            filePath: processedDataInfo.filePath,
            filename: processedDataInfo.filePath?.split('/').pop(),
            name: processedDataInfo.filePath?.split('/').pop()?.replace(/\.(csv|json)$/, '')
          } : null}
          selectedSKU={selectedSKU}
          skuCount={processedDataInfo?.skuList ? new Set(processedDataInfo.skuList).size : (processedDataInfo?.summary?.skuCount || 1)}
          datasetCount={datasetCount}
        />
      </div>
      {/* Floating logo container, top left */}
      <div className="fixed top-4 left-6 z-50">
        <img src="/forecast_alchemy_logo.svg" alt="Forecast Alchemy Logo" className="h-20 w-auto" />
      </div>
    </div>
  );
};
