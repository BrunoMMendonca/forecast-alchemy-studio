import React from 'react';
import { CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { BarChart3, Brain, Sparkles } from 'lucide-react';
import { BusinessContext } from '@/types/businessContext';
import { BusinessContextSettings } from '@/components/BusinessContextSettings';
import { useAISettings } from '@/hooks/useAISettings';

interface ForecastSettingsProps {
  forecastPeriods: number;
  setForecastPeriods: (periods: number) => void;
  businessContext: BusinessContext;
  setBusinessContext: (context: BusinessContext) => void;
  aiForecastModelOptimizationEnabled: boolean;
  setaiForecastModelOptimizationEnabled: (enabled: boolean) => void;
  aiFailureThreshold: number;
  setAiFailureThreshold: (threshold: number) => void;
  aiCsvImportEnabled: boolean;
  setAiCsvImportEnabled: (enabled: boolean) => void;
  largeFileProcessingEnabled: boolean;
  setLargeFileProcessingEnabled: (enabled: boolean) => void;
  largeFileThreshold: number;
  setLargeFileThreshold: (threshold: number) => void;
}

export const ForecastSettings: React.FC<ForecastSettingsProps> = ({
  forecastPeriods,
  setForecastPeriods,
  businessContext,
  setBusinessContext,
  aiForecastModelOptimizationEnabled,
  setaiForecastModelOptimizationEnabled,
  aiFailureThreshold,
  setAiFailureThreshold,
  aiCsvImportEnabled,
  setAiCsvImportEnabled,
  largeFileProcessingEnabled,
  setLargeFileProcessingEnabled,
  largeFileThreshold,
  setLargeFileThreshold
}) => {
  const { enabled: aiEnabled, setEnabled: setAIEnabled } = useAISettings({
    onSettingsChange: (enabled) => {
      // If AI Features is disabled, also disable AI Model Optimization
      if (!enabled) {
        setaiForecastModelOptimizationEnabled(false);
      }
    }
  });

  return (
    <div className="space-y-8">
      {/* AI Features (Grok API) */}
      <div className="space-y-2">
        <Label htmlFor="ai-enabled" className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5" />
          AI Features (Grok API)
        </Label>
        <div className="flex items-center space-x-2">
          <Switch
            id="ai-enabled"
            checked={aiEnabled}
            onCheckedChange={setAIEnabled}
          />
          <span className="text-sm text-slate-600">
            {aiEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <p className="text-sm text-slate-500">
          Enable advanced AI features powered by the Grok API, including model optimization and business context-aware recommendations.
        </p>
      </div>

      {/* AI CSV Import Wizard (sub-toggle, only visible if AI Features is enabled) */}
      {aiEnabled && (
        <div className="pl-6 border-l-2 border-slate-200 space-y-2">
          <Label htmlFor="ai-csv-import-enabled" className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            AI-Powered CSV Import Wizard
          </Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="ai-csv-import-enabled"
              checked={aiCsvImportEnabled}
              onCheckedChange={setAiCsvImportEnabled}
            />
            <span className="text-sm text-slate-600">
              {aiCsvImportEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Enable the AI-powered CSV Import Wizard to get interactive suggestions and data transformations during CSV import.
          </p>
        </div>
      )}

      {/* Large File Processing (sub-toggle, only visible if AI Features and AI CSV Import are enabled) */}
      {aiEnabled && aiCsvImportEnabled && (
        <div className="pl-6 border-l-2 border-slate-200 space-y-2">
          <Label htmlFor="large-file-processing-enabled" className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            Large File Processing
          </Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="large-file-processing-enabled"
              checked={largeFileProcessingEnabled}
              onCheckedChange={setLargeFileProcessingEnabled}
            />
            <span className="text-sm text-slate-600">
              {largeFileProcessingEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Enable configuration-based processing for large CSV files that exceed token limits. Uses AI to generate transformation scripts.
          </p>
          
          {/* Large File Threshold Setting */}
          <div className="flex items-center space-x-2 mt-2">
            <Label htmlFor="large-file-threshold" className="text-sm">Large File Threshold</Label>
            <Input
              id="large-file-threshold"
              type="number"
              min={1024 * 100} // 100KB minimum
              max={1024 * 1024 * 10} // 10MB maximum
              step={1024 * 100} // 100KB steps
              value={Math.round(largeFileThreshold / (1024 * 100)) * 100}
              onChange={e => setLargeFileThreshold(Number(e.target.value) * 1024)}
              className="w-24"
            />
            <span className="text-xs text-slate-500">KB (Files larger than this will use configuration-based processing)</span>
          </div>
        </div>
      )}

      {/* AI Model Optimization (sub-toggle, only visible if AI Features is enabled) */}
      {aiEnabled && (
        <div className="pl-6 border-l-2 border-slate-200 space-y-2">
          <Label htmlFor="grok-api-enabled" className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4" />
            AI Model Optimization
          </Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="grok-api-enabled"
              checked={aiForecastModelOptimizationEnabled}
              onCheckedChange={setaiForecastModelOptimizationEnabled}
            />
            <span className="text-sm text-slate-600">
              {aiForecastModelOptimizationEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Use the Grok API to optimize model parameters for best forecast accuracy. When disabled, traditional grid search will be used.
          </p>
          {/* AI Failure Threshold Setting */}
          <div className="flex items-center space-x-2 mt-2">
            <Label htmlFor="ai-failure-threshold" className="text-sm">AI Failure Threshold</Label>
            <Input
              id="ai-failure-threshold"
              type="number"
              min={1}
              max={20}
              value={aiFailureThreshold}
              onChange={e => setAiFailureThreshold(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-xs text-slate-500">(Disable AI after this many consecutive failures. Default: 5)</span>
          </div>

          {/* AI Model Optimization Context (only visible if AI Model Optimization is enabled) */}
          {aiForecastModelOptimizationEnabled && (
            <div className="pl-6 border-l-2 border-slate-100 mt-4">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <span className="font-semibold text-purple-700">AI Model Optimization Context</span>
              </div>
              <p className="text-sm text-slate-500 mb-4">
                These parameters guide the AI Model Optimization process and help tailor results to your business needs.
              </p>
              <BusinessContextSettings
                businessContext={businessContext}
                setBusinessContext={setBusinessContext}
                disabled={!aiForecastModelOptimizationEnabled}
              />
            </div>
          )}
        </div>
      )}

      {/* Forecast Periods (always visible) */}
      <div className="space-y-2">
        <Label htmlFor="forecast-periods" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Forecast Periods
        </Label>
        <Input
          id="forecast-periods"
          type="number"
          value={forecastPeriods}
          onChange={(e) => setForecastPeriods(Math.max(1, parseInt(e.target.value) || 1))}
          min={1}
          max={365}
          className="w-32"
        />
        <p className="text-sm text-slate-500">
          Number of future periods to forecast (auto-detects your data frequency)
        </p>
      </div>
    </div>
  );
};
