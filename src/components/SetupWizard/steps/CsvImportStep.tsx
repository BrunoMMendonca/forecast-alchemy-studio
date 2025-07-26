import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Upload, FileText, Info, Settings, MapPin, SkipForward, AlertTriangle } from 'lucide-react';
import { useSetupWizardStore } from '@/store/setupWizardStore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CsvImportWizard } from '@/components/CsvImportWizard';

import { useToast } from '@/hooks/use-toast';

interface CsvImportStepProps {
  onNext?: () => void;
  onBack?: () => void;
  // Props passed from SetupWizard
  orgStructure?: any;
  pendingDivisions?: any[];
  pendingClusters?: any[];
  setCurrentStep?: (step: number) => void;
  getStepIndexByTitle?: (title: string) => number;
  safeSetOrgStructure?: (structure: any) => void;
  safeSetNewDivision?: (division: any) => void;
  safeSetNewCluster?: (cluster: any) => void;
  safeClearPendingItems?: () => void;
  storeData?: any;
}

const CsvImportStep: React.FC<CsvImportStepProps> = ({ 
  onNext, 
  onBack,
  orgStructure: propOrgStructure,
  pendingDivisions: propPendingDivisions,
  pendingClusters: propPendingClusters,
  setCurrentStep,
  getStepIndexByTitle,
  safeSetOrgStructure,
  safeSetNewDivision,
  safeSetNewCluster,
  safeClearPendingItems,
  storeData
}) => {
  const { toast } = useToast();
  const { 
    orgStructure: storeOrgStructure, 
    fieldMappings, 
    storeCsvMappingData, 
    importSetupCsvData,
    setOrgStructure: setStoreOrgStructure,
    clearCsvMappingData,
    addPendingDivision,
    addPendingCluster
  } = useSetupWizardStore();
  
  // Use props if provided, otherwise use store values
  const orgStructure = propOrgStructure || storeOrgStructure;
  const pendingDivisions = propPendingDivisions || storeOrgStructure.pendingDivisions;
  const pendingClusters = propPendingClusters || storeOrgStructure.pendingClusters;
  
  const [csvImportComplete, setCsvImportComplete] = useState(false);

  // Check if CSV import can be skipped (only if mappings exist)
  const canSkipCsvImport = () => {
    // Check if there are existing field mappings
    const hasDatabaseMappings = fieldMappings && fieldMappings.length > 0;
    
    // Check if there are CSV mappings from previous imports
    const hasCsvMappings = orgStructure.csvImportData && 
                          orgStructure.csvImportData.columnMappings && 
                          orgStructure.csvImportData.columnMappings.length > 0;
    
    return hasDatabaseMappings || hasCsvMappings;
  };

  // Check if a file has been imported in company-wide context
  const hasImportedFile = () => {
    return orgStructure.csvImportData && 
           orgStructure.csvImportData.csvFileName && 
           orgStructure.csvImportData.data && 
           orgStructure.csvImportData.data.length > 0;
  };

  // Check if we should disable import functionality (company-wide context with file already imported)
  const shouldDisableImport = () => {
    return orgStructure.importLevel === 'company' && hasImportedFile();
  };

  // Function to handle next step navigation
  const handleNext = () => {
    if (onNext) {
      onNext();
    } else if (setCurrentStep && getStepIndexByTitle) {
      // Determine the next step based on organizational structure
      if (orgStructure.hasMultipleDivisions && !orgStructure.setupFlow?.skipDivisionStep) {
        const divisionsIndex = getStepIndexByTitle('Divisions');
        if (divisionsIndex !== -1) {
          setCurrentStep(divisionsIndex);
        }
      } else if (orgStructure.hasMultipleClusters && !orgStructure.setupFlow?.skipClusterStep) {
        const clustersIndex = getStepIndexByTitle('Clusters');
        if (clustersIndex !== -1) {
          setCurrentStep(clustersIndex);
        }
      } else if (orgStructure.enableLifecycleTracking) {
        const lifecycleIndex = getStepIndexByTitle('Product Life Cycle');
        if (lifecycleIndex !== -1) {
          setCurrentStep(lifecycleIndex);
        }
      } else {
        const sopIndex = getStepIndexByTitle('S&OP Cycles');
        if (sopIndex !== -1) {
          setCurrentStep(sopIndex);
        }
      }
    }
  };

  // Function to handle back step navigation
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (setCurrentStep) {
      setCurrentStep(Math.max(0, (setCurrentStep as any) - 1));
    }
  };

  // Helper function to get icon for column role (copied from MapStep)
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Material Code':
        return '🔢';
      case 'Description':
        return '📄';
      case 'Date':
        return '📅';
      case 'Division':
        return '🏢';
      case 'Cluster':
        return '📍';
      case 'Lifecycle Phase':
        return '❤️';
      case 'Ignore':
        return '❌';
      default:
        return 'Σ';
    }
  };

  // Function to display current mappings using the MapStep-style interface
  const renderCurrentMappings = () => {
    const csvImportData = orgStructure.csvImportData;
    const hasDatabaseMappings = fieldMappings && fieldMappings.length > 0;
    const hasCsvMappings = csvImportData && csvImportData.columnMappings && csvImportData.columnMappings.length > 0;

    if (!hasDatabaseMappings && !hasCsvMappings) {
      return (
        <div className="text-center py-8">
          <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Column Mappings Found
          </h3>
          <p className="text-gray-600 mb-4">
            No column mappings have been configured yet. You can upload a CSV file to configure mappings.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Database Field Mappings */}
        {hasDatabaseMappings && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Database Field Mappings
              </h3>
              <Badge variant="outline" className="text-sm">
                {fieldMappings.length} mappings configured
              </Badge>
            </div>
            
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium mb-3">Existing Field Mappings</h4>
              <div className="overflow-x-auto border rounded">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr>
                      <th className="px-2 py-1 bg-slate-100 border-b text-left">CSV Column</th>
                      <th className="px-2 py-1 bg-slate-100 border-b text-left">Mapped To</th>
                      <th className="px-2 py-1 bg-slate-100 border-b text-left">Field Type</th>
                      <th className="px-2 py-1 bg-slate-100 border-b text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {fieldMappings.map((mapping: any, index: number) => (
                      <tr key={`db-${index}`}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-700 font-mono">
                          {mapping.dataset_column || 'N/A'}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-700">
                          <span className="font-medium">{mapping.field_name}</span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-700">
                          <Badge variant="secondary" className="text-xs">
                            {mapping.field_type}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-700">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-green-700">Active</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CSV Column Mappings - Using MapStep-style interface */}
        {hasCsvMappings && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                CSV Column Mappings
              </h3>
              <Badge variant="outline" className="text-sm">
                {csvImportData.columnMappings.length} mappings configured
              </Badge>
            </div>
            
                         <div className="bg-white border border-gray-200 rounded-lg p-4">
               <h4 className="font-medium mb-3 text-gray-900">Imported File Mappings</h4>
              
              {/* Show sample data with mappings */}
              <div className="mb-2 text-sm text-blue-600 text-center">
                📊 Showing sample of {Math.min(csvImportData.data?.length || 0, 5)} rows from your dataset
                {csvImportData.data && csvImportData.data.length > 5 && (
                  <span className="block text-xs text-blue-500 mt-1">
                    (Total dataset has {csvImportData.data.length} rows)
                  </span>
                )}
              </div>
              
                             <div className="overflow-x-auto border rounded">
                 <table className="min-w-full text-sm">
                   <thead>
                     <tr>
                       {csvImportData.headers?.map((header: string, i: number) => {
                         const mapping = csvImportData.columnMappings?.find((m: any) => m.originalName === header);
                         return (
                           <th key={i} className="px-3 py-2 bg-slate-100 border-b min-w-[120px]">
                             <div className="font-medium text-slate-800 mb-1 break-words">
                               {header}
                             </div>
                             <div className="text-xs text-blue-700 font-medium">
                               {mapping ? (
                                 <div className="flex items-center gap-1 justify-center">
                                   <span>{getRoleIcon(mapping.role)}</span>
                                   <span className="text-center">{mapping.role}</span>
                                 </div>
                               ) : (
                                 <div className="text-center text-gray-500">
                                   ❌ Ignore
                                 </div>
                               )}
                             </div>
                           </th>
                         );
                       })}
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-200 bg-white">
                     {csvImportData.data?.slice(0, 5).map((row: any, rowIdx: number) => (
                       <tr key={rowIdx}>
                         {csvImportData.headers?.map((header: string, colIdx: number) => (
                           <td key={colIdx} className="px-3 py-2 text-sm text-slate-700 max-w-[200px]">
                             <div className="truncate" title={row[header] || ''}>
                               {row[header] || ''}
                             </div>
                           </td>
                         ))}
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>

            {/* CSV Configuration Details */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium mb-2 text-blue-900">CSV Configuration Details</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-blue-800">Date Format:</span>{' '}
                  <span className="text-blue-700">{csvImportData.dateFormat || 'Not specified'}</span>
                </div>
                <div>
                  <span className="font-medium text-blue-800">Number Format:</span>{' '}
                  <span className="text-blue-700">{csvImportData.numberFormat || 'Not specified'}</span>
                </div>
                <div>
                  <span className="font-medium text-blue-800">Separator:</span>{' '}
                  <span className="text-blue-700">{csvImportData.separator || 'Auto-detected'}</span>
                </div>
                <div>
                  <span className="font-medium text-blue-800">File Name:</span>{' '}
                  <span className="text-blue-700">{csvImportData.csvFileName || 'Unknown'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };



  // Handle CSV import completion
  const handleCsvImportComplete = async (result: any) => {
    console.log('CSV import completed:', result);
    setCsvImportComplete(true);
    
    // Store the mapping data for later use
    if (result.mappingData) {
      storeCsvMappingData(result.mappingData);
    }
    
    // Import the CSV data
    const importResult = await importSetupCsvData();
    if (importResult.success) {
      console.log('Setup CSV data imported successfully');
    } else {
      console.error('Failed to import setup CSV data:', importResult.error);
    }
  };

  // Handle setup data ready (for organizational structure extraction)
  const handleSetupDataReady = (divisions: string[], clusters: string[], divisionClusterMap?: Record<string, string[]>, lifecyclePhases?: string[], isSingleCsvReplacement?: boolean, csvFileName?: string) => {
    console.log('Setup data ready:', { divisions, clusters, divisionClusterMap, lifecyclePhases, isSingleCsvReplacement, csvFileName });
    
    // Convert lifecycle phases to the proper format for the store
    const lifecycleMappings = lifecyclePhases ? lifecyclePhases.map((phase, index) => ({
      id: `csv-${index}`,
      value: phase,
      phase: 'stable' as const, // Default to 'stable' phase, user can change in lifecycle step
      isCustom: false
    })) : [];
    
    console.log('🔍 [LIFECYCLE DEBUG] Converted lifecycle phases to mappings:', lifecycleMappings);
    
    // Update the org structure with extracted data
    const setOrgStructureFn = safeSetOrgStructure || setStoreOrgStructure;
    setOrgStructureFn({
      extractedDivisions: divisions,
      extractedClusters: clusters,
      divisionClusterMap: divisionClusterMap || {},
      lifecycleMappings: lifecycleMappings,
      isSingleCsvReplacement: isSingleCsvReplacement || false
    });

    // Add divisions to pending divisions
    divisions.forEach(divisionName => {
      const pendingDivision = {
        name: divisionName,
        description: `Created from CSV import: ${csvFileName || 'unknown file'}`,
        industry: '',
        fieldMapping: divisionName,
        sourceFile: csvFileName || 'unknown.csv'
      };
      addPendingDivision(pendingDivision);
    });

    // Add clusters to pending clusters with detailed logging
    console.log('🔍 [CLUSTER DEBUG] Starting cluster processing...');
    console.log('🔍 [CLUSTER DEBUG] Division cluster map:', divisionClusterMap);
    
    // Process clusters by division to handle duplicates across divisions
    if (divisionClusterMap) {
      let totalClustersProcessed = 0;
      const allClusters = new Set<string>();
      
      // Count total clusters across all divisions
      Object.values(divisionClusterMap).forEach(clusterList => {
        clusterList.forEach(cluster => allClusters.add(cluster));
      });
      
      console.log('🔍 [CLUSTER DEBUG] Total unique clusters to process:', allClusters.size);
      console.log('🔍 [CLUSTER DEBUG] All unique clusters:', Array.from(allClusters));
      
      // Process each division's clusters
      Object.entries(divisionClusterMap).forEach(([divisionName, clusterList]) => {
        console.log(`🔍 [CLUSTER DEBUG] Processing division "${divisionName}" with clusters:`, clusterList);
        
        clusterList.forEach((clusterName, index) => {
          totalClustersProcessed++;
          console.log(`🔍 [CLUSTER DEBUG] Processing cluster ${totalClustersProcessed}/${allClusters.size}: "${clusterName}" in division "${divisionName}"`);
          
          const fieldMapping = `${divisionName}_${clusterName}`;
          console.log(`🔍 [CLUSTER DEBUG] Generated field mapping: "${fieldMapping}"`);

          const pendingCluster = {
            name: clusterName,
            description: `Created from CSV import: ${csvFileName || 'unknown file'}`,
            divisionId: -1, // Will be resolved when divisions are created
            divisionName: divisionName,
            countryCode: '',
            region: '',
            fieldMapping: fieldMapping, // Make field mapping unique per division
            sourceFile: csvFileName || 'unknown.csv'
          };
          
          console.log(`🔍 [CLUSTER DEBUG] About to call addPendingCluster with:`, pendingCluster);
          addPendingCluster(pendingCluster);
          console.log(`🔍 [CLUSTER DEBUG] addPendingCluster called for "${clusterName}" in division "${divisionName}"`);
        });
      });
      
      console.log('🔍 [CLUSTER DEBUG] Finished processing all clusters across all divisions');
    } else {
      // Fallback to original logic if no division cluster map
      console.log('🔍 [CLUSTER DEBUG] No division cluster map, using original logic');
      console.log('🔍 [CLUSTER DEBUG] Total clusters to process:', clusters.length);
      
      clusters.forEach((clusterName, index) => {
        console.log(`🔍 [CLUSTER DEBUG] Processing cluster ${index + 1}/${clusters.length}: "${clusterName}"`);
        
        // Find which division this cluster belongs to
        let divisionName = 'Unknown Division';
        if (divisionClusterMap) {
          for (const [div, clusterList] of Object.entries(divisionClusterMap)) {
            if (clusterList.includes(clusterName)) {
              divisionName = div;
              break;
            }
          }
        }
        
        console.log(`🔍 [CLUSTER DEBUG] Cluster "${clusterName}" belongs to division: "${divisionName}"`);

        const fieldMapping = `${divisionName}_${clusterName}`;
        console.log(`🔍 [CLUSTER DEBUG] Generated field mapping: "${fieldMapping}"`);

        const pendingCluster = {
          name: clusterName,
          description: `Created from CSV import: ${csvFileName || 'unknown file'}`,
          divisionId: -1, // Will be resolved when divisions are created
          divisionName: divisionName,
          countryCode: '',
          region: '',
          fieldMapping: fieldMapping, // Make field mapping unique per division
          sourceFile: csvFileName || 'unknown.csv'
        };
        
        console.log(`🔍 [CLUSTER DEBUG] About to call addPendingCluster with:`, pendingCluster);
        addPendingCluster(pendingCluster);
        console.log(`🔍 [CLUSTER DEBUG] addPendingCluster called for "${clusterName}"`);
      });
      
      console.log('🔍 [CLUSTER DEBUG] Finished processing all clusters');
    }
  };

  // Handle proceeding to next step
  const handleProceedToNextStep = async () => {
    handleNext();
  };

  // Handle AI failure
  const handleAIFailure = (errorMessage: string) => {
    console.error('AI processing failed:', errorMessage);
    // You can show a toast or handle the error as needed
  };

  // Handle CSV data ready
  const handleDataReady = (result: any) => {
    console.log('CSV data ready:', result);
  };

  // Handle CSV confirmation
  const handleConfirm = async (result: any) => {
    console.log('CSV confirmed:', result);
    return Promise.resolve();
  };
  
  return (
    <div className="max-w-6xl mx-auto">
      <Card className="border-0 shadow-lg relative">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Upload className="h-6 w-6 text-blue-600" />
            CSV Import & Mapping
          </CardTitle>
          <p className="text-gray-600 dark:text-gray-400">
            Upload a CSV file to extract organizational structure and configure column mappings for your setup.
          </p>
        </CardHeader>
        <CardContent>
          {/* Information Alert - Context first */}
          <Alert className="mb-6">
            {shouldDisableImport() ? (
              <AlertTriangle className="h-4 w-4" style={{ color: '#dc2626' }} />
            ) : (
              <Info className="h-4 w-4" />
            )}
            <AlertDescription>
              {shouldDisableImport() ? (
                <>
                  <strong>File already imported:</strong> {orgStructure.csvImportData?.csvFileName}. Delete the file to import a new one.
                </>
              ) : (
                <>
                  <strong>CSV Import Process:</strong> The CSV import wizard will help you upload a file, configure column mappings, and extract organizational structure data for your setup.
                </>
              )}
            </AlertDescription>
          </Alert>

          {/* Skip Option - Early escape */}
          <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Skip CSV Import</h4>
                <p className="text-sm text-gray-600">
                  {canSkipCsvImport() 
                    ? "You can skip CSV import and manually create divisions and clusters in the following steps."
                    : "You need to import a CSV file to configure column mappings before you can proceed."
                  }
                </p>
              </div>
              <Button 
                variant="outline"
                onClick={handleNext}
                disabled={!canSkipCsvImport() || shouldDisableImport()}
                className={!canSkipCsvImport() || shouldDisableImport() ? "opacity-50 cursor-not-allowed" : ""}
              >
                <SkipForward className="h-4 w-4 mr-2" />
                Skip CSV Import
              </Button>
            </div>
            {!canSkipCsvImport() && !shouldDisableImport() && (
              <div className="mt-2 text-sm text-amber-600">
                <Info className="h-4 w-4 inline mr-1" />
                No column mappings found. Please import a CSV file to configure mappings first.
              </div>
            )}
          </div>

          {/* Current Mappings Display - Show existing state */}
          {renderCurrentMappings()}

          {/* CSV Import Wizard - Main functionality last */}
          <div className="mb-6">
            <CsvImportWizard
              onDataReady={handleDataReady}
              onConfirm={handleConfirm}
              onAIFailure={handleAIFailure}
              context="setup"
              onSetupDataReady={handleSetupDataReady}
              onProceedToNextStep={handleProceedToNextStep}
              disableImport={shouldDisableImport()}
            />
          </div>

          {csvImportComplete && (
            <Alert className="mb-6 border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>CSV Import Complete!</strong> Your data has been successfully imported and processed.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}; 

export default CsvImportStep; 