import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FloatingSettingsButton } from '@/components/FloatingSettingsButton';
import { StepNavigation } from '@/components/StepNavigation';
import { List, Loader2, CheckCircle, XCircle, X } from 'lucide-react';
import { useUnifiedState } from '@/hooks/useUnifiedState';
import { getDefaultModels } from '@/utils/modelConfig';
import { JobSummary, useBackendJobStatus } from '@/hooks/useBackendJobStatus';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
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

const JobMonitorButton = ({ summary = { total: 0, pending: 0, running: 0, completed: 0, failed: 0, cancelled: 0, isOptimizing: false, progress: 0 }, onOpen }: JobMonitorButtonProps) => {
  const getButtonContent = () => {
    if (summary.isOptimizing) {
      return {
        icon: <Loader2 className="h-4 w-4 mr-2 animate-spin" />,
        text: `Processing... (${summary.completed}/${summary.total - summary.cancelled})`,
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
            "fixed bottom-4 right-4 z-50 shadow-lg rounded-full flex items-center transition-all",
            className
          )}
        >
          <Button
              variant={variant as any}
              className="rounded-full"
              onClick={onOpen}
          >
              {icon}
              {text}
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
  // =====================================

  const { setModels } = useUnifiedState(); // Keep global model state separate
  const { jobs, summary, isPaused, setIsPaused } = useBackendJobStatus();
  const globalSettings = useGlobalSettings();
  const { toast } = useToast();

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
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white dark:bg-gray-800 shadow-sm">
          <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Forecast Alchemy Studio
            </h1>
            <Button variant="outline" onClick={handleResetModels}>Reset Models</Button>
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
      
      {showFloatingButton && (
        <FloatingSettingsButton
          {...globalSettings}
          settingsOpen={settingsOpen}
          setSettingsOpen={setSettingsOpen}
        />
      )}
      <JobMonitorButton summary={summary} onOpen={() => setIsQueueOpen(true)} />
      <OptimizationQueuePopup
          isOpen={isQueueOpen}
          onOpenChange={setIsQueueOpen}
          jobs={jobs as Job[]}
          summary={summary}
          isPaused={isPaused}
          setIsPaused={setIsPaused}
      />
    </div>
  );
};
