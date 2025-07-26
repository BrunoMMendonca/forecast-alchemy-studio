import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FloatingSettingsButton } from '@/components/FloatingSettingsButton';
import { StepNavigation } from '@/components/StepNavigation';
import { List, Loader2, CheckCircle, XCircle, X, LogOut, User } from 'lucide-react';
import { useUnifiedState } from '@/hooks/useUnifiedState';
import { fetchAvailableModels } from '@/utils/modelConfig';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import { useExistingDataDetection } from '@/hooks/useExistingDataDetection';
import { cn } from '@/lib/utils';
import { OptimizationQueuePopup } from '@/components/OptimizationQueuePopup';
import { useToast } from '@/hooks/use-toast';
import { CsvUploadResult } from '@/components/CsvImportWizard';
import { ForecastResult, ModelConfig } from '@/types/forecast';
import { useSKUStore } from '@/store/skuStore';
import { useOptimizationStatusContext } from '@/contexts/OptimizationStatusContext';

const JobMonitorButton = ({ onOpen }: { onOpen: () => void }) => {
  const { summary } = useOptimizationStatusContext();

  // Determine badge content and color
  let badge;
  if (summary.isOptimizing) {
    badge = (
      <span className="flex items-center gap-1 text-xs text-blue-100 bg-blue-500 rounded-full px-3 py-1 animate-pulse transition ring-0 hover:ring-2 hover:ring-blue-300 cursor-pointer" onClick={onOpen}>
        <span className="w-2 h-2 bg-blue-200 rounded-full"></span>
        Active
      </span>
    );
  } else {
    const totalProcessable = summary.total - summary.cancelled;
    if (summary.total > 0 && summary.completed + summary.failed === totalProcessable) {
      if (summary.failed > 0) {
        badge = (
          <span className="flex items-center gap-1 text-xs text-red-600 bg-red-100 rounded-full px-3 py-1 transition ring-0 hover:ring-2 hover:ring-red-300 cursor-pointer" onClick={onOpen}>
            <span className="w-2 h-2 bg-red-400 rounded-full"></span>
            Failed
          </span>
        );
      } else {
        badge = (
          <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 rounded-full px-3 py-1 transition ring-0 hover:ring-2 hover:ring-green-300 cursor-pointer" onClick={onOpen}>
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            Complete
          </span>
        );
      }
    } else {
      // Idle state
      badge = (
        <span className="flex items-center gap-1 text-xs text-gray-600 bg-gray-200 rounded-full px-3 py-1 transition ring-0 hover:ring-2 hover:ring-gray-400 cursor-pointer" onClick={onOpen}>
          <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
          Idle
        </span>
      );
    }
  }

  return (
    <div className="flex items-center transition-all h-12">
      {badge}
    </div>
  );
};

export const MainLayout: React.FC = () => {
  const location = useLocation();
  const showFloatingButton = location.pathname.startsWith('/forecast');
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Ref for StepNavigation
  const stepNavRef = useRef<HTMLDivElement | null>(null);
  const [floatingTop, setFloatingTop] = useState<number>(48); // default fallback

  // Load user info on mount
  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const sessionToken = localStorage.getItem('sessionToken');
        if (sessionToken) {
          const response = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${sessionToken}`
            }
          });
          if (response.ok) {
            const result = await response.json();
            setUser(result.user);
          }
        }
      } catch (error) {
        console.error('Failed to load user info:', error);
      }
    };
    loadUserInfo();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('refreshToken');
    window.location.reload();
  };

  // === Hoisted State for ForecastPage ===
  const [currentStep, setCurrentStep] = useState(0);
  const [processedDataInfo, setProcessedDataInfo] = useState<CsvUploadResult | null>(null);
  const [forecastResults, setForecastResults] = useState<ForecastResult[]>([]);
  
  const [aiError, setAiError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [isAutoLoading, setIsAutoLoading] = useState(true);
  const [models, setModels] = useState<ModelConfig[]>([]); // Local model state
  const [modelsLoaded, setModelsLoaded] = useState(false); // Track if models have been successfully loaded
  const [datasetCount, setDatasetCount] = useState<number>(1);
  const modelsLoadAttemptedRef = useRef(false); // Track if we've attempted to load models
  // =====================================

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
                  datasetId: processedDataInfo.datasetId,
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

  useEffect(() => {
    // Clear persisted SKU if there are no datasets/SKUs loaded
    if (!processedDataInfo || !processedDataInfo.skuList || processedDataInfo.skuList.length === 0) {
      localStorage.removeItem('sku-storage');
      setSelectedSKU('');
    } else if (!selectedSKU || !processedDataInfo.skuList.includes(selectedSKU)) {
      setSelectedSKU(processedDataInfo.skuList[0]);
    }
  }, [processedDataInfo, selectedSKU, setSelectedSKU]);

  // Fetch models from backend on app start
  useEffect(() => {
    // Only load models once on mount
    if (modelsLoadAttemptedRef.current) {
      return;
    }
    modelsLoadAttemptedRef.current = true;

    async function loadModels() {
      try {
        const backendModels = await fetchAvailableModels();
        
        if (!backendModels || backendModels.length === 0) {
          // Only clear models if we haven't successfully loaded any yet
          if (!modelsLoaded) {
          setModels([]);
          } else {
            console.warn('[MainLayout] Backend returned no models, but keeping existing models loaded');
          }
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
        setModelsLoaded(true);
      } catch (err) {
        // Only clear models if we haven't successfully loaded any yet
        if (!modelsLoaded) {
          setModels([]); // Set empty array on error only if no models were loaded before
        } else {
          console.warn('[MainLayout] Failed to fetch models from backend, but keeping existing models loaded:', err);
        }
      }
    }
    loadModels();
  }, []); // Empty dependency array - only run once on mount

  useEffect(() => {
    async function fetchDatasetCount() {
      try {
        const res = await fetch('/api/detect-existing-data');
        if (res.ok) {
          const data = await res.json();
          setDatasetCount(data.datasets?.length || 1);
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

  // Explicit function to clear models (for dataset changes, etc.)
  const clearModels = useCallback(() => {
    setModels([]);
    setModelsLoaded(false);
    modelsLoadAttemptedRef.current = false; // Allow reloading in the future
  }, []);

  // Model update function
  const updateModel = useCallback((modelId: string, updates: Partial<ModelConfig>) => {
    setModels(prev => prev.map(model =>
      model.id === modelId ? { ...model, ...updates } : model
    ));
  }, []);

  // Wrapper function for setForecastResults
  const setForecastResultsWithLogging = useCallback((results: ForecastResult[]) => {
    setForecastResults(results);
  }, []);

  const outletContext = {
    summary: processedDataInfo?.summary ?? null,
    ...globalSettings,
    currentStep,
    setCurrentStep,
    processedDataInfo,
    setProcessedDataInfo,
    forecastResults,
    setForecastResults: setForecastResultsWithLogging,
    aiError,
    setAiError,
    batchId,
    setBatchId,
    isAutoLoading,
    models,
    updateModel,
    clearModels,
  };

  useEffect(() => {
    if (stepNavRef.current) {
      const rect = stepNavRef.current.getBoundingClientRect();
      // Add scroll offset for sticky headers, etc.
      setFloatingTop(rect.top + window.scrollY);
    }
  }, [stepNavRef, currentStep, location.pathname]);

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white dark:bg-gray-800 shadow-sm">
          <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <div className="flex items-center">
              <img src="/forecast_alchemy_logo.svg" alt="Forecast Alchemy Logo" className="h-10 w-auto mr-2" />
              <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">Forecast Alchemy</h1>
            </div>
            <div className="flex items-center gap-4">
              {user && (
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <User className="h-5 w-5" />
                  <span>{user.username}</span>
                </div>
              )}
              <Button variant="ghost" onClick={handleLogout} className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Button>
            </div>
          </div>
          <div ref={stepNavRef}>
            <StepNavigation
              currentStep={currentStep}
              onStepClick={handleStepClick}
              uploadSummary={processedDataInfo?.summary ?? null}
              forecastResultsLength={forecastResults.length}
            />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet context={outletContext} />
        </main>
      </div>
      <OptimizationQueuePopup
          isOpen={isQueueOpen}
          onOpenChange={setIsQueueOpen}
          currentDataset={processedDataInfo ? {
            datasetId: processedDataInfo.datasetId,
            filename: processedDataInfo.datasetId ? `dataset_${processedDataInfo.datasetId}` : undefined,
            name: processedDataInfo.datasetId ? `dataset_${processedDataInfo.datasetId}` : undefined
          } : null}
          selectedSKU={selectedSKU}
          skuCount={processedDataInfo?.skuList ? new Set(processedDataInfo.skuList).size : (processedDataInfo?.summary?.skuCount || 1)}
          datasetCount={datasetCount}
      />
      {/* Floating container for Job Monitor and Setup button */}
      <div
        className="fixed right-16 z-50 flex flex-row items-center gap-4"
        style={{ top: `${floatingTop}px` }}
      >
        <JobMonitorButton onOpen={() => setIsQueueOpen(true)} />
        <FloatingSettingsButton
          {...globalSettings}
          settingsOpen={settingsOpen}
          setSettingsOpen={setSettingsOpen}
          currentDataset={processedDataInfo ? {
            datasetId: processedDataInfo.datasetId,
            filename: processedDataInfo.datasetId ? `dataset_${processedDataInfo.datasetId}` : undefined,
            name: processedDataInfo.datasetId ? `dataset_${processedDataInfo.datasetId}` : undefined
          } : null}
          selectedSKU={selectedSKU}
          skuCount={processedDataInfo?.skuList ? new Set(processedDataInfo.skuList).size : (processedDataInfo?.summary?.skuCount || 1)}
          datasetCount={datasetCount}
        />
      </div>
      {/* Zustand debug panel moved to Debug tab in settings */}
    </div>
  );
};
