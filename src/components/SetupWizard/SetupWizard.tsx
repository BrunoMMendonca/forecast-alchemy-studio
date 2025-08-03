import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import { CheckCircle, Building2, MapPin, Calendar, Upload, ArrowRight, ArrowLeft, Loader2, LogOut, Search, Info, Landmark, Trash2, Menu, X, FileText } from 'lucide-react';
import { toast } from 'sonner';
import countries from 'i18n-iso-countries';
import moment from 'moment-timezone';
import currencies from 'currency-codes';

// Register English locale for countries
import enLocale from 'i18n-iso-countries/langs/en.json';
countries.registerLocale(enLocale);

// Import the store and CSV import wizard
import { useSetupWizardStore } from '../../store/setupWizardStoreRefactored';
import { CsvImportWizard } from '../CsvImportWizard';

// Import state machine for navigation logic
import { setupWizardStateMachine, SetupWizardState } from '../../state/SetupWizardStateMachine';

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
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get current step from URL or default to 0
  const getCurrentStepFromURL = () => {
    const searchParams = new URLSearchParams(location.search);
    const stepParam = searchParams.get('step');
    if (stepParam) {
      const stepIndex = parseInt(stepParam, 10);
      return isNaN(stepIndex) ? 0 : Math.max(0, stepIndex);
    }
    return 0;
  };

  const [currentStep, setCurrentStep] = useState(getCurrentStepFromURL);
  const [timezoneSearch, setTimezoneSearch] = useState('');
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [countryOpen, setCountryOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStepNavigation, setShowStepNavigation] = useState(false);
  const [showImportedCsvList, setShowImportedCsvList] = useState(false);
  
  // Check for page reload and reset to step 0 if needed
  useEffect(() => {
    const wasReloaded = sessionStorage.getItem('setupWizardReloaded');
    
    if (!wasReloaded) {
      // This is a fresh page load or reload, reset to step 0
      sessionStorage.setItem('setupWizardReloaded', 'true');
      const searchParams = new URLSearchParams(location.search);
      searchParams.set('step', '0');
      navigate(`/setup?${searchParams.toString()}`, { replace: true });
      setCurrentStep(0);
    }
  }, [navigate, location.search]);

  // Initialize URL if no step parameter is present
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const urlStep = searchParams.get('step');
    
    if (!urlStep && currentStep === 0) {
      searchParams.set('step', '0');
      navigate(`/setup?${searchParams.toString()}`, { replace: true });
    }
  }, [navigate, location.search]);

  // Update state when URL changes
  useEffect(() => {
    const urlStep = getCurrentStepFromURL();
    if (urlStep !== currentStep) {
      setCurrentStep(urlStep);
    }
  }, [location.search]);

  // Listen for browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const newStep = getCurrentStepFromURL();
      setCurrentStep(newStep);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Clean up sessionStorage when component unmounts
  useEffect(() => {
    return () => {
      sessionStorage.removeItem('setupWizardReloaded');
    };
  }, []);
  
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
    addPendingDivision,
    addPendingCluster,
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
    loadDbClustersIntoPending,
    removeImportedCsv
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
      { title: 'Company Details', description: 'Configure your company information' },
      { title: 'Business Configuration', description: 'Configure your organizational structure, data import approach, and product lifecycle management' }
    ];

    // Special handling for division-level import without division column
    const isDivisionLevelWithoutColumn = orgStructure.importLevel === 'division' && 
                                       orgStructure.divisionCsvType === 'withoutDivisionColumn' &&
                                       orgStructure.hasMultipleClusters;

    // Special handling for division-level import without division column AND no clusters
    const isDivisionLevelWithoutColumnNoClusters = orgStructure.importLevel === 'division' && 
                                                  orgStructure.divisionCsvType === 'withoutDivisionColumn' &&
                                                  !orgStructure.hasMultipleClusters;


    if (isDivisionLevelWithoutColumn) {
      // Flow: Manual divisions first, then CSV import for clusters, then manual cluster editing
      baseSteps.push({ title: 'Manage Divisions', description: 'Create business divisions' });
      baseSteps.push({ title: 'CSV Import & Column Mapping', description: 'Upload cluster data for each division' });
      baseSteps.push({ title: 'Manage Clusters', description: 'Edit clusters from CSV and add additional clusters' });
    } else if (isDivisionLevelWithoutColumnNoClusters) {
      // Flow: Manual divisions first, then CSV import for column mapping (before product lifecycle or S&OP)
      baseSteps.push({ title: 'Manage Divisions', description: 'Create business divisions' });
      baseSteps.push({ title: 'CSV Import & Column Mapping', description: 'Upload a CSV file to automatically detect and map your data structure for divisions, clusters, and lifecycle phases.' });
    } else {
      // Standard flow
      // Add CSV Import step if CSV upload is required
      if (orgStructure.setupFlow?.requiresCsvUpload) {
        baseSteps.push({ title: 'CSV Import & Column Mapping', description: 'Upload a CSV file to automatically detect and map your data structure for divisions, clusters, and lifecycle phases.' });

      }

      // Add Divisions step if not skipped
      if (!orgStructure.setupFlow?.skipDivisionStep) {
        baseSteps.push({ title: 'Manage Divisions', description: 'Create and edit business divisions' });
      }

      // Add Clusters step if not skipped
      if (!orgStructure.setupFlow?.skipClusterStep) {
        baseSteps.push({ title: 'Manage Clusters', description: 'Create and edit geographic/operational clusters' });
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

    return baseSteps;
  };

  const steps = getSteps();

  // Use useCallback to prevent safeLoadAllData from being recreated on every render
  const memoizedSafeLoadAllData = useCallback(() => {
    console.log('[SetupWizard] Component mounted, calling safeLoadAllData');
    return safeLoadAllData().then(() => {
      console.log('[SetupWizard] safeLoadAllData completed');
    }).catch((error) => {
      console.error('[SetupWizard] safeLoadAllData failed:', error);
    });
  }, [safeLoadAllData]);

  // Load data only once when component mounts
  useEffect(() => {
    memoizedSafeLoadAllData();
  }, [memoizedSafeLoadAllData]);

  // Calculate setup flow after data loads
  useEffect(() => {
    if (company && !isLoading) {
      // Calculate setup flow after company data is loaded
      setTimeout(() => safeCalculateSetupFlow(), 100);
      
      // Initialize state machine context
      setupWizardStateMachine.updateContext({
        currentState: 'business-configuration',
        importLevel: orgStructure.importLevel,
        hasMultipleDivisions: orgStructure.hasMultipleDivisions,
        hasMultipleClusters: orgStructure.hasMultipleClusters,
        enableLifecycleTracking: orgStructure.enableLifecycleTracking,
        csvImportData: orgStructure.csvImportData,
        extractedDivisions: orgStructure.extractedDivisions,
        extractedClusters: orgStructure.extractedClusters,
        pendingDivisions: pendingDivisions,
        pendingClusters: pendingClusters,
        lifecycleMappings: orgStructure.lifecycleMappings,
        multipleCsvImport: orgStructure.multipleCsvImport
      });
    }
  }, [company, isLoading]);

  // Update pending divisions when database divisions change (for name updates)
  useEffect(() => {
    if (divisions.length > 0 && pendingDivisions.length > 0) {
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

      safeSetOrgStructure({ pendingDivisions: updatedPendingDivs });
    }
  }, [divisions]); // Only depend on divisions, not pendingDivisions

  // Populate pending clusters from database data if they're empty (only once during initialization)
  useEffect(() => {
    if (clusters.length > 0 && pendingClusters.length === 0) {
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
    // Debug logging removed to prevent console spam
  }, [divisions, clusters]);

  // Log pending arrays for debugging
  useEffect(() => {
    // Debug logging removed to prevent console spam
  }, [pendingDivisions, pendingClusters]);

  // Recalculate current step when step structure changes
  useEffect(() => {
    // If current step is beyond the new step count, reset to last step
    if (currentStep >= steps.length) {
      setCurrentStep(steps.length - 1);
    }
  }, [steps, currentStep]);

  // Initialize multiple CSV import when component loads with appropriate settings
  useEffect(() => {
    if (orgStructure.importLevel === 'division') {
      // Check if this is the scenario: hasDivisions + !hasClusters + withoutDivisionColumn
      const isColumnMappingOnlyScenario = orgStructure.hasMultipleDivisions && 
                                         !orgStructure.hasMultipleClusters && 
                                         orgStructure.divisionCsvType === 'withoutDivisionColumn';
      
      if (isColumnMappingOnlyScenario) {
        // For column mapping only - disable multiple CSV import
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
    // Removed to prevent infinite loops
  }, [divisions, orgStructure.pendingDivisions]);

  // Load DB divisions into pending when Divisions step is rendered
  useEffect(() => {
    if (currentStep === getStepIndexByTitle('Manage Divisions')) {
      loadDbDivisionsIntoPending();
    }
  }, [currentStep, loadDbDivisionsIntoPending]);

  // Load DB clusters into pending when Clusters step is rendered
  useEffect(() => {
    if (currentStep === getStepIndexByTitle('Manage Clusters')) {
      loadDbClustersIntoPending();
    }
  }, [currentStep, loadDbClustersIntoPending]);

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
      const newStep = currentStep + 1;
      const searchParams = new URLSearchParams(location.search);
      searchParams.set('step', newStep.toString());
      navigate(`/setup?${searchParams.toString()}`);
    }
  };

  // Use state machine for navigation validation
  const canProceedToNextStep = () => {
    // Update state machine context with current data
    setupWizardStateMachine.updateContext({
      currentState: getCurrentStateFromStepTitle(steps[currentStep]?.title),
      importLevel: orgStructure.importLevel,
      hasMultipleDivisions: orgStructure.hasMultipleDivisions,
      hasMultipleClusters: orgStructure.hasMultipleClusters,
      enableLifecycleTracking: orgStructure.enableLifecycleTracking,
      csvImportData: orgStructure.csvImportData,
      extractedDivisions: orgStructure.extractedDivisions,
      extractedClusters: orgStructure.extractedClusters,
      pendingDivisions: pendingDivisions,
      pendingClusters: pendingClusters,
      lifecycleMappings: orgStructure.lifecycleMappings,
      multipleCsvImport: orgStructure.multipleCsvImport
    });
    
    return setupWizardStateMachine.canProceedToNextStep();
  };

  // Use state machine for validation error messages
  const getValidationErrorMessage = () => {
    // Update state machine context with current data
    setupWizardStateMachine.updateContext({
      currentState: getCurrentStateFromStepTitle(steps[currentStep]?.title),
      importLevel: orgStructure.importLevel,
      hasMultipleDivisions: orgStructure.hasMultipleDivisions,
      hasMultipleClusters: orgStructure.hasMultipleClusters,
      enableLifecycleTracking: orgStructure.enableLifecycleTracking,
      csvImportData: orgStructure.csvImportData,
      extractedDivisions: orgStructure.extractedDivisions,
      extractedClusters: orgStructure.extractedClusters,
      pendingDivisions: pendingDivisions,
      pendingClusters: pendingClusters,
      lifecycleMappings: orgStructure.lifecycleMappings,
      multipleCsvImport: orgStructure.multipleCsvImport
    });
    
    const validationErrors = setupWizardStateMachine.getValidationErrors();
    const currentStepTitle = steps[currentStep]?.title;
    
    // Return the first error message for the current step
    if (currentStepTitle === 'Divisions' && validationErrors.divisions?.length > 0) {
      return validationErrors.divisions[0];
    }
    
    if (currentStepTitle === 'Clusters' && validationErrors.clusters?.length > 0) {
      return validationErrors.clusters[0];
    }
    
    if (currentStepTitle === 'Business Configuration' && validationErrors.business?.length > 0) {
      return validationErrors.business[0];
    }
    
    return null;
  };

  // Helper function to map step titles to state machine states
  const getCurrentStateFromStepTitle = (stepTitle?: string): SetupWizardState => {
    switch (stepTitle) {
      case 'Company Details':
        return 'business-configuration';
      case 'Business Configuration':
        return 'business-configuration';
      case 'CSV Import & Column Mapping':
        return 'csv-import';
      case 'Manage Divisions':
        return 'divisions';
      case 'Manage Clusters':
        return 'clusters';
      case 'Product Life Cycle':
        return 'product-lifecycle';
      case 'S&OP Cycles':
        return 'sop-cycles';
      case 'Setup Complete':
        return 'setup-complete';
      default:
        return 'business-configuration';
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      const searchParams = new URLSearchParams(location.search);
      searchParams.set('step', newStep.toString());
      navigate(`/setup?${searchParams.toString()}`);
    }
  };

  // Helper function to find step index by title
  const getStepIndexByTitle = (title: string): number => {
    const index = steps.findIndex(step => step.title === title);
    //console.log(`[DEBUG] getStepIndexByTitle('${title}') = ${index}`);
    return index;
  };

  // Navigate to a specific step
  const goToStep = (stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < steps.length) {
      const searchParams = new URLSearchParams(location.search);
      searchParams.set('step', stepIndex.toString());
      navigate(`/setup?${searchParams.toString()}`);
    }
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
      case 'Company Details':
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

      case 'CSV Import & Column Mapping':
        return (
          <CsvImportStep
            orgStructure={orgStructure}
            pendingDivisions={pendingDivisions}
            pendingClusters={pendingClusters}
            setCurrentStep={goToStep}
            getStepIndexByTitle={getStepIndexByTitle}
            safeSetOrgStructure={safeSetOrgStructure}
            safeSetNewDivision={safeSetNewDivision}
            safeSetNewCluster={safeSetNewCluster}
            safeClearPendingItems={safeClearPendingItems}
            storeData={storeData}
          />
        );

      case 'Manage Divisions':
        return (
          <DivisionsStep
            orgStructure={orgStructure}
            pendingDivisions={pendingDivisions}
            divisions={divisions}
            editingDivision={editingDivision}
            editDivisionForm={editDivisionForm}
            isLoadingDivisions={isLoadingDivisions}
            newDivision={newDivision}
            setCurrentStep={goToStep}
            getStepIndexByTitle={getStepIndexByTitle}
            safeSetEditingDivision={safeSetEditingDivision}
            safeSetEditDivisionForm={safeSetEditDivisionForm}
            safeCreateDivision={safeCreateDivision}
            safeSetNewDivision={safeSetNewDivision}
            handleUpdatePendingDivision={handleUpdatePendingDivision}
          />
        );

      case 'Manage Clusters':
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
            setCurrentStep={goToStep}
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
            setCurrentStep={goToStep}
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
          
          {/* Professional Progress Bar */}
          <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-4 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-700 ease-out shadow-sm"
                      style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                    {currentStep + 1} / {steps.length}
                  </span>
                </div>
              </div>
              
              {/* Current Step Title */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 transition-all duration-300">
                    {steps[currentStep]?.title}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
                    {steps[currentStep]?.description}
                  </p>
                </div>
                
                {/* Step Navigation Icon and Indicators */}
                <div className="flex items-center space-x-3 ml-6">
                  {/* CSV Files Button - Show only when there are imported CSVs */}
                  {(storeData?.orgStructure?.csvImportData?.csvFileName || 
                  (storeData?.orgStructure?.multipleCsvImport?.importedCsvs && 
                   storeData.orgStructure.multipleCsvImport.importedCsvs.length > 0)) && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowImportedCsvList(true)}
                            className="p-2 h-8 w-8 text-blue-600 hover:text-blue-700 animate-pulse" // shadow-lg"
                          >
                            <FileText className="h-4 w-4 drop-shadow-sm" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Imported CSV Files ({storeData?.orgStructure?.multipleCsvImport?.importedCsvs?.length || 1})</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  
                  {/* Inactive Divisions Indicator */}
                  {divisions.some(division => division.is_active === false) && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-2 h-8 w-8 text-orange-600 hover:text-orange-700 animate-pulse"
                          >
                            <Building2 className="h-4 w-4 drop-shadow-sm" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Inactive Divisions ({divisions.filter(division => division.is_active === false).length})</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  
                  {/* Inactive Clusters Indicator */}
                  {clusters.some(cluster => cluster.is_active === false) && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-2 h-8 w-8 text-orange-600 hover:text-orange-700 animate-pulse"
                          >
                            <MapPin className="h-4 w-4 drop-shadow-sm" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Inactive Clusters ({clusters.filter(cluster => cluster.is_active === false).length})</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowStepNavigation(true)}
                          className="p-2 h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
                        >
                          <Menu className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Step navigation</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  {/* Step Indicator Dots */}
                  <div className="flex items-center space-x-1.5">
                    {steps.map((step, index) => (
                      <div
                        key={index}
                        className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                          index === currentStep
                            ? 'bg-blue-600 scale-125 shadow-md'
                            : index < currentStep
                            ? 'bg-green-500 shadow-sm'
                            : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                        title={`${step.title} - ${step.description}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Step Navigation Side Panel */}
          {showStepNavigation && (
            <div className="fixed inset-0 z-50 overflow-hidden">
              {/* Backdrop */}
              <div 
                className="absolute inset-0 bg-black bg-opacity-25 transition-opacity"
                onClick={() => setShowStepNavigation(false)}
              />
              
              {/* Panel */}
              <div className="absolute right-0 top-0 h-full w-80 max-w-full bg-white dark:bg-gray-800 shadow-xl transform transition-transform duration-300 ease-in-out">
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Step Navigation
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowStepNavigation(false)}
                      className="p-1 h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Steps List */}
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-2">
                {steps.map((step, index) => (
                  <button
                    key={index}
                          onClick={() => {
                            if (index <= currentStep) {
                              setCurrentStep(index);
                              setShowStepNavigation(false);
                            }
                          }}
                          disabled={index > currentStep}
                          className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${
                      index === currentStep
                              ? 'border-blue-200 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : index < currentStep
                              ? 'border-gray-200 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                              : 'border-gray-200 bg-gray-50 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    }`}
                  >
                          <div className="flex items-center space-x-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      index === currentStep
                                ? 'bg-blue-600 text-white'
                        : index < currentStep
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-300 dark:bg-gray-600 text-gray-500'
                    }`}>
                      {index < currentStep ? (
                                <CheckCircle className="w-3 h-3" />
                      ) : (
                        index + 1
                      )}
                    </div>
                            <div className="flex-1">
                              <div className={`font-medium ${
                                index === currentStep ? 'text-blue-700 dark:text-blue-300' : ''
                              }`}>
                                {step.title}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {step.description}
                              </div>
                            </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
                  
                  {/* Footer */}
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
                      Step {currentStep + 1} of {steps.length}
          </div>
                  </div>
                </div>
              </div>
            </div>
          )}
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
              
              <div className={`flex ${currentStep > 0 ? 'justify-between' : 'justify-end'}`}>
                {/* Previous Button - Hide on first step, use state machine validation for others */}
                {currentStep > 0 && !(steps[currentStep]?.title === 'CSV Import & Column Mapping' && orgStructure.csvImportActive) && (
                  <Button
                    variant="outline"
                    onClick={prevStep}
                    disabled={currentStep <= 1 ? false : !setupWizardStateMachine.canGoToPreviousStep()}
                    className="flex items-center space-x-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Previous
                  </Button>
                )}
                
                {/* Next Button - Hide on CSV Import step when CSV import wizard is active */}
                {steps[currentStep]?.title !== 'CSV Import & Column Mapping' && !(steps[currentStep]?.title === 'CSV Import & Column Mapping' && orgStructure.csvImportActive) && (
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
                {steps[currentStep]?.title === 'CSV Import & Column Mapping' && !orgStructure.csvImportActive && orgStructure.csvImportData && (
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
      
      {/* Imported CSV Files Popup */}
      {showImportedCsvList && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Imported CSV Files</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowImportedCsvList(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <p className="text-gray-600">
                These CSV files have been imported and are ready for processing. You can remove any file if needed.
              </p>
              
              <div className="space-y-3">
                {/* Single CSV Import - Only show if we're NOT in multiple CSV mode */}
                {storeData?.orgStructure?.csvImportData?.csvFileName && 
                 !(storeData?.orgStructure?.multipleCsvImport?.importedCsvs && 
                   storeData.orgStructure.multipleCsvImport.importedCsvs.length > 0) && (
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <span className="text-green-600 text-sm">✓</span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-800">{storeData.orgStructure.csvImportData.csvFileName}</div>
                        <div className="text-sm text-gray-600">
                          {storeData.orgStructure.extractedDivisions?.length > 0 && (
                            <span>Divisions: {storeData.orgStructure.extractedDivisions.join(', ')}</span>
                          )}
                          {storeData.orgStructure.extractedClusters?.length > 0 && (
                            <span className="ml-2">Clusters: {storeData.orgStructure.extractedClusters.join(', ')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        // Clear CSV mapping data and arrays
                        storeData.clearCsvMappingData();
                        
                        // Clear organizational structure data
                        storeData.setOrgStructure({
                          ...storeData.orgStructure,
                          csvImportData: null,
                          uploadedCsvData: null,
                          csvHeaders: null,
                          csvMapping: null,
                          extractedDivisions: [],
                          extractedClusters: [],
                          divisionClusterMap: {},
                        });
                        
                        toast.success(`"${storeData.orgStructure.csvImportData.csvFileName}" has been removed and all associated data has been cleared.`);
                        
                        setShowImportedCsvList(false);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                
                {/* Multiple CSV Imports - Only show if we have multiple CSV imports */}
                {storeData?.orgStructure?.multipleCsvImport?.importedCsvs?.map((csv: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 text-sm">✓</span>
                      </div>
                      <div className="flex-1">
                        {/* Primary: Division Name */}
                        <div className="font-semibold text-gray-900 text-base">
                          {csv.divisionName || csv.divisions?.[0] || 'Unknown Division'}
                        </div>
                        {/* Secondary: File details */}
                        <div className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">File:</span> {csv.fileName}
                          {csv.clusters?.length > 0 && (
                            <span className="ml-3">
                              <span className="font-medium">Clusters:</span> {csv.clusters.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        // Remove the specific CSV from the tracking
                        storeData.removeImportedCsv(csv.fileName);
                        
                        const divisionName = csv.divisionName || csv.divisions?.[0] || 'Unknown Division';
                        toast.success(`Division "${divisionName}" has been removed.`);
                        
                        // Close popup if no more files
                        if (storeData.orgStructure.multipleCsvImport.importedCsvs.length === 1) {
                          setShowImportedCsvList(false);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SetupWizard; 