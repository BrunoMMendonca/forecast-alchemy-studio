
import React from 'react';
import { Button } from '@/components/ui/button';
import { FloatingSettingsButton } from '@/components/FloatingSettingsButton';
import { StepNavigation } from '@/components/StepNavigation';
import { List } from 'lucide-react';
import { BusinessContext } from '@/types/businessContext';

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
  grokApiEnabled: boolean;
  setGrokApiEnabled: (enabled: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
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
  grokApiEnabled,
  setGrokApiEnabled,
  settingsOpen,
  setSettingsOpen
}) => {
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
            <Button
              variant="outline"
              size="sm"
              onClick={onQueuePopupOpen}
              className="gap-2"
            >
              <List className="h-4 w-4" />
              View Queue
            </Button>
          </div>
        </div>

        {/* Floating Settings Button */}
        <FloatingSettingsButton
          forecastPeriods={forecastPeriods}
          setForecastPeriods={setForecastPeriods}
          businessContext={businessContext}
          setBusinessContext={setBusinessContext}
          grokApiEnabled={grokApiEnabled}
          setGrokApiEnabled={setGrokApiEnabled}
          settingsOpen={settingsOpen}
          setSettingsOpen={setSettingsOpen}
        />

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
