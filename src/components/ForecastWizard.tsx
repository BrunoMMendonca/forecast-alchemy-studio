import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import { ReviewTuneStep } from './forecast-wizard/ReviewTuneStep';
import { FinalizeStep } from './forecast-wizard/FinalizeStep';
import { useForecastWizardStore } from '@/store/forecastWizardStore';

interface ForecastWizardProps {
  data: any[];
  forecastPeriods: number;
  onForecastGeneration: (results: any[], selectedSKU: string) => void;
  businessContext?: any;
  aiForecastModelOptimizationEnabled: boolean;
  isOptimizing?: boolean;
  batchId?: string | null;
  models: any[];
  updateModel: (modelId: string, updates: any) => void;
  processedDataInfo?: any;
  datasetId?: number;
  setForecastResults: (results: any[]) => void;
}

export const ForecastWizard: React.FC<ForecastWizardProps> = ({
  data,
  forecastPeriods,
  onForecastGeneration,
  businessContext,
  aiForecastModelOptimizationEnabled,
  isOptimizing,
  batchId,
  models,
  updateModel,
  processedDataInfo,
  datasetId,
  setForecastResults
}) => {
  const { currentStep, setCurrentStep, isStepComplete } = useForecastWizardStore();
  
  const steps = [
    { id: 'review', title: 'Review & Tune', description: 'Review optimization results and fine-tune parameters' },
    { id: 'finalize', title: 'Finalize Forecast', description: 'Make manual adjustments and finalize the forecast' }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinalize = () => {
    // TODO: Implement finalization logic
    console.log('Finalizing forecast...');
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <ReviewTuneStep
            data={data}
            models={models}
            updateModel={updateModel}
            aiForecastModelOptimizationEnabled={aiForecastModelOptimizationEnabled}
            isOptimizing={isOptimizing}
            processedDataInfo={processedDataInfo}
            datasetId={datasetId}
          />
        );
      case 1:
        return (
          <FinalizeStep
            data={data}
            forecastPeriods={forecastPeriods}
            onForecastGeneration={onForecastGeneration}
            setForecastResults={setForecastResults}
            processedDataInfo={processedDataInfo}
            datasetId={datasetId}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          Forecast Wizard
        </CardTitle>
        <CardDescription>
          Step-by-step forecast generation with parameter tuning and manual adjustments.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step Navigation */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center gap-2">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  index === currentStep 
                    ? 'border-blue-500 bg-blue-500 text-white' 
                    : index < currentStep 
                    ? 'border-green-500 bg-green-500 text-white'
                    : 'border-gray-300 bg-gray-100 text-gray-500'
                }`}>
                  {index < currentStep ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                <div className="hidden sm:block">
                  <div className="text-sm font-medium">{step.title}</div>
                  <div className="text-xs text-gray-500">{step.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          {renderStepContent()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            {currentStep === steps.length - 1 ? (
              <Button
                onClick={handleFinalize}
                className="flex items-center gap-2"
                disabled={!isStepComplete(currentStep)}
              >
                Finalize Forecast
                <CheckCircle className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!isStepComplete(currentStep)}
                className="flex items-center gap-2"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}; 