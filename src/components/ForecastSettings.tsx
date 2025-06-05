
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Brain, Target, Clock, BarChart3 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BusinessContext, BUSINESS_CONTEXT_OPTIONS } from '@/types/businessContext';

interface ForecastSettingsProps {
  forecastPeriods: number;
  setForecastPeriods: (periods: number) => void;
  businessContext: BusinessContext;
  setBusinessContext: (context: BusinessContext) => void;
}

export const ForecastSettings: React.FC<ForecastSettingsProps> = ({
  forecastPeriods,
  setForecastPeriods,
  businessContext,
  setBusinessContext
}) => {
  const updateBusinessContext = (key: keyof BusinessContext, value: string) => {
    setBusinessContext({
      ...businessContext,
      [key]: value
    });
  };

  return (
    <TooltipProvider>
      <Card className="bg-white/90 backdrop-blur-sm border-blue-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-600" />
            Global Forecast Settings
          </CardTitle>
          <CardDescription>
            Configure global parameters that apply to all forecast models and AI optimization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Forecast Periods */}
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

          {/* Business Context */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-600" />
              AI Optimization Context
            </h3>
            <p className="text-sm text-slate-600">
              These parameters guide AI optimization decisions and model selection
            </p>

            {/* Cost of Error */}
            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label className="flex items-center gap-2 cursor-help">
                    <Target className="h-4 w-4" />
                    Cost of Forecast Error
                  </Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>How much business impact comes from forecast errors</p>
                </TooltipContent>
              </Tooltip>
              <Select
                value={businessContext.costOfError}
                onValueChange={(value) => updateBusinessContext('costOfError', value)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_CONTEXT_OPTIONS.costOfError.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-sm text-slate-500">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Forecast Horizon */}
            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label className="flex items-center gap-2 cursor-help">
                    <Clock className="h-4 w-4" />
                    Forecast Horizon
                  </Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>How far into the future you're planning</p>
                </TooltipContent>
              </Tooltip>
              <Select
                value={businessContext.forecastHorizon}
                onValueChange={(value) => updateBusinessContext('forecastHorizon', value)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_CONTEXT_OPTIONS.forecastHorizon.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-sm text-slate-500">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Update Frequency */}
            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label className="flex items-center gap-2 cursor-help">
                    <Settings className="h-4 w-4" />
                    Update Frequency
                  </Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>How often the forecast model will be updated</p>
                </TooltipContent>
              </Tooltip>
              <Select
                value={businessContext.updateFrequency}
                onValueChange={(value) => updateBusinessContext('updateFrequency', value)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_CONTEXT_OPTIONS.updateFrequency.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-sm text-slate-500">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Interpretability Needs */}
            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label className="flex items-center gap-2 cursor-help">
                    <Brain className="h-4 w-4" />
                    Interpretability Needs
                  </Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>How important it is to understand and explain model decisions</p>
                </TooltipContent>
              </Tooltip>
              <Select
                value={businessContext.interpretabilityNeeds}
                onValueChange={(value) => updateBusinessContext('interpretabilityNeeds', value)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_CONTEXT_OPTIONS.interpretabilityNeeds.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-sm text-slate-500">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};
