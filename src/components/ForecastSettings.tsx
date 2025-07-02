import React, { useMemo, useState, useEffect } from 'react';
import { CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { BarChart3, Brain, Sparkles } from 'lucide-react';
import { BusinessContext } from '@/types/businessContext';
import { BusinessContextSettings } from '@/components/BusinessContextSettings';
import { useAISettings } from '@/hooks/useAISettings';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';

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
  aiReasoningEnabled: boolean;
  setAiReasoningEnabled: (enabled: boolean) => void;
  mapeWeight: number;
  rmseWeight: number;
  maeWeight: number;
  accuracyWeight: number;
  setWeights: (weights: { mape: number; rmse: number; mae: number; accuracy: number }) => void;
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
  setLargeFileThreshold,
  aiReasoningEnabled,
  setAiReasoningEnabled,
  mapeWeight,
  rmseWeight,
  maeWeight,
  accuracyWeight,
  setWeights,
}) => {
  const { enabled: aiFeaturesEnabled, setEnabled: setAIEnabled } = useAISettings({
    onSettingsChange: (enabled) => {
      // If AI Features is disabled, also disable AI Model Optimization
      if (!enabled) {
        setaiForecastModelOptimizationEnabled(false);
      }
    }
  });

  const globalSettings = useGlobalSettings();
  const fallbackSeparator = globalSettings.csvSeparator || ',';
  const frequencyOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' },
  ];

  // New local state for editing weights before saving
  const [editMape, setEditMape] = useState(mapeWeight);
  const [editRmse, setEditRmse] = useState(rmseWeight);
  const [editMae, setEditMae] = useState(maeWeight);
  const [editAccuracy, setEditAccuracy] = useState(accuracyWeight);
  
  // Calculate total
  const total = editMape + editRmse + editMae + editAccuracy;
  const isValid = total === 100;

  // Color palette for the bar
  const colors = ['#2563eb', '#059669', '#f59e42', '#e11d48'];
  const barSegments = useMemo(() => [
    { label: 'MAPE', value: editMape, color: colors[0] },
    { label: 'RMSE', value: editRmse, color: colors[1] },
    { label: 'MAE', value: editMae, color: colors[2] },
    { label: 'Accuracy', value: editAccuracy, color: colors[3] },
  ], [editMape, editRmse, editMae, editAccuracy]);

  // Minimum percent to show label inside bar
  const MIN_LABEL_PERCENT = 10;

  // Default weights
  const DEFAULT_WEIGHTS = { mape: 40, rmse: 30, mae: 20, accuracy: 10 };

  // Track if there are unsaved changes
  const hasChanges =
    editMape !== mapeWeight ||
    editRmse !== rmseWeight ||
    editMae !== maeWeight ||
    editAccuracy !== accuracyWeight;

  // Track if values are at default
  const isDefault =
    editMape === DEFAULT_WEIGHTS.mape &&
    editRmse === DEFAULT_WEIGHTS.rmse &&
    editMae === DEFAULT_WEIGHTS.mae &&
    editAccuracy === DEFAULT_WEIGHTS.accuracy;

  // Save button enabled only if valid and there are changes
  const canSave = isValid && hasChanges;

  // Sync local edit fields to saved values after saving
  useEffect(() => {
    setEditMape(mapeWeight);
    setEditRmse(rmseWeight);
    setEditMae(maeWeight);
    setEditAccuracy(accuracyWeight);
  }, [mapeWeight, rmseWeight, maeWeight, accuracyWeight]);

  // Save handler
  const handleSave = () => {
    if (!isValid) return; // Defensive: do not save if invalid
    setWeights({ mape: editMape, rmse: editRmse, mae: editMae, accuracy: editAccuracy });
  };

  // Reset handler
  const handleReset = () => {
    setEditMape(DEFAULT_WEIGHTS.mape);
    setEditRmse(DEFAULT_WEIGHTS.rmse);
    setEditMae(DEFAULT_WEIGHTS.mae);
    setEditAccuracy(DEFAULT_WEIGHTS.accuracy);
  };

  return (
    <div className="space-y-8">
      {/* Composite Score Weights Section */}
      <div className="space-y-2">
        <Label className="text-lg">Composite Score Weights for Best Model Selection</Label>
        <CardDescription>
          Adjust the importance of each metric in selecting the best model. The weights must sum to 100%.
        </CardDescription>
        {/* Weight Distribution Bar (read-only, with tooltip) */}
        <TooltipProvider>
          <div className="w-full h-5 rounded overflow-hidden flex mb-2 border border-slate-200">
            {barSegments.map(seg => (
              <Tooltip key={seg.label}>
                <TooltipTrigger asChild>
                  <div
                    style={{ width: `${seg.value}%`, background: seg.color, cursor: 'pointer' }}
                    className="h-full flex items-center justify-center text-xs text-white font-bold relative"
                  >
                    {seg.value >= MIN_LABEL_PERCENT ? `${seg.label} ${seg.value}%` : ''}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" align="center">
                  {seg.label}: {seg.value}%
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
        {/* Legend below the bar */}
        <div className="flex flex-wrap gap-4 mb-4">
          {barSegments.map(seg => (
            <div key={seg.label} className="flex items-center gap-1 text-sm">
              <span style={{ background: seg.color, width: 12, height: 12, borderRadius: '50%', display: 'inline-block' }}></span>
              <span>{seg.label}: {seg.value}%</span>
            </div>
          ))}
        </div>
        {/* Numeric Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div>
            <Label htmlFor="mape-weight">MAPE Weight</Label>
            <Input
              id="mape-weight"
              type="number"
              min={0}
              max={100}
              value={editMape}
              onChange={e => setEditMape(Math.max(0, Math.min(100, Number(e.target.value))))}
              className="w-24"
            />
          </div>
          <div>
            <Label htmlFor="rmse-weight">RMSE Weight</Label>
            <Input
              id="rmse-weight"
              type="number"
              min={0}
              max={100}
              value={editRmse}
              onChange={e => setEditRmse(Math.max(0, Math.min(100, Number(e.target.value))))}
              className="w-24"
            />
          </div>
          <div>
            <Label htmlFor="mae-weight">MAE Weight</Label>
            <Input
              id="mae-weight"
              type="number"
              min={0}
              max={100}
              value={editMae}
              onChange={e => setEditMae(Math.max(0, Math.min(100, Number(e.target.value))))}
              className="w-24"
            />
          </div>
          <div>
            <Label htmlFor="accuracy-weight">Accuracy Weight</Label>
            <Input
              id="accuracy-weight"
              type="number"
              min={0}
              max={100}
              value={editAccuracy}
              onChange={e => setEditAccuracy(Math.max(0, Math.min(100, Number(e.target.value))))}
              className="w-24"
            />
          </div>
        </div>
        <div className="mt-2 text-sm font-semibold" style={{ color: isValid ? '#059669' : '#e11d48' }}>
          Total: {total}% {isValid ? '' : ' (Weights must sum to 100%)'}
        </div>
        <button
          className={`mt-2 px-4 py-2 rounded text-white font-bold ${canSave ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}
          onClick={handleSave}
          disabled={!canSave}
        >
          Save Weights
        </button>
        <button
          className={`mt-2 ml-4 px-4 py-2 rounded text-blue-700 font-bold border border-blue-600 bg-white hover:bg-blue-50 ${isDefault ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={handleReset}
          type="button"
          disabled={isDefault}
        >
          Reset to Default
        </button>
      </div>

      {/* AI Features (Grok API) */}
      <div className="space-y-2">
        <Label htmlFor="ai-enabled" className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5" />
          AI Features (Grok API)
        </Label>
        <div className="flex items-center space-x-2">
          <Switch
            id="ai-enabled"
            checked={aiFeaturesEnabled}
            onCheckedChange={setAIEnabled}
          />
          <span className="text-sm text-slate-600">
            {aiFeaturesEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <p className="text-sm text-slate-500">
          Enable advanced AI features powered by the Grok API, including model optimization and business context-aware recommendations.
        </p>
      </div>

      {/* AI CSV Import Wizard (sub-toggle, only visible if AI Features is enabled) */}
      {aiFeaturesEnabled && (
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

          {aiCsvImportEnabled && (
            <div className="pl-6 border-l-2 border-slate-200 mt-4 space-y-4 pt-4">
              {/* AI Reasoning (nested) */}
              <div className="space-y-2">
                <Label htmlFor="ai-reasoning-switch" className="flex items-center gap-2 font-semibold">
                  <Sparkles className="h-5 w-5" />
                  Enable AI Reasoning
                </Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="ai-reasoning-switch"
                    checked={aiReasoningEnabled}
                    onCheckedChange={setAiReasoningEnabled}
                    disabled={!aiCsvImportEnabled || !aiFeaturesEnabled}
                  />
                  <span className="text-sm text-muted-foreground">
                    {aiReasoningEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  When enabled, the AI will provide a detailed explanation of the transformations it applied. Disabling this can reduce API costs.
                </p>
              </div>

              {/* Large File Processing (nested) */}
              <div className="space-y-2">
                <Label htmlFor="large-file-processing-enabled" className="flex items-center gap-2 font-semibold">
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
                <div className="flex items-center space-x-2 mt-2">
                  <Label htmlFor="large-file-threshold" className="text-sm">Large File Threshold</Label>
                  <Input
                    id="large-file-threshold"
                    type="number"
                    min={100}
                    max={10240}
                    step={100}
                    value={Math.round(largeFileThreshold / 1024)}
                    onChange={e => setLargeFileThreshold(Number(e.target.value) * 1024)}
                    className="w-24"
                  />
                  <span className="text-xs text-slate-500">KB</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Model Optimization (sub-toggle, only visible if AI Features is enabled) */}
      {aiFeaturesEnabled && (
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
          
          {/* AI Failure Threshold & Business Context */}
          <div className="pl-6 border-l-2 border-slate-200 mt-4 space-y-4 pt-4">
            {/* AI Failure Threshold Setting */}
            <div className="space-y-2">
              <Label htmlFor="ai-failure-threshold" className="text-sm font-semibold">AI Failure Threshold</Label>
              <div className="flex items-center space-x-2">
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
            </div>

            {/* AI Model Optimization Context (only visible if AI Model Optimization is enabled) */}
            {aiForecastModelOptimizationEnabled && (
              <div className="space-y-2">
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

      {/* CSV Separator (always visible) */}
      <div className="space-y-2">
        <Label htmlFor="csv-separator" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          CSV Separator
        </Label>
        <Select value={fallbackSeparator} onValueChange={globalSettings.setCsvSeparator}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value=",">Comma (,)</SelectItem>
            <SelectItem value=";">Semicolon (;)</SelectItem>
            <SelectItem value="\t">Tab</SelectItem>
            <SelectItem value="|">Pipe (|)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-slate-500">
          Default separator for CSV import/export. Auto-detect will override this for import if possible.
        </p>
      </div>
    </div>
  );
};
