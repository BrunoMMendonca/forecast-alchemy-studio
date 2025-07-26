import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Badge } from '../../ui/badge';
import { Switch } from '../../ui/switch';
import { Building2, MapPin, Loader2, Package, Briefcase, FileSpreadsheet } from 'lucide-react';
import { useSetupWizardStoreRefactored } from '../../../store/setupWizardStoreRefactored';
import { setupWizardConfigManager } from '../../../config/SetupWizardConfig';
import { commandManager } from '../../../commands/SetupWizardCommands';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BusinessConfigurationStepRefactoredProps {
  onComplete?: () => void;
}

export const BusinessConfigurationStepRefactored: React.FC<BusinessConfigurationStepRefactoredProps> = ({
  onComplete
}) => {
  const {
    businessConfig,
    validationErrors,
    canProceedToNext,
    updateBusinessConfiguration,
    clearCsvData,
    undo,
    redo,
    canUndo,
    canRedo
  } = useSetupWizardStoreRefactored();

  const config = setupWizardConfigManager.getConfig();
  
  // State for confirmation dialog
  const [showClearCsvDialog, setShowClearCsvDialog] = useState(false);
  const [pendingChange, setPendingChange] = useState<{
    type: keyof typeof businessConfig;
    value: any;
  } | null>(null);

  // Get available import levels from configuration
  const availableImportLevels = config.importLevels;

  // Function to handle parameter changes with validation
  const handleParameterChange = (
    type: keyof typeof businessConfig,
    value: any
  ) => {
    // Check if we need to clear CSV data
    const hasImportedData = useSetupWizardStoreRefactored.getState().csvImportData ||
                           useSetupWizardStoreRefactored.getState().extractedDivisions.length > 0 ||
                           useSetupWizardStoreRefactored.getState().extractedClusters.length > 0 ||
                           useSetupWizardStoreRefactored.getState().lifecycleMappings.length > 0 ||
                           useSetupWizardStoreRefactored.getState().multipleCsvImport.importedCsvs.length > 0;

    if (hasImportedData) {
      // Show confirmation dialog
      setPendingChange({ type, value });
      setShowClearCsvDialog(true);
    } else {
      // No imported data, proceed with change
      executeParameterChange(type, value);
    }
  };

  // Execute the parameter change
  const executeParameterChange = (type: keyof typeof businessConfig, value: any) => {
    const newConfig = { ...businessConfig, [type]: value };
    updateBusinessConfiguration(newConfig);
  };

  // Handle confirmation dialog actions
  const handleConfirmClearCsv = () => {
    if (pendingChange) {
      // Clear CSV data first
      clearCsvData();
      // Then proceed with the parameter change
      executeParameterChange(pendingChange.type, pendingChange.value);
      setPendingChange(null);
    }
    setShowClearCsvDialog(false);
  };

  const handleCancelClearCsv = () => {
    setPendingChange(null);
    setShowClearCsvDialog(false);
  };

  // Get validation errors for this step
  const stepErrors = validationErrors.business || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Business Configuration</h2>
        <p className="text-gray-600 mt-2">
          Configure your organizational structure and import preferences
        </p>
      </div>

      {/* Configuration Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Organizational Structure */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organizational Structure
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Multiple Divisions */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="multiple-divisions">Multiple Divisions</Label>
                <p className="text-sm text-gray-500">
                  Do you have multiple divisions in your organization?
                </p>
              </div>
              <Switch
                id="multiple-divisions"
                checked={businessConfig.hasMultipleDivisions}
                onCheckedChange={(checked) => 
                  handleParameterChange('hasMultipleDivisions', checked)
                }
              />
            </div>

            {/* Multiple Clusters */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="multiple-clusters">Multiple Clusters</Label>
                <p className="text-sm text-gray-500">
                  Do you have multiple clusters within divisions?
                </p>
              </div>
              <Switch
                id="multiple-clusters"
                checked={businessConfig.hasMultipleClusters}
                onCheckedChange={(checked) => 
                  handleParameterChange('hasMultipleClusters', checked)
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Import Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Import Level */}
            <div className="space-y-2">
              <Label htmlFor="import-level">Import Level</Label>
              <Select
                value={businessConfig.importLevel}
                onValueChange={(value: 'company' | 'division') => 
                  handleParameterChange('importLevel', value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select import level" />
                </SelectTrigger>
                <SelectContent>
                  {availableImportLevels.map((level) => (
                    <SelectItem key={level.id} value={level.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{level.label}</span>
                        <span className="text-sm text-gray-500">{level.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lifecycle Tracking */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="lifecycle-tracking">Product Lifecycle Tracking</Label>
                <p className="text-sm text-gray-500">
                  Enable tracking of product lifecycle phases
                </p>
              </div>
              <Switch
                id="lifecycle-tracking"
                checked={businessConfig.enableLifecycleTracking}
                onCheckedChange={(checked) => 
                  handleParameterChange('enableLifecycleTracking', checked)
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Validation Errors */}
      {stepErrors.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <h4 className="font-medium text-red-800">Configuration Issues</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                {stepErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Command History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Command History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={undo}
              disabled={!canUndo}
            >
              Undo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={redo}
              disabled={!canRedo}
            >
              Redo
            </Button>
            <span className="text-sm text-gray-500">
              {commandManager.getUndoStackSize()} actions available to undo
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" disabled>
          Previous
        </Button>
        <Button 
          onClick={onComplete}
          disabled={!canProceedToNext}
        >
          Next Step
        </Button>
      </div>

      {/* Clear CSV Data Confirmation Dialog */}
      <AlertDialog open={showClearCsvDialog} onOpenChange={setShowClearCsvDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All CSV Import Data?</AlertDialogTitle>
            <AlertDialogDescription>
              Changing this business configuration will clear ALL your imported CSV data, including:
              <br />• CSV files and mappings
              <br />• Extracted divisions and clusters
              <br />• Lifecycle phase mappings
              <br />• Multiple CSV import progress
              <br /><br />
              You'll need to re-upload and re-configure all your CSV files to match the new configuration.
              <br /><br />
              Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelClearCsv}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClearCsv}>Clear All CSV Data</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}; 