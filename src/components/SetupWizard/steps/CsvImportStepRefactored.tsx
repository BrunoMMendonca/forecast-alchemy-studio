import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Alert, AlertDescription } from '../../ui/alert';
import { AlertTriangle, Info, Upload } from 'lucide-react';
import { CsvImportWizard } from '../../CsvImportWizard';
import { useSetupWizardStoreRefactored } from '../../../store/setupWizardStoreRefactored';
import { importStrategyManager } from '../../../strategies/ImportStrategy';
import { setupWizardConfigManager } from '../../../config/SetupWizardConfig';

interface CsvImportStepRefactoredProps {
  onComplete?: () => void;
}

export const CsvImportStepRefactored: React.FC<CsvImportStepRefactoredProps> = ({
  onComplete
}) => {
  const {
    businessConfig,
    csvImportData,
    extractedDivisions,
    extractedClusters,
    lifecycleMappings,
    multipleCsvImport,
    importCsvData,
    processCsvData,
    nextStep,
    canProceedToNext
  } = useSetupWizardStoreRefactored();

  const [isProcessing, setIsProcessing] = useState(false);

  // Get import behavior from strategy manager
  const importBehavior = importStrategyManager.getImportBehavior({
    importLevel: businessConfig.importLevel,
    hasMultipleDivisions: businessConfig.hasMultipleDivisions,
    hasMultipleClusters: businessConfig.hasMultipleClusters,
    csvData: csvImportData,
    existingData: csvImportData
  });

  // Check if we have imported data
  const hasImportedFile = () => {
    return csvImportData || 
           extractedDivisions.length > 0 || 
           extractedClusters.length > 0 ||
           lifecycleMappings.length > 0 ||
           multipleCsvImport.importedCsvs.length > 0;
  };

  // Check if import should be disabled
  const shouldDisableImport = () => {
    return importBehavior.isDropzoneDisabled;
  };

  // Handle CSV import completion
  const handleCsvImportComplete = async (data: any) => {
    setIsProcessing(true);
    try {
      // Use strategy manager to process the import
      const importContext = {
        importLevel: businessConfig.importLevel,
        hasMultipleDivisions: businessConfig.hasMultipleDivisions,
        hasMultipleClusters: businessConfig.hasMultipleClusters,
        csvData: data,
        existingData: csvImportData
      };

      const result = importStrategyManager.processImport(importContext);

      if (result.success) {
        // Import the CSV data
        importCsvData(data, businessConfig.importLevel);
        
        // Process the extracted data
        if (data.extractedData) {
          processCsvData(data.extractedData);
        }

        console.log('[CsvImportStepRefactored] CSV import completed successfully');
      } else {
        console.error('[CsvImportStepRefactored] CSV import failed:', result.errors);
      }
    } catch (error) {
      console.error('[CsvImportStepRefactored] Error processing CSV import:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle skip CSV import
  const handleSkipCsvImport = () => {
    console.log('[CsvImportStepRefactored] Skipping CSV import');
    // Move to next step
    nextStep();
  };

  // Get current step configuration
  const currentStep = setupWizardConfigManager.getWorkflowStep('csv-import');
  const config = setupWizardConfigManager.getConfig();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">{currentStep?.title || 'CSV Import & Mapping'}</h2>
        <p className="text-gray-600 mt-2">
          {currentStep?.description || 'Upload and map your CSV data'}
        </p>
      </div>

      {/* Import Level Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Import Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              <strong>Import Level:</strong> {businessConfig.importLevel === 'company' ? 'Company-wide' : 'Division-specific'}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Multiple Divisions:</strong> {businessConfig.hasMultipleDivisions ? 'Yes' : 'No'}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Multiple Clusters:</strong> {businessConfig.hasMultipleClusters ? 'Yes' : 'No'}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Lifecycle Tracking:</strong> {businessConfig.enableLifecycleTracking ? 'Enabled' : 'Disabled'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* File Already Imported Alert */}
      {hasImportedFile() && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4" style={{ color: '#dc2626' }} />
          <AlertDescription className="text-orange-800">
            File already imported: {csvImportData?.fileName || 'CSV data'}. 
            {importBehavior.dataClearingPolicy.length > 0 && (
              <span>
                {' '}Delete the file to import a new one.
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* CSV Import Wizard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            CSV Import
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CsvImportWizard
            context="setup"
            onDataReady={() => {}}
            onConfirm={handleCsvImportComplete}
            onAIFailure={(error) => console.error('AI failure:', error)}
            onSetupDataReady={handleCsvImportComplete}
            disableImport={shouldDisableImport()}
          />
        </CardContent>
      </Card>

      {/* Skip Button */}
      <Card>
        <CardHeader>
          <CardTitle>Skip CSV Import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              {importBehavior.skipButtonDescription}
            </p>
            <Button
              variant="outline"
              onClick={handleSkipCsvImport}
              disabled={importBehavior.isSkipButtonDisabled}
              className={importBehavior.isSkipButtonDisabled ? 'opacity-50 cursor-not-allowed' : ''}
            >
              {importBehavior.skipButtonText}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Import Status */}
      {hasImportedFile() && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800">Import Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-green-700">
              {csvImportData && (
                <p><strong>File:</strong> {csvImportData.fileName}</p>
              )}
              {extractedDivisions.length > 0 && (
                <p><strong>Divisions Found:</strong> {extractedDivisions.length}</p>
              )}
              {extractedClusters.length > 0 && (
                <p><strong>Clusters Found:</strong> {extractedClusters.length}</p>
              )}
              {lifecycleMappings.length > 0 && (
                <p><strong>Lifecycle Mappings:</strong> {lifecycleMappings.length}</p>
              )}
              {multipleCsvImport.importedCsvs.length > 0 && (
                <p><strong>Multiple CSV Files:</strong> {multipleCsvImport.importedCsvs.length}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => {}}>
          Previous
        </Button>
        <Button 
          onClick={onComplete || nextStep}
          disabled={!canProceedToNext || isProcessing}
        >
          {isProcessing ? 'Processing...' : 'Next Step'}
        </Button>
      </div>

      {/* Strategy Information (Debug) */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-800 text-sm">Strategy Debug Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-xs text-blue-700">
              <p><strong>Strategy:</strong> {importBehavior.skipButtonText}</p>
              <p><strong>Dropzone Disabled:</strong> {importBehavior.isDropzoneDisabled ? 'Yes' : 'No'}</p>
              <p><strong>Skip Button Disabled:</strong> {importBehavior.isSkipButtonDisabled ? 'Yes' : 'No'}</p>
              <p><strong>Show Replacement Dialog:</strong> {importBehavior.shouldShowReplacementDialog ? 'Yes' : 'No'}</p>
              <p><strong>Clear Existing Data:</strong> {importBehavior.shouldClearExistingData ? 'Yes' : 'No'}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}; 