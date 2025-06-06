
import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, Target, TrendingUp, Settings } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BusinessContext, BUSINESS_CONTEXT_OPTIONS } from '@/types/businessContext';

interface BusinessContextSettingsProps {
  businessContext: BusinessContext;
  setBusinessContext: (context: BusinessContext) => void;
  disabled?: boolean;
}

export const BusinessContextSettings: React.FC<BusinessContextSettingsProps> = ({
  businessContext,
  setBusinessContext,
  disabled = false
}) => {
  const updateBusinessContext = (key: keyof BusinessContext, value: string) => {
    if (disabled) return;
    setBusinessContext({
      ...businessContext,
      [key]: value
    });
  };

  return (
    <TooltipProvider>
      <div className={`space-y-4 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
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
            disabled={disabled}
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

        {/* Planning Purpose */}
        <div className="space-y-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Label className="flex items-center gap-2 cursor-help">
                <TrendingUp className="h-4 w-4" />
                Planning Purpose
              </Label>
            </TooltipTrigger>
            <TooltipContent>
              <p>How you'll use these forecasts in your business planning</p>
            </TooltipContent>
          </Tooltip>
          <Select
            value={businessContext.planningPurpose}
            onValueChange={(value) => updateBusinessContext('planningPurpose', value)}
            disabled={disabled}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_CONTEXT_OPTIONS.planningPurpose.map((option) => (
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
            disabled={disabled}
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
            disabled={disabled}
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
    </TooltipProvider>
  );
};
