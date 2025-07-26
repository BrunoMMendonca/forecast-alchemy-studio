import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Info, Edit3, Save } from 'lucide-react';
import { useSetupWizardStore } from '@/store/setupWizardStore';
import { InteractiveMappingTable } from '@/components/CsvImportWizard/InteractiveMappingTable';

interface CsvMappingReviewStepProps {
  onProceed: () => void;
  onBack: () => void;
  onSkip?: () => void;
}

const CsvMappingReviewStep: React.FC<CsvMappingReviewStepProps> = ({ onProceed, onBack, onSkip }) => {
  const { orgStructure, fieldMappings } = useSetupWizardStore();
  const { csvImportData, setupFlow } = orgStructure;
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedColumnRoles, setEditedColumnRoles] = useState<string[]>([]);

  if (!csvImportData) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No CSV mapping data found. Please upload a CSV file first.
          </AlertDescription>
        </Alert>
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  const {
    headers,
    columnMappings,
    finalColumnRoles,
    csvFileName,
    dateFormat,
    numberFormat,
    separator
  } = csvImportData;

  const hasExistingMappings = fieldMappings.length > 0;
  const isSkippable = setupFlow?.csvImportSkippable;

  // Initialize edited roles when entering edit mode
  React.useEffect(() => {
    if (isEditMode && csvImportData?.columnRoles) {
      setEditedColumnRoles([...csvImportData.columnRoles]);
    }
  }, [isEditMode, csvImportData?.columnRoles]);

  // Get available column roles for dropdown
  const dropdownOptions = useMemo(() => {
    const baseRoles = ['Material Code', 'Description', 'Date', 'Ignore'];
    
    if (orgStructure.hasMultipleDivisions && 
        (orgStructure.importLevel === 'company' || 
         (orgStructure.importLevel === 'division' && orgStructure.divisionCsvType === 'withDivisionColumn'))) {
      baseRoles.push('Division');
    }
    
    if (orgStructure.hasMultipleClusters) {
      baseRoles.push('Cluster');
    }
    
    if (orgStructure.enableLifecycleTracking) {
      baseRoles.push('Lifecycle Phase');
    }
    
    // Add dynamic roles from CSV headers
    const dynamicRoles = headers?.filter((h, i) => {
      if (baseRoles.includes(h)) return false;
      if (csvImportData?.columnRoles?.[i] === 'Date') return false;
      return true;
    }).map(h => ({ value: h, label: h })) || [];
    
    return [
      ...baseRoles.map(role => ({ value: role, label: role })),
      ...dynamicRoles
    ];
  }, [headers, orgStructure, csvImportData?.columnRoles]);

  // Handle role changes in edit mode
  const handleRoleChange = (colIdx: number, role: string) => {
    const newRoles = [...editedColumnRoles];
    newRoles[colIdx] = role;
    setEditedColumnRoles(newRoles);
  };

  // Save changes and exit edit mode
  const handleSaveChanges = () => {
    if (csvImportData) {
      // Update the CSV import data with new roles
      const updatedCsvImportData = {
        ...csvImportData,
        columnRoles: editedColumnRoles
      };
      useSetupWizardStore.getState().setOrgStructure({
        csvImportData: updatedCsvImportData
      });
    }
    setIsEditMode(false);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              CSV Mapping Review
            </CardTitle>
            <CardDescription>
              Review the column mappings that will be applied to your CSV data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File Information */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">File:</span> {csvFileName || 'Unknown'}
              </div>
              <div>
                <span className="font-medium">Columns:</span> {headers?.length || 0}
              </div>
              <div>
                <span className="font-medium">Date Format:</span> {dateFormat || 'Auto-detected'}
              </div>
              <div>
                <span className="font-medium">Separator:</span> {separator || ','}
              </div>
            </div>

            {/* Existing Mappings Warning */}
            {hasExistingMappings && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Existing field mappings found:</strong> You have {fieldMappings.length} field mapping(s) already configured. 
                  {isSkippable && ' You can skip this step if you want to use existing mappings.'}
                </AlertDescription>
              </Alert>
            )}

            {/* Interactive Column Mappings Table */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Column Mappings & Data Preview</h4>
                <div className="flex gap-2">
                  {!isEditMode ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditMode(true)}
                      className="flex items-center gap-2"
                    >
                      <Edit3 className="h-4 w-4" />
                      Edit Mappings
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsEditMode(false);
                          setEditedColumnRoles([...csvImportData.columnRoles]);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveChanges}
                        className="flex items-center gap-2"
                      >
                        <Save className="h-4 w-4" />
                        Save Changes
                      </Button>
                    </>
                  )}
                </div>
              </div>
              
              <InteractiveMappingTable
                headers={headers || []}
                rows={csvImportData?.data || []}
                columnRoles={isEditMode ? editedColumnRoles : csvImportData?.columnRoles || []}
                dropdownOptions={dropdownOptions}
                dateFormat={csvImportData?.dateFormat || 'dd/mm/yyyy'}
                context="setup"
                orgStructure={orgStructure}
                onRoleChange={isEditMode ? handleRoleChange : undefined}
                isReadOnly={!isEditMode}
                rowLimit={5}
                showSampleInfo={true}
              />
            </div>

            {/* Mapping Summary */}
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium mb-2">Mapping Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Mapped Columns:</span>{' '}
                  {(isEditMode ? editedColumnRoles : csvImportData?.columnRoles)?.filter(role => role && role !== 'Ignore').length || 0}
                </div>
                <div>
                  <span className="font-medium">Unmapped Columns:</span>{' '}
                  {(isEditMode ? editedColumnRoles : csvImportData?.columnRoles)?.filter(role => !role || role === 'Ignore').length || 0}
                </div>
                <div>
                  <span className="font-medium">Date Columns:</span>{' '}
                  {(isEditMode ? editedColumnRoles : csvImportData?.columnRoles)?.filter(role => role === 'Date').length || 0}
                </div>
                <div>
                  <span className="font-medium">Value Columns:</span>{' '}
                  {(isEditMode ? editedColumnRoles : csvImportData?.columnRoles)?.filter(role => role === 'Sales').length || 0}
                </div>
              </div>
              {isEditMode && (
                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                  💡 <strong>Edit Mode:</strong> You can now modify column mappings. Click "Save Changes" to apply your modifications.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <div className="flex gap-2">
          {isSkippable && hasExistingMappings && onSkip && (
            <Button variant="outline" onClick={onSkip}>
              Skip & Use Existing Mappings
            </Button>
          )}
          <Button onClick={onProceed}>
            {isSkippable && hasExistingMappings ? 'Apply New Mappings' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CsvMappingReviewStep; 