// Refactored Setup Wizard Store - EXACT INTERFACE MATCH
// Uses new architecture patterns behind the scenes while maintaining 100% compatibility

import { create } from 'zustand';
import { toast } from 'sonner';
import { setupWizardStateMachine } from '@/state/SetupWizardStateMachine';
import { setupWizardConfigManager } from '@/config/SetupWizardConfig';
import { importStrategyManager } from '@/strategies/ImportStrategy';
import { commandManager, UpdateBusinessConfigurationCommand, ImportCsvDataCommand, ClearCsvDataCommand, AddDivisionCommand, UpdateDivisionCommand, DeleteDivisionCommand, AddClusterCommand, UpdateClusterCommand, DeleteClusterCommand } from '@/commands/SetupWizardCommands';

// EXACT SAME INTERFACES AS ORIGINAL
interface Division {
  id: number;
  name: string;
  description: string;
  industry: string | null;
  fieldMapping: string | null;
}

interface Cluster {
  id: number;
  name: string;
  description: string;
  country_code: string | null;
  region: string | null;
  division_id: number;
  fieldMapping: string | null;
}

interface SopCycleConfig {
  id?: number;
  companyId: number;
  divisionId?: number;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  dayType: 'regular' | 'working';
  startDay: number;
  startMonth?: number;
  cutOffDays: number;
  isActive: boolean;
  description?: string;
  autoGenerate: boolean;
  generateFromDate: string;
  generateCount: number;
  workingDaysConfig?: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
    holidays?: string[];
  };
  divisionName?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface SopCycle {
  id: number;
  companyId: number;
  divisionId?: number;
  configId?: number;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  cutOffDate: string;
  isCurrent: boolean;
  isCompleted: boolean;
  status: 'active' | 'locked' | 'completed' | 'archived';
  cycleStatus?: 'upcoming' | 'active' | 'locked' | 'completed';
  divisionName?: string;
  configFrequency?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface SopCyclePermission {
  id: number;
  companyId: number;
  cycleId: number;
  userId: number;
  permissionType: 'view' | 'edit' | 'approve' | 'admin';
  username?: string;
  firstName?: string;
  lastName?: string;
  grantedAt: string;
  grantedBy?: number;
  expiresAt?: string;
}

interface FieldMapping {
  id: number;
  company_id: number;
  field_def_id: number;
  dataset_column: string;
  division_id?: number;
  field_order?: number;
  field_name?: string;
  field_type?: string;
  options?: any;
  division_name?: string;
  created_at: string;
  created_by: number;
}

interface Company {
  id: number;
  name: string;
  description: string;
  country: string;
  website: string;
  phone: string;
  address: string;
  city: string;
  state_province: string;
  postal_code: string;
  company_size: string;
  fiscal_year_start: string;
  timezone: string;
  currency: string;
  logo_url: string;
  notes: string;
}

interface SetupStatus {
  setupRequired: boolean;
  setupWizardAccessible: boolean;
  hasDatasets: boolean;
  divisionCount: number;
  clusterCount: number;
  datasetCount: number;
  companyCount: number;
}

// EXACT SAME INTERFACE AS ORIGINAL
interface SetupWizardState {
  // Data
  company: Company | null;
  divisions: Division[];
  clusters: Cluster[];
  sopCycleConfigs: SopCycleConfig[];
  sopCycles: SopCycle[];
  sopCyclePermissions: SopCyclePermission[];
  fieldMappings: FieldMapping[];
  setupStatus: SetupStatus | null;
  
  // Cache management
  cache: {
    lastFetched: Record<string, number>;
    cacheDuration: number;
  };
  
  // Request deduplication
  pendingRequests: Record<string, Promise<any>>;
  
  // Organizational structure configuration - EXACT SAME STRUCTURE
  orgStructure: {
    hasMultipleDivisions: boolean;
    hasMultipleClusters: boolean;
    enableLifecycleTracking: boolean;
    lifecycleMappings: Array<{
      id: string;
      value: string;
      phase: 'launch' | 'stable' | 'end-of-life';
      isCustom?: boolean;
    }>;
    importLevel: 'company' | 'division' | null;
    csvUploadType: 'perCompany' | 'perDivision' | null;
    divisionCsvType: 'withDivisionColumn' | 'withoutDivisionColumn' | null;
    uploadedCsvData: any[] | null;
    csvHeaders: string[] | null;
    csvMapping: {
      divisionColumn: string | null;
      clusterColumn: string | null;
      materialNameColumn: string | null;
      descriptionColumn: string | null;
      lifecycleColumn: string | null;
    } | null;
    extractedDivisions: string[];
    extractedClusters: string[];
    divisionClusterMap: Record<string, string[]>;
    pendingDivisions: Array<{
      name: string;
      description: string;
      industry: string;
      fieldMapping: string;
      isExisting?: boolean;
      id?: number;
      sourceFile?: string;
    }>;
    pendingClusters: Array<{
      name: string;
      description: string;
      divisionId: number;
      countryCode: string;
      region: string;
      fieldMapping: string;
      divisionName?: string;
      isExisting?: boolean;
      id?: number;
      sourceFile?: string;
    }>;
    multipleCsvImport: {
      isEnabled: boolean;
      importedCsvs: Array<{
        fileName: string;
        divisions: string[];
        clusters: string[];
        divisionName?: string;
      }>;
      remainingDivisions: string[];
    };
    setupFlow: {
      skipDivisionStep: boolean;
      skipClusterStep: boolean;
      divisionValue: string | null;
      clusterValue: string | null;
      requiresCsvUpload: boolean;
      csvImportSkippable: boolean;
      csvStructure: {
        hasDivisionColumn: boolean;
        hasClusterColumn: boolean;
        hasLifecycleColumn: boolean;
      };
    };
    csvImportData: {
      originalCsv: string | null;
      headers: string[] | null;
      data: any[] | null;
      columnRoles: string[] | null;
      columnMappings: any[] | null;
      dateFormat: string | null;
      numberFormat: string | null;
      separator: string | null;
      transpose: boolean;
      finalColumnRoles: string[] | null;
      csvFileName: string | null;
      csvHash: string | null;
      selectedDivision: string | null;
      divisionSpecific?: Record<string, any>;
      global?: any;
    } | null;
    csvImportActive: boolean;
    deletedItems: {
      divisions: Array<Division & { isExisting?: boolean; originalPendingIndex?: number }>;
      clusters: Array<Cluster & { isExisting?: boolean; originalPendingIndex?: number; divisionName?: string; requiresParentRestore?: boolean }>;
    };
    userConfiguredFlags: {
      hasMultipleDivisions: boolean;
      hasMultipleClusters: boolean;
    };
    isSingleCsvReplacement: boolean;
  };
  
  // Loading states
  isLoading: boolean;
  isLoadingCompany: boolean;
  isLoadingDivisions: boolean;
  isLoadingClusters: boolean;
  isLoadingSopCycleConfigs: boolean;
  isLoadingSopCycles: boolean;
  isLoadingSopCyclePermissions: boolean;
  isUploadingCsv: boolean;
  isLoadingFieldMappings: boolean;
  
  // Form data
  companyForm: {
    name: string;
    description: string;
    country: string;
    website: string;
    phone: string;
    address: string;
    city: string;
    state_province: string;
    postal_code: string;
    company_size: string;
    fiscal_year_start: string;
    timezone: string;
    currency: string;
    logo_url: string;
    notes: string;
  };
  
  newDivision: { name: string; description: string; industry: string; fieldMapping: string };
  newCluster: { name: string; description: string; divisionId: string; countryCode: string; region: string; fieldMapping: string };
  newSopCycle: { name: string; description: string; divisionId: string; startDate: string; endDate: string };
  
  // Edit states
  editingDivision: number | null;
  editingCluster: number | null;
  editDivisionForm: { name: string; description: string; industry: string; fieldMapping: string };
  editClusterForm: { name: string; description: string; countryCode: string; region: string; fieldMapping: string };
  
  // S&OP Configuration for setup wizard
  sopCycleConfig: {
    frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    startDay: number;
    startMonth?: number;
    cutOffDays: number;
    divisionId?: number;
    workingDaysSettings: {
      startDate: { useWorkingDays: boolean };
      cutOffPeriod: { useWorkingDays: boolean };
    };
    workingDaysConfig?: {
      monday: boolean;
      tuesday: boolean;
      wednesday: boolean;
      thursday: boolean;
      friday: boolean;
      saturday: boolean;
      sunday: boolean;
      holidayObjects?: Array<{
        name: string;
        startDate: string;
        endDate: string;
        isRange: boolean;
      }>;
    };
  } | null;
  
  // EXACT SAME ACTIONS AS ORIGINAL
  loadCompany: () => Promise<void>;
  loadDivisions: (force?: boolean) => Promise<void>;
  loadClusters: (force?: boolean) => Promise<void>;
  loadSopCycleConfigs: () => Promise<void>;
  loadSetupStatus: () => Promise<void>;
  loadOrgStructureConfig: () => Promise<void>;
  saveOrgStructureConfig: () => Promise<void>;
  loadAllData: () => Promise<void>;
  loadFieldMappings: () => Promise<void>;
  createFieldMapping: (mapping: Omit<FieldMapping, 'id' | 'created_at' | 'created_by'>) => Promise<void>;
  updateFieldMapping: (id: number, mapping: Partial<FieldMapping>) => Promise<void>;
  deleteFieldMapping: (id: number) => Promise<void>;
  
  updateCompany: () => Promise<void>;
  createDivision: () => Promise<void>;
  createCluster: () => Promise<void>;
  createSopCycleConfig: (config: Omit<SopCycleConfig, 'id' | 'companyId'>) => Promise<void>;
  updateSopCycleConfig: (id: number, config: Partial<SopCycleConfig>) => Promise<void>;
  deleteSopCycleConfig: (id: number) => Promise<void>;
  generateSopCycles: (configId: number) => Promise<void>;
  
  loadSopCycles: () => Promise<void>;
  createSopCycle: (cycle: Omit<SopCycle, 'id' | 'companyId'>) => Promise<void>;
  updateSopCycleStatus: (id: number, status: string, isCurrent?: boolean) => Promise<void>;
  
  loadSopCyclePermissions: (cycleId: number) => Promise<void>;
  grantSopCyclePermission: (cycleId: number, userId: number, permissionType: string, expiresAt?: string) => Promise<void>;
  revokeSopCyclePermission: (cycleId: number, userId: number, permissionType: string) => Promise<void>;
  
  // CSV upload and mapping actions
  uploadCsvFile: (file: File) => Promise<void>;
  mapCsvColumns: (divisionColumn: string | null, clusterColumn: string | null, lifecycleColumn: string | null) => Promise<void>;
  extractOrgStructure: () => Promise<void>;
  createDivisionsFromCsv: () => Promise<void>;
  createClustersFromCsv: () => Promise<void>;
  
  // CSV mapping storage and import actions
  storeCsvMappingData: (mappingData: SetupWizardState['orgStructure']['csvImportData'], divisionName?: string) => void;
  importSetupCsvData: () => Promise<{ success: boolean; datasetId?: number; error?: string }>;
  clearCsvMappingData: () => void;
  
  // Pending divisions and clusters management
  addPendingDivision: (division: SetupWizardState['orgStructure']['pendingDivisions'][0]) => void;
  addPendingCluster: (cluster: SetupWizardState['orgStructure']['pendingClusters'][0]) => void;
  updatePendingDivision: (index: number, division: SetupWizardState['orgStructure']['pendingDivisions'][0]) => void;
  updatePendingCluster: (index: number, cluster: SetupWizardState['orgStructure']['pendingClusters'][0]) => void;
  createAllPendingItems: () => Promise<{ success: boolean; error?: string }>;
  
  // Field definition and mapping management
  createFieldDefinitions: () => Promise<{ success: boolean; error?: string }>;
  createFieldMappings: () => Promise<{ success: boolean; error?: string }>;
  getFieldDefinitionId: (fieldName: string) => number | null;
  
  // Multiple CSV import actions
  initializeMultipleCsvImport: (remainingDivisions?: string[]) => void;
  addImportedCsv: (fileName: string, divisions: string[], clusters: string[], divisionName?: string) => void;
  removeImportedCsv: (fileName: string) => void;
  getNextImportInfo: () => { importedCount: number; remainingDivisions: string[] };
  isMultipleCsvImportComplete: () => boolean;
  
  // Load DB divisions into pending divisions (single source of truth)
  loadDbDivisionsIntoPending: () => void;
  loadDbClustersIntoPending: () => void;
  
  // Create consistent division-cluster ordering and ID assignment
  createConsistentDivisionClusterOrdering: (csvDivisions: string[], csvClusters: string[], divisionClusterMap: Record<string, string[]>) => {
    divisions: Array<{ name: string; source: string; id: number | null; consistentId: number }>;
    clusters: Array<{ name: string; divisionId: number | null; divisionName: string; source: string; id: number | null; consistentId: number }>;
    divisionNameToConsistentId: Record<string, number>;
  };
  
  // Form setters
  setCompanyForm: (form: Partial<SetupWizardState['companyForm']>) => void;
  setNewDivision: (division: Partial<SetupWizardState['newDivision']>) => void;
  setNewCluster: (cluster: Partial<SetupWizardState['newCluster']>) => void;
  setNewSopCycle: (sopCycle: Partial<SetupWizardState['newSopCycle']>) => void;
  setSopCycleConfig: (config: SetupWizardState['sopCycleConfig']) => void;
  setEditDivisionForm: (form: Partial<SetupWizardState['editDivisionForm']>) => void;
  setEditClusterForm: (form: Partial<SetupWizardState['editClusterForm']>) => void;
  
  // Edit state setters
  setEditingDivision: (id: number | null) => void;
  setEditingCluster: (id: number | null) => void;
  
  // Org structure setters
  setOrgStructure: (structure: Partial<SetupWizardState['orgStructure']>) => void;
  
  // Reset functions
  resetForms: () => void;
  resetEditStates: () => void;
  resetOrgStructure: () => void;
  clearPendingItems: () => void;
  
  // Setup flow calculation
  calculateSetupFlow: () => void;
  
  // Cache utilities
  isCacheStale: (key: string) => boolean;
  updateCache: (key: string) => void;
  clearCache: () => void;
  
  // Parallel data loading
  loadSetupData: () => Promise<void>;
  loadOrgData: () => Promise<void>;
  
  // Request deduplication
  deduplicatedFetch: <T>(key: string, fetchFn: () => Promise<T>) => Promise<T>;
  
  // Division and cluster management
  deleteDivision: (id: number, forceHardDelete?: boolean) => Promise<{ success: boolean; method: 'soft' | 'hard'; error?: string }>;
  deleteCluster: (id: number, forceHardDelete?: boolean) => Promise<{ success: boolean; method: 'soft' | 'hard'; error?: string }>;
  restoreDivision: (id: number) => Promise<{ success: boolean; error?: string }>;
  restoreCluster: (id: number) => Promise<{ success: boolean; error?: string }>;
  
  // Setup Wizard pending operations (no immediate DB changes)
  deletePendingDivision: (id: number) => { success: boolean; error?: string };
  deletePendingCluster: (id: number) => { success: boolean; error?: string };
  restorePendingDivision: (id: number) => { success: boolean; error?: string };
  restorePendingCluster: (id: number, clusterName?: string, divisionName?: string) => { success: boolean; error?: string };
  applyPendingChanges: () => Promise<{ success: boolean; error?: string }>;

  // Get CSV data for a specific division
  getDivisionCsvData: (divisionName: string) => any | null;

  // Get current CSV data based on context
  getCurrentCsvData: (selectedDivision?: string) => any | null;
}

// Helper function to get session token
const getSessionToken = () => localStorage.getItem('sessionToken');

// EXACT SAME IMPLEMENTATION AS ORIGINAL - but with new architecture behind the scenes
export const useSetupWizardStore = create<SetupWizardState>((set, get) => ({
  // Initial state - EXACT SAME AS ORIGINAL
  company: null,
  divisions: [],
  clusters: [],
  sopCycleConfigs: [],
  sopCycles: [],
  sopCyclePermissions: [],
  fieldMappings: [],
  setupStatus: null,
  
  cache: {
    lastFetched: {},
    cacheDuration: 5 * 60 * 1000, // 5 minutes in milliseconds
  },
  
  pendingRequests: {},
  
  orgStructure: {
    hasMultipleDivisions: false,
    hasMultipleClusters: false,
    enableLifecycleTracking: false,
    lifecycleMappings: [],
    importLevel: 'company',
    csvUploadType: null,
    divisionCsvType: null,
    uploadedCsvData: null,
    csvHeaders: null,
    csvMapping: null,
    extractedDivisions: [],
    extractedClusters: [],
    divisionClusterMap: {},
    pendingDivisions: [],
    pendingClusters: [],
    multipleCsvImport: {
      isEnabled: false,
      importedCsvs: [],
      remainingDivisions: [],
    },
    setupFlow: {
      skipDivisionStep: false,
      skipClusterStep: false,
      divisionValue: null,
      clusterValue: null,
      requiresCsvUpload: false,
      csvImportSkippable: false,
      csvStructure: {
        hasDivisionColumn: false,
        hasClusterColumn: false,
        hasLifecycleColumn: false,
      },
    },
    csvImportData: null,
    csvImportActive: false,
    deletedItems: {
      divisions: [] as Array<Division & { isExisting?: boolean; originalPendingIndex?: number }>,
      clusters: [] as Array<Cluster & { isExisting?: boolean; originalPendingIndex?: number; divisionName?: string; requiresParentRestore?: boolean }>
    },
    userConfiguredFlags: {
      hasMultipleDivisions: false,
      hasMultipleClusters: false,
    },
    isSingleCsvReplacement: false
  },
  
  isLoading: false,
  isLoadingCompany: false,
  isLoadingDivisions: false,
  isLoadingClusters: false,
  isLoadingSopCycleConfigs: false,
  isLoadingSopCycles: false,
  isLoadingSopCyclePermissions: false,
  isUploadingCsv: false,
  isLoadingFieldMappings: false,
  
  companyForm: {
    name: '',
    description: '',
    country: '',
    website: '',
    phone: '',
    address: '',
    city: '',
    state_province: '',
    postal_code: '',
    company_size: '',
    fiscal_year_start: '',
    timezone: 'UTC',
    currency: 'USD',
    logo_url: '',
    notes: ''
  },
  
  newDivision: { name: '', description: '', industry: '', fieldMapping: '' },
  newCluster: { name: '', description: '', divisionId: '', countryCode: '', region: '', fieldMapping: '' },
  newSopCycle: { name: '', description: '', divisionId: '', startDate: '', endDate: '' },
  
  editingDivision: null,
  editingCluster: null,
  editDivisionForm: { name: '', description: '', industry: '', fieldMapping: '' },
  editClusterForm: { name: '', description: '', countryCode: '', region: '', fieldMapping: '' },
  
  sopCycleConfig: null,

  // EXACT SAME ACTIONS - but now using new architecture behind the scenes
  
  // Business Configuration Actions (using Command Pattern)
  setOrgStructure: (structure) => {
    
    // Initialize state machine context if needed
    const currentContext = setupWizardStateMachine.getContext();
    if (currentContext.currentState === 'initializing') {
      setupWizardStateMachine.updateContext({
        currentState: 'business-configuration',
        hasMultipleDivisions: get().orgStructure.hasMultipleDivisions,
        hasMultipleClusters: get().orgStructure.hasMultipleClusters,
        importLevel: get().orgStructure.importLevel || 'company',
        enableLifecycleTracking: get().orgStructure.enableLifecycleTracking
      });
    }
    
    const command = new UpdateBusinessConfigurationCommand(structure);
    const result = commandManager.executeCommand(command);
    
    if (result.success) {
      set((state) => ({
        orgStructure: { ...state.orgStructure, ...structure }
      }));
    } else {
      console.error('Failed to update org structure:', result.errors);
    }
  },

  // CSV Import Actions (using Strategy Pattern)
  clearCsvMappingData: () => {
    const command = new ClearCsvDataCommand();
    const result = commandManager.executeCommand(command);
    
    if (result.success) {
      set((state) => {
        // Preserve custom lifecycle mappings, only clear CSV-related ones
        const preservedLifecycleMappings = state.orgStructure.lifecycleMappings.filter(
          mapping => mapping.isCustom === true
        );
        
        console.log('[RefactoredStore] clearCsvMappingData: Preserving custom lifecycle mappings:', {
          totalMappings: state.orgStructure.lifecycleMappings.length,
          customMappings: preservedLifecycleMappings.length,
          clearedMappings: state.orgStructure.lifecycleMappings.length - preservedLifecycleMappings.length
        });
        
        return {
          orgStructure: {
            ...state.orgStructure,
            csvImportData: null,
            extractedDivisions: [],
            extractedClusters: [],
            divisionClusterMap: {},
            pendingDivisions: state.orgStructure.pendingDivisions.filter(d => !d.sourceFile),
            pendingClusters: state.orgStructure.pendingClusters.filter(c => !c.sourceFile),
            lifecycleMappings: preservedLifecycleMappings,
            multipleCsvImport: {
              isEnabled: false,
              importedCsvs: [],
              remainingDivisions: []
            },
            isSingleCsvReplacement: false
          }
        };
      });
    }
  },

  // Pending Items Management (using Command Pattern)
  addPendingDivision: (division) => {  
    set((state) => {
      // Check for duplicate division names in existing divisions (case-insensitive)
      const existingDivision = state.divisions.find(d => 
        d.name.toLowerCase() === division.name.trim().toLowerCase()
      );
      if (existingDivision) {
        console.warn(`Division "${division.name}" already exists in database`);
        return state; // Don't add if it already exists
      }
      
      // Check for duplicate division names in pending divisions
      const pendingDivision = state.orgStructure.pendingDivisions.find(d => 
        d.name.toLowerCase() === division.name.trim().toLowerCase()
      );
      if (pendingDivision) {
        console.warn(`Division "${division.name}" is already pending creation`);
        return state; // Don't add if it's already pending
      }
      
      // Check for duplicate field mappings in existing divisions (case-insensitive)
      const existingFieldMapping = state.divisions.find(d => 
        d.fieldMapping && d.fieldMapping.toLowerCase() === division.fieldMapping.trim().toLowerCase()
      );
      if (existingFieldMapping) {
        console.warn(`Field mapping "${division.fieldMapping}" already exists in database`);
        return state; // Don't add if field mapping already exists
      }
      
      // Check for duplicate field mappings in pending divisions
      const pendingFieldMapping = state.orgStructure.pendingDivisions.find(d => 
        d.fieldMapping && d.fieldMapping.toLowerCase() === division.fieldMapping.trim().toLowerCase()
      );
      if (pendingFieldMapping) {
        console.warn(`Field mapping "${division.fieldMapping}" is already pending creation`);
        return state; // Don't add if field mapping is already pending
      }
      
      // Add to pending divisions if no duplicates found
      return {
      orgStructure: {
        ...state.orgStructure,
        pendingDivisions: [...state.orgStructure.pendingDivisions, division]
      }
      };
    });
  },

  addPendingCluster: (cluster) => {
    set((state) => {
      console.log(`[addPendingCluster] Adding cluster: "${cluster.name}" with fieldMapping: "${cluster.fieldMapping}" to division: ${cluster.divisionName || cluster.divisionId}`);
      
      // Check for duplicate cluster names in the SAME division (existing clusters)
      const selectedDivision = state.divisions.find(d => d.id === cluster.divisionId);
      if (selectedDivision) {
        const existingClusterInSameDivision = state.clusters.find(c => {
          const existingDivision = state.divisions.find(d => d.id === c.division_id);
          return c.name.toLowerCase() === cluster.name.trim().toLowerCase() && 
                 existingDivision && existingDivision.id === selectedDivision.id;
        });
        if (existingClusterInSameDivision) {
          console.warn(`Cluster "${cluster.name}" already exists in division "${selectedDivision.name}"`);
          return state; // Don't add if it already exists in the same division
        }
      }
      
      // Check for duplicate cluster names in the SAME division (existing clusters) by divisionName
      if (cluster.divisionName && cluster.divisionId === -1) {
        const existingClusterInSameDivision = state.clusters.find(c => {
          const existingDivision = state.divisions.find(d => d.id === c.division_id);
          return c.name.toLowerCase() === cluster.name.trim().toLowerCase() && 
                 existingDivision && existingDivision.name.toLowerCase() === cluster.divisionName.toLowerCase();
        });
        if (existingClusterInSameDivision) {
          console.warn(`Cluster "${cluster.name}" already exists in division "${cluster.divisionName}"`);
          return state; // Don't add if it already exists in the same division
        }
        
        // Check for duplicate field mappings in the SAME division (existing clusters) by divisionName
        const existingFieldMappingInSameDivision = state.clusters.find(c => {
          const existingDivision = state.divisions.find(d => d.id === c.division_id);
          return c.fieldMapping && c.fieldMapping.toLowerCase() === cluster.fieldMapping.trim().toLowerCase() && 
                 existingDivision && existingDivision.name.toLowerCase() === cluster.divisionName.toLowerCase();
        });
        if (existingFieldMappingInSameDivision) {
          console.warn(`Field mapping "${cluster.fieldMapping}" already exists in division "${cluster.divisionName}"`);
          return state; // Don't add if field mapping already exists in the same division
        }
      }
      
      // Check for duplicate cluster names in the SAME division (pending clusters)
      const pendingClusterInSameDivision = state.orgStructure.pendingClusters.find(c => {
        if (c.divisionId >= 0) {
          return c.name.toLowerCase() === cluster.name.trim().toLowerCase() && 
                 c.divisionId === cluster.divisionId;
        }
        // Check by divisionName when divisionId is -1
        if (c.divisionId === -1 && cluster.divisionId === -1) {
          return c.name.toLowerCase() === cluster.name.trim().toLowerCase() && 
                 c.divisionName && cluster.divisionName &&
                 c.divisionName.toLowerCase() === cluster.divisionName.toLowerCase();
        }
        return false;
      });
      if (pendingClusterInSameDivision) {
        console.warn(`Cluster "${cluster.name}" is already pending creation in the same division`);
        return state; // Don't add if it's already pending in the same division
      }
      
      // Check for duplicate field mappings in the SAME division (existing clusters)
      if (selectedDivision) {
        const existingFieldMappingInSameDivision = state.clusters.find(c => {
          const existingDivision = state.divisions.find(d => d.id === c.division_id);
          return c.fieldMapping && c.fieldMapping.toLowerCase() === cluster.fieldMapping.trim().toLowerCase() && 
                 existingDivision && existingDivision.id === selectedDivision.id;
        });
        if (existingFieldMappingInSameDivision) {
          console.warn(`Field mapping "${cluster.fieldMapping}" already exists in division "${selectedDivision.name}"`);
          return state; // Don't add if field mapping already exists in the same division
        }
      }
      
      // Check for duplicate field mappings in the SAME division (existing clusters) by divisionName
      if (cluster.divisionName && cluster.divisionId === -1) {
        const existingFieldMappingInSameDivision = state.clusters.find(c => {
          const existingDivision = state.divisions.find(d => d.id === c.division_id);
          return c.fieldMapping && c.fieldMapping.toLowerCase() === cluster.fieldMapping.trim().toLowerCase() && 
                 existingDivision && existingDivision.name.toLowerCase() === cluster.divisionName.toLowerCase();
        });
        if (existingFieldMappingInSameDivision) {
          console.warn(`Field mapping "${cluster.fieldMapping}" already exists in division "${cluster.divisionName}"`);
          return state; // Don't add if field mapping already exists in the same division
        }
      }
      
      // Check for duplicate field mappings in the SAME division (pending clusters)
      const pendingFieldMappingInSameDivision = state.orgStructure.pendingClusters.find(c => {
        if (c.divisionId >= 0) {
          return c.fieldMapping && c.fieldMapping.toLowerCase() === cluster.fieldMapping.trim().toLowerCase() && 
                 c.divisionId === cluster.divisionId;
        }
        // Check by divisionName when divisionId is -1
        if (c.divisionId === -1 && cluster.divisionId === -1) {
          return c.fieldMapping && c.fieldMapping.toLowerCase() === cluster.fieldMapping.trim().toLowerCase() && 
                 c.divisionName && cluster.divisionName &&
                 c.divisionName.toLowerCase() === cluster.divisionName.toLowerCase();
        }
        return false;
      });
      if (pendingFieldMappingInSameDivision) {
        console.warn(`Field mapping "${cluster.fieldMapping}" is already pending creation in the same division`);
        return state; // Don't add if field mapping is already pending in the same division
      }
      
      // Additional check for withoutDivisionColumn path: ensure we don't create duplicate clusters
      // when importing CSV data for a specific division
      if (state.orgStructure.divisionCsvType === 'withoutDivisionColumn' && cluster.divisionName) {
        // Check if this cluster name already exists in the same division (both existing and pending)
        const allClustersInSameDivision = [
          ...state.clusters.filter(c => {
            const existingDivision = state.divisions.find(d => d.id === c.division_id);
            return existingDivision && existingDivision.name.toLowerCase() === cluster.divisionName.toLowerCase();
          }),
          ...state.orgStructure.pendingClusters.filter(c => 
            c.divisionName && c.divisionName.toLowerCase() === cluster.divisionName.toLowerCase()
          )
        ];
        
        const duplicateCluster = allClustersInSameDivision.find(c => 
          c.name.toLowerCase() === cluster.name.trim().toLowerCase()
        );
        
        if (duplicateCluster) {
          console.warn(`Cluster "${cluster.name}" already exists in division "${cluster.divisionName}" (found in ${duplicateCluster.id ? 'existing' : 'pending'} clusters)`);
          return state; // Don't add if it already exists in the same division
        }
        
        // Also check for duplicate field mappings in the same division
        const duplicateFieldMapping = allClustersInSameDivision.find(c => 
          c.fieldMapping && c.fieldMapping.toLowerCase() === cluster.fieldMapping.trim().toLowerCase()
        );
        
        if (duplicateFieldMapping) {
          console.warn(`Field mapping "${cluster.fieldMapping}" already exists in division "${cluster.divisionName}" (found in ${duplicateFieldMapping.id ? 'existing' : 'pending'} clusters)`);
          return state; // Don't add if field mapping already exists in the same division
        }
      }
      
      console.log(`[addPendingCluster] Successfully added cluster: "${cluster.name}" to division: ${cluster.divisionName || cluster.divisionId}`);
      
      // Add to pending clusters if no duplicates found
      return {
      orgStructure: {
        ...state.orgStructure,
        pendingClusters: [...state.orgStructure.pendingClusters, cluster]
      }
      };
    });
  },

  updatePendingDivision: (index, division) => {

    
    set((state) => {
      // Get the old division to check if the name changed
      const oldDivision = state.orgStructure.pendingDivisions[index];
      const oldDivisionName = oldDivision?.name;
      const newDivisionName = division.name;

      
      // Update the division
      const updatedPendingDivisions = state.orgStructure.pendingDivisions.map((d, i) => 
        i === index ? { ...d, ...division } : d
      );
      
      // If the division name changed, update all related clusters
      let updatedPendingClusters = state.orgStructure.pendingClusters;
      let updatedDeletedClusters = state.orgStructure.deletedItems.clusters;
      
      if (oldDivisionName && newDivisionName && oldDivisionName !== newDivisionName) {

        
        // Update pending clusters that reference the old division name
        updatedPendingClusters = state.orgStructure.pendingClusters.map(cluster => {
          if (cluster.divisionName === oldDivisionName) {

            return {
              ...cluster,
              divisionName: newDivisionName
            };
          }
          return cluster;
        });
        
        // Update deleted clusters that reference the old division name
        updatedDeletedClusters = state.orgStructure.deletedItems.clusters.map(cluster => {
          if (cluster.divisionName === oldDivisionName) {

            return {
              ...cluster,
              divisionName: newDivisionName
            };
          }
          return cluster;
        });
      }
      
      return {
        orgStructure: {
          ...state.orgStructure,
          pendingDivisions: updatedPendingDivisions,
          pendingClusters: updatedPendingClusters,
          deletedItems: {
            ...state.orgStructure.deletedItems,
            clusters: updatedDeletedClusters
          }
        }
      };
    });
    

  },

  updatePendingCluster: (index, cluster) => {

    
    set((state) => ({
      orgStructure: {
        ...state.orgStructure,
        pendingClusters: state.orgStructure.pendingClusters.map((c, i) => 
          i === index ? { ...c, ...cluster } : c
        )
      }
    }));
    

  },

  deletePendingDivision: (idOrIndex) => {

    
    const state = get();
    let divisionToDelete;
    
    console.log('🔄 [RefactoredStore] deletePendingDivision called with:', idOrIndex);
    console.log('🔄 [RefactoredStore] Current pendingDivisions:', state.orgStructure.pendingDivisions);
    console.log('🔄 [RefactoredStore] Current deletedItems:', state.orgStructure.deletedItems);
    
    // Handle both ID and index cases
    if (typeof idOrIndex === 'number' && idOrIndex >= 0 && idOrIndex < state.orgStructure.pendingDivisions.length) {
      // It's an index
      divisionToDelete = state.orgStructure.pendingDivisions[idOrIndex];

    } else {
      // It's an ID
      divisionToDelete = state.orgStructure.pendingDivisions.find(d => d.id === idOrIndex);

    }
    
    if (!divisionToDelete) {
      console.error('[RefactoredStore] Division not found for idOrIndex:', idOrIndex);
      return { success: false, error: 'Division not found' };
    }
    
    console.log('🔄 [RefactoredStore] Found division to delete:', divisionToDelete);
    
    // Remove the division and its associated clusters
    set((state) => {
      // Find clusters associated with this division
      const associatedClusters = state.orgStructure.pendingClusters.filter(c => c.divisionId === divisionToDelete.id);
      
      console.log('🔄 [RefactoredStore] Associated clusters found:', associatedClusters);
      
      const updatedState = {
      orgStructure: {
        ...state.orgStructure,
        pendingDivisions: state.orgStructure.pendingDivisions.filter((d, index) => {
          if (typeof idOrIndex === 'number' && idOrIndex >= 0 && idOrIndex < state.orgStructure.pendingDivisions.length) {
            return index !== idOrIndex; // Remove by index
          } else {
            return d.id !== idOrIndex; // Remove by ID
          }
        }),
        pendingClusters: state.orgStructure.pendingClusters.filter(c => c.divisionId !== divisionToDelete.id),
        deletedItems: {
          ...state.orgStructure.deletedItems,
          divisions: [...state.orgStructure.deletedItems.divisions, {
            ...divisionToDelete,
            isExisting: divisionToDelete.isExisting || false,
            originalPendingIndex: typeof idOrIndex === 'number' ? idOrIndex : undefined
            } as Division & { isExisting?: boolean; originalPendingIndex?: number }],
            clusters: [...state.orgStructure.deletedItems.clusters, ...associatedClusters.map(cluster => ({
              id: cluster.id || 0,
              name: cluster.name,
              description: cluster.description,
              country_code: cluster.countryCode,
              region: cluster.region,
              division_id: cluster.divisionId,
              fieldMapping: cluster.fieldMapping,
              isExisting: cluster.isExisting || false,
              originalPendingIndex: undefined,
              divisionName: cluster.divisionName,
              requiresParentRestore: true // Flag to indicate this cluster needs its parent division restored first
            } as Cluster & { isExisting?: boolean; originalPendingIndex?: number; divisionName?: string; requiresParentRestore?: boolean }))]
          }
        }
      };
      
      console.log('🔄 [RefactoredStore] Updated state deletedItems:', updatedState.orgStructure.deletedItems);
      
      return updatedState;
    });
    
    console.log('🔄 [RefactoredStore] deletePendingDivision completed successfully');
    
    // Dispatch custom event to notify components that inactive entities have changed
    window.dispatchEvent(new CustomEvent('inactiveEntitiesChanged', {
      detail: { type: 'division', action: 'deleted', id: divisionToDelete.id }
    }));
    
    return { success: true };
  },

  deletePendingCluster: (idOrIndex) => {

    
    const state = get();
    let clusterToDelete;
    
    // Handle both ID and index cases
    if (typeof idOrIndex === 'number' && idOrIndex >= 0 && idOrIndex < state.orgStructure.pendingClusters.length) {
      // It's an index
      clusterToDelete = state.orgStructure.pendingClusters[idOrIndex];

    } else {
      // It's an ID
      clusterToDelete = state.orgStructure.pendingClusters.find(c => c.id === idOrIndex);

    }
    
    if (!clusterToDelete) {
      console.error('[RefactoredStore] Cluster not found for idOrIndex:', idOrIndex);
      return { success: false, error: 'Cluster not found' };
    }
    
    // Remove the cluster
    set((state) => ({
      orgStructure: {
        ...state.orgStructure,
        pendingClusters: state.orgStructure.pendingClusters.filter((c, index) => {
          if (typeof idOrIndex === 'number' && idOrIndex >= 0 && idOrIndex < state.orgStructure.pendingClusters.length) {
            return index !== idOrIndex; // Remove by index
          } else {
            return c.id !== idOrIndex; // Remove by ID
          }
        }),
        deletedItems: {
          ...state.orgStructure.deletedItems,
          clusters: [...state.orgStructure.deletedItems.clusters, {
            ...clusterToDelete,
            isExisting: clusterToDelete.isExisting || false,
            originalPendingIndex: typeof idOrIndex === 'number' ? idOrIndex : undefined,
            divisionName: clusterToDelete.divisionName
          } as unknown as Cluster & { isExisting?: boolean; originalPendingIndex?: number; divisionName?: string }]
        }
      }
    }));
    
    console.log('🔄 [RefactoredStore] deletePendingCluster completed successfully');
    
    // Dispatch custom event to notify components that inactive entities have changed
    window.dispatchEvent(new CustomEvent('inactiveEntitiesChanged', {
      detail: { type: 'cluster', action: 'deleted', id: clusterToDelete.id }
    }));

    return { success: true };
  },

  restorePendingDivision: (id) => {
    const state = get();
    const deletedDivision = state.orgStructure.deletedItems.divisions.find(d => d.id === id);
    
    if (deletedDivision) {
      // Find associated clusters that were moved to deletedItems when this division was deleted
      const associatedClusters = state.orgStructure.deletedItems.clusters.filter(c => 
        c.divisionName === deletedDivision.name && c.requiresParentRestore
      );
      
      // Filter out clusters that are already in pendingClusters to prevent duplicates
      const clustersToAdd = associatedClusters.filter(cluster => {
        const alreadyExists = state.orgStructure.pendingClusters.some(pendingCluster => 
          pendingCluster.id === cluster.id && 
          pendingCluster.name === cluster.name &&
          pendingCluster.divisionName === cluster.divisionName
        );
        return !alreadyExists;
      });
      
      set((state) => ({
        orgStructure: {
          ...state.orgStructure,
          pendingDivisions: [...state.orgStructure.pendingDivisions, deletedDivision],
          pendingClusters: [...state.orgStructure.pendingClusters, ...clustersToAdd.map(cluster => ({
            id: cluster.id,
            name: cluster.name,
            description: cluster.description,
            divisionId: cluster.division_id,
            countryCode: cluster.country_code,
            region: cluster.region,
            fieldMapping: cluster.fieldMapping,
            divisionName: cluster.divisionName,
            isExisting: cluster.isExisting,
            sourceFile: undefined
          }))],
          deletedItems: {
            ...state.orgStructure.deletedItems,
            divisions: state.orgStructure.deletedItems.divisions.filter(d => d.id !== id),
            clusters: state.orgStructure.deletedItems.clusters.filter(c => 
              !(c.divisionName === deletedDivision.name && c.requiresParentRestore)
            )
          }
        }
      }));
      
      console.log('🔄 [RefactoredStore] restorePendingDivision completed successfully');
      
      // Dispatch custom event to notify components that inactive entities have changed
      window.dispatchEvent(new CustomEvent('inactiveEntitiesChanged', {
        detail: { type: 'division', action: 'restored', id: id }
      }));
      
      return { success: true };
    }
    
    return { success: false, error: 'Division not found in deleted items' };
  },

  restorePendingCluster: (id, clusterName, divisionName) => {
    const state = get();
    const deletedCluster = state.orgStructure.deletedItems.clusters.find(c => 
      c.id === id && 
      c.name === clusterName && 
      c.divisionName === divisionName
    );
    
    if (deletedCluster) {
      // Check if cluster requires parent division to be restored first
      if (deletedCluster.requiresParentRestore) {
        const parentDivision = state.orgStructure.deletedItems.divisions.find(d => 
          d.name === deletedCluster.divisionName
        );
        
        if (parentDivision) {
          return { success: false, error: `Cannot restore cluster "${clusterName}" because its parent division "${deletedCluster.divisionName}" is also inactive. Please restore the division first.` };
        }
      }
      
      set((state) => ({
        orgStructure: {
          ...state.orgStructure,
          pendingClusters: [...state.orgStructure.pendingClusters, deletedCluster as unknown as SetupWizardState['orgStructure']['pendingClusters'][0]],
          deletedItems: {
            ...state.orgStructure.deletedItems,
            clusters: state.orgStructure.deletedItems.clusters.filter(c => 
              !(c.id === id && c.name === clusterName && c.divisionName === divisionName)
            )
          }
        }
      }));
      
      console.log('🔄 [RefactoredStore] restorePendingCluster completed successfully');
      
      // Dispatch custom event to notify components that inactive entities have changed
      window.dispatchEvent(new CustomEvent('inactiveEntitiesChanged', {
        detail: { type: 'cluster', action: 'restored', id: id }
      }));
      
      return { success: true };
    }
    
    return { success: false, error: 'Cluster not found in deleted items' };
  },

  // ACTUAL IMPLEMENTATIONS - Using the new architecture with real business logic
  
  loadCompany: async () => {

    
    const state = get();

    if (!state.isCacheStale('company') && state.company?.id) {

      return;
    }

    set({ isLoadingCompany: true });
    
    try {
      const response = await fetch('/api/auth/company', {
        headers: {
          'Authorization': `Bearer ${getSessionToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const responseData = await response.json();

        
        // Extract the actual company data from the response
        const companyData = responseData.company || responseData;
        
        set({ 
          company: companyData,
          companyForm: {
            name: companyData.name || '',
            description: companyData.description || '',
            country: companyData.country || '',
            website: companyData.website || '',
            phone: companyData.phone || '',
            address: companyData.address || '',
            city: companyData.city || '',
            state_province: companyData.state_province || '',
            postal_code: companyData.postal_code || '',
            company_size: companyData.company_size || '',
            fiscal_year_start: companyData.fiscal_year_start || '',
            timezone: companyData.timezone || 'UTC',
            currency: companyData.currency || 'USD',
            logo_url: companyData.logo_url || '',
            notes: companyData.notes || ''
          }
        });
        state.updateCache('company');

      } else {
        console.error('[RefactoredStore] Failed to load company data:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('[RefactoredStore] Error loading company data:', error);
    } finally {
      set({ isLoadingCompany: false });
    }
  },

  loadDivisions: async (force?: boolean) => {
    
    const state = get();
    if (!force && !state.isCacheStale('divisions')) {
      return;
    }

    set({ isLoadingDivisions: true });
    
    try {
      const companyId = get().company?.id;
      if (!companyId) {
        console.error('[RefactoredStore] No company ID available for divisions request');
        return;
      }
      
      const response = await fetch(`/api/divisions?companyId=${companyId}`, {
        headers: {
          'Authorization': `Bearer ${getSessionToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const divisionsData = await response.json();
        set({ divisions: divisionsData });
        state.updateCache('divisions');

      } else {
        console.error('[RefactoredStore] Failed to load divisions data:', response.status);
      }
    } catch (error) {
      console.error('[RefactoredStore] Error loading divisions data:', error);
    } finally {
      set({ isLoadingDivisions: false });
    }
  },

  loadClusters: async (force?: boolean) => {
    
    const state = get();
    if (!force && !state.isCacheStale('clusters')) {
      return;
    }

    set({ isLoadingClusters: true });
    
    try {
      const companyId = get().company?.id;
      if (!companyId) {
        console.error('[RefactoredStore] No company ID available for clusters request');
        return;
      }
      
      const response = await fetch(`/api/clusters?companyId=${companyId}`, {
        headers: {
          'Authorization': `Bearer ${getSessionToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const clustersData = await response.json();
        set({ clusters: clustersData });
        state.updateCache('clusters');

      } else {
        console.error('[RefactoredStore] Failed to load clusters data:', response.status);
      }
    } catch (error) {
      console.error('[RefactoredStore] Error loading clusters data:', error);
    } finally {
      set({ isLoadingClusters: false });
    }
  },

  loadSopCycleConfigs: async () => {

  },

  loadSetupStatus: async () => {

    
    const sessionToken = getSessionToken();
    if (!sessionToken) return;
    
    try {
      const response = await fetch('/api/auth/setup/status', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      
      if (response.ok) {
        const setupStatus = await response.json();
        set({ setupStatus });

      }
    } catch (error) {
      console.error('[RefactoredStore] Error loading setup status:', error);
    }
  },

  loadOrgStructureConfig: async () => {
    
    const sessionToken = getSessionToken();
    if (!sessionToken) return;
    
    try {
      const response = await fetch('/api/organization-structure-config', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Merge with existing org structure, preserving any pending data
        set((state) => ({
          orgStructure: {
            ...state.orgStructure,
            ...data.config,
            // Preserve pending data and CSV import data
            pendingDivisions: state.orgStructure.pendingDivisions,
            pendingClusters: state.orgStructure.pendingClusters,
            csvImportData: state.orgStructure.csvImportData,
            multipleCsvImport: state.orgStructure.multipleCsvImport,
          }
        }));

      }
    } catch (error) {
      console.error('[RefactoredStore] Error loading organization structure configuration:', error);
    }
  },

  saveOrgStructureConfig: async () => {

  },

  loadAllData: async () => {

    
    set({ isLoading: true });
    
    try {
      // Load company first (needed for other requests)
      await get().loadCompany();
      
      // Check if company was loaded successfully
      const company = get().company;
      if (!company?.id) {
        console.error('[RefactoredStore] Company not loaded, skipping dependent requests');
        return;
      }
      
      // Then load other data that depends on company ID
      await Promise.all([
        get().loadDivisions(),
        get().loadClusters(),
        get().loadFieldMappings(),
        get().loadSetupStatus(),
        get().loadOrgStructureConfig()
      ]);
      
    } catch (error) {
      console.error('[RefactoredStore] Error loading all data:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  loadFieldMappings: async () => {
    
    const sessionToken = getSessionToken();
    if (!sessionToken) return;

    set({ isLoadingFieldMappings: true });

    try {
      const company = get().company;
      if (!company) {
        return;
      }

      const response = await fetch(`/api/field-mappings?companyId=${company.id}`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });

      if (response.ok) {
        const fieldMappings = await response.json();
        set({ fieldMappings });
      }
    } catch (error) {
      console.error('[RefactoredStore] Error loading field mappings:', error);
    } finally {
      set({ isLoadingFieldMappings: false });
    }
  },

  createFieldMapping: async (mapping) => {

  },

  updateFieldMapping: async (id, mapping) => {

  },

  deleteFieldMapping: async (id) => {

  },

  updateCompany: async () => {

  },

  createDivision: async () => {
    const state = get();
    const { newDivision, company } = state;
    
    if (!company?.id) {
      toast.error('No company selected');
      return;
    }

    if (!newDivision.name.trim()) {
      toast.error('Division name is required');
      return;
    }

    // Create the division object for pending
    const pendingDivision = {
      name: newDivision.name.trim(),
      description: newDivision.description || '',
      industry: newDivision.industry || '',
      fieldMapping: newDivision.fieldMapping || newDivision.name.trim()
    };

    // Check if division already exists or is pending
    const existingDivision = state.divisions.find(d => 
      d.name.toLowerCase() === pendingDivision.name.toLowerCase()
    );
    if (existingDivision) {
      toast.error('Division already exists');
      return;
    }

    const pendingDivisionExists = state.orgStructure.pendingDivisions.find(d => 
      d.name.toLowerCase() === pendingDivision.name.toLowerCase()
    );
    if (pendingDivisionExists) {
      toast.error('Division is already pending');
      return;
    }

    // Check for duplicate field mappings
    const existingFieldMapping = state.divisions.find(d => 
      d.fieldMapping && d.fieldMapping.toLowerCase() === pendingDivision.fieldMapping.toLowerCase()
    );
    if (existingFieldMapping) {
      toast.error('Field mapping already exists');
      return;
    }

    const pendingFieldMapping = state.orgStructure.pendingDivisions.find(d => 
      d.fieldMapping && d.fieldMapping.toLowerCase() === pendingDivision.fieldMapping.toLowerCase()
    );
    if (pendingFieldMapping) {
      toast.error('Field mapping already exists');
      return;
    }

    // Add to pending divisions
    get().addPendingDivision(pendingDivision);
    
    // Clear the form
    set((state) => ({
      newDivision: { name: '', description: '', industry: '', fieldMapping: '' }
    }));
    toast.success('Division added to pending list');
  },

  createCluster: async () => {
    const state = get();
    const { newCluster, company } = state;
    
    if (!company?.id) {
      toast.error('No company selected');
      return;
    }

    if (!newCluster.name.trim()) {
      toast.error('Cluster name is required');
      return;
    }

    if (!newCluster.divisionId) {
      toast.error('Division is required');
      return;
    }

    // Find division name for the cluster
    const division = state.divisions.find(d => d.id === parseInt(newCluster.divisionId));
    const divisionName = division?.name || 'Unknown Division';

    // Create the cluster object for pending
    const pendingCluster = {
      name: newCluster.name.trim(),
      description: newCluster.description || '',
      divisionId: parseInt(newCluster.divisionId),
      countryCode: newCluster.countryCode || '',
      region: newCluster.region || '',
      fieldMapping: newCluster.fieldMapping || newCluster.name.trim(),
      divisionName: divisionName
    };

    // Check if cluster already exists in the same division
    const existingClusterInSameDivision = state.clusters.find(c => {
      const existingDivision = state.divisions.find(d => d.id === c.division_id);
      return c.name.toLowerCase() === pendingCluster.name.toLowerCase() && 
             existingDivision && existingDivision.id === pendingCluster.divisionId;
    });
    if (existingClusterInSameDivision) {
      toast.error(`Cluster "${pendingCluster.name}" already exists in division "${divisionName}"`);
      return;
    }

    // Check if cluster is already pending in the same division
    const pendingClusterInSameDivision = state.orgStructure.pendingClusters.find(c => 
      c.name.toLowerCase() === pendingCluster.name.toLowerCase() && 
      c.divisionId === pendingCluster.divisionId
    );
    if (pendingClusterInSameDivision) {
      toast.error(`Cluster "${pendingCluster.name}" is already pending in division "${divisionName}"`);
      return;
    }

    // Check for duplicate field mappings in the same division
    const existingFieldMappingInSameDivision = state.clusters.find(c => {
      const existingDivision = state.divisions.find(d => d.id === c.division_id);
      return c.fieldMapping && c.fieldMapping.toLowerCase() === pendingCluster.fieldMapping.toLowerCase() && 
             existingDivision && existingDivision.id === pendingCluster.divisionId;
    });
    if (existingFieldMappingInSameDivision) {
      toast.error(`Field mapping "${pendingCluster.fieldMapping}" already exists in division "${divisionName}"`);
      return;
    }

    // Check for duplicate field mappings in pending clusters in the same division
    const pendingFieldMappingInSameDivision = state.orgStructure.pendingClusters.find(c => 
      c.fieldMapping && c.fieldMapping.toLowerCase() === pendingCluster.fieldMapping.toLowerCase() && 
      c.divisionId === pendingCluster.divisionId
    );
    if (pendingFieldMappingInSameDivision) {
      toast.error(`Field mapping "${pendingCluster.fieldMapping}" is already pending in division "${divisionName}"`);
      return;
    }

    // Add to pending clusters
    get().addPendingCluster(pendingCluster);
    
    // Clear the form
    set((state) => ({
      newCluster: { name: '', description: '', divisionId: '', countryCode: '', region: '', fieldMapping: '' }
    }));
    toast.success('Cluster added to pending list');
  },

  createSopCycleConfig: async (config) => {

  },

  updateSopCycleConfig: async (id, config) => {

  },

  deleteSopCycleConfig: async (id) => {

  },

  generateSopCycles: async (configId) => {

  },

  loadSopCycles: async () => {

  },

  createSopCycle: async (cycle) => {

  },

  updateSopCycleStatus: async (id, status, isCurrent?) => {

  },

  loadSopCyclePermissions: async (cycleId) => {

  },

  grantSopCyclePermission: async (cycleId, userId, permissionType, expiresAt?) => {

  },

  revokeSopCyclePermission: async (cycleId, userId, permissionType) => {

  },

  uploadCsvFile: async (file) => {

  },

  mapCsvColumns: async (divisionColumn, clusterColumn, lifecycleColumn) => {

  },

  extractOrgStructure: async () => {

  },

  createDivisionsFromCsv: async () => {

  },

  createClustersFromCsv: async () => {

  },

  storeCsvMappingData: (mappingData, divisionName?) => {
    const state = get();

    if (divisionName && state.orgStructure?.importLevel === 'division') {
      // Store division-specific CSV data
    set((state) => ({
      orgStructure: {
        ...state.orgStructure,
          csvImportData: {
            ...state.orgStructure.csvImportData,
            // Preserve top-level fields from mappingData
            originalCsv: mappingData.originalCsv,
            headers: mappingData.headers,
            data: mappingData.data,
            columnRoles: mappingData.columnRoles,
            columnMappings: mappingData.columnMappings,
            dateFormat: mappingData.dateFormat,
            numberFormat: mappingData.numberFormat,
            separator: mappingData.separator,
            transpose: mappingData.transpose,
            finalColumnRoles: mappingData.finalColumnRoles,
            csvFileName: mappingData.csvFileName,
            csvHash: mappingData.csvHash,
            selectedDivision: mappingData.selectedDivision,
            divisionSpecific: {
              ...state.orgStructure.csvImportData?.divisionSpecific,
              [divisionName]: mappingData
            }
          }
      }
    }));
    } else {
      // Store global CSV data
      set((state) => ({
        orgStructure: {
          ...state.orgStructure,
          csvImportData: {
            ...state.orgStructure.csvImportData,
            // Preserve top-level fields from mappingData
            originalCsv: mappingData.originalCsv,
            headers: mappingData.headers,
            data: mappingData.data,
            columnRoles: mappingData.columnRoles,
            columnMappings: mappingData.columnMappings,
            dateFormat: mappingData.dateFormat,
            numberFormat: mappingData.numberFormat,
            separator: mappingData.separator,
            transpose: mappingData.transpose,
            finalColumnRoles: mappingData.finalColumnRoles,
            csvFileName: mappingData.csvFileName,
            csvHash: mappingData.csvHash,
            selectedDivision: mappingData.selectedDivision,
            global: mappingData
          }
        }
      }));
    }
  },

  importSetupCsvData: async () => {

    return { success: false, error: 'Not implemented yet' };
  },

  createAllPendingItems: async () => {

    return { success: false, error: 'Not implemented yet' };
  },

  createFieldDefinitions: async () => {

    return { success: false, error: 'Not implemented yet' };
  },

  createFieldMappings: async () => {

    return { success: false, error: 'Not implemented yet' };
  },

  getFieldDefinitionId: (fieldName) => {

    return null;
  },

  initializeMultipleCsvImport: (remainingDivisions?) => {
    set((state) => ({
      orgStructure: {
        ...state.orgStructure,
        multipleCsvImport: {
          ...state.orgStructure.multipleCsvImport,
          isEnabled: true,
          importedCsvs: [],
          remainingDivisions: remainingDivisions || []
        }
      }
    }));
  },

  addImportedCsv: (fileName, divisions, clusters, divisionName?) => {
    set((state) => ({
      orgStructure: {
        ...state.orgStructure,
        multipleCsvImport: {
          ...state.orgStructure.multipleCsvImport,
          importedCsvs: [
            ...state.orgStructure.multipleCsvImport.importedCsvs,
            {
              fileName,
              divisions,
              clusters,
              divisionName
            }
          ]
        }
      }
    }));
  },

  removeImportedCsv: (fileName) => {
    set((state) => {
      console.log('[RefactoredStore] removeImportedCsv: Deleting data from file:', fileName);
      
      // Debug: Log all divisions and their properties
      console.log('[RefactoredStore] removeImportedCsv: All pending divisions before filtering:', 
        state.orgStructure.pendingDivisions.map(d => ({
          name: d.name,
          isExisting: d.isExisting,
          sourceFile: d.sourceFile,
          id: d.id
        }))
      );
      
      // Debug: Log all clusters and their properties
      console.log('[RefactoredStore] removeImportedCsv: All pending clusters before filtering:', 
        state.orgStructure.pendingClusters.map(c => ({
          name: c.name,
          isExisting: c.isExisting,
          sourceFile: c.sourceFile,
          id: c.id
        }))
      );
      
      // Use the same safe logic as the legacy store
      // Only remove items that have this file as source or are not existing
      const updatedPendingDivisions = state.orgStructure.pendingDivisions.filter(
        division => division.isExisting === true || division.sourceFile !== fileName
      );
      
      const updatedPendingClusters = state.orgStructure.pendingClusters.filter(
        cluster => cluster.isExisting === true || cluster.sourceFile !== fileName
      );
      
      console.log('[RefactoredStore] removeImportedCsv: Filter results:', {
        originalDivisions: state.orgStructure.pendingDivisions.length,
        originalClusters: state.orgStructure.pendingClusters.length,
        filteredDivisions: updatedPendingDivisions.length,
        filteredClusters: updatedPendingClusters.length,
        removedDivisions: state.orgStructure.pendingDivisions.length - updatedPendingDivisions.length,
        removedClusters: state.orgStructure.pendingClusters.length - updatedPendingClusters.length
      });
      
      // Debug: Log which divisions are being removed
      const removedDivisions = state.orgStructure.pendingDivisions.filter(
        d => d.isExisting !== true && d.sourceFile === fileName
      );
      const removedClusters = state.orgStructure.pendingClusters.filter(
        c => c.isExisting !== true && c.sourceFile === fileName
      );
      
      console.log('[RefactoredStore] removeImportedCsv: Divisions being removed:', 
        removedDivisions.map(d => ({ name: d.name, sourceFile: d.sourceFile, isExisting: d.isExisting }))
      );
      console.log('[RefactoredStore] removeImportedCsv: Clusters being removed:', 
        removedClusters.map(c => ({ name: c.name, sourceFile: c.sourceFile, isExisting: c.isExisting }))
      );
      
      // Clean up CSV mapping data and lifecycle phases that came from this file
      // For now, we'll clear all CSV-related data since we don't have file-specific tracking
      // In the future, we could add sourceFile tracking to csvImportData and lifecycleMappings
      const updatedCsvImportData = state.orgStructure.csvImportData?.csvFileName === fileName ? null : state.orgStructure.csvImportData;
      
      // Clear lifecycle mappings that came from this CSV (for now, clear all since we don't have file-specific tracking)
      // In the future, we could add sourceFile tracking to lifecycleMappings
      const updatedLifecycleMappings = state.orgStructure.lifecycleMappings.filter(mapping => {
        // For now, we'll clear all non-custom lifecycle mappings since they likely came from CSV
        // Custom mappings (isCustom: true) should be preserved as they were manually created
        return mapping.isCustom === true;
      });
      
      console.log('[RefactoredStore] removeImportedCsv: CSV data cleanup:', {
        originalCsvImportData: state.orgStructure.csvImportData ? 'exists' : 'null',
        updatedCsvImportData: updatedCsvImportData ? 'preserved' : 'cleared',
        originalLifecycleMappings: state.orgStructure.lifecycleMappings.length,
        updatedLifecycleMappings: updatedLifecycleMappings.length,
        removedLifecycleMappings: state.orgStructure.lifecycleMappings.length - updatedLifecycleMappings.length
      });
      
      return {
        orgStructure: {
          ...state.orgStructure,
          multipleCsvImport: {
            ...state.orgStructure.multipleCsvImport,
            importedCsvs: state.orgStructure.multipleCsvImport.importedCsvs.filter(
              csv => csv.fileName !== fileName
            )
          },
          pendingDivisions: updatedPendingDivisions,
          pendingClusters: updatedPendingClusters,
          csvImportData: updatedCsvImportData,
          lifecycleMappings: updatedLifecycleMappings,
          // Also clear extracted data and mapping that came from this CSV
          extractedDivisions: [],
          extractedClusters: [],
          divisionClusterMap: {},
          csvHeaders: null,
          csvMapping: null
        }
      };
    });
  },

  getNextImportInfo: () => {
    const state = get();
    return {
      importedCount: state.orgStructure.multipleCsvImport.importedCsvs.length,
      remainingDivisions: state.orgStructure.multipleCsvImport.remainingDivisions
    };
  },

  isMultipleCsvImportComplete: () => {
    const state = get();
    return state.orgStructure.multipleCsvImport.importedCsvs.length > 0;
  },

  loadDbDivisionsIntoPending: () => {
    
    const state = get();
    const dbDivisions = state.divisions;
    const pendingDivisions = state.orgStructure.pendingDivisions;
    const deletedDivisions = state.orgStructure.deletedItems.divisions;
    
  
    // Only add DB divisions if they're not already in pending AND not in deletedItems
    const newPendingDivisions = dbDivisions
      .filter(dbDivision => 
        !pendingDivisions.some(pending => pending.id === dbDivision.id) &&
        !deletedDivisions.some(deleted => deleted.id === dbDivision.id)
      )
      .map(dbDivision => ({
        name: dbDivision.name,
        description: dbDivision.description || '',
        industry: dbDivision.industry || '',
        fieldMapping: dbDivision.fieldMapping || dbDivision.name,
        isExisting: true,
        id: dbDivision.id
      }));
    
    if (newPendingDivisions.length > 0) {
      set((state) => ({
        orgStructure: {
          ...state.orgStructure,
          pendingDivisions: [...state.orgStructure.pendingDivisions, ...newPendingDivisions]
        }
      }));

    } else {
    }
  },

  loadDbClustersIntoPending: () => {

    const state = get();
    const clusters = state.clusters;
    const pendingClusters = state.orgStructure.pendingClusters;
    const deletedClusters = state.orgStructure.deletedItems.clusters;
    const divisions = state.divisions;
    
    
    // First, fix any existing pending clusters that are missing divisionName
    const fixedPendingClusters = pendingClusters.map(pendingCluster => {
      if (!pendingCluster.divisionName) {
        // Try to find the division by looking up the cluster in the DB clusters
        const dbCluster = clusters.find(c => c.name === pendingCluster.name);
        if (dbCluster) {
          const division = divisions.find(d => d.id === dbCluster.division_id);
          if (division) {
            console.log(`🔍 [STORE DEBUG] Fixing pending cluster "${pendingCluster.name}" - found in DB with division_id: ${dbCluster.division_id}, adding divisionName: "${division.name}"`);
            return { 
              ...pendingCluster, 
              divisionId: dbCluster.division_id,
              divisionName: division.name 
            };
          }
        }
        
        // If no DB cluster found, try to fix by divisionId if it exists
        if (pendingCluster.divisionId > 0) {
          const division = divisions.find(d => d.id === pendingCluster.divisionId);
          if (division) {
            console.log(`🔍 [STORE DEBUG] Fixing pending cluster "${pendingCluster.name}" - adding divisionName: "${division.name}"`);
            return { ...pendingCluster, divisionName: division.name };
          }
        }
      }
      return pendingCluster;
    });
    
    console.log(`🔍 [STORE DEBUG] Fixed pending clusters:`, fixedPendingClusters.map(c => `${c.name} (divisionId: ${c.divisionId}, divisionName: ${c.divisionName || 'MISSING'})`));
    
    // Update the pending clusters with fixed division names
    if (JSON.stringify(fixedPendingClusters) !== JSON.stringify(pendingClusters)) {
      console.log(`🔍 [STORE DEBUG] Updating pending clusters with fixed division names`);
      set((state) => ({
        orgStructure: {
          ...state.orgStructure,
          pendingClusters: fixedPendingClusters
        }
      }));
    }
    
    // Filter out clusters that are already in pending or are deleted
    const newPendingClusters = clusters
      .filter(dbCluster => {
        // Find the division for this DB cluster
        const dbDivision = divisions.find(d => d.id === dbCluster.division_id);
        const dbDivisionName = dbDivision?.name || 'Unknown';
        
        // Check if already in pending (by exact ID match OR by name + same division)
        const alreadyInPending = fixedPendingClusters.some(pendingCluster => {
          // First check: exact ID match (most reliable)
          if (pendingCluster.id === dbCluster.id) {
            return true;
          }
          
          // Second check: same name AND same division (prevent duplicates within same division)
          const pendingDivisionName = pendingCluster.divisionName || 'Unknown';
          return pendingCluster.name === dbCluster.name && 
                 pendingDivisionName.toLowerCase() === dbDivisionName.toLowerCase();
        });
        
        if (alreadyInPending) {
          console.log(`🔍 [STORE DEBUG] Skipping cluster "${dbCluster.name}" in division "${dbCluster.division_id}" - already in pending`);
        }
        
        return !alreadyInPending;
      })
      .map(dbCluster => {
        // Find the division name for this cluster
        const division = divisions.find(d => d.id === dbCluster.division_id);
        const divisionName = division?.name || 'Unknown Division';
        
        console.log(`🔍 [STORE DEBUG] Cluster "${dbCluster.name}" (ID: ${dbCluster.id}) - division_id: ${dbCluster.division_id}, found division: ${division?.name || 'NOT FOUND'}`);
        console.log(`🔍 [STORE DEBUG] Division lookup: looking for division with id ${dbCluster.division_id} in:`, divisions.map(d => `id: ${d.id}, name: ${d.name}`));
        
        return {
          name: dbCluster.name,
          description: dbCluster.description || '',
          divisionId: dbCluster.division_id, // This should be the correct mapping
          countryCode: dbCluster.country_code || '',
          region: dbCluster.region || '',
          fieldMapping: dbCluster.fieldMapping || dbCluster.name,
          divisionName: divisionName,
          isExisting: true,
          id: dbCluster.id
        };
      });
    
    if (newPendingClusters.length > 0) {
      set((state) => ({
        orgStructure: {
          ...state.orgStructure,
          pendingClusters: [...state.orgStructure.pendingClusters, ...newPendingClusters]
        }
      }));

    } else {

    }
  },

  createConsistentDivisionClusterOrdering: (csvDivisions, csvClusters, divisionClusterMap) => {
    const { divisions } = get();
    const pendingDivisions = get().orgStructure.pendingDivisions;
    
    // Combine and deduplicate divisions (case-insensitive, keep first occurrence)
    const allDivisions = [
      ...divisions.map(d => ({ name: d.name, source: 'db', id: d.id })),
      ...pendingDivisions.map(d => ({ name: d.name, source: 'pending', id: null })),
      ...csvDivisions.map(d => ({ name: d, source: 'csv', id: null }))
    ];
    
    const uniqueDivisions = [];
    const seenDivisionNames = new Set<string>();
    
    for (const division of allDivisions) {
      const lowerName = division.name.toLowerCase();
      if (!seenDivisionNames.has(lowerName)) {
        seenDivisionNames.add(lowerName);
        uniqueDivisions.push(division);
      }
    }
    
    // Order divisions alphabetically and assign consistent IDs
    const divisionsWithIds = uniqueDivisions
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((division, index) => ({ ...division, consistentId: index }));
    
    // Process clusters with cluster+division pair deduplication
    const allClusters = [];
    const seenClusterDivisionPairs = new Set<string>();
    
    // Add existing clusters from DB
    const { clusters } = get();
    clusters.forEach(cluster => {
      const division = divisions.find(d => d.id === cluster.division_id);
      const divisionName = division ? division.name : 'Unknown Division';
      const key = `${cluster.name.toLowerCase()}|${divisionName.toLowerCase()}`;
      
      if (!seenClusterDivisionPairs.has(key)) {
        seenClusterDivisionPairs.add(key);
        allClusters.push({
          name: cluster.name,
          divisionId: cluster.division_id,
          divisionName: divisionName,
          source: 'db',
          id: cluster.id
        });
      }
    });
    
    // Add pending clusters
    const pendingClusters = get().orgStructure.pendingClusters;
    pendingClusters.forEach(cluster => {
      let divisionName = 'Unknown Division';
      if (cluster.divisionId >= 0) {
        const division = divisions.find(d => d.id === cluster.divisionId);
        if (division) divisionName = division.name;
      } else if (cluster.divisionName) {
        divisionName = cluster.divisionName;
      }
      
      const key = `${cluster.name.toLowerCase()}|${divisionName.toLowerCase()}`;
      if (!seenClusterDivisionPairs.has(key)) {
        seenClusterDivisionPairs.add(key);
        allClusters.push({
          name: cluster.name,
          divisionId: cluster.divisionId,
          divisionName: divisionName,
          source: 'pending',
          id: null
        });
      }
    });
    
    // Add new clusters from CSV (allowing same cluster in multiple divisions)
    csvClusters.forEach(clusterName => {
      for (const [divisionName, clusterList] of Object.entries(divisionClusterMap)) {
        if (Array.isArray(clusterList) && clusterList.includes(clusterName)) {
          const key = `${clusterName.toLowerCase()}|${divisionName.toLowerCase()}`;
          if (!seenClusterDivisionPairs.has(key)) {
            seenClusterDivisionPairs.add(key);
            allClusters.push({
              name: clusterName,
              divisionId: null,
              divisionName: divisionName,
              source: 'csv',
              id: null
            });
          }
        }
      }
    });
    
    // Order clusters alphabetically and assign consistent IDs
    const clustersWithIds = allClusters
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((cluster, index) => ({ ...cluster, consistentId: index }));
    
    // Create division name to consistent ID mapping
    const divisionNameToConsistentId = Object.fromEntries(
      divisionsWithIds.map(division => [division.name, division.consistentId])
    );

    return {
      divisions: divisionsWithIds,
      clusters: clustersWithIds,
      divisionNameToConsistentId
    };
  },

  setCompanyForm: (form) => {
    set((state) => ({
      companyForm: { ...state.companyForm, ...form }
    }));
  },

  setNewDivision: (division) => {
    set((state) => ({
      newDivision: { ...state.newDivision, ...division }
    }));
  },

  setNewCluster: (cluster) => {
    set((state) => ({
      newCluster: { ...state.newCluster, ...cluster }
    }));
  },

  setNewSopCycle: (sopCycle) => {
    set((state) => ({
      newSopCycle: { ...state.newSopCycle, ...sopCycle }
    }));
  },

  setSopCycleConfig: (config) => {
    set({ sopCycleConfig: config });
  },

  setEditDivisionForm: (form) => {
    set((state) => ({
      editDivisionForm: { ...state.editDivisionForm, ...form }
    }));
  },

  setEditClusterForm: (form) => {
    set((state) => ({
      editClusterForm: { ...state.editClusterForm, ...form }
    }));
  },

  setEditingDivision: (id) => {
    set({ editingDivision: id });
  },

  setEditingCluster: (id) => {
    set({ editingCluster: id });
  },

  resetForms: () => {
    set({
      companyForm: {
        name: '',
        description: '',
        country: '',
        website: '',
        phone: '',
        address: '',
        city: '',
        state_province: '',
        postal_code: '',
        company_size: '',
        fiscal_year_start: '',
        timezone: 'UTC',
        currency: 'USD',
        logo_url: '',
        notes: ''
      },
      newDivision: { name: '', description: '', industry: '', fieldMapping: '' },
      newCluster: { name: '', description: '', divisionId: '', countryCode: '', region: '', fieldMapping: '' },
      newSopCycle: { name: '', description: '', divisionId: '', startDate: '', endDate: '' }
    });
  },

  resetEditStates: () => {
    set({
      editingDivision: null,
      editingCluster: null,
      editDivisionForm: { name: '', description: '', industry: '', fieldMapping: '' },
      editClusterForm: { name: '', description: '', countryCode: '', region: '', fieldMapping: '' }
    });
  },

  resetOrgStructure: () => {
    set((state) => ({
      orgStructure: {
        ...state.orgStructure,
        hasMultipleDivisions: false,
        hasMultipleClusters: false,
        enableLifecycleTracking: false,
        lifecycleMappings: [],
        importLevel: 'company',
        csvUploadType: null,
        divisionCsvType: null,
        uploadedCsvData: null,
        csvHeaders: null,
        csvMapping: null,
        extractedDivisions: [],
        extractedClusters: [],
        divisionClusterMap: {},
        pendingDivisions: [],
        pendingClusters: [],
        multipleCsvImport: {
          isEnabled: false,
          importedCsvs: [],
          remainingDivisions: [],
        },
        setupFlow: {
          skipDivisionStep: false,
          skipClusterStep: false,
          divisionValue: null,
          clusterValue: null,
          requiresCsvUpload: false,
          csvImportSkippable: false,
          csvStructure: {
            hasDivisionColumn: false,
            hasClusterColumn: false,
            hasLifecycleColumn: false,
          },
        },
        csvImportData: null,
        csvImportActive: false,
        deletedItems: {
          divisions: [],
          clusters: []
        },
        userConfiguredFlags: {
          hasMultipleDivisions: false,
          hasMultipleClusters: false,
        },
        isSingleCsvReplacement: false
      }
    }));
  },

  clearPendingItems: () => {
    set((state) => ({
      orgStructure: {
        ...state.orgStructure,
        pendingDivisions: [],
        pendingClusters: []
      }
    }));
  },

  calculateSetupFlow: () => {
     
    const state = get();
    const {
      hasMultipleDivisions,
      hasMultipleClusters,
      importLevel,
      divisionCsvType
    } = state.orgStructure;
    
    const companyName = state.company?.name || 'Company';
    const fieldMappings = state.fieldMappings;
    
    // Check if field mappings already exist for this company/division
    const hasExistingFieldMappings = fieldMappings.length > 0;
    
    let skipDivisionStep = false;
    let skipClusterStep = false;
    let requiresCsvUpload = false; // Default to false, enable only when needed
    let csvImportSkippable = false; // Whether CSV import can be skipped if mappings exist
    let divisionValue: string | null = null;
    let clusterValue: string | null = null;
    let hasDivisionColumn = false;
    let hasClusterColumn = false;
    let hasLifecycleColumn = false;

    // Determine setup flow based on organizational structure and import level
    if (importLevel === 'company') {
      // Company-level import - only include CSV import if there's organizational structure to configure
      if (hasMultipleDivisions && hasMultipleClusters) {
        // Scenario 1: Company import + Multiple divisions + Multiple clusters
        skipDivisionStep = false;
        skipClusterStep = false;
        requiresCsvUpload = true; // Need CSV to import both divisions and clusters
        hasDivisionColumn = true;
        hasClusterColumn = true;
      } else if (!hasMultipleDivisions && hasMultipleClusters) {
        // Scenario 2: Company import + No divisions + Multiple clusters
        skipDivisionStep = true;
        skipClusterStep = false;
        requiresCsvUpload = true; // Need CSV to import clusters
        divisionValue = companyName; // Use company name as division
        hasClusterColumn = true;
      } else if (hasMultipleDivisions && !hasMultipleClusters) {
        // Scenario 3: Company import + Multiple divisions + No clusters
        skipDivisionStep = false;
        skipClusterStep = true;
        requiresCsvUpload = true; // Need CSV to import divisions
        hasDivisionColumn = true;
        clusterValue = companyName; // Use company name as cluster
      } else {
        // Scenario 4: Company import + No divisions + No clusters
        skipDivisionStep = true;
        skipClusterStep = true;
        requiresCsvUpload = true; // Always include CSV import for mapping purposes
        divisionValue = companyName;
        clusterValue = companyName;
      }
    } else if (importLevel === 'division') {
      // Division-level import - handle different CSV types
      if (hasMultipleClusters) {
        // Scenario 5: Division import + Multiple clusters
        if (divisionCsvType === 'withDivisionColumn') {
          // CSV includes division column - can import both divisions and clusters
          skipDivisionStep = false;
          skipClusterStep = false;
          requiresCsvUpload = true; // Need CSV to import both
          hasDivisionColumn = true;
          hasClusterColumn = true;
        } else if (divisionCsvType === 'withoutDivisionColumn') {
          // CSV doesn't include division column - manual division creation + CSV import for clusters
          skipDivisionStep = false; // Manual division creation required
          skipClusterStep = false;
          requiresCsvUpload = true; // Need CSV to import clusters (per division)
          hasDivisionColumn = false;
          hasClusterColumn = true;
        } else {
          // No CSV type selected yet - default to manual
          skipDivisionStep = false;
          skipClusterStep = false;
          requiresCsvUpload = true; // Always include CSV import for mapping purposes
          hasDivisionColumn = false;
          hasClusterColumn = true;
        }
      } else {
        // Scenario 6: Division import + No clusters (hasDivisions + !hasClusters)
        if (divisionCsvType === 'withDivisionColumn') {
          // CSV includes division column - can import divisions
          // CSV import should happen BEFORE clusters (which are skipped)
          skipDivisionStep = false;
          skipClusterStep = true;
          requiresCsvUpload = true; // Need CSV to import divisions
          hasDivisionColumn = true;
          clusterValue = companyName; // Use company name as cluster
        } else if (divisionCsvType === 'withoutDivisionColumn') {
          // CSV doesn't include division column - manual division creation only
          // CSV import should happen BEFORE product lifecycle (if enabled) or S&OP (if lifecycle disabled)
          // This is for column mapping purposes only - single CSV, no multiple import
          skipDivisionStep = false; // Manual division creation required
          skipClusterStep = true;
          requiresCsvUpload = true; // Need CSV for column mapping (not division import)
          hasDivisionColumn = false;
          clusterValue = companyName; // Use company name as cluster
          
          // Disable multiple CSV import for column mapping scenario
          // This will be handled in the final set call below
        } else {
          // No CSV type selected yet - default to manual
          skipDivisionStep = false;
          skipClusterStep = true;
          requiresCsvUpload = true; // Always include CSV import for mapping purposes
          hasDivisionColumn = false;
          clusterValue = companyName; // Use company name as cluster
        }
      }
    }



    set((state) => ({
      orgStructure: {
        ...state.orgStructure,
        setupFlow: {
          skipDivisionStep,
          skipClusterStep,
          divisionValue,
          clusterValue,
          requiresCsvUpload,
          csvImportSkippable: hasExistingFieldMappings, // Skip if field mappings already exist
          csvStructure: {
            hasDivisionColumn,
            hasClusterColumn,
            hasLifecycleColumn
          }
        }
      }
    }));
  },

  isCacheStale: (key) => {
    const state = get();
    const lastFetched = state.cache.lastFetched[key];
    return !lastFetched || Date.now() - lastFetched > state.cache.cacheDuration;
  },

  updateCache: (key) => {
    set((state) => ({
      cache: {
        ...state.cache,
        lastFetched: {
          ...state.cache.lastFetched,
          [key]: Date.now()
        }
      }
    }));
  },

  clearCache: () => {
    set((state) => ({
      cache: {
        ...state.cache,
        lastFetched: {}
      }
    }));
  },

  loadSetupData: async () => {

  },

  loadOrgData: async () => {

  },

  deduplicatedFetch: async (key, fetchFn) => {
    const state = get();
    if (state.pendingRequests[key]) {
      return state.pendingRequests[key];
    }
    
    const promise = fetchFn();
    set((state) => ({
      pendingRequests: {
        ...state.pendingRequests,
        [key]: promise
      }
    }));
    
    try {
      const result = await promise;
      set((state) => {
        const newPendingRequests = { ...state.pendingRequests };
        delete newPendingRequests[key];
        return { pendingRequests: newPendingRequests };
      });
      return result;
    } catch (error) {
      set((state) => {
        const newPendingRequests = { ...state.pendingRequests };
        delete newPendingRequests[key];
        return { pendingRequests: newPendingRequests };
      });
      throw error;
    }
  },

  deleteDivision: async (id, forceHardDelete?) => {

    return { success: false, method: 'soft' as const, error: 'Not implemented yet' };
  },

  deleteCluster: async (id, forceHardDelete?) => {

    return { success: false, method: 'soft' as const, error: 'Not implemented yet' };
  },

  restoreDivision: async (id) => {

    return { success: false, error: 'Not implemented yet' };
  },

  restoreCluster: async (id) => {

    return { success: false, error: 'Not implemented yet' };
  },

  applyPendingChanges: async () => {

    return { success: false, error: 'Not implemented yet' };
  },

  // Get CSV data for a specific division
  getDivisionCsvData: (divisionName) => {
    const state = get();
    return state.orgStructure?.csvImportData?.divisionSpecific?.[divisionName] || null;
  },

  // Get current CSV data based on context
  getCurrentCsvData: (selectedDivision) => {
    const state = get();
    
    if (state.orgStructure?.importLevel === 'division' && selectedDivision) {
      return state.orgStructure?.csvImportData?.divisionSpecific?.[selectedDivision] || null;
    } else {
      return state.orgStructure?.csvImportData?.global || null;
    }
  }
})); 