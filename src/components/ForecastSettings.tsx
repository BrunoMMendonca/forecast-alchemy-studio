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
  grokApiEnabled: boolean;
  setGrokApiEnabled: (enabled: boolean) => void;
}

export const ForecastSettings: React.FC<ForecastSettingsProps> = ({
  forecastPeriods,
  setForecastPeriods,
  businessContext,
  setBusinessContext,
  grokApiEnabled,
  setGrokApiEnabled
}) => {
  const { enabled: aiEnabled, setEnabled: setAIEnabled } = useAISettings({
    onSettingsChange: (enabled) => {
      // If AI Features is disabled, also disable AI Model Optimization
      if (!enabled) {
        setGrokApiEnabled(false);
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
              checked={grokApiEnabled}
              onCheckedChange={setGrokApiEnabled}
            />
            <span className="text-sm text-slate-600">
              {grokApiEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Use the Grok API to optimize model parameters for best forecast accuracy. When disabled, traditional grid search will be used.
          </p>

          {/* AI Model Optimization Context (only visible if AI Model Optimization is enabled) */}
          {grokApiEnabled && (
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
                disabled={!grokApiEnabled}
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
