
import React from 'react';
import { Upload, BarChart3, Zap, TrendingUp, Eye, LucideProps } from 'lucide-react';

interface Step {
  id: string;
  title: string;
  icon: React.ComponentType<LucideProps>;
}

interface StepNavigationProps {
  currentStep: number;
  salesDataLength: number;
  forecastResultsLength: number;
  onStepClick: (stepIndex: number) => void;
}

const steps: Step[] = [
  { id: 'upload', title: 'Upload Data', icon: Upload },
  { id: 'visualize', title: 'Visualize', icon: BarChart3 },
  { id: 'clean', title: 'Clean Data', icon: Zap },
  { id: 'forecast', title: 'Generate Forecasts', icon: TrendingUp },
  { id: 'finalize', title: 'Finalize & Export', icon: Eye },
];

export const StepNavigation: React.FC<StepNavigationProps> = ({
  currentStep,
  salesDataLength,
  forecastResultsLength,
  onStepClick
}) => {
  const handleStepClick = (stepIndex: number) => {
    // Allow navigation to any step if data is uploaded
    if (stepIndex === 0 || salesDataLength > 0) {
      // Don't allow finalization step without forecasts
      if (stepIndex === 4 && forecastResultsLength === 0) return;
      onStepClick(stepIndex);
    }
  };

  return (
    <div className="flex justify-center mb-8">
      <div className="flex space-x-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index <= currentStep;
          const isCurrent = index === currentStep;
          const isClickable = index === 0 || salesDataLength > 0;
          
          return (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => handleStepClick(index)}
                disabled={!isClickable}
                className={`
                  flex items-center gap-2 transition-all duration-300
                  ${isClickable ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed opacity-50'}
                `}
              >
                <div className={`
                  flex items-center justify-center w-12 h-12 rounded-full border-2
                  ${isActive 
                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg' 
                    : 'bg-white border-slate-300 text-slate-400'
                  }
                  ${isCurrent ? 'ring-4 ring-blue-200' : ''}
                `}>
                  <Icon size={20} />
                </div>
                <span className={`font-medium ${isActive ? 'text-slate-800' : 'text-slate-400'}`}>
                  {step.title}
                </span>
              </button>
              {index < steps.length - 1 && (
                <div className={`w-8 h-0.5 ml-4 ${index < currentStep ? 'bg-blue-600' : 'bg-slate-300'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
