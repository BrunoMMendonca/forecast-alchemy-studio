import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FloatingSettingsButton } from '@/components/FloatingSettingsButton';
import { StepNavigation } from '@/components/StepNavigation';
import { List, Loader2, CheckCircle, XCircle, X } from 'lucide-react';
import { useUnifiedState } from '@/hooks/useUnifiedState';
import { getDefaultModels } from '@/utils/modelConfig';
import { JobSummary, useBackendJobStatus } from '@/hooks/useBackendJobStatus';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import { useExistingDataDetection } from '@/hooks/useExistingDataDetection';
import { cn } from '@/lib/utils';
import { OptimizationQueuePopup } from '@/components/OptimizationQueuePopup';
import { useToast } from '@/hooks/use-toast';
import { Job } from '@/types/optimization';
import { CsvUploadResult } from '@/components/CsvImportWizard';
import { ForecastResult } from '@/types/forecast';

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
  const [selectedSKU, setSelectedSKU] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [isAutoLoading, setIsAutoLoading] = useState(true);
  // =====================================

  const { setModels } = useUnifiedState(); // Keep global model state separate
  const { jobs, summary, isPaused, setIsPaused } = useBackendJobStatus(batchId);
  const globalSettings = useGlobalSettings();
  const { toast } = useToast();
  const { autoLoadLastDataset } = useExistingDataDetection();

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
            console.log('[MainLayout] Auto-loaded last dataset:', result.filePath);
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

  const handleStepClick = (stepIndex: number) => {
    setCurrentStep(stepIndex);
  };

  const handleResetModels = () => {
    setModels(getDefaultModels());
    toast({
      title: "Models Reset",
      description: "All model configurations have been reset to their default state.",
    });
  };

  const outletContext = {
    summary,
    ...globalSettings,
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
    batchId,
    setBatchId,
    isAutoLoading,
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
      />
      {/* Floating container for Job Monitor and Setup button */}
      <div className="fixed top-6 right-6 z-50 flex flex-row items-center gap-4 min-w-[260px]">
        <JobMonitorButton summary={summary} onOpen={() => setIsQueueOpen(true)} />
        <FloatingSettingsButton
          {...globalSettings}
          settingsOpen={settingsOpen}
          setSettingsOpen={setSettingsOpen}
        />
      </div>
      {/* Floating logo container, top left */}
      <div className="fixed top-4 left-6 z-50">
        <img src="/forecast_alchemy_logo.svg" alt="Forecast Alchemy Logo" className="h-20 w-auto" />
      </div>
    </div>
  );
};
