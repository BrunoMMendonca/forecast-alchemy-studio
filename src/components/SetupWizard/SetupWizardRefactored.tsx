import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { CheckCircle, Circle, ArrowLeft, ArrowRight } from 'lucide-react';
import { useSetupWizardStoreRefactored } from '../../store/setupWizardStoreRefactored';
import { setupWizardConfigManager } from '../../config/SetupWizardConfig';
import { BusinessConfigurationStepRefactored } from './steps/BusinessConfigurationStepRefactored';
import { CsvImportStepRefactored } from './steps/CsvImportStepRefactored';
import { DivisionsStepRefactored } from './steps/DivisionsStepRefactored';
import { ClustersStepRefactored } from './steps/ClustersStepRefactored';
import { ProductLifecycleStepRefactored } from './steps/ProductLifecycleStepRefactored';

interface SetupWizardRefactoredProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

export const SetupWizardRefactored: React.FC<SetupWizardRefactoredProps> = ({
  onComplete,
  onCancel
}) => {
  const {
    currentState,
    previousState,
    canProceedToNext,
    canGoToPrevious,
    validationErrors,
    initialize,
    nextStep,
    previousStep,
    goToStep,
    reset
  } = useSetupWizardStoreRefactored();

  // Initialize the wizard on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Get workflow configuration
  const config = setupWizardConfigManager.getConfig();
  const visibleSteps = setupWizardConfigManager.getVisibleSteps();
  const currentStepIndex = visibleSteps.findIndex(step => step.id === currentState);

  // Calculate progress
  const progress = currentStepIndex >= 0 ? ((currentStepIndex + 1) / visibleSteps.length) * 100 : 0;

  // Handle step completion
  const handleStepComplete = () => {
    if (canProceedToNext) {
      nextStep();
    }
  };

  // Handle step navigation
  const handleStepNavigation = (stepId: string) => {
    goToStep(stepId);
  };

  // Handle wizard completion
  const handleWizardComplete = () => {
    if (onComplete) {
      onComplete();
    }
  };

  // Handle wizard cancellation
  const handleWizardCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  // Render step content based on current state
  const renderStepContent = () => {
    switch (currentState) {
      case 'business-configuration':
        return (
          <BusinessConfigurationStepRefactored
            onComplete={handleStepComplete}
          />
        );

      case 'csv-import':
        return (
          <CsvImportStepRefactored
            onComplete={handleStepComplete}
          />
        );

      case 'divisions':
        return (
          <DivisionsStepRefactored
            onComplete={handleStepComplete}
          />
        );

      case 'clusters':
        return (
          <ClustersStepRefactored
            onComplete={handleStepComplete}
          />
        );

      case 'product-lifecycle':
        return (
          <ProductLifecycleStepRefactored
            onComplete={handleStepComplete}
          />
        );

      case 'sop-cycles':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">SOP Cycles</h2>
              <p className="text-gray-600 mt-2">
                Configure Sales & Operations Planning cycles
              </p>
            </div>
            <Card>
              <CardContent className="pt-6">
                <p className="text-gray-600">
                  SOP cycles component will be implemented here.
                </p>
              </CardContent>
            </Card>
          </div>
        );

      case 'setup-complete':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">Setup Complete!</h2>
              <p className="text-gray-600 mt-2">
                Your setup is complete and ready to use.
              </p>
            </div>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                  <p className="text-gray-600">
                    All configuration steps have been completed successfully.
                  </p>
                  <Button onClick={handleWizardComplete}>
                    Start Using the Application
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'error':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-red-900">Setup Error</h2>
              <p className="text-red-600 mt-2">
                An error occurred during setup
              </p>
            </div>
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <p className="text-red-700">
                  Please try again or contact support if the problem persists.
                </p>
                <div className="mt-4 space-x-2">
                  <Button variant="outline" onClick={() => reset()}>
                    Reset Setup
                  </Button>
                  <Button variant="outline" onClick={handleWizardCancel}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">Loading...</h2>
              <p className="text-gray-600 mt-2">
                Initializing setup wizard
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Setup Wizard</h1>
        <p className="text-gray-600 mt-2">
          Configure your organization and import your data
        </p>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        </CardContent>
      </Card>

      {/* Step Navigation */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {visibleSteps.map((step, index) => {
              const isCurrentStep = step.id === currentState;
              const isCompleted = index < currentStepIndex;
              const isClickable = index <= currentStepIndex + 1; // Can navigate to current or next step

              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isCurrentStep
                      ? 'border-blue-500 bg-blue-50'
                      : isCompleted
                      ? 'border-green-200 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${!isClickable ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => isClickable && handleStepNavigation(step.id)}
                >
                  <div className="flex-shrink-0">
                    {isCompleted ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-medium ${
                      isCurrentStep ? 'text-blue-900' : 'text-gray-900'
                    }`}>
                      {step.title}
                    </h3>
                    <p className="text-sm text-gray-600">{step.description}</p>
                  </div>
                  {step.isRequired && (
                    <span className="text-xs text-red-500 font-medium">Required</span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Current Step Content */}
      <Card>
        <CardContent className="pt-6">
          {renderStepContent()}
        </CardContent>
      </Card>

      {/* Global Navigation */}
      {currentState !== 'setup-complete' && currentState !== 'error' && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={previousStep}
                  disabled={!canGoToPrevious}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={handleWizardCancel}
                >
                  Cancel Setup
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  onClick={nextStep}
                  disabled={!canProceedToNext}
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation Errors */}
      {Object.keys(validationErrors).length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Validation Issues</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.entries(validationErrors).map(([step, errors]) => (
              <div key={step} className="mb-4">
                <h4 className="font-medium text-red-800 capitalize">{step} Step</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Debug Information (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-800 text-sm">Debug Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-xs text-blue-700">
              <p><strong>Current State:</strong> {currentState}</p>
              <p><strong>Previous State:</strong> {previousState || 'None'}</p>
              <p><strong>Can Proceed:</strong> {canProceedToNext ? 'Yes' : 'No'}</p>
              <p><strong>Can Go Back:</strong> {canGoToPrevious ? 'Yes' : 'No'}</p>
              <p><strong>Step Index:</strong> {currentStepIndex}</p>
              <p><strong>Total Steps:</strong> {visibleSteps.length}</p>
              <p><strong>Progress:</strong> {Math.round(progress)}%</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}; 