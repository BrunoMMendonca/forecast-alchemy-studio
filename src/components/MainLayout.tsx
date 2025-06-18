import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FloatingSettingsButton } from '@/components/FloatingSettingsButton';
import { StepNavigation } from '@/components/StepNavigation';
import { List, Loader2 } from 'lucide-react';
import { BusinessContext } from '@/types/businessContext';
import { useUnifiedState } from '@/hooks/useUnifiedState';
import { useBatchOptimization } from '@/hooks/useBatchOptimization';
import { getDefaultModels } from '@/utils/modelConfig';

interface MainLayoutProps {
  children: React.ReactNode;
  salesDataLength: number;
  queueSize: number;
  uniqueSKUCount: number;
  currentStep: number;
  forecastResultsLength: number;
  onStepClick: (step: number) => void;
  onQueuePopupOpen: () => void;
  forecastPeriods: number;
  setForecastPeriods: (periods: number) => void;
  businessContext: BusinessContext;
  setBusinessContext: (context: BusinessContext) => void;
  aiForecastModelOptimizationEnabled: boolean;
  setaiForecastModelOptimizationEnabled: (enabled: boolean) => void;
  aiCsvImportEnabled: boolean;
  setAiCsvImportEnabled: (enabled: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  isOptimizing?: boolean;
  paused: boolean;
  aiFailureThreshold: number;
  setAiFailureThreshold: (threshold: number) => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  salesDataLength,
  queueSize,
  uniqueSKUCount,
  currentStep,
  forecastResultsLength,
  onStepClick,
  onQueuePopupOpen,
  forecastPeriods,
  setForecastPeriods,
  businessContext,
  setBusinessContext,
  aiForecastModelOptimizationEnabled,
  setaiForecastModelOptimizationEnabled,
  aiCsvImportEnabled,
  setAiCsvImportEnabled,
  settingsOpen,
  setSettingsOpen,
  isOptimizing,
  paused,
  aiFailureThreshold,
  setAiFailureThreshold
}) => {
  // === DEV MENU START ===
  // This block is for development only and can be easily erased.
  const isDev = process.env.NODE_ENV === 'development';
  const {
    cleanedData,
    models: stateModels,
    setModels,
    setIsOptimizing,
    setOptimizationProgress
  } = useUnifiedState();
  const { runOptimization, isOptimizing: batchIsOptimizing } = useBatchOptimization();
  const allSKUs = Array.from(new Set(cleanedData.map(d => d['Material Code']).filter(Boolean)));
  const models = stateModels.length > 0 ? stateModels : getDefaultModels();

  // Dropdown state
  const [selectedSKU, setSelectedSKU] = useState<string>(allSKUs[0] || '');
  const [selectedModelId, setSelectedModelId] = useState<string>(models[0]?.id || '');

  const handleOptimizeAll = async () => {
    await runOptimization(allSKUs, cleanedData, models, businessContext);
  };

  const handleOptimizeSKUModel = async () => {
    const model = models.find(m => m.id === selectedModelId);
    if (!model || !selectedSKU) return;
    await runOptimization([selectedSKU], cleanedData, [model], businessContext);
  };
  // === DEV MENU END ===

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-4">
            AI-Powered Sales Forecast Analytics
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Upload your historical sales data, leverage AI for optimization, and generate enterprise-ready forecasts for S&OP planning.
          </p>
          <div className="mt-4 flex items-center justify-center gap-4">
            {salesDataLength > 0 && queueSize > 0 && (
              <div className="text-sm text-blue-600 bg-blue-50 rounded-lg px-4 py-2">
                📋 {queueSize} optimization combinations queued ({uniqueSKUCount} SKUs)
              </div>
            )}
          </div>
        </div>

        {/* Floating View Queue Button - always visible */}
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            variant="outline"
            size="lg"
            onClick={onQueuePopupOpen}
            className={`gap-2 shadow-lg rounded-full px-6 py-3 ${paused ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100' : 'bg-white border-blue-300 hover:bg-blue-50'}`}
            style={{ minWidth: 0, marginRight: '8px' }}
          >
            {isOptimizing && queueSize > 0 && (
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            )}
            <List className="h-5 w-5" />
            View Queue
          </Button>
        </div>

        {/* Floating Settings Button */}
        <FloatingSettingsButton
          forecastPeriods={forecastPeriods}
          setForecastPeriods={setForecastPeriods}
          businessContext={businessContext}
          setBusinessContext={setBusinessContext}
          aiForecastModelOptimizationEnabled={aiForecastModelOptimizationEnabled}
          setaiForecastModelOptimizationEnabled={setaiForecastModelOptimizationEnabled}
          aiCsvImportEnabled={aiCsvImportEnabled}
          setAiCsvImportEnabled={setAiCsvImportEnabled}
          aiFailureThreshold={aiFailureThreshold}
          setAiFailureThreshold={setAiFailureThreshold}
          settingsOpen={settingsOpen}
          setSettingsOpen={setSettingsOpen}
        />

        {/* === DEV MENU START === */}
        {isDev && (
          <div className="my-6 p-4 border-2 border-dashed border-red-400 bg-red-50 rounded-lg">
            <div className="font-bold text-red-700 mb-2">DEV: Manual Optimization Trigger</div>
            <Button onClick={handleOptimizeAll} disabled={batchIsOptimizing} className="mb-4">
              Optimize All SKUs/Models
            </Button>
            <div className="flex items-center gap-2">
              <label htmlFor="dev-sku-select" className="text-sm font-semibold">SKU:</label>
              <select
                id="dev-sku-select"
                value={selectedSKU}
                onChange={e => setSelectedSKU(e.target.value)}
                className="border rounded px-2 py-1"
              >
                {allSKUs.map((sku, index) => (
                  <option key={`sku-${sku}-${index}`} value={sku}>{sku}</option>
                ))}
              </select>
              <label htmlFor="dev-model-select" className="text-sm font-semibold">Model:</label>
              <select
                id="dev-model-select"
                value={selectedModelId}
                onChange={e => setSelectedModelId(e.target.value)}
                className="border rounded px-2 py-1"
              >
                {models.map((model, index) => (
                  <option key={`model-${model.id}-${index}`} value={model.id}>{model.name}</option>
                ))}
              </select>
              <Button
                onClick={handleOptimizeSKUModel}
                disabled={batchIsOptimizing || !selectedSKU || !selectedModelId}
                className="ml-2"
              >
                Optimize Selected
              </Button>
            </div>
          </div>
        )}
        {/* === DEV MENU END === */}

        {/* Progress Steps */}
        <StepNavigation
          currentStep={currentStep}
          salesDataLength={salesDataLength}
          forecastResultsLength={forecastResultsLength}
          onStepClick={onStepClick}
        />

        {/* Main Content */}
        <div className="w-full">
          {children}
        </div>
      </div>
    </div>
  );
};
