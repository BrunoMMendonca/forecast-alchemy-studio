import React from 'react';
import { Upload, BarChart3, TrendingUp, Eye } from 'lucide-react';
import { Icon as LucideIcon } from 'lucide-react';
import { broom } from '@lucide/lab';
import { cn } from '@/lib/utils';
import { useLocation } from 'react-router-dom';

interface Step {
  name: string;
  description: string;
  icon: React.FC<any>;
}

interface StepNavigationProps {
  currentStep: number;
  onStepClick: (stepIndex: number) => void;
  uploadSummary: { skuCount: number; dateRange: [string, string]; totalPeriods: number } | null;
  forecastResultsLength: number;
}

const steps: Step[] = [
  { name: 'Upload', description: 'Upload your data', icon: Upload },
  { name: 'Clean & Prepare', description: 'Clean and prepare your data', icon: (props) => <LucideIcon iconNode={broom} {...props} /> },
  { name: 'Explore', description: 'Explore your data', icon: BarChart3 },
  { name: 'Forecast', description: 'Generate a forecast', icon: TrendingUp },
  { name: 'Review', description: 'Review your forecast', icon: Eye },
];

export const StepNavigation: React.FC<StepNavigationProps> = ({
  currentStep,
  onStepClick,
  uploadSummary,
  forecastResultsLength,
}) => {
  const location = useLocation();

  if (location.pathname !== '/forecast') {
    return null;
  }

  const isStepDisabled = (stepIndex: number): boolean => {
    if (stepIndex === 0) return false; // Always allow going back to Upload
    const hasData = uploadSummary && uploadSummary.skuCount > 0;
    if (stepIndex > 0 && !hasData) return true;
    // Disable forecast/review if no data
    if (stepIndex >= 3 && !hasData) return true;
    // Disable review if no forecast results
    if (stepIndex === 4 && forecastResultsLength === 0) return true;

    return false;
  };

  const isStepCompleted = (stepIndex: number): boolean => {
    if (stepIndex < currentStep) return true;
    const hasData = uploadSummary && uploadSummary.skuCount > 0;
    if (stepIndex === 0 && hasData) return true;
    if (stepIndex === 1 && hasData) return true; // Assuming cleaning is implicit for now
    if (stepIndex === 2 && hasData) return true;
    if (stepIndex === 3 && forecastResultsLength > 0) return true;
    return false;
  };

  return (
    <div className="flex justify-center mb-8">
      <div className="flex space-x-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isCurrent = index === currentStep;
          const isCompleted = isStepCompleted(index);
          const isClickable = !isStepDisabled(index);
          
          return (
            <div key={step.name} className="flex items-center">
              <button
                onClick={() => isClickable && onStepClick(index)}
                disabled={!isClickable}
                className={`
                  flex items-center gap-2 transition-all duration-300
                  ${isClickable ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed opacity-50'}
                `}
              >
                <div className={cn(
                  'flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all',
                  isCurrent 
                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg ring-4 ring-blue-200' 
                    : isCompleted
                      ? 'bg-white border-blue-600 text-blue-600'
                      : 'bg-white border-slate-300 text-slate-400'
                )}>
                  <Icon size={20} />
                </div>
                <span className={cn(
                  'font-medium transition-all',
                  isCurrent || isCompleted ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'
                )}>
                  {step.name}
                </span>
              </button>
              {index < steps.length - 1 && (
                <div className={cn(
                  'w-8 h-0.5 ml-4 transition-all',
                  isCompleted ? 'bg-blue-600' : 'bg-slate-300'
                )} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
