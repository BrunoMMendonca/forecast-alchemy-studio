import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Progress } from '../ui/progress';
import { Switch } from '../ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { CheckCircle, Building2, MapPin, Calendar, Upload, ArrowRight, ArrowLeft, Loader2, LogOut, Search, Info, Landmark, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import countries from 'i18n-iso-countries';
import moment from 'moment-timezone';
import currencies from 'currency-codes';

// Register English locale for countries
import enLocale from 'i18n-iso-countries/langs/en.json';
countries.registerLocale(enLocale);

// Import the store and CSV import wizard
import { useSetupWizardStore } from '../../store/setupWizardStore';
import { CsvImportWizard } from '../CsvImportWizard';

// Import modular step components
import {
  CompanyStep,
  BusinessConfigurationStep,
  CsvImportStep,
  DivisionsStep,
  ClustersStep,
  ProductLifecycleStep,
  SopCyclesStep,
  ImportSetupDataStep,
  SetupCompleteStep
} from './steps';

const SetupWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [timezoneSearch, setTimezoneSearch] = useState('');
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [countryOpen, setCountryOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Use Zustand store with error handling
  let storeData: any = null;
  try {
    storeData = useSetupWizardStore();
  } catch (err) {
    console.error('Failed to load setup wizard store:', err);
    setError('Failed to load setup wizard. Please refresh the page.');
  }

  // If there's an error, show error UI
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-100">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <strong>Error:</strong> {error}
          </div>
          <Button 
            onClick={() => window.location.reload()} 
            className="bg-blue-600 hover:bg-blue-700"
          >
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }

  // If store is not available, show loading
  if (!storeData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-100">
        <div className="text-center">
          <Loader2 className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></Loader2>
          <p className="text-slate-600">Loading setup wizard...</p>
        </div>
      </div>
    );
  }

  const {
    // Data
    company,
    divisions,
    clusters,
    sopCycles,
    setupStatus,
    
    // Loading states
    isLoading,
    isLoadingCompany,
    isLoadingDivisions,
    isLoadingClusters,
    isLoadingSopCycles,
    
    // Form data
    companyForm,
    newDivision,
    newCluster,
    newSopCycle,
    sopCycleConfig,
    
    // Edit states
    editingDivision,
    editingCluster,
    editDivisionForm,
    editClusterForm,
    
    // Actions
    loadAllData,
    updateCompany,
    createDivision,
    createCluster,
    createSopCycle,
    updateDivision,
    updateCluster,
    completeSetup,
    createAllPendingItems,
    createFieldDefinitions,
    createFieldMappings,
    updatePendingDivision,
    updatePendingCluster,
    createSopCycleConfig,
    
    // Form setters
    setCompanyForm,
    setNewDivision,
    setNewCluster,
    setNewSopCycle,
    setEditDivisionForm,
    setEditClusterForm,
    
    // Edit state setters
    setEditingDivision,
    setEditingCluster,
    
    // Reset functions
    resetForms,
    resetEditStates,
    setOrgStructure,
    orgStructure,
    isUploadingCsv,
    uploadCsvFile,
    mapCsvColumns,
    extractedDivisions,
    extractedClusters,
    createDivisionsFromCsv,
    createClustersFromCsv,
    setCsvHeaders,
    csvHeaders,
    csvMapping,
    setCsvMapping,
    calculateSetupFlow,
    importSetupCsvData,
    clearCsvMappingData,
    
    // Multiple CSV import functions
    initializeMultipleCsvImport,
    addImportedCsv,
    getNextImportInfo,
    isMultipleCsvImportComplete,
    createFieldMapping,
    clearPendingItems,
    applyPendingChanges,
    loadDbDivisionsIntoPending,
    loadDbClustersIntoPending
  } = storeData || {};

  // Get pending divisions and clusters from orgStructure
  const pendingDivisions = orgStructure?.pendingDivisions || [];
  const pendingClusters = orgStructure?.pendingClusters || [];

  // Provide fallback functions if store functions are not available
  const safeLoadAllData = loadAllData || (() => Promise.resolve());

  const safeCreateDivision = createDivision || (() => Promise.resolve());
  const safeCreateCluster = createCluster || (() => Promise.resolve());
  const safeCreateSopCycle = createSopCycle || (() => Promise.resolve());
  const safeUpdateDivision = updateDivision || (() => Promise.resolve());
  const safeUpdateCluster = updateCluster || (() => Promise.resolve());
  const safeCompleteSetup = completeSetup || (() => Promise.resolve());
  const safeCreateAllPendingItems = createAllPendingItems || (() => Promise.resolve({ success: false, error: 'Function not available' }));
  const safeCreateFieldDefinitions = createFieldDefinitions || (() => Promise.resolve({ success: false, error: 'Function not available' }));
  const safeCreateFieldMappings = createFieldMappings || (() => Promise.resolve({ success: false, error: 'Function not available' }));
  const safeApplyPendingChanges = applyPendingChanges || (() => Promise.resolve({ success: false, error: 'Function not available' }));
  const safeUpdatePendingDivision = updatePendingDivision || (() => {});
  const safeUpdatePendingCluster = updatePendingCluster || (() => {});
  const safeCreateSopCycleConfig = createSopCycleConfig || (() => Promise.resolve({ success: false, error: 'Function not available' }));

  const safeSetCompanyForm = setCompanyForm || (() => {});
  const safeSetNewDivision = setNewDivision || (() => {});
  const safeSetNewCluster = setNewCluster || (() => {});
  const safeSetNewSopCycle = setNewSopCycle || (() => {});
  const safeSetEditDivisionForm = setEditDivisionForm || (() => {});
  const safeSetEditClusterForm = setEditClusterForm || (() => {});

  const safeSetEditingDivision = setEditingDivision || (() => {});

  const safeSetEditingCluster = setEditingCluster || (() => {});

  const safeResetForms = resetForms || (() => {});
  const safeResetEditStates = resetEditStates || (() => {});
  const safeSetOrgStructure = setOrgStructure || (() => {});
  const safeUploadCsvFile = uploadCsvFile || (() => {});
  const safeMapCsvColumns = mapCsvColumns || (() => {});
  const safeCreateDivisionsFromCsv = createDivisionsFromCsv || (() => {});
  const safeCreateClustersFromCsv = createClustersFromCsv || (() => {});
  const safeSetCsvHeaders = setCsvHeaders || (() => {});
  const safeSetCsvMapping = setCsvMapping || (() => {});
  const safeCalculateSetupFlow = calculateSetupFlow || (() => {});
  const safeImportSetupCsvData = importSetupCsvData || (() => Promise.resolve({ success: false, error: 'Function not available' }));
  const safeClearCsvMappingData = clearCsvMappingData || (() => {});
  const safeCreateFieldMapping = createFieldMapping || (() => Promise.resolve({ success: false, error: 'Function not available' }));
  
  // Safe multiple CSV import functions
  const safeInitializeMultipleCsvImport = initializeMultipleCsvImport || (() => {});
  const safeAddImportedCsv = addImportedCsv || (() => {});
  const safeGetNextImportInfo = getNextImportInfo || (() => ({ importedCount: 0, remainingDivisions: [] }));
  const safeIsMultipleCsvImportComplete = isMultipleCsvImportComplete || (() => false);
  
  // Safe clear pending items function
  const safeClearPendingItems = clearPendingItems || (() => {});

  // Handle complete setup with pending items creation
  const handleCompleteSetup = async () => {
    try {
      // Step 1: Create field definitions
      const fieldDefinitionResult = await safeCreateFieldDefinitions();
      if (!fieldDefinitionResult.success) {
        toast.error(fieldDefinitionResult.error || 'Failed to create field definitions');
        return;
      }
      
      // Step 2: Import CSV data if available
      if (orgStructure.csvImportData) {
        const importResult = await safeImportSetupCsvData();
        if (!importResult.success) {
          toast.error(importResult.error || 'Failed to import CSV data');
          return;
        }
      }
      
      // Step 3: Create field mappings
      const fieldMappingResult = await safeCreateFieldMappings();
      if (!fieldMappingResult.success) {
        toast.error(fieldMappingResult.error || 'Failed to create field mappings');
        return;
      }
      
      // Step 4: Create all pending divisions and clusters
      const pendingResult = await safeCreateAllPendingItems();
      if (!pendingResult.success) {
        toast.error(pendingResult.error || 'Failed to create pending divisions and clusters');
        return;
      }
      
      // Step 5: Apply any pending delete/restore operations
      const pendingChangesResult = await safeApplyPendingChanges();
      if (!pendingChangesResult.success) {
        toast.error(pendingChangesResult.error || 'Failed to apply pending changes');
        return;
      }
      
      // Step 6: Save S&OP configuration if it exists
      if (sopCycleConfig) {
        try {
          await safeCreateSopCycleConfig({
            ...sopCycleConfig,
            companyId: company?.id || 1,
            isActive: true,
            autoGenerate: true,
            generateFromDate: new Date().toISOString().split('T')[0],
            generateCount: 12 // Generate 12 cycles by default
          });
          toast.success('S&OP configuration saved successfully');
        } catch (error) {
          console.error('Error saving S&OP configuration:', error);
          toast.error('Failed to save S&OP configuration');
          return;
        }
      }
      
      // Step 7: Complete the setup
      await safeCompleteSetup();
    } catch (error) {
      console.error('Error completing setup:', error);
      toast.error('Failed to complete setup');
    }
  };

  // Handle updating pending division
  const handleUpdatePendingDivision = () => {
    if (editingDivision !== null) {
      safeUpdatePendingDivision(editingDivision, editDivisionForm);
      safeSetEditingDivision(null);
      safeSetEditDivisionForm({ name: '', description: '', industry: '', fieldMapping: '' });
      toast.success('Division updated successfully');
    }
  };

  // Handle updating pending cluster
  const handleUpdatePendingCluster = () => {
    if (editingCluster !== null) {
      safeUpdatePendingCluster(editingCluster, editClusterForm);
      safeSetEditingCluster(null);
      safeSetEditClusterForm({ name: '', description: '', countryCode: '', region: '', fieldMapping: '' });
      toast.success('Cluster updated successfully');
    }
  };

  // Helper functions to determine available import levels
  const getAvailableImportLevels = () => {
    const { hasMultipleDivisions } = orgStructure;
    
    const availableLevels = {
      company: true, // Company level is always available
      division: hasMultipleDivisions // Division level only if multiple divisions
    };
    
    return availableLevels;
  };

  const getImportLevelDisabledReason = (level: 'company' | 'division') => {
    const { hasMultipleDivisions } = orgStructure;
    
    switch (level) {
      case 'division':
        if (!hasMultipleDivisions) {
          return 'Enable "Multiple Divisions" to use division-level import';
        }
        break;
    }
    
    return null;
  };

  const handleImportLevelChange = (level: 'company' | 'division') => {
    const availableLevels = getAvailableImportLevels();
    
    // Only allow changing to available levels
    if (availableLevels[level]) {
      if (level === 'company') {
        // Clear multiple CSV import state when switching to company-level import
        safeSetOrgStructure({
          importLevel: level,
          divisionCsvType: null, // Clear division CSV type for company level
          multipleCsvImport: {
            isEnabled: false,
            importedCsvs: [],
            remainingDivisions: [],
          },
        });
      } else {
        // Division level - set default CSV type to "with division column" and enable multiple CSV import
        safeSetOrgStructure({ 
          importLevel: level,
          divisionCsvType: 'withDivisionColumn', // Default to CSV with division column
          multipleCsvImport: {
            isEnabled: true,
            importedCsvs: [],
            remainingDivisions: [],
          },
        });
      }
      setTimeout(() => safeCalculateSetupFlow(), 100);
    }
  };

  // Auto-select company level if current selection becomes invalid
  useEffect(() => {
    const availableLevels = getAvailableImportLevels();
    const currentLevel = orgStructure.importLevel;
    
    if (currentLevel && !availableLevels[currentLevel]) {
      console.log(`Auto-selecting company level because ${currentLevel} is no longer available`);
      safeSetOrgStructure({ importLevel: 'company' });
      setTimeout(() => safeCalculateSetupFlow(), 100);
    }
  }, [orgStructure.hasMultipleDivisions]);

  // Calculate dynamic steps based on setup flow
  const getSteps = () => {
    const baseSteps = [
      { title: 'Company', description: 'Edit company details' },
      { title: 'Business Configuration', description: 'Configure organizational structure and product lifecycle' }
    ];

    // console.log('[DEBUG] getSteps called with orgStructure:', orgStructure);

    // Special handling for division-level import without division column
    const isDivisionLevelWithoutColumn = orgStructure.importLevel === 'division' && 
                                       orgStructure.divisionCsvType === 'withoutDivisionColumn' &&
                                       orgStructure.hasMultipleClusters;

    // Special handling for division-level import without division column AND no clusters
    const isDivisionLevelWithoutColumnNoClusters = orgStructure.importLevel === 'division' && 
                                                  orgStructure.divisionCsvType === 'withoutDivisionColumn' &&
                                                  !orgStructure.hasMultipleClusters;

    // console.log('[DEBUG] isDivisionLevelWithoutColumn:', isDivisionLevelWithoutColumn);
    // console.log('[DEBUG] isDivisionLevelWithoutColumnNoClusters:', isDivisionLevelWithoutColumnNoClusters);

    if (isDivisionLevelWithoutColumn) {
      // Flow: Manual divisions first, then CSV import for clusters, then manual cluster editing
      baseSteps.push({ title: 'Divisions', description: 'Create business divisions' });
      baseSteps.push({ title: 'CSV Import', description: 'Upload cluster data for each division' });
      baseSteps.push({ title: 'Clusters', description: 'Edit clusters from CSV and add additional clusters' });
      // console.log('[DEBUG] ✅ Special flow: Divisions → CSV Import → Clusters (division-level without column)');
    } else if (isDivisionLevelWithoutColumnNoClusters) {
      // Flow: Manual divisions first, then CSV import for column mapping (before product lifecycle or S&OP)
      baseSteps.push({ title: 'Divisions', description: 'Create business divisions' });
      baseSteps.push({ title: 'CSV Import', description: 'Upload CSV for column mapping' });
      // console.log('[DEBUG] ✅ Special flow: Divisions → CSV Import (for column mapping)');
    } else {
      // Standard flow
      // Add CSV Import step if CSV upload is required
      if (orgStructure.setupFlow?.requiresCsvUpload) {
        baseSteps.push({ title: 'CSV Import', description: 'Upload and map organizational structure data' });
        // console.log('[DEBUG] ✅ CSV Import step added - requiresCsvUpload is true');
      } else {
        // console.log('[DEBUG] ❌ CSV Import step skipped - requiresCsvUpload is false');
      }

      // Add Divisions step if not skipped
      if (!orgStructure.setupFlow?.skipDivisionStep) {
        baseSteps.push({ title: 'Divisions', description: 'Create business divisions' });
      }

      // Add Clusters step if not skipped
      if (!orgStructure.setupFlow?.skipClusterStep) {
        baseSteps.push({ title: 'Clusters', description: 'Create business clusters' });
      }
    }

    // Add Product Life Cycle step if lifecycle tracking is enabled
    if (orgStructure.enableLifecycleTracking) {
      baseSteps.push({ title: 'Product Life Cycle', description: 'Configure lifecycle phase mappings' });
    }

    // Add S&OP Cycles step
    baseSteps.push({ title: 'S&OP Cycles', description: 'Create planning cycles' });

    // Add final step to ask about importing setup data
    if (orgStructure.csvImportData) {
      baseSteps.push({ title: 'Import Setup Data', description: 'Import your setup CSV as first dataset' });
    }

    // Always add the Setup Complete step
    baseSteps.push({ title: 'Setup Complete', description: 'Finish setup and start forecasting' });

    // console.log('[DEBUG] Final steps:', baseSteps.map(s => s.title));
    return baseSteps;
  };

  const steps = getSteps();

  useEffect(() => {
    // Load all data when component mounts
    console.log('[SetupWizard] Component mounted, calling safeLoadAllData');
    safeLoadAllData().then(() => {
      console.log('[SetupWizard] safeLoadAllData completed');
    }).catch((error) => {
      console.error('[SetupWizard] safeLoadAllData failed:', error);
    });
  }, [safeLoadAllData]);

  // Calculate setup flow after data loads
  useEffect(() => {
    if (company && !isLoading) {
      // Calculate setup flow after company data is loaded
      setTimeout(() => safeCalculateSetupFlow(), 100);
    }
  }, [company, isLoading]);

  // Update pending divisions when database divisions change (for name updates)
  useEffect(() => {
    if (divisions.length > 0 && pendingDivisions.length > 0) {
      console.log('[DEBUG] Updating pendingDivisions from database changes', { before: pendingDivisions });
      const updatedPendingDivs = pendingDivisions.map(pendingDiv => {
        // Only update if this is an existing division (has id and isExisting is true)
        if (pendingDiv.isExisting && pendingDiv.id) {
          const dbDivision = divisions.find(d => d.id === pendingDiv.id);
          if (dbDivision) {
            // Preserve all properties from pendingDiv, but update name/description from dbDivision
            return {
              ...pendingDiv,
              name: dbDivision.name,
              description: dbDivision.description || pendingDiv.description,
              // Ensure id and isExisting are preserved
              id: pendingDiv.id,
              isExisting: pendingDiv.isExisting
            };
          }
        }
        // For non-existing divisions or divisions without id, return as-is
        return pendingDiv;
      });
      console.log('[DEBUG] Updated pendingDivisions after db sync', { after: updatedPendingDivs });
      safeSetOrgStructure({ pendingDivisions: updatedPendingDivs });
    }
  }, [divisions]); // Only depend on divisions, not pendingDivisions

  // Populate pending clusters from database data if they're empty (only once during initialization)
  useEffect(() => {
    if (clusters.length > 0 && pendingClusters.length === 0) {
      // console.log('[DEBUG] Initial population of pendingClusters from database');
      const pendingClusts = clusters.map(cluster => ({
        name: cluster.name,
        description: cluster.description || '',
        divisionId: cluster.divisionId,
        fieldMapping: cluster.name,
        isExisting: true,
        id: cluster.id
      }));
      safeSetOrgStructure({ pendingClusters: pendingClusts });
    }
  }, [clusters]); // Removed pendingClusters.length dependency to prevent re-population

  // Debug: Log divisions and clusters when they change
  useEffect(() => {
    console.log('[DEBUG] Divisions updated:', divisions);
    console.log('[DEBUG] Clusters updated:', clusters);
  }, [divisions, clusters]);

  // Log pending arrays for debugging
  useEffect(() => {
    // console.log('[DEBUG] pendingDivisions:', pendingDivisions);
    // console.log('[DEBUG] pendingClusters:', pendingClusters);
  }, [pendingDivisions, pendingClusters]);

  // Recalculate current step when step structure changes
  useEffect(() => {
    // console.log('[DEBUG] Step structure changed, recalculating current step');
    // console.log('[DEBUG] Current step before recalculation:', currentStep);
    // console.log('[DEBUG] Steps array:', steps.map((s, i) => `${i}: ${s.title}`));
    
    // If current step is beyond the new step count, reset to last step
    if (currentStep >= steps.length) {
      setCurrentStep(steps.length - 1);
    }
  }, [steps, currentStep]);

  // Initialize multiple CSV import when component loads with appropriate settings
  useEffect(() => {
    if (orgStructure.importLevel === 'division') {
      // console.log('[DEBUG] Initializing multiple CSV import for division-level import');
      
      // Check if this is the scenario: hasDivisions + !hasClusters + withoutDivisionColumn
      const isColumnMappingOnlyScenario = orgStructure.hasMultipleDivisions && 
                                         !orgStructure.hasMultipleClusters && 
                                         orgStructure.divisionCsvType === 'withoutDivisionColumn';
      
      if (isColumnMappingOnlyScenario) {
        // For column mapping only - disable multiple CSV import
        // console.log('[DEBUG] Column mapping only scenario - disabling multiple CSV import');
        safeSetOrgStructure({
          multipleCsvImport: {
            ...orgStructure.multipleCsvImport,
            isEnabled: false
          }
        });
      } else if (orgStructure.multipleCsvImport.isEnabled) {
        // Only initialize if multiple CSV import is enabled and we're not in column mapping scenario
        if (orgStructure.divisionCsvType === 'withDivisionColumn') {
          safeInitializeMultipleCsvImport(orgStructure.hasMultipleDivisions ? 2 : 1);
        } else if (orgStructure.divisionCsvType === 'withoutDivisionColumn') {
          safeInitializeMultipleCsvImport(orgStructure.hasMultipleDivisions, []);
        }
      }
    }
  }, [orgStructure.importLevel, orgStructure.divisionCsvType, orgStructure.hasMultipleDivisions, orgStructure.hasMultipleClusters]);

  // Add logging for DB divisions and pendingDivisions
  useEffect(() => {
    console.log('[SetupWizard] divisions from store:', divisions);
    console.log('[SetupWizard] orgStructure.pendingDivisions:', orgStructure.pendingDivisions);
  }, [divisions, orgStructure.pendingDivisions]);

  // Note: loadDbDivisionsIntoPending and loadDbClustersIntoPending are now handled by loadAllData
  // which properly sets isExisting and id flags for database entities

  // Timezone data preparation
  const getTimezoneOptions = () => {
    try {
      const timezones = moment.tz.names();
      
      // Common timezones to show first
      const commonTimezones = [
        'UTC',
        'America/New_York',
        'America/Chicago', 
        'America/Denver',
        'America/Los_Angeles',
        'Europe/London',
        'Europe/Paris',
        'Europe/Berlin',
        'Asia/Tokyo',
        'Asia/Shanghai',
        'Australia/Sydney'
      ];

      // Group timezones by region
      const groupedTimezones = timezones.reduce((acc, tz) => {
        try {
          const parts = tz.split('/');
          const region = parts[0];
          const city = parts.slice(1).join('/');
          
          if (!acc[region]) {
            acc[region] = [];
          }
          
          const offsetText = moment.tz(tz).format('Z');
          const isCommon = commonTimezones.includes(tz);
          
          acc[region].push({
            value: tz,
            label: city,
            offset: offsetText,
            isCommon,
            displayText: `${city} (GMT${offsetText})`
          });
        } catch (error) {
          console.warn(`Error processing timezone ${tz}:`, error);
        }
        
        return acc;
      }, {} as Record<string, any[]>);

      // Sort regions and cities within regions
      Object.keys(groupedTimezones).forEach(region => {
        groupedTimezones[region].sort((a, b) => {
          // Common timezones first
          if (a.isCommon && !b.isCommon) return -1;
          if (!a.isCommon && b.isCommon) return 1;
          // Then alphabetically by city
          return a.label.localeCompare(b.label);
        });
      });

      return groupedTimezones;
    } catch (error) {
      console.error('Error getting timezone options:', error);
      return {};
    }
  };

  const getFilteredTimezoneOptions = () => {
    try {
      const grouped = getTimezoneOptions();
      const searchLower = timezoneSearch.toLowerCase();
      
      if (!searchLower) return grouped;
      
      const filtered: Record<string, any[]> = {};
      
      Object.keys(grouped).forEach(region => {
        const filteredCities = grouped[region].filter(tz => 
          tz.label.toLowerCase().includes(searchLower) ||
          tz.value.toLowerCase().includes(searchLower) ||
          region.toLowerCase().includes(searchLower)
        );
        
        if (filteredCities.length > 0) {
          filtered[region] = filteredCities;
        }
      });
      
      return filtered;
    } catch (error) {
      console.error('Error filtering timezone options:', error);
      return {};
    }
  };

  const getFilteredCountryOptions = () => {
    try {
      const searchLower = countrySearch.toLowerCase();
      
      // Curated list of commonly used countries (sovereign nations + major territories)
      // This reduces the list from 250+ countries/territories to ~120 most relevant ones
      // Includes major economies, regional powers, and significant territories
      const commonCountryCodes = [
        // Major economies and regions
        'US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'UY', 'PY', 'BO', 'EC', 'VE', 'GY', 'SR',
        'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'HU',
        'RO', 'BG', 'HR', 'SI', 'SK', 'LT', 'LV', 'EE', 'IE', 'PT', 'GR', 'CY', 'MT', 'LU', 'IS', 'LI',
        'MC', 'AD', 'SM', 'VA', 'RU', 'UA', 'BY', 'MD', 'GE', 'AM', 'AZ', 'KZ', 'UZ', 'KG', 'TJ', 'TM',
        'TR', 'IL', 'JO', 'LB', 'SY', 'IQ', 'IR', 'KW', 'SA', 'AE', 'QA', 'BH', 'OM', 'YE', 'EG', 'LY',
        'TN', 'DZ', 'MA', 'SD', 'SS', 'ET', 'ER', 'DJ', 'SO', 'KE', 'UG', 'TZ', 'RW', 'BI', 'CD', 'CG',
        'GA', 'CM', 'GQ', 'ST', 'CF', 'TD', 'NE', 'NG', 'BJ', 'TG', 'GH', 'CI', 'BF', 'ML', 'SN', 'GN',
        'GW', 'SL', 'LR', 'BW', 'NA', 'ZA', 'LS', 'SZ', 'MG', 'MU', 'SC', 'KM', 'RE', 'MZ', 'MW', 'ZW',
        'CN', 'JP', 'KR', 'TW', 'HK', 'MO', 'SG', 'MY', 'TH', 'VN', 'LA', 'KH', 'MM', 'BD', 'IN', 'PK',
        'LK', 'MV', 'NP', 'BT', 'AF', 'MN', 'AU', 'NZ', 'PG', 'FJ', 'VU', 'NC', 'PF', 'TO', 'WS', 'AS',
        'GU', 'MP', 'PW', 'FM', 'MH', 'KI', 'TV', 'NR', 'CK', 'NU', 'TK', 'WF', 'SB'
      ];
      
      const allCountries = commonCountryCodes.map(code => {
        const countryName = countries.getName(code, 'en');
        return {
          code,
          name: countryName || code
        };
      }).filter(country => country.name && country.name !== country.code) // Filter out any that don't have proper names
        .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically by country name
      
      if (!searchLower) return allCountries;
      
      return allCountries.filter(country => 
        country.name.toLowerCase().includes(searchLower) ||
        country.code.toLowerCase().includes(searchLower)
      );
    } catch (error) {
      console.error('Error filtering country options:', error);
      return [];
    }
  };

  const getFilteredCurrencyOptions = () => {
    try {
      const searchLower = currencySearch.toLowerCase();
      
      // Curated list of commonly used currencies (major world currencies + major regional currencies)
      // This reduces the list from 179 currencies to ~100 most relevant ones
      // Includes major reserve currencies, regional currencies, and actively traded currencies
      const commonCurrencyCodes = [
        'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'SEK', 'NOK',
        'DKK', 'NZD', 'MXN', 'BRL', 'INR', 'KRW', 'SGD', 'HKD', 'TWD', 'THB',
        'MYR', 'IDR', 'PHP', 'VND', 'TRY', 'RUB', 'ZAR', 'PLN', 'CZK', 'HUF',
        'RON', 'BGN', 'HRK', 'RSD', 'UAH', 'BYN', 'KZT', 'UZS', 'KGS', 'TJS',
        'TMT', 'AZN', 'GEL', 'AMD', 'AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR',
        'JOD', 'LBP', 'ILS', 'EGP', 'MAD', 'TND', 'DZD', 'LYD', 'NGN', 'GHS',
        'KES', 'UGX', 'TZS', 'ETB', 'SDG', 'SSP', 'CDF', 'RWF', 'BIF', 'DJF',
        'SOS', 'KMF', 'MUR', 'SCR', 'SZL', 'LSL', 'NAD', 'BWP', 'ZMW', 'MWK',
        'MZN', 'ZWL', 'STN', 'CVE', 'GMD', 'GNF', 'SLL', 'LRD', 'SLE', 'XOF',
        'XAF', 'XPF', 'CLP', 'PEN', 'COP', 'ARS', 'UYU', 'PYG', 'BOB', 'GTQ',
        'HNL', 'NIO', 'CRC', 'PAB', 'BZD', 'JMD', 'HTG', 'DOP', 'TTD', 'BBD',
        'XCD', 'AWG', 'ANG', 'SRD', 'GYD', 'VEF', 'VED', 'COU', 'ECU', 'ECS'
      ];
      
      const allCurrencies = commonCurrencyCodes.map(code => {
        const currency = currencies.code(code);
        return {
          code,
          name: currency && typeof currency.currency === 'string' ? currency.currency : code
        };
      }).filter(currency => currency.name !== currency.code) // Filter out any that don't have proper names
        .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically by currency name
      
      if (!searchLower) return allCurrencies;
      
      return allCurrencies.filter(currency => 
        currency.name.toLowerCase().includes(searchLower) ||
        currency.code.toLowerCase().includes(searchLower)
      );
    } catch (error) {
      console.error('Error filtering currency options:', error);
      return [];
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  // Validation function to check if we can proceed to the next step
  const canProceedToNextStep = () => {
    const currentStepTitle = steps[currentStep]?.title;
    
    // Check divisions validation
    if (currentStepTitle === 'Divisions' && orgStructure.hasMultipleDivisions) {
      // Count active divisions (excluding deleted ones)
      const deletedDivisionIds = new Set(orgStructure.deletedItems?.divisions?.map(d => d.id) || []);
      const activeDivisions = divisions.filter(d => !deletedDivisionIds.has(d.id));
      const totalDivisions = activeDivisions.length + pendingDivisions.length;
      if (totalDivisions === 0) {
        return false;
      }
    }
    
    // Check clusters validation
    if (currentStepTitle === 'Clusters' && orgStructure.hasMultipleClusters) {
      // Count active clusters (excluding deleted ones)
      const deletedClusterIds = new Set(orgStructure.deletedItems?.clusters?.map(c => c.id) || []);
      const activeClusters = clusters.filter(c => !deletedClusterIds.has(c.id));
      const totalClusters = activeClusters.length + pendingClusters.length;
      if (totalClusters === 0) {
        return false;
      }
    }
    
    return true;
  };

  // Get validation error message
  const getValidationErrorMessage = () => {
    const currentStepTitle = steps[currentStep]?.title;
    
    if (currentStepTitle === 'Divisions' && orgStructure.hasMultipleDivisions) {
      // Count active divisions (excluding deleted ones)
      const deletedDivisionIds = new Set(orgStructure.deletedItems?.divisions?.map(d => d.id) || []);
      const activeDivisions = divisions.filter(d => !deletedDivisionIds.has(d.id));
      const totalDivisions = activeDivisions.length + pendingDivisions.length;
      if (totalDivisions === 0) {
        return 'You have selected "Multiple Divisions" but no divisions have been created. Please create at least one division before proceeding.';
      }
    }
    
    if (currentStepTitle === 'Clusters' && orgStructure.hasMultipleClusters) {
      // Count active clusters (excluding deleted ones)
      const deletedClusterIds = new Set(orgStructure.deletedItems?.clusters?.map(c => c.id) || []);
      const activeClusters = clusters.filter(c => !deletedClusterIds.has(c.id));
      const totalClusters = activeClusters.length + pendingClusters.length;
      if (totalClusters === 0) {
        return 'You have selected "Multiple Clusters" but no clusters have been created. Please create at least one cluster before proceeding.';
      }
    }
    
    return null;
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Helper function to find step index by title
  const getStepIndexByTitle = (title: string): number => {
    const index = steps.findIndex(step => step.title === title);
    //console.log(`[DEBUG] getStepIndexByTitle('${title}') = ${index}`);
    return index;
  };

  const renderStep = () => {
    // console.log('[DEBUG] renderStep called with currentStep:', currentStep);
    // console.log('[DEBUG] Current steps array:', steps.map((s, i) => `${i}: ${s.title}`));
    
    const currentStepData = steps[currentStep];
    // console.log('[DEBUG] Current step title:', currentStepData?.title);
    
    // Check if we need to show S&OP Cycles step
    const sopCyclesIndex = getStepIndexByTitle('S&OP Cycles');
    const setupCompleteIndex = getStepIndexByTitle('Setup Complete');
    
    // console.log('[DEBUG] getStepIndexByTitle(\'S&OP Cycles\') =', sopCyclesIndex);
    // console.log('[DEBUG] getStepIndexByTitle(\'Setup Complete\') =', setupCompleteIndex);
    
    // Render based on step title using modular components
    switch (currentStepData?.title) {
      case 'Company':
        return (
          <CompanyStep
            companyForm={companyForm}
            timezoneSearch={timezoneSearch}
            timezoneOpen={timezoneOpen}
            countrySearch={countrySearch}
            countryOpen={countryOpen}
            currencySearch={currencySearch}
            currencyOpen={currencyOpen}
            safeSetCompanyForm={safeSetCompanyForm}
            setTimezoneSearch={setTimezoneSearch}
            setTimezoneOpen={setTimezoneOpen}
            setCountrySearch={setCountrySearch}
            setCountryOpen={setCountryOpen}
            setCurrencySearch={setCurrencySearch}
            setCurrencyOpen={setCurrencyOpen}
            getFilteredTimezoneOptions={getFilteredTimezoneOptions}
            getFilteredCountryOptions={getFilteredCountryOptions}
            getFilteredCurrencyOptions={getFilteredCurrencyOptions}
          />
        );

      case 'Business Configuration':
        return (
          <BusinessConfigurationStep
            orgStructure={orgStructure}
            safeSetOrgStructure={safeSetOrgStructure}
            safeCalculateSetupFlow={safeCalculateSetupFlow}
            safeInitializeMultipleCsvImport={safeInitializeMultipleCsvImport}
            getAvailableImportLevels={getAvailableImportLevels}
            handleImportLevelChange={handleImportLevelChange}
          />
        );

      case 'CSV Import':
        return (
          <CsvImportStep
            orgStructure={orgStructure}
            pendingDivisions={pendingDivisions}
            pendingClusters={pendingClusters}
            setCurrentStep={setCurrentStep}
            getStepIndexByTitle={getStepIndexByTitle}
            safeSetOrgStructure={safeSetOrgStructure}
            safeSetNewDivision={safeSetNewDivision}
            safeSetNewCluster={safeSetNewCluster}
            safeClearPendingItems={safeClearPendingItems}
            storeData={storeData}
          />
        );

      case 'Divisions':
        return (
          <DivisionsStep
            orgStructure={orgStructure}
            pendingDivisions={pendingDivisions}
            divisions={divisions}
            editingDivision={editingDivision}
            editDivisionForm={editDivisionForm}
            isLoadingDivisions={isLoadingDivisions}
            newDivision={newDivision}
            setCurrentStep={setCurrentStep}
            getStepIndexByTitle={getStepIndexByTitle}
            safeSetEditingDivision={safeSetEditingDivision}
            safeSetEditDivisionForm={safeSetEditDivisionForm}
            safeCreateDivision={safeCreateDivision}
            safeSetNewDivision={safeSetNewDivision}
            handleUpdatePendingDivision={handleUpdatePendingDivision}
          />
        );

      case 'Clusters':
        return (
          <ClustersStep
            orgStructure={orgStructure}
            pendingDivisions={pendingDivisions}
            pendingClusters={pendingClusters}
            divisions={divisions}
            clusters={clusters}
            editingCluster={editingCluster}
            editClusterForm={editClusterForm}
            isLoadingClusters={isLoadingClusters}
            newCluster={newCluster}
            setCurrentStep={setCurrentStep}
            getStepIndexByTitle={getStepIndexByTitle}
            safeSetEditingCluster={safeSetEditingCluster}
            safeSetEditClusterForm={safeSetEditClusterForm}
            safeCreateCluster={safeCreateCluster}
            safeSetNewCluster={safeSetNewCluster}
            handleUpdatePendingCluster={handleUpdatePendingCluster}
          />
        );

      case 'Product Life Cycle':
        return (
          <ProductLifecycleStep
            orgStructure={orgStructure}
            safeSetOrgStructure={safeSetOrgStructure}
          />
        );

      case 'S&OP Cycles':
        return (
          <SopCyclesStep
            pendingDivisions={pendingDivisions}
            divisions={divisions}
            sopCycles={sopCycles}
            isLoadingSopCycles={isLoadingSopCycles}
            newSopCycle={newSopCycle}
            safeCreateSopCycle={safeCreateSopCycle}
            safeSetNewSopCycle={safeSetNewSopCycle}
          />
        );

      case 'Import Setup Data':
        return (
          <ImportSetupDataStep
            orgStructure={orgStructure}
            pendingDivisions={pendingDivisions}
            pendingClusters={pendingClusters}
            setCurrentStep={setCurrentStep}
            getStepIndexByTitle={getStepIndexByTitle}
          />
        );

      case 'Setup Complete':
        return (
          <SetupCompleteStep
            company={company}
            pendingDivisions={pendingDivisions}
            pendingClusters={pendingClusters}
            handleCompleteSetup={handleCompleteSetup}
          />
        );

      default:
        return null;
    }
  };

  // Prefill division fieldMapping from CSV mapping
  useEffect(() => {
    if (
      orgStructure.csvMapping &&
      newDivision.name &&
      !newDivision.fieldMapping &&
      orgStructure.uploadedCsvData &&
      orgStructure.csvMapping.divisionColumn
    ) {
      const divisionCol = orgStructure.csvMapping.divisionColumn;
      const match = orgStructure.uploadedCsvData.find(row => row[divisionCol] === newDivision.name);
      if (match) {
        safeSetNewDivision({ fieldMapping: match[divisionCol] });
      }
    }
  }, [newDivision.name, orgStructure.csvMapping, orgStructure.uploadedCsvData]);

  // Prefill cluster fieldMapping from CSV mapping
  useEffect(() => {
    if (
      orgStructure.csvMapping &&
      newCluster.name &&
      !newCluster.fieldMapping &&
      orgStructure.uploadedCsvData &&
      orgStructure.csvMapping.clusterColumn
    ) {
      const clusterCol = orgStructure.csvMapping.clusterColumn;
      const match = orgStructure.uploadedCsvData.find(row => row[clusterCol] === newCluster.name);
      if (match) {
        safeSetNewCluster({ fieldMapping: match[clusterCol] });
      }
    }
  }, [newCluster.name, orgStructure.csvMapping, orgStructure.uploadedCsvData]);

  // Multiple CSV Import Progress Component
  const MultipleCsvImportProgress = () => {
    const { multipleCsvImport } = orgStructure;
    
    if (!multipleCsvImport.isEnabled) return null;
    
    const { importedCsvs } = multipleCsvImport;
    // Ensure remainingDivisions is always an array
    const remainingDivisions = Array.isArray(multipleCsvImport.remainingDivisions) 
      ? multipleCsvImport.remainingDivisions 
      : [];
    const importedCount = importedCsvs.length;
    const progress = Math.min(importedCount * 20, 100); // 20% per CSV, capped at 100%
    
    return (
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-blue-900">Multiple CSV Import Progress</h4>
          <span className="text-sm text-blue-700">
            {importedCount} CSV{importedCount !== 1 ? 's' : ''} imported
          </span>
        </div>
        
        <div className="mb-3">
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
        
        {remainingDivisions.length > 0 && (
          <div className="text-sm text-blue-700">
            <p className="mb-2">Remaining divisions to import:</p>
            <div className="flex flex-wrap gap-2">
              {remainingDivisions.map((division, index) => (
                <Badge key={index} variant="outline" className="text-blue-700 border-blue-300">
                  {division}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        <p className="text-xs text-blue-600 mt-2">
          You can import more CSVs or proceed to the next step when ready.
        </p>
      </div>
    );
  };

  // Import Another CSV Button Component
  const ImportAnotherCsvButton = ({ stepTitle }: { stepTitle: string }) => {
    const { multipleCsvImport, importLevel, divisionCsvType } = orgStructure;
    
    // Only show for division-level imports
    if (importLevel !== 'division') return null;
    
    // Check if we need more imports
    const remainingDivisions = Array.isArray(multipleCsvImport.remainingDivisions) 
      ? multipleCsvImport.remainingDivisions 
      : [];
    
    if (multipleCsvImport.isEnabled && remainingDivisions.length > 0) {
      return (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-amber-900 mb-1">Import Additional CSV</h4>
              <p className="text-sm text-amber-700">
                {divisionCsvType === 'withDivisionColumn' 
                  ? 'You have more divisions to import. Each division should have its own CSV file.'
                  : 'You have more divisions to import clusters for. Select a division and import its cluster data.'
                }
              </p>
            </div>
            <Button 
              onClick={() => setCurrentStep(getStepIndexByTitle('CSV Import'))}
              variant="outline"
              className="border-amber-300 text-amber-700 hover:bg-amber-100"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import Another CSV
            </Button>
          </div>
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white dark:bg-gray-800 shadow-sm">
          <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Organization Setup
              </h1>
              <Badge variant="outline" className="text-blue-600 border-blue-600">
                Step {currentStep + 1} of {steps.length}
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Progress value={((currentStep + 1) / steps.length) * 100} className="w-32" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {Math.round(((currentStep + 1) / steps.length) * 100)}%
                </span>
              </div>
              <Button 
                variant="ghost" 
                onClick={handleLogout}
                className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Button>
            </div>
          </div>
          
          {/* Step Navigation */}
          <div className="border-t border-gray-200 dark:border-gray-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex space-x-8 overflow-x-auto">
                {steps.map((step, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentStep(index)}
                    className={`flex items-center space-x-2 py-4 px-2 border-b-2 whitespace-nowrap transition-colors ${
                      index === currentStep
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : index < currentStep
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      index === currentStep
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400'
                        : index < currentStep
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {index < currentStep ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <div className="text-left">
                      <div className="font-medium">{step.title}</div>
                      <div className="text-xs">{step.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {renderStep()}
          
          {/* Navigation Buttons */}
          {currentStep <= getStepIndexByTitle('S&OP Cycles') && currentStep !== getStepIndexByTitle('Setup Complete') && (
            <div className="max-w-4xl mx-auto mt-8">
              {/* Validation Error Message */}
              {getValidationErrorMessage() && (
                <Alert className="mb-4 border-red-200 bg-red-50">
                  <AlertDescription className="text-red-800">
                    {getValidationErrorMessage()}
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="flex justify-between">
                {/* Previous Button - Hide when CSV import wizard is active */}
                {!(steps[currentStep]?.title === 'CSV Import' && orgStructure.csvImportActive) && (
                  <Button
                    variant="outline"
                    onClick={prevStep}
                    disabled={currentStep === 0}
                    className="flex items-center space-x-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Previous
                  </Button>
                )}
                
                {/* Next Button - Hide on CSV Import step when CSV import wizard is active */}
                {steps[currentStep]?.title !== 'CSV Import' && !(steps[currentStep]?.title === 'CSV Import' && orgStructure.csvImportActive) && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Button
                            onClick={nextStep}
                            disabled={
                              (currentStep === 1 && (!orgStructure.importLevel || (orgStructure.importLevel === 'division' && !orgStructure.divisionCsvType))) ||
                              !canProceedToNextStep()
                            }
                            className={`flex items-center space-x-2 ${
                              (currentStep === 1 && (!orgStructure.importLevel || (orgStructure.importLevel === 'division' && !orgStructure.divisionCsvType))) ||
                              !canProceedToNextStep()
                                ? 'bg-gray-400 cursor-not-allowed' 
                                : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                          >
                            Next
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </TooltipTrigger>
                      {!canProceedToNextStep() && getValidationErrorMessage() && (
                        <TooltipContent>
                          <p>{getValidationErrorMessage()}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                )}
                
                {/* Show Next button on CSV Import step only when CSV import is complete */}
                {steps[currentStep]?.title === 'CSV Import' && !orgStructure.csvImportActive && orgStructure.csvImportData && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Button
                            onClick={nextStep}
                            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700"
                          >
                            Next
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </TooltipTrigger>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          )}
          

        </main>
      </div>
      
      {/* Floating logo container, top left */}
      <div className="fixed top-4 left-6 z-50 bg-white rounded-lg p-2 shadow-sm">
        <img src="/forecast_alchemy_logo.svg" alt="Forecast Alchemy Logo" className="h-20 w-auto" />
      </div>
    </div>
  );
};

export default SetupWizard; 