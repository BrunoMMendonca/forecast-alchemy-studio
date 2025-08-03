import { create } from 'zustand';
import { toast } from 'sonner';

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
  divisionId?: number; // null for company-wide
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  dayType: 'regular' | 'working'; // NEW: regular days vs working days
  startDay: number; // 1-31 for monthly, 1-7 for weekly (Monday=1)
  startMonth?: number; // 1-12 for quarterly/yearly
  cutOffDays: number; // Days before cycle end when regular users can't modify
  isActive: boolean;
  description?: string;
  autoGenerate: boolean;
  generateFromDate: string; // Start generating cycles from this date
  generateCount: number; // How many cycles to generate
  workingDaysConfig?: { // NEW: configuration for working days
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
    holidays?: string[]; // Array of holiday dates (YYYY-MM-DD)
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
    cacheDuration: number; // 5 minutes in milliseconds
  };
  
  // Request deduplication
  pendingRequests: Record<string, Promise<any>>;
  
  // Organizational structure configuration
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
    divisionCsvType: 'withDivisionColumn' | 'withoutDivisionColumn' | null; // New field for division-level CSV type
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
    // Temporary storage for divisions and clusters to be created when setup is completed
    pendingDivisions: Array<{
      name: string;
      description: string;
      industry: string;
      fieldMapping: string;
      isExisting?: boolean; // true for DB divisions, false for CSV divisions
      id?: number; // DB ID for existing divisions
      sourceFile?: string; // CSV filename that this division came from (null for DB divisions)
    }>;
    pendingClusters: Array<{
      name: string;
      description: string;
      divisionId: number; // Reference to division id (will be resolved to ID when created)
      countryCode: string;
      region: string;
      fieldMapping: string;
      divisionName?: string; // Division name for resolution (for pending divisions)
      isExisting?: boolean; // true for DB clusters, false for CSV clusters
      id?: number; // DB ID for existing clusters
      sourceFile?: string; // CSV filename that this cluster came from (null for DB clusters)
    }>;
    // Multiple CSV import tracking
    multipleCsvImport: {
      isEnabled: boolean;
      importedCsvs: Array<{
        fileName: string;
        divisions: string[];
        clusters: string[];
        divisionName?: string; // For division-level imports without division column
      }>;
      remainingDivisions: string[]; // For division-level imports without division column
    };
    // Setup wizard flow configuration
    setupFlow: {
      skipDivisionStep: boolean;
      skipClusterStep: boolean;
      divisionValue: string | null; // NULL or company name
      clusterValue: string | null; // NULL or division name
      requiresCsvUpload: boolean;
      csvImportSkippable: boolean; // Whether CSV import can be skipped if mappings exist
      csvStructure: {
        hasDivisionColumn: boolean;
        hasClusterColumn: boolean;
        hasLifecycleColumn: boolean;
      };
    };
    // CSV mapping data for later import
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
      selectedDivision: string | null; // For division-level without division column workflow
    } | null;
    // CSV import wizard state
    csvImportActive: boolean;
    // Items marked for deletion during Setup Wizard (not applied to DB until completion)
    deletedItems: {
      divisions: Array<Division & { isExisting?: boolean; originalPendingIndex?: number }>;
      clusters: Array<Cluster & { isExisting?: boolean; originalPendingIndex?: number; divisionName?: string }>;
    };
    // Flags to track if user has manually configured these settings
    userConfiguredFlags: {
      hasMultipleDivisions: boolean;
      hasMultipleClusters: boolean;
    };
    // Flag to indicate single CSV replacement (not merge)
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
  
  // Actions
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
  storeCsvMappingData: (mappingData: SetupWizardState['orgStructure']['csvImportData']) => void;
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
}

const getSessionToken = () => localStorage.getItem('sessionToken');

export const useSetupWizardStore = create<SetupWizardState>((set, get) => ({
  // Initial state
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
    // Items marked for deletion during Setup Wizard (not applied to DB until completion)
    deletedItems: {
      divisions: [] as Division[],
      clusters: [] as Cluster[]
    },
    // Flags to track if user has manually configured these settings
    userConfiguredFlags: {
      hasMultipleDivisions: false,
      hasMultipleClusters: false,
    },
    // Flag to indicate single CSV replacement (not merge)
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
  
  // S&OP Configuration for setup wizard
  sopCycleConfig: null,
  
  // Load company data
  loadCompany: async () => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;
    
    // Check cache first
    if (!get().isCacheStale('company')) {
      console.log('Using cached company data');
      return;
    }
    
    set({ isLoadingCompany: true });
    
    try {
      const response = await fetch('/api/auth/company', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      
      if (response.ok) {
        const result = await response.json();
        const companyData = result.company;
        
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
        
        // Update cache
        get().updateCache('company');
      }
    } catch (error) {
      console.error('Error loading company:', error);
    } finally {
      set({ isLoadingCompany: false });
    }
  },
  
  // Load divisions
  loadDivisions: async (force: boolean = false) => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;
    
    // Check cache first (unless force is true)
    if (!force && !get().isCacheStale('divisions')) {
      console.log('Using cached divisions data');
      return;
    }
    
    set({ isLoadingDivisions: true });
    
    try {
      const company = get().company;
      if (!company) return;
      
      const response = await fetch(`/api/divisions?companyId=${company.id}`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      
      if (response.ok) {
        const result = await response.json();
        const divisions = result.divisions || result; // Handle both { divisions: [...] } and [...] formats
        set({ divisions });
        
        // Auto-initialize hasMultipleDivisions flag AFTER setting divisions
        // Only auto-calculate if user hasn't manually configured it
        const currentState = get();
        if (!currentState.orgStructure.userConfiguredFlags.hasMultipleDivisions) {
          const hasMultipleDivisions = divisions.length > 1;
          set((state) => ({
            orgStructure: {
              ...state.orgStructure,
              hasMultipleDivisions,
            },
          }));
        }
        
        // Update cache
        get().updateCache('divisions');
      }
    } catch (error) {
      console.error('Error loading divisions:', error);
    } finally {
      set({ isLoadingDivisions: false });
    }
  },
  
  // Load clusters
  loadClusters: async (force: boolean = false) => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;
    
    // Check cache first (unless force is true)
    if (!force && !get().isCacheStale('clusters')) {
      console.log('Using cached clusters data');
      return;
    }
    
    set({ isLoadingClusters: true });
    
    try {
      const company = get().company;
      if (!company) return;
      
      const response = await fetch(`/api/clusters?companyId=${company.id}`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      
      if (response.ok) {
        const result = await response.json();
        const clusters = result.clusters || result; // Handle both { clusters: [...] } and [...] formats
        set({ clusters });
        
        // Auto-initialize hasMultipleClusters flag AFTER setting clusters
        // Only auto-calculate if user hasn't manually configured it
        const currentState = get();
        if (!currentState.orgStructure.userConfiguredFlags.hasMultipleClusters) {
          const hasMultipleClusters = clusters.length > 1;
          set((state) => ({
            orgStructure: {
              ...state.orgStructure,
              hasMultipleClusters,
            },
          }));
        }
        
        // Update cache
        get().updateCache('clusters');
      }
    } catch (error) {
      console.error('Error loading clusters:', error);
    } finally {
      set({ isLoadingClusters: false });
    }
  },
  
  // Load S&OP cycle configs
  loadSopCycleConfigs: async () => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;
    
    try {
      set({ isLoadingSopCycleConfigs: true });
      const response = await fetch('/api/sop-cycle-configs', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      
      if (response.ok) {
        const result = await response.json();
        set({ sopCycleConfigs: result.configs });
      } else {
        console.error('Failed to load S&OP cycle configs');
      }
    } catch (error) {
      console.error('Error loading S&OP cycle configs:', error);
    } finally {
      set({ isLoadingSopCycleConfigs: false });
    }
  },

  // Load field mappings
  loadFieldMappings: async () => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;

    set({ isLoadingFieldMappings: true });

    try {
      const company = get().company;
      if (!company) return;

      const response = await fetch(`/api/field-mappings?companyId=${company.id}`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });

      if (response.ok) {
        const fieldMappings = await response.json();
        set({ fieldMappings: fieldMappings });
      }
    } catch (error) {
      console.error('Error loading field mappings:', error);
    } finally {
      set({ isLoadingFieldMappings: false });
    }
  },
  
  // Load setup status
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
      console.error('Error loading setup status:', error);
    }
  },

  // Load organization structure configuration
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
      console.error('Error loading organization structure configuration:', error);
    }
  },

  // Save organization structure configuration
  saveOrgStructureConfig: async () => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;
    
    try {
      const { orgStructure } = get();
      
      // Prepare config for saving (exclude temporary data)
      const configToSave = {
        hasMultipleDivisions: orgStructure.hasMultipleDivisions,
        hasMultipleClusters: orgStructure.hasMultipleClusters,
        importLevel: orgStructure.importLevel,
        csvUploadType: orgStructure.csvUploadType,
        divisionCsvType: orgStructure.divisionCsvType,
        setupFlow: orgStructure.setupFlow,
      };

      const response = await fetch('/api/organization-structure-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ config: configToSave }),
      });

      if (!response.ok) throw new Error('Failed to save organization structure configuration');
      
      console.log('Organization structure configuration saved successfully');
    } catch (error) {
      console.error('Error saving organization structure configuration:', error);
    }
  },
  
  // Load all data
  loadAllData: async () => {
    set({ isLoading: true });
    
    try {
      await Promise.all([
        get().loadCompany(),
        get().loadSetupStatus(),
        get().loadOrgStructureConfig(), // Load organization structure configuration
      ]);
      
      // Load divisions, clusters, and S&OP cycles after company is loaded
      const company = get().company;
      if (company) {
        await Promise.all([
          get().loadDivisions(),
          get().loadClusters(),
          get().loadSopCycles()
        ]);
        
        // Auto-initialize organizational structure flags based on existing data
        // Only auto-calculate if user hasn't manually configured them
        const { divisions, clusters, orgStructure } = get();
        const hasMultipleDivisions = orgStructure.userConfiguredFlags.hasMultipleDivisions 
          ? orgStructure.hasMultipleDivisions 
          : divisions.length > 1;
        const hasMultipleClusters = orgStructure.userConfiguredFlags.hasMultipleClusters 
          ? orgStructure.hasMultipleClusters 
          : clusters.length > 1;
        
        // Populate pending arrays with existing divisions and clusters from database
        const existingPendingDivisions = divisions.map(division => ({
          name: division.name,
          description: division.description || '',
          industry: division.industry || '',
          fieldMapping: division.name, // Use name as field mapping for existing divisions
          isExisting: true,
          id: division.id,
          sourceFile: undefined // Explicitly set sourceFile for DB divisions
        }));
        
        const existingPendingClusters = clusters.map(cluster => {
          const division = divisions.find(d => d.id === cluster.division_id);
          return {
            name: cluster.name,
            description: cluster.description || '',
            divisionId: division ? division.id : 0, // Reference to division id
            countryCode: cluster.country_code || '',
            region: cluster.region || '',
            fieldMapping: cluster.name, // Use name as field mapping for existing clusters
            isExisting: true,
            id: cluster.id,
            sourceFile: undefined // Explicitly set sourceFile for DB clusters
          };
        });
        
        
        set((state) => ({
          orgStructure: {
            ...state.orgStructure,
            hasMultipleDivisions,
            hasMultipleClusters,
            pendingDivisions: existingPendingDivisions,
            pendingClusters: existingPendingClusters,
          },
        }));
        
        // Recalculate setup flow with the auto-initialized flags
        setTimeout(async () => await get().calculateSetupFlow(), 100);
      }
    } catch (error) {
      console.error('Error loading all data:', error);
    } finally {
      set({ isLoading: false });
    }
  },
  
  // Update company
  updateCompany: async () => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;
    
    const { companyForm } = get();
    
    if (!companyForm.name.trim()) {
      toast.error('Company name is required');
      return;
    }
    
    try {
      const response = await fetch('/api/auth/company', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(companyForm)
      });
      
      const result = await response.json();
      if (result.success) {
        toast.success('Company updated successfully');
        set({ company: result.company });
      } else {
        toast.error(result.error || 'Failed to update company');
      }
    } catch (error) {
      console.error('Error updating company:', error);
      toast.error('Failed to update company');
    }
  },
  
  // Create division (add to pending list instead of direct DB creation)
  createDivision: async () => {
    const { newDivision, company, divisions, orgStructure } = get();
    
    if (!newDivision.name.trim()) {
      toast.error('Division name is required');
      return;
    }
    
    // Check if this is division-level without column workflow
    const isDivisionLevelWithoutColumn = orgStructure.importLevel === 'division' && 
                                       orgStructure.divisionCsvType === 'withoutDivisionColumn' &&
                                       orgStructure.hasMultipleClusters;
    
    // Only require field mapping if not in division-level without column workflow
    if (!isDivisionLevelWithoutColumn && !newDivision.fieldMapping.trim()) {
      toast.error('Field mapping is required');
      return;
    }
    
    if (!company) {
      toast.error('Company not found');
      return;
    }
    
    // Check for duplicate division names in existing divisions (case-insensitive)
    const existingDivision = divisions.find(d => 
      d.name.toLowerCase() === newDivision.name.trim().toLowerCase()
    );
    if (existingDivision) {
      toast.error(`Division "${newDivision.name}" already exists in database`);
      return;
    }
    
    // Check for duplicate division names in pending divisions
    const pendingDivision = orgStructure.pendingDivisions.find(d => 
      d.name.toLowerCase() === newDivision.name.trim().toLowerCase()
    );
    if (pendingDivision) {
      toast.error(`Division "${newDivision.name}" is already pending creation`);
      return;
    }
    
    // Only check for duplicate field mappings if not in division-level without column workflow
    if (!isDivisionLevelWithoutColumn) {
    // Check for duplicate field mappings in existing divisions (case-insensitive)
    const existingFieldMapping = divisions.find(d => 
      d.fieldMapping && d.fieldMapping.toLowerCase() === newDivision.fieldMapping.trim().toLowerCase()
    );
    if (existingFieldMapping) {
      toast.error(`Field mapping "${newDivision.fieldMapping}" already exists in database`);
      return;
    }
    
    // Check for duplicate field mappings in pending divisions
    const pendingFieldMapping = orgStructure.pendingDivisions.find(d => 
      d.fieldMapping && d.fieldMapping.toLowerCase() === newDivision.fieldMapping.trim().toLowerCase()
    );
    if (pendingFieldMapping) {
      toast.error(`Field mapping "${newDivision.fieldMapping}" is already pending creation`);
      return;
      }
    }
    
    // Add to pending divisions (same as CSV import)
    const pendingDivisionData = {
      name: newDivision.name.trim(),
      description: newDivision.description || '',
      industry: newDivision.industry || '',
      fieldMapping: isDivisionLevelWithoutColumn ? newDivision.name.trim() : newDivision.fieldMapping.trim(),
      sourceFile: undefined // Manually created divisions are not from CSV
    };
    
    get().addPendingDivision(pendingDivisionData);
    
    // Clear the form
    set({ newDivision: { name: '', description: '', industry: '', fieldMapping: '' } });
    
    toast.success('Division added to pending list');
  },
  
  // Create cluster (add to pending list instead of direct DB creation)
  createCluster: async () => {
    const { newCluster, company, clusters, orgStructure, divisions } = get();
    
    if (!newCluster.name.trim() || !newCluster.divisionId) {
      toast.error('Cluster name and division are required');
      return;
    }
    
    if (!newCluster.fieldMapping.trim()) {
      toast.error('Field mapping is required');
      return;
    }
    
    if (!company) {
      toast.error('Company not found');
      return;
    }
    
    // Check for duplicate cluster names in the SAME division (existing clusters)
    const selectedDivision = divisions.find(d => d.id.toString() === newCluster.divisionId);
    if (selectedDivision) {
      const existingClusterInSameDivision = clusters.find(c => {
        const existingDivision = divisions.find(d => d.id === c.division_id);
        return c.name.toLowerCase() === newCluster.name.trim().toLowerCase() && 
               existingDivision && existingDivision.id === selectedDivision.id;
      });
      if (existingClusterInSameDivision) {
        toast.error(`Cluster "${newCluster.name}" already exists in division "${selectedDivision.name}"`);
      return;
    }
    }
    
    // Check for duplicate cluster names in the SAME division (pending clusters)
    const pendingClusterInSameDivision = orgStructure.pendingClusters.find(c => {
      if (c.divisionId >= 0) {
        return c.name.toLowerCase() === newCluster.name.trim().toLowerCase() && 
               c.divisionId === selectedDivision?.id;
      }
      return false; // Pending divisions are handled differently
    });
    if (pendingClusterInSameDivision) {
      toast.error(`Cluster "${newCluster.name}" is already pending creation in division "${selectedDivision?.name}"`);
      return;
    }
    
    // Check for duplicate field mappings in existing clusters (case-insensitive)
    const existingFieldMapping = clusters.find(c => 
      c.fieldMapping && c.fieldMapping.toLowerCase() === newCluster.fieldMapping.trim().toLowerCase()
    );
    if (existingFieldMapping) {
      toast.error(`Field mapping "${newCluster.fieldMapping}" already exists in database`);
      return;
    }
    
    // Check for duplicate field mappings in pending clusters
    const pendingFieldMapping = orgStructure.pendingClusters.find(c => 
      c.fieldMapping && c.fieldMapping.toLowerCase() === newCluster.fieldMapping.trim().toLowerCase()
    );
    if (pendingFieldMapping) {
      toast.error(`Field mapping "${newCluster.fieldMapping}" is already pending creation`);
      return;
    }
    
    // Validate that the selected division exists
    let divisionId: number;
    
    if (newCluster.divisionId.startsWith('pending-')) {
      // Pending division from CSV
      const pendingIndex = parseInt(newCluster.divisionId.replace('pending-', ''));
      const pendingDivision = orgStructure.pendingDivisions[pendingIndex];
      if (!pendingDivision) {
        toast.error('Selected pending division not found');
        return;
      }
      // Use negative index to indicate pending division
      divisionId = -(pendingIndex + 1);
    } else {
      // Existing division from database
      const selectedDivision = divisions.find(d => d.id.toString() === newCluster.divisionId);
      if (!selectedDivision) {
        toast.error('Selected division not found');
        return;
      }
      divisionId = selectedDivision.id;
    }
    
    // Add to pending clusters (same as CSV import)
    const pendingClusterData = {
      name: newCluster.name.trim(),
      description: newCluster.description || '',
      divisionId: divisionId,
      countryCode: newCluster.countryCode || '',
      region: newCluster.region || '',
      fieldMapping: newCluster.fieldMapping.trim(),
      sourceFile: undefined // Manually created clusters are not from CSV
    };
    
    get().addPendingCluster(pendingClusterData);
    
    // Clear the form
    set({ newCluster: { name: '', description: '', divisionId: '', countryCode: '', region: '', fieldMapping: '' } });
    
    toast.success('Cluster added to pending list');
  },
  
  // Create S&OP cycle config
  createSopCycleConfig: async (config) => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;
    
    try {
      const response = await fetch('/api/sop-cycle-configs', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(config)
      });
      
      const result = await response.json();
      if (result.status === 'ok') {
        toast.success('S&OP cycle configuration created successfully');
        await get().loadSopCycleConfigs();
      } else {
        toast.error(result.error || 'Failed to create S&OP cycle configuration');
      }
    } catch (error) {
      console.error('Error creating S&OP cycle config:', error);
      toast.error('Failed to create S&OP cycle configuration');
    }
  },

  // Update S&OP cycle config
  updateSopCycleConfig: async (id, config) => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;
    
    try {
      const response = await fetch(`/api/sop-cycle-configs/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(config)
      });
      
      const result = await response.json();
      if (result.status === 'ok') {
        toast.success('S&OP cycle configuration updated successfully');
        await get().loadSopCycleConfigs();
      } else {
        toast.error(result.error || 'Failed to update S&OP cycle configuration');
      }
    } catch (error) {
      console.error('Error updating S&OP cycle config:', error);
      toast.error('Failed to update S&OP cycle configuration');
    }
  },

  // Delete S&OP cycle config
  deleteSopCycleConfig: async (id) => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;
    
    try {
      const response = await fetch(`/api/sop-cycle-configs/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      
      const result = await response.json();
      if (result.status === 'ok') {
        toast.success('S&OP cycle configuration deleted successfully');
        await get().loadSopCycleConfigs();
      } else {
        toast.error(result.error || 'Failed to delete S&OP cycle configuration');
    }
    } catch (error) {
      console.error('Error deleting S&OP cycle config:', error);
      toast.error('Failed to delete S&OP cycle configuration');
    }
  },

  // Generate S&OP cycles
  generateSopCycles: async (configId) => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;
    
    try {
      const response = await fetch(`/api/sop-cycle-configs/${configId}/generate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      
      const result = await response.json();
      if (result.status === 'ok') {
        toast.success(`Generated ${result.cyclesCreated} S&OP cycles`);
        await get().loadSopCycles();
      } else {
        toast.error(result.error || 'Failed to generate S&OP cycles');
      }
    } catch (error) {
      console.error('Error generating S&OP cycles:', error);
      toast.error('Failed to generate S&OP cycles');
    }
  },

  // Enhanced loadSopCycles method
  loadSopCycles: async () => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;
    
    try {
      set({ isLoadingSopCycles: true });
      const response = await fetch('/api/sop-cycles', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      
      if (response.ok) {
        const result = await response.json();
        set({ sopCycles: result.cycles });
      } else {
        console.error('Failed to load S&OP cycles');
      }
    } catch (error) {
      console.error('Error loading S&OP cycles:', error);
    } finally {
      set({ isLoadingSopCycles: false });
    }
  },

  // Create S&OP cycle
  createSopCycle: async (cycle) => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;
    
    try {
      const response = await fetch('/api/sop-cycles', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(cycle)
      });
      
      const result = await response.json();
      if (result.status === 'ok') {
        toast.success('S&OP cycle created successfully');
        await get().loadSopCycles();
      } else {
        toast.error(result.error || 'Failed to create S&OP cycle');
      }
    } catch (error) {
      console.error('Error creating S&OP cycle:', error);
      toast.error('Failed to create S&OP cycle');
    }
  },

  // Update S&OP cycle status
  updateSopCycleStatus: async (id, status, isCurrent) => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;
    
    try {
      const response = await fetch(`/api/sop-cycles/${id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ status, isCurrent })
      });
      
      const result = await response.json();
      if (result.status === 'ok') {
        toast.success('S&OP cycle status updated successfully');
        await get().loadSopCycles();
      } else {
        toast.error(result.error || 'Failed to update S&OP cycle status');
      }
    } catch (error) {
      console.error('Error updating S&OP cycle status:', error);
      toast.error('Failed to update S&OP cycle status');
    }
  },

  // Load S&OP cycle permissions
  loadSopCyclePermissions: async (cycleId) => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;
    
    try {
      set({ isLoadingSopCyclePermissions: true });
      const response = await fetch(`/api/sop-cycles/${cycleId}/permissions`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      
      if (response.ok) {
        const result = await response.json();
        set({ sopCyclePermissions: result.permissions });
      } else {
        console.error('Failed to load S&OP cycle permissions');
      }
    } catch (error) {
      console.error('Error loading S&OP cycle permissions:', error);
    } finally {
      set({ isLoadingSopCyclePermissions: false });
    }
  },

  // Grant S&OP cycle permission
  grantSopCyclePermission: async (cycleId, userId, permissionType, expiresAt) => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;
    
    try {
      const response = await fetch(`/api/sop-cycles/${cycleId}/permissions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ userId, permissionType, expiresAt })
      });
      
      const result = await response.json();
      if (result.status === 'ok') {
        toast.success('Permission granted successfully');
        await get().loadSopCyclePermissions(cycleId);
      } else {
        toast.error(result.error || 'Failed to grant permission');
      }
    } catch (error) {
      console.error('Error granting permission:', error);
      toast.error('Failed to grant permission');
    }
  },

  // Revoke S&OP cycle permission
  revokeSopCyclePermission: async (cycleId, userId, permissionType) => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;
    
    try {
      const response = await fetch(`/api/sop-cycles/${cycleId}/permissions/${userId}/${permissionType}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      
      const result = await response.json();
      if (result.status === 'ok') {
        toast.success('Permission revoked successfully');
        await get().loadSopCyclePermissions(cycleId);
      } else {
        toast.error(result.error || 'Failed to revoke permission');
      }
    } catch (error) {
      console.error('Error revoking permission:', error);
      toast.error('Failed to revoke permission');
    }
  },

  // Create field mapping
  createFieldMapping: async (mapping: Omit<FieldMapping, 'id' | 'created_at' | 'created_by'>) => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;

    try {
      const response = await fetch('/api/field-mappings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(mapping)
      });

      const result = await response.json();
      if (response.ok && result.success) {
        toast.success('Field mapping created successfully');
        await get().loadFieldMappings(); // Refresh field mappings
      } else {
        toast.error(result.error || 'Failed to create field mapping');
      }
    } catch (error) {
      console.error('Error creating field mapping:', error);
      toast.error('Failed to create field mapping');
    }
  },

  // Update field mapping
  updateFieldMapping: async (id: number, mapping: Partial<FieldMapping>) => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;

    try {
      const response = await fetch(`/api/field-mappings/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(mapping)
      });

      const result = await response.json();
      if (response.ok && result.success) {
        toast.success('Field mapping updated successfully');
        await get().loadFieldMappings(); // Refresh field mappings
      } else {
        toast.error(result.error || 'Failed to update field mapping');
      }
    } catch (error) {
      console.error('Error updating field mapping:', error);
      toast.error('Failed to update field mapping');
    }
  },

  // Delete field mapping
  deleteFieldMapping: async (id: number) => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;

    if (!confirm('Are you sure you want to delete this field mapping?')) {
      return;
    }

    try {
      const response = await fetch(`/api/field-mappings/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      const result = await response.json();
      if (response.ok && result.success) {
        toast.success('Field mapping deleted successfully');
        await get().loadFieldMappings(); // Refresh field mappings
      } else {
        toast.error(result.error || 'Failed to delete field mapping');
      }
    } catch (error) {
      console.error('Error deleting field mapping:', error);
      toast.error('Failed to delete field mapping');
    }
  },
  
  // Update division
  updateDivision: async () => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;
    
    const { editingDivision, editDivisionForm } = get();
    
    if (!editingDivision || !editDivisionForm.name.trim()) {
      toast.error('Division name is required');
      return;
    }
    
    try {
      const response = await fetch(`/api/setup/divisions/${editingDivision}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(editDivisionForm)
      });
      
      const result = await response.json();
      if (result.success) {
        toast.success('Division updated successfully');
        set({ editingDivision: null, editDivisionForm: { name: '', description: '', industry: '', fieldMapping: '' } });
        await get().loadDivisions(); // Refresh divisions
      } else {
        toast.error(result.error || 'Failed to update division');
      }
    } catch (error) {
      console.error('Error updating division:', error);
      toast.error('Failed to update division');
    }
  },
  
  // Update cluster
  updateCluster: async () => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;
    
    const { editingCluster, editClusterForm } = get();
    
    if (!editingCluster || !editClusterForm.name.trim()) {
      toast.error('Cluster name is required');
      return;
    }
    
    try {
      const response = await fetch(`/api/setup/clusters/${editingCluster}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(editClusterForm)
      });
      
      const result = await response.json();
      if (result.success) {
        toast.success('Cluster updated successfully');
        set({ editingCluster: null, editClusterForm: { name: '', description: '', countryCode: '', region: '', fieldMapping: '' } });
        await get().loadClusters(); // Refresh clusters
      } else {
        toast.error(result.error || 'Failed to update cluster');
      }
    } catch (error) {
      console.error('Error updating cluster:', error);
      toast.error('Failed to update cluster');
    }
  },
  
  // Complete setup
  completeSetup: async () => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;
    
    try {
      // Save organization structure configuration before completing setup
      await get().saveOrgStructureConfig();
      
      const response = await fetch('/api/auth/setup/complete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        window.location.href = '/forecast';
      } else {
        console.error('[SetupWizard] Failed to complete setup, redirecting anyway...');
        window.location.href = '/forecast';
      }
    } catch (error) {
      console.error('[SetupWizard] Error completing setup:', error);
      window.location.href = '/forecast';
    }
  },
  
  // CSV upload and mapping actions
  uploadCsvFile: async (file: File) => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;

    set({ isUploadingCsv: true });

    try {
      const formData = new FormData();
      formData.append('csv', file);

      const response = await fetch('/api/setup/csv/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        set({ orgStructure: { ...get().orgStructure, uploadedCsvData: result.data, csvHeaders: result.headers } });
        toast.success('CSV file uploaded successfully');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to upload CSV file');
      }
    } catch (error) {
      console.error('Error uploading CSV file:', error);
      toast.error('Failed to upload CSV file');
    } finally {
      set({ isUploadingCsv: false });
    }
  },

  mapCsvColumns: async (divisionColumn: string | null, clusterColumn: string | null, lifecycleColumn: string | null) => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;

    try {
      const response = await fetch('/api/extract-org-structure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          csvData: get().orgStructure.uploadedCsvData,
          csvMapping: {
            divisionColumn,
            clusterColumn: clusterColumn || null,
            lifecycleColumn: lifecycleColumn || null,
            materialNameColumn: null,
            descriptionColumn: null
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        set({ 
          orgStructure: { 
            ...get().orgStructure, 
            csvMapping: {
              divisionColumn,
              clusterColumn: clusterColumn || null,
              lifecycleColumn: lifecycleColumn || null,
              materialNameColumn: null,
              descriptionColumn: null
            },
            extractedDivisions: result.extractedDivisions, 
            extractedClusters: result.extractedClusters,
            divisionClusterMap: result.divisionClusterMap || {}
          } 
        });
        
        // Create pending divisions and clusters with proper relationships
        if (result.extractedDivisions.length > 0) {
          result.extractedDivisions.forEach((divisionName: string) => {
            get().addPendingDivision({
              name: divisionName,
              description: '',
              industry: '',
              fieldMapping: divisionName,
              sourceFile: get().orgStructure.csvImportData?.csvFileName || 'unknown.csv' // Set sourceFile for CSV divisions
            });
          });
        }
        
        if (result.extractedClusters.length > 0 && result.divisionClusterMap) {
          // Use the new consistent ordering approach
          const consistentOrdering = get().createConsistentDivisionClusterOrdering(
            result.extractedDivisions,
            result.extractedClusters,
            result.divisionClusterMap
          );
          
          // Add new divisions from CSV to pending
          result.extractedDivisions.forEach((divisionName: string) => {
            // Check if this division is already in pending or database
            const existingDivision = get().divisions.find(d => d.name.toLowerCase() === divisionName.toLowerCase());
            const pendingDivision = get().orgStructure.pendingDivisions.find(d => d.name.toLowerCase() === divisionName.toLowerCase());
            
            if (!existingDivision && !pendingDivision) {
              get().addPendingDivision({
                name: divisionName,
                description: '',
                industry: '',
                fieldMapping: divisionName,
                sourceFile: get().orgStructure.csvImportData?.csvFileName || 'unknown.csv' // Set sourceFile for CSV divisions
              });
                  }
          });
          
          // Add clusters with consistent division IDs
          consistentOrdering.clusters.forEach((clusterInOrdering) => {
            get().addPendingCluster({
              name: clusterInOrdering.name,
              description: '',
              divisionId: clusterInOrdering.divisionId || 0,
              countryCode: '',
              region: '',
              fieldMapping: clusterInOrdering.name,
              sourceFile: get().orgStructure.csvImportData?.csvFileName || 'unknown.csv' // Set sourceFile for CSV clusters
            });
            
          });
        }
        
        toast.success('CSV columns mapped successfully');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to map CSV columns');
      }
    } catch (error) {
      console.error('Error mapping CSV columns:', error);
      toast.error('Failed to map CSV columns');
    }
  },

  extractOrgStructure: async () => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;

    try {
      const response = await fetch('/api/setup/csv/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          csvData: get().orgStructure.uploadedCsvData,
          csvMapping: get().orgStructure.csvMapping
        })
      });

      if (response.ok) {
        const result = await response.json();
        set({ orgStructure: { ...get().orgStructure, extractedDivisions: result.extractedDivisions, extractedClusters: result.extractedClusters } });
        toast.success('Organizational structure extracted successfully');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to extract organizational structure');
      }
    } catch (error) {
      console.error('Error extracting organizational structure:', error);
      toast.error('Failed to extract organizational structure');
    }
  },

  createDivisionsFromCsv: async () => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;

    try {
      const response = await fetch('/api/setup/csv/create-divisions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          companyId: get().company?.id,
          divisionNames: get().orgStructure.extractedDivisions
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Show detailed feedback about what was added vs what already existed
          if (result.newDivisions.length > 0 && result.existingDivisions.length > 0) {
            toast.success(`Added ${result.newDivisions.length} new divisions. ${result.existingDivisions.length} already existed.`);
          } else if (result.newDivisions.length > 0) {
            toast.success(`Added ${result.newDivisions.length} new divisions from CSV`);
          } else if (result.existingDivisions.length > 0) {
            toast.info(`All ${result.existingDivisions.length} divisions already exist in the database`);
          }
          await get().loadDivisions(); // Refresh divisions and auto-update flags
        } else {
          toast.error(result.error || 'Failed to create divisions from CSV');
        }
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create divisions from CSV');
      }
    } catch (error) {
      console.error('Error creating divisions from CSV:', error);
      toast.error('Failed to create divisions from CSV');
    }
  },

  createClustersFromCsv: async () => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;

    try {
      const response = await fetch('/api/setup/csv/create-clusters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          companyId: get().company?.id,
          divisionNames: get().orgStructure.extractedDivisions,
          clusterNames: get().orgStructure.extractedClusters
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Show detailed feedback about what was added vs what already existed
          if (result.newClusters.length > 0 && result.existingClusters.length > 0) {
            toast.success(`Added ${result.newClusters.length} new clusters. ${result.existingClusters.length} already existed.`);
          } else if (result.newClusters.length > 0) {
            toast.success(`Added ${result.newClusters.length} new clusters from CSV`);
          } else if (result.existingClusters.length > 0) {
            toast.info(`All ${result.existingClusters.length} clusters already exist in the database`);
          }
          await get().loadClusters(); // Refresh clusters and auto-update flags
        } else {
          toast.error(result.error || 'Failed to create clusters from CSV');
        }
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create clusters from CSV');
      }
    } catch (error) {
      console.error('Error creating clusters from CSV:', error);
      toast.error('Failed to create clusters from CSV');
    }
  },

  // CSV mapping storage and import actions
  storeCsvMappingData: (mappingData) => {
    set((state) => ({
      orgStructure: {
        ...state.orgStructure,
        csvImportData: mappingData
      }
    }));
  },

  importSetupCsvData: async () => {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return { success: false, error: 'No session token' };
    }

    const csvImportData = get().orgStructure.csvImportData;
    if (!csvImportData) {
      return { success: false, error: 'No CSV mapping data found' };
    }

    try {
      const payload = {
        headers: csvImportData.headers,
        data: csvImportData.data,
        mappings: csvImportData.columnMappings,
        dateFormat: csvImportData.dateFormat,
        numberFormat: csvImportData.numberFormat,
        separator: csvImportData.separator,
        transpose: csvImportData.transpose,
        finalColumnRoles: csvImportData.finalColumnRoles,
        originalCsvData: csvImportData.data, // Use data as original CSV data
        originalCsvString: csvImportData.originalCsv,
        csvFileName: csvImportData.csvFileName || 'setup-import.csv',
        csvHash: csvImportData.csvHash || 'setup-hash',
        selectedDivision: csvImportData.selectedDivision || null // Pass selected division to backend
      };

      const response = await fetch('/api/process-manual-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        toast.success('Setup CSV data imported successfully');
        return { success: true, datasetId: result.datasetId };
      } else {
        const error = result.error || result.details || 'Failed to import setup CSV data';
        toast.error(error);
        return { success: false, error };
      }
    } catch (error) {
      console.error('Error importing setup CSV data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to import setup CSV data';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  },

  clearCsvMappingData: () => {
    set((state) => {
      return {
        orgStructure: {
          ...state.orgStructure,
          csvImportData: null,
          extractedDivisions: [],
          extractedClusters: [],
          divisionClusterMap: {},
          pendingDivisions: state.orgStructure.pendingDivisions.filter(d => !d.sourceFile), // Keep only DB divisions
          pendingClusters: state.orgStructure.pendingClusters.filter(c => !c.sourceFile), // Keep only DB clusters
          lifecycleMappings: [],
          multipleCsvImport: {
            isEnabled: false,
            importedCsvs: [],
            remainingDivisions: []
          },
          isSingleCsvReplacement: false
        }
      };
    });
  },
  
  // Pending divisions and clusters management
  addPendingDivision: (division) => {
    const state = get();
    
    // Check for duplicate division names in existing divisions
    const existingDivision = state.divisions.find(d => 
      d.name.toLowerCase() === division.name.toLowerCase()
    );
    if (existingDivision) {
      console.warn(`[DEBUG] Skipping duplicate division "${division.name}" - already exists in database`);
      return;
    }
    
    // Check for duplicate division names in pending divisions
    const pendingDivision = state.orgStructure.pendingDivisions.find(d => 
      d.name.toLowerCase() === division.name.toLowerCase()
    );
    if (pendingDivision) {
      console.warn(`[DEBUG] Skipping duplicate division "${division.name}" - already pending`);
      return;
    }
    
    // Check for duplicate field mappings
    if (division.fieldMapping.trim()) {
      const existingFieldMapping = state.divisions.find(d => 
        d.fieldMapping && d.fieldMapping.toLowerCase() === division.fieldMapping.toLowerCase()
      );
      if (existingFieldMapping) {
        console.warn(`[DEBUG] Skipping division with duplicate field mapping "${division.fieldMapping}"`);
        return;
      }
      
      const pendingFieldMapping = state.orgStructure.pendingDivisions.find(d => 
        d.fieldMapping && d.fieldMapping.toLowerCase() === division.fieldMapping.toLowerCase()
      );
      if (pendingFieldMapping) {
        console.warn(`[DEBUG] Skipping division with duplicate pending field mapping "${division.fieldMapping}"`);
        return;
      }
    }
    
    set((state) => ({ orgStructure: { ...state.orgStructure, pendingDivisions: [...state.orgStructure.pendingDivisions, division] } }));
  },
  
  addPendingCluster: (cluster) => {
    const state = get();
    
    console.log(`🔍 [STORE DEBUG] addPendingCluster called with: "${cluster.name}"`);
    console.log(`🔍 [STORE DEBUG] Cluster details:`, cluster);
    console.log(`🔍 [STORE DEBUG] Current pending clusters count:`, state.orgStructure.pendingClusters.length);
    console.log(`🔍 [STORE DEBUG] Current pending clusters:`, state.orgStructure.pendingClusters.map(c => ({ name: c.name, divisionName: c.divisionName, fieldMapping: c.fieldMapping })));
    
    // Find the division name for this cluster
    let divisionName = 'Unknown Division';
    if (cluster.divisionId >= 0) {
      const division = state.divisions.find(d => d.id === cluster.divisionId);
      if (division) {
        divisionName = division.name;
      }
    } else if (cluster.divisionName) {
      divisionName = cluster.divisionName;
    }
    
    // Check for duplicate cluster names in the SAME division (existing clusters)
    console.log(`🔍 [STORE DEBUG] Checking for existing cluster "${cluster.name}" in division "${divisionName}"`);
    const existingClusterInSameDivision = state.clusters.find(c => {
      const existingDivision = state.divisions.find(d => d.id === c.division_id);
      const existingDivisionName = existingDivision ? existingDivision.name : 'Unknown Division';
      const isDuplicate = c.name.toLowerCase() === cluster.name.toLowerCase() && 
             existingDivisionName.toLowerCase() === divisionName.toLowerCase();
      if (isDuplicate) {
        console.log(`🔍 [STORE DEBUG] Found existing cluster "${c.name}" in division "${existingDivisionName}"`);
      }
      return isDuplicate;
    });
    if (existingClusterInSameDivision) {
      console.warn(`🔍 [STORE DEBUG] Skipping duplicate cluster "${cluster.name}" - already exists in division "${divisionName}"`);
      return;
    }
    
    // Check for duplicate cluster names in the SAME division (pending clusters)
    console.log(`🔍 [STORE DEBUG] Checking for pending cluster "${cluster.name}" in division "${divisionName}"`);
    const pendingClusterInSameDivision = state.orgStructure.pendingClusters.find(c => {
      let pendingDivisionName = 'Unknown Division';
      if (c.divisionId >= 0) {
        const division = state.divisions.find(d => d.id === c.divisionId);
        if (division) {
          pendingDivisionName = division.name;
        }
      } else if (c.divisionName) {
        pendingDivisionName = c.divisionName;
      }
      const isDuplicate = c.name.toLowerCase() === cluster.name.toLowerCase() && 
             pendingDivisionName.toLowerCase() === divisionName.toLowerCase();
      if (isDuplicate) {
        console.log(`🔍 [STORE DEBUG] Found pending cluster "${c.name}" in division "${pendingDivisionName}"`);
      }
      return isDuplicate;
    });
    if (pendingClusterInSameDivision) {
      console.warn(`🔍 [STORE DEBUG] Skipping duplicate cluster "${cluster.name}" - already pending in division "${divisionName}"`);
      return;
    }
    
    // Check for duplicate field mappings (global check - field mappings should be unique across the system)
    if (cluster.fieldMapping.trim()) {
      console.log(`🔍 [STORE DEBUG] Checking for duplicate field mapping "${cluster.fieldMapping}"`);
      const existingFieldMapping = state.clusters.find(c => 
        c.fieldMapping && c.fieldMapping.toLowerCase() === cluster.fieldMapping.toLowerCase()
      );
      if (existingFieldMapping) {
        console.warn(`🔍 [STORE DEBUG] Skipping cluster with duplicate field mapping "${cluster.fieldMapping}" - already exists in database`);
        return;
      }
      
      const pendingFieldMapping = state.orgStructure.pendingClusters.find(c => 
        c.fieldMapping && c.fieldMapping.toLowerCase() === cluster.fieldMapping.toLowerCase()
      );
      if (pendingFieldMapping) {
        console.warn(`🔍 [STORE DEBUG] Skipping cluster with duplicate pending field mapping "${cluster.fieldMapping}" - already pending`);
        return;
      }
      console.log(`🔍 [STORE DEBUG] Field mapping "${cluster.fieldMapping}" is unique`);
    }
    
    set((state) => ({ orgStructure: { ...state.orgStructure, pendingClusters: [...state.orgStructure.pendingClusters, cluster] } }));
    console.log(`🔍 [STORE DEBUG] Successfully added cluster "${cluster.name}" to pending clusters`);
  },
  updatePendingDivision: (index, division) => set((state) => {
    // Get the old division name before updating
    const oldDivision = state.orgStructure.pendingDivisions[index];
    const oldDivisionName = oldDivision?.name;
    const newDivisionName = division.name;
    
    // Update the division
    const updatedPendingDivisions = state.orgStructure.pendingDivisions.map((d, i) => i === index ? division : d);
    
    // Update any pending clusters that reference the old division name
    const updatedPendingClusters = state.orgStructure.pendingClusters.map(cluster => {
      if (cluster.divisionName === oldDivisionName) {
        return {
          ...cluster,
          divisionName: newDivisionName,
          // Update fieldMapping to reflect the new division name
          fieldMapping: cluster.fieldMapping.replace(`${oldDivisionName}_`, `${newDivisionName}_`)
        };
      }
      return cluster;
    });
    
    // Update any deleted clusters that reference the old division name
    const updatedDeletedClusters = state.orgStructure.deletedItems.clusters.map(cluster => {
      if (cluster.divisionName === oldDivisionName) {
        return {
          ...cluster,
          divisionName: newDivisionName,
          // Update fieldMapping to reflect the new division name
          fieldMapping: cluster.fieldMapping.replace(`${oldDivisionName}_`, `${newDivisionName}_`)
        };
      }
      return cluster;
    });
    
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
  }),
  updatePendingCluster: (index, cluster) => set((state) => ({ orgStructure: { ...state.orgStructure, pendingClusters: state.orgStructure.pendingClusters.map((c, i) => i === index ? cluster : c) } })),
  createAllPendingItems: async () => {
    const { orgStructure, company, loadDivisions, loadClusters, divisions, clusters } = get();
    const sessionToken = getSessionToken();
    if (!sessionToken || !company) return { success: false, error: 'No session or company' };
    
    try {
      // Filter out divisions that already exist in the database (case-insensitive)
      const existingDivisionNames = divisions.map(d => d.name.toLowerCase());
      const newPendingDivisions = orgStructure.pendingDivisions.filter(
        pending => !existingDivisionNames.includes(pending.name.toLowerCase())
      );
      
      // Filter out clusters that already exist in the database (case-insensitive) - PER DIVISION
      const existingClustersByDivision = new Map<string, Set<string>>();
      clusters.forEach(cluster => {
        const division = divisions.find(d => d.id === cluster.division_id);
        const divisionName = division ? division.name.toLowerCase() : 'unknown';
        if (!existingClustersByDivision.has(divisionName)) {
          existingClustersByDivision.set(divisionName, new Set());
        }
        existingClustersByDivision.get(divisionName)!.add(cluster.name.toLowerCase());
      });
      
      const newPendingClusters = orgStructure.pendingClusters.filter(pending => {
        const divisionName = pending.divisionName ? pending.divisionName.toLowerCase() : 'unknown';
        const existingClustersInDivision = existingClustersByDivision.get(divisionName) || new Set();
        return !existingClustersInDivision.has(pending.name.toLowerCase());
      });
      
      let createdDivisions = 0;
      let createdClusters = 0;
      
      // Create new divisions in batch
      if (newPendingDivisions.length > 0) {
        const response = await fetch('/api/setup/csv/create-divisions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
          },
          body: JSON.stringify({
            companyId: company.id,
            divisions: newPendingDivisions
          })
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.error || 'Failed to create divisions');
        createdDivisions = newPendingDivisions.length;
      }
      
      // Create new clusters in batch
      if (newPendingClusters.length > 0) {
        // First, create divisions if needed and get their IDs
        const divisionNameToId: { [name: string]: number } = {};
        
        // Map existing divisions
        divisions.forEach(div => {
          divisionNameToId[div.name] = div.id;
        });
        
        // Map newly created divisions
        if (createdDivisions > 0) {
          // Reload divisions to get the new IDs
          await loadDivisions();
          const updatedDivisions = get().divisions;
          updatedDivisions.forEach(div => {
            divisionNameToId[div.name] = div.id;
          });
        }
        
        // Resolve cluster division IDs
        const resolvedClusters = newPendingClusters.map(cluster => {
          let resolvedDivisionId = cluster.divisionId;
          
          // Handle the new consistent division ID approach
          if (cluster.divisionId >= 0) {
            // Use the consistent ordering to resolve division IDs
            const consistentOrdering = get().createConsistentDivisionClusterOrdering(
              [], // No new CSV divisions since we're in the creation phase
              [], // No new CSV clusters since we're in the creation phase
              {} // No division cluster map since we're in the creation phase
            );
            
            // Find the division at the consistent ID index
            if (cluster.divisionId < consistentOrdering.divisions.length) {
              const targetDivision = consistentOrdering.divisions[cluster.divisionId];
              resolvedDivisionId = divisionNameToId[targetDivision.name] || 1; // Default to first division
            } else {
              console.warn(`[DEBUG] Cluster "${cluster.name}" has invalid division index ${cluster.divisionId}, defaulting to first division`);
              resolvedDivisionId = 1; // Default to first division
            }
          } else if (cluster.divisionId < 0) {
            // Legacy negative index handling (for backward compatibility)
            const pendingDivisionIndex = -(cluster.divisionId + 1);
            const pendingDivision = orgStructure.pendingDivisions[pendingDivisionIndex];
            if (pendingDivision) {
              resolvedDivisionId = divisionNameToId[pendingDivision.name] || 1; // Default to first division
            }
          }
          
          return {
            ...cluster,
            divisionId: resolvedDivisionId
          };
        });
        
        const response = await fetch('/api/setup/csv/create-clusters', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
          },
          body: JSON.stringify({
            companyId: company.id,
            clusters: resolvedClusters
          })
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.error || 'Failed to create clusters');
        createdClusters = newPendingClusters.length;
      }
      
      // Show feedback about what was created
      const feedbackMessages = [];
      if (createdDivisions > 0) {
        feedbackMessages.push(`${createdDivisions} new division(s)`);
      }
      if (createdClusters > 0) {
        feedbackMessages.push(`${createdClusters} new cluster(s)`);
      }
      
      const existingCount = (orgStructure.pendingDivisions.length - createdDivisions) + 
                           (orgStructure.pendingClusters.length - createdClusters);
      
      if (feedbackMessages.length > 0) {
        toast.success(`Created ${feedbackMessages.join(' and ')}`);
      }
      
      if (existingCount > 0) {
        toast.info(`${existingCount} existing item(s) were preserved`);
      }
      
      // Clear pending arrays
      set(state => ({
        orgStructure: {
          ...state.orgStructure,
          pendingDivisions: [],
          pendingClusters: []
        }
      }));
      
      // Reload from backend
      await loadDivisions();
      await loadClusters();
      return { success: true };
    } catch (error: any) {
      toast.error(error.message || 'Failed to create pending items');
      return { success: false, error: error.message };
    }
  },
  
  // Field definition and mapping management
  createFieldDefinitions: async () => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return { success: false, error: 'No session token' };

    try {
      const response = await fetch('/api/field-definitions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          companyId: get().company?.id,
          fieldNames: ['Division', 'Cluster', 'Material Name', 'Description']
        })
      });

      const result = await response.json();
      if (response.ok && result.success) {
        toast.success('Field definitions created successfully');
        return { success: true };
      } else {
        toast.error(result.error || 'Failed to create field definitions');
        return { success: false, error: result.error || 'Failed to create field definitions' };
      }
    } catch (error) {
      console.error('Error creating field definitions:', error);
      toast.error('Failed to create field definitions');
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create field definitions' };
    }
  },

  createFieldMappings: async () => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return { success: false, error: 'No session token' };

    const { orgStructure, company } = get();
    if (!company) return { success: false, error: 'Company not found' };

    try {
      const mappings = [];
      
      // Create mappings for each field that has a CSV column
      if (orgStructure.csvMapping?.divisionColumn) {
        mappings.push({
          companyId: company.id,
          fieldDefId: 1, // Division field definition ID
          datasetColumn: orgStructure.csvMapping.divisionColumn
        });
      }
      
      if (orgStructure.csvMapping?.clusterColumn) {
        mappings.push({
          companyId: company.id,
          fieldDefId: 2, // Cluster field definition ID
          datasetColumn: orgStructure.csvMapping.clusterColumn
        });
      }
      
      if (orgStructure.csvMapping?.materialNameColumn) {
        mappings.push({
          companyId: company.id,
          fieldDefId: 3, // Material Name field definition ID
          datasetColumn: orgStructure.csvMapping.materialNameColumn
        });
      }
      
      if (orgStructure.csvMapping?.descriptionColumn) {
        mappings.push({
          companyId: company.id,
          fieldDefId: 4, // Description field definition ID
          datasetColumn: orgStructure.csvMapping.descriptionColumn
        });
      }

      if (mappings.length === 0) {
        return { success: true }; // No mappings to create
      }

      const response = await fetch('/api/field-mappings/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ mappings })
      });

      const result = await response.json();
      if (response.ok && result.success) {
        toast.success('Field mappings created successfully');
        return { success: true };
      } else {
        toast.error(result.error || 'Failed to create field mappings');
        return { success: false, error: result.error || 'Failed to create field mappings' };
      }
    } catch (error) {
      console.error('Error creating field mappings:', error);
      toast.error('Failed to create field mappings');
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create field mappings' };
    }
  },

  getFieldDefinitionId: (fieldName: string) => {
    const fieldDefinitions = get().fieldMappings.filter(f => f.dataset_column === fieldName);
    if (fieldDefinitions.length > 0) {
      return fieldDefinitions[0].field_def_id;
    }
    return null;
  },
  
  // Multiple CSV import actions
  initializeMultipleCsvImport: (remainingDivisions: string[] = []) => {
    set((state) => ({
      orgStructure: {
        ...state.orgStructure,
        multipleCsvImport: {
          isEnabled: true,
          importedCsvs: [],
          remainingDivisions,
        },
      },
    }));
  },

  addImportedCsv: (fileName: string, divisions: string[], clusters: string[], divisionName?: string) => {
    set((state) => {
      const { multipleCsvImport } = state.orgStructure;
      const newImportedCsvs = [
        ...multipleCsvImport.importedCsvs,
        {
          fileName,
          divisions,
          clusters,
          divisionName,
        },
      ];

      // Update remaining divisions if this was a division-level import without division column
      // Ensure remainingDivisions is always an array
      const currentRemainingDivisions = Array.isArray(multipleCsvImport.remainingDivisions) 
        ? multipleCsvImport.remainingDivisions 
        : [];
      
      let newRemainingDivisions = currentRemainingDivisions;
      if (divisionName && currentRemainingDivisions.includes(divisionName)) {
        newRemainingDivisions = currentRemainingDivisions.filter(d => d !== divisionName);
      }

      return {
        orgStructure: {
          ...state.orgStructure,
          multipleCsvImport: {
            ...multipleCsvImport,
            importedCsvs: newImportedCsvs,
            remainingDivisions: newRemainingDivisions,
          },
        },
      };
    });
  },

  removeImportedCsv: (fileName: string) => {
    set((state) => {
      const { multipleCsvImport, pendingDivisions, pendingClusters } = state.orgStructure;
      console.log('[removeImportedCsv] Deleting data from file:', fileName);
      
      // Debug: Log all divisions and their properties
      console.log('[removeImportedCsv] All pending divisions before filtering:', 
        pendingDivisions.map(d => ({
          name: d.name,
          isExisting: d.isExisting,
          sourceFile: d.sourceFile,
          id: d.id
        }))
      );
      
      // Debug: Log all clusters and their properties
      console.log('[removeImportedCsv] All pending clusters before filtering:', 
        pendingClusters.map(c => ({
          name: c.name,
          isExisting: c.isExisting,
          sourceFile: c.sourceFile,
          id: c.id
        }))
      );
      
      // Remove only divisions/clusters from this specific file
      // Keep all DB data (isExisting: true) and items from other files
      const newPendingDivisions = pendingDivisions.filter(
        d => d.isExisting === true || d.sourceFile !== fileName
      );
      const newPendingClusters = pendingClusters.filter(
        c => c.isExisting === true || c.sourceFile !== fileName
      );
      
      console.log('[removeImportedCsv] Filter results:', {
        originalDivisions: pendingDivisions.length,
        originalClusters: pendingClusters.length,
        filteredDivisions: newPendingDivisions.length,
        filteredClusters: newPendingClusters.length,
        removedDivisions: pendingDivisions.length - newPendingDivisions.length,
        removedClusters: pendingClusters.length - newPendingClusters.length
      });
      
      // Debug: Log which divisions are being removed
      const removedDivisions = pendingDivisions.filter(
        d => d.isExisting !== true && d.sourceFile === fileName
      );
      const removedClusters = pendingClusters.filter(
        c => c.isExisting !== true && c.sourceFile === fileName
      );
      
      console.log('[removeImportedCsv] Divisions being removed:', 
        removedDivisions.map(d => ({ name: d.name, sourceFile: d.sourceFile, isExisting: d.isExisting }))
      );
      console.log('[removeImportedCsv] Clusters being removed:', 
        removedClusters.map(c => ({ name: c.name, sourceFile: c.sourceFile, isExisting: c.isExisting }))
      );
      
      // Remove the CSV from the tracking system
      const newImportedCsvs = multipleCsvImport.importedCsvs.filter(csv => csv.fileName !== fileName);
      const newRemainingDivisions = multipleCsvImport.remainingDivisions.filter(d => !newImportedCsvs.some(csv => csv.divisionName === d));
      
      return {
        orgStructure: {
          ...state.orgStructure,
          pendingDivisions: newPendingDivisions,
          pendingClusters: newPendingClusters,
          multipleCsvImport: {
            ...multipleCsvImport,
            importedCsvs: newImportedCsvs,
            remainingDivisions: newRemainingDivisions,
          },
        },
      };
    });
  },

  getNextImportInfo: () => {
    const { multipleCsvImport } = get().orgStructure;
    // Ensure remainingDivisions is always an array
    const remainingDivisions = Array.isArray(multipleCsvImport.remainingDivisions) 
      ? multipleCsvImport.remainingDivisions 
      : [];
    
    return {
      importedCount: multipleCsvImport.importedCsvs.length,
      remainingDivisions: remainingDivisions,
    };
  },

  isMultipleCsvImportComplete: () => {
    const { multipleCsvImport } = get().orgStructure;
    // For division-level imports with division column, we don't know the total
    // So we let the user decide when they're done
    return false; // Always allow more imports unless user chooses to move on
  },
  
  // Load DB divisions into pending divisions (single source of truth)
  loadDbDivisionsIntoPending: () => {
    const state = get();
    const divisions = state.divisions;
    const pendingDivisions = state.orgStructure.pendingDivisions;
    
    console.log('🔄 loadDbDivisionsIntoPending called:', {
      dbDivisionsCount: divisions.length,
      pendingDivisionsCount: pendingDivisions.length,
      dbDivisions: divisions.map(d => ({ name: d.name, id: d.id })),
      pendingDivisions: pendingDivisions.map(d => ({ name: d.name, id: d.id, isExisting: d.isExisting }))
    });
    
    // Clear existing pending divisions
    set(state => ({
      orgStructure: {
        ...state.orgStructure,
        pendingDivisions: []
      }
    }));
    
    console.log('🔄 Cleared pending divisions, now adding DB divisions...');
    
    // Add existing divisions to pending divisions
    const dbDivisionsWithFlag = divisions.map(division => ({
      name: division.name,
      description: division.description || '',
      industry: division.industry || '',
      fieldMapping: division.fieldMapping || division.name,
      isExisting: true,
      id: division.id,
      sourceFile: undefined // Explicitly set sourceFile for DB divisions
    }));
    
    console.log('🔄 Adding DB divisions to pending:', dbDivisionsWithFlag);
    
    set(state => ({
      orgStructure: {
        ...state.orgStructure,
        pendingDivisions: [...dbDivisionsWithFlag]
      }
    }));
    
    // Add back existing pending divisions that weren't from DB
    // Preserve all properties including sourceFile
    const nonExistingPendingDivisions = pendingDivisions.filter(pd => !pd.isExisting);
    console.log('🔄 Adding back non-existing pending divisions:', {
      count: nonExistingPendingDivisions.length,
      divisions: nonExistingPendingDivisions.map(d => ({ 
        name: d.name, 
        id: d.id, 
        isExisting: d.isExisting,
        sourceFile: d.sourceFile 
      }))
    });
    
    if (nonExistingPendingDivisions.length > 0) {
      set(state => ({
        orgStructure: {
          ...state.orgStructure,
          pendingDivisions: [...state.orgStructure.pendingDivisions, ...nonExistingPendingDivisions]
        }
      }));
    }
    
    const finalState = get();
    console.log('🔄 loadDbDivisionsIntoPending completed:', {
      finalPendingDivisionsCount: finalState.orgStructure.pendingDivisions.length,
      finalPendingDivisions: finalState.orgStructure.pendingDivisions.map(d => ({
        name: d.name,
        id: d.id,
        isExisting: d.isExisting,
        sourceFile: d.sourceFile,
        description: d.description,
        industry: d.industry,
        fieldMapping: d.fieldMapping
      }))
    });
  },
  
  // Load DB clusters into pending clusters (single source of truth)
  loadDbClustersIntoPending: () => {
    const state = get();
    const clusters = state.clusters;
    const pendingClusters = state.orgStructure.pendingClusters;
    
    console.log('🔄 loadDbClustersIntoPending called:', {
      dbClustersCount: clusters.length,
      pendingClustersCount: pendingClusters.length,
      dbClusters: clusters.map(c => ({ name: c.name, id: c.id })),
      pendingClusters: pendingClusters.map(c => ({ 
        name: c.name, 
        id: c.id, 
        isExisting: c.isExisting,
        sourceFile: c.sourceFile 
      }))
    });
    
    // Clear existing pending clusters
    set(state => ({
      orgStructure: {
        ...state.orgStructure,
        pendingClusters: []
      }
    }));
    
    // Add existing clusters to pending clusters
    clusters.forEach(cluster => {
      set(state => ({
        orgStructure: {
          ...state.orgStructure,
          pendingClusters: [...state.orgStructure.pendingClusters, {
            name: cluster.name,
            description: cluster.description,
            divisionId: cluster.division_id,
            countryCode: cluster.country_code || '',
            region: cluster.region || '',
            fieldMapping: cluster.fieldMapping || '',
            isExisting: true,
            id: cluster.id,
            sourceFile: undefined // Explicitly set sourceFile for DB clusters
          }]
        }
      }));
    });
    
    // Add existing pending clusters back, but only if they're not already in the array
    // and preserve their isExisting flag
    pendingClusters.forEach(pendingCluster => {
      set(state => {
        // Check if this cluster is already in the array (by name or ID)
        const alreadyExists = state.orgStructure.pendingClusters.some(pc => 
          pc.id === pendingCluster.id || pc.name === pendingCluster.name
        );
        
        if (!alreadyExists) {
          return {
            orgStructure: {
              ...state.orgStructure,
              pendingClusters: [...state.orgStructure.pendingClusters, {
                ...pendingCluster,
                // Preserve the isExisting flag if it exists, otherwise default to false
                isExisting: pendingCluster.isExisting !== undefined ? pendingCluster.isExisting : false
              }]
            }
          };
        }
        return state; // No changes if already exists
      });
    });
    
    // Log the final result
    const finalState = get();
    console.log('🔄 loadDbClustersIntoPending completed:', {
      finalPendingClustersCount: finalState.orgStructure.pendingClusters.length,
      finalPendingClusters: finalState.orgStructure.pendingClusters.map(c => ({ 
        name: c.name, 
        id: c.id, 
        isExisting: c.isExisting,
        sourceFile: c.sourceFile
      }))
    });
  },
  
  // Form setters
  setCompanyForm: (form) => set((state) => ({ companyForm: { ...state.companyForm, ...form } })),
  setNewDivision: (division) => set((state) => ({ newDivision: { ...state.newDivision, ...division } })),
  setNewCluster: (cluster) => set((state) => ({ newCluster: { ...state.newCluster, ...cluster } })),
  setNewSopCycle: (sopCycle) => set((state) => ({ newSopCycle: { ...state.newSopCycle, ...sopCycle } })),
  setSopCycleConfig: (config) => set({ sopCycleConfig: config }),
  setEditDivisionForm: (form) => set((state) => ({ editDivisionForm: { ...state.editDivisionForm, ...form } })),
  setEditClusterForm: (form) => set((state) => ({ editClusterForm: { ...state.editClusterForm, ...form } })),
  
  // Edit state setters
  setEditingDivision: (id) => set({ editingDivision: id }),
  setEditingCluster: (id) => set({ editingCluster: id }),
  
  // Org structure setters
  setOrgStructure: (structure) => set((state) => {
    // Check if user is manually setting hasMultipleDivisions or hasMultipleClusters
    const userConfiguredFlags = { ...state.orgStructure.userConfiguredFlags };
    
    if ('hasMultipleDivisions' in structure) {
      userConfiguredFlags.hasMultipleDivisions = true;
    }
    
    if ('hasMultipleClusters' in structure) {
      userConfiguredFlags.hasMultipleClusters = true;
    }
    
    return {
      orgStructure: { 
        ...state.orgStructure, 
        ...structure,
        userConfiguredFlags
      }
    };
  }),
  
  // Reset functions
  resetForms: () => set({
    newDivision: { name: '', description: '', industry: '', fieldMapping: '' },
    newCluster: { name: '', description: '', divisionId: '', countryCode: '', region: '', fieldMapping: '' },
    newSopCycle: { name: '', description: '', divisionId: '', startDate: '', endDate: '' }
  }),
  
  resetEditStates: () => set({
    editingDivision: null,
    editingCluster: null,
    editDivisionForm: { name: '', description: '', industry: '', fieldMapping: '' },
    editClusterForm: { name: '', description: '', countryCode: '', region: '', fieldMapping: '' }
  }),

  resetOrgStructure: () => set({
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
      // Items marked for deletion during Setup Wizard (not applied to DB until completion)
      deletedItems: {
        divisions: [] as Division[],
        clusters: [] as Cluster[]
      },
      // Flags to track if user has manually configured these settings
      userConfiguredFlags: {
        hasMultipleDivisions: false,
        hasMultipleClusters: false,
      },
      // Flag to indicate single CSV replacement (not merge)
      isSingleCsvReplacement: false
    }
  }),

  // Clear pending items only (keep other org structure settings)
  clearPendingItems: () => set((state) => ({
    orgStructure: {
      ...state.orgStructure,
      pendingDivisions: [],
      pendingClusters: [],
    }
  })),
  
  // Create consistent division-cluster ordering and ID assignment
  createConsistentDivisionClusterOrdering: (csvDivisions: string[], csvClusters: string[], divisionClusterMap: Record<string, string[]>) => {
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
    
    // Resolve cluster division assignments
    const resolvedClusters = clustersWithIds.map(cluster => {
      if (cluster.divisionId === null && cluster.source === 'csv') {
        const consistentDivisionId = divisionNameToConsistentId[cluster.divisionName];
        if (consistentDivisionId !== undefined) {
          cluster.divisionId = consistentDivisionId;
        }
      }
      return cluster;
    });
    
    return {
      divisions: divisionsWithIds,
      clusters: resolvedClusters,
      divisionNameToConsistentId
    };
  },
  
  // Setup flow calculation
  calculateSetupFlow: async () => {
    const { orgStructure, company } = get();
    
    // Load field mappings if not already loaded
    if (company?.id) {
      await get().loadFieldMappings();
    }
    
    const { fieldMappings } = get();
    const { hasMultipleDivisions, hasMultipleClusters, importLevel, divisionCsvType, enableLifecycleTracking } = orgStructure;
    const companyName = company?.name || 'Company';

    let skipDivisionStep = false;
    let skipClusterStep = false;
    let requiresCsvUpload = false; // Default to false, enable only when needed
    let csvImportSkippable = false; // Whether CSV import can be skipped if mappings exist
    let divisionValue: string | null = null;
    let clusterValue: string | null = null;
    let hasDivisionColumn = false;
    let hasClusterColumn = false;

    // Check if field mappings already exist for this company/division
    const hasExistingFieldMappings = fieldMappings.length > 0;

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
          set((state) => ({
            orgStructure: {
              ...state.orgStructure,
              multipleCsvImport: {
                ...state.orgStructure.multipleCsvImport,
                isEnabled: false
              }
            }
          }));
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
            hasLifecycleColumn: false,
          },
        },
      },
    }));
  },
  
  // Cache utilities
  isCacheStale: (key: string) => {
    const lastFetched = get().cache.lastFetched[key];
    const cacheDuration = get().cache.cacheDuration;
    return !lastFetched || Date.now() - lastFetched > cacheDuration;
  },
  
  updateCache: (key: string) => {
    set(state => ({
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
    set(state => ({
      cache: {
        ...state.cache,
        lastFetched: {}
      }
    }));
  },
  
  // Parallel data loading
  loadSetupData: async () => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;
    
    set({ isLoading: true });
    
    try {
      // Load setup-related data in parallel
      const [setupStatus, orgStructureConfig, fieldMappings] = await Promise.all([
        get().loadSetupStatus(),
        get().loadOrgStructureConfig(),
        get().loadFieldMappings()
      ]);
      
      console.log('Setup data loaded successfully');
    } catch (error) {
      console.error('Error loading setup data:', error);
    } finally {
      set({ isLoading: false });
    }
  },
  
  loadOrgData: async () => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;
    
    set({ isLoading: true });
    
    try {
      // Load organizational data in parallel
      const [company, divisions, clusters] = await Promise.all([
        get().loadCompany(),
        get().loadDivisions(),
        get().loadClusters()
      ]);
      
      console.log('Organization data loaded successfully');
    } catch (error) {
      console.error('Error loading organization data:', error);
    } finally {
      set({ isLoading: false });
    }
  },
  
  // Request deduplication
  deduplicatedFetch: async <T>(key: string, fetchFn: () => Promise<T>): Promise<T> => {
    if (get().isCacheStale(key)) {
      get().updateCache(key);
      return fetchFn();
    } else {
      const pendingRequest = get().pendingRequests[key];
      if (pendingRequest) {
        return pendingRequest;
      } else {
        const newPromise = fetchFn();
        set(state => ({
          pendingRequests: {
            ...state.pendingRequests,
            [key]: newPromise
          }
        }));
        try {
          const result = await newPromise;
          set(state => ({
            pendingRequests: {
              ...state.pendingRequests,
              [key]: undefined
            }
          }));
          return result;
        } catch (error) {
          set(state => ({
            pendingRequests: {
              ...state.pendingRequests,
              [key]: undefined
            }
          }));
          throw error;
        }
      }
    }
  },
  
  // Division and cluster management
  deleteDivision: async (id: number, forceHardDelete?: boolean) => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return { success: false, method: 'soft', error: 'No session token' };
    
    try {
      // Get the division name before deleting it
      const currentState = get();
      const divisionToDelete = currentState.divisions.find(d => d.id === id);
      const divisionName = divisionToDelete?.name;
      
      const response = await fetch(`/api/divisions/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      
      const result = await response.json();
      if (response.ok && result.success) {
        toast.success('Division deleted successfully');
        
        // Reload divisions data to update UI (without triggering setup flow)
        const divisionsResponse = await fetch(`/api/divisions?companyId=${get().company?.id}`, {
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        
        if (divisionsResponse.ok) {
          const result = await divisionsResponse.json();
          const divisions = result.divisions || result;
          
          // Update state directly without triggering auto-initialization
          // Preserve existing orgStructure settings to maintain user selections
          set((state) => {
            const hasMultipleDivisions = divisions.length > 1;
            
            // Update pendingDivisions to reflect the deletion
            // Remove the deleted division from pendingDivisions if it was there
            const updatedPendingDivisions = state.orgStructure.pendingDivisions.filter(
              pendingDiv => pendingDiv.name !== divisionName
            );
            
            // Add the deleted division to deletedItems for restoration
            const updatedDeletedDivisions = [...state.orgStructure.deletedItems.divisions, {
              ...divisionToDelete,
              originalPendingIndex: state.orgStructure.pendingDivisions.findIndex(pd => pd.name === divisionName)
            }];
            
            return {
              divisions,
              orgStructure: {
                ...state.orgStructure,
                hasMultipleDivisions,
                pendingDivisions: updatedPendingDivisions,
                deletedItems: {
                  ...state.orgStructure.deletedItems,
                  divisions: updatedDeletedDivisions
                }
                // Don't trigger calculateSetupFlow to preserve setup flow settings
              },
            };
          });
          
                  // Update cache
        get().updateCache('divisions');
        
        // Trigger a custom event to notify components that inactive entities should be refreshed
        window.dispatchEvent(new CustomEvent('inactiveEntitiesChanged', { 
          detail: { type: 'division', action: 'deleted', id } 
        }));
      }
      
      return { success: true, method: 'soft' };
      } else if (response.ok && result.error === 'Division is in use') {
        if (forceHardDelete) {
          const hardDeleteResponse = await fetch(`/api/divisions/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${sessionToken}`,
              'X-Force-Hard-Delete': 'true'
            }
          });
          
          if (hardDeleteResponse.ok && (await hardDeleteResponse.json()).success) {
            toast.success('Division deleted successfully (hard delete)');
            
            // Reload divisions data to update UI (without triggering setup flow)
            const divisionsResponse = await fetch(`/api/divisions?companyId=${get().company?.id}`, {
              headers: { 'Authorization': `Bearer ${sessionToken}` }
            });
            
            if (divisionsResponse.ok) {
              const result = await divisionsResponse.json();
              const divisions = result.divisions || result;
              
              // Update state directly without triggering auto-initialization
              set((state) => {
                const hasMultipleDivisions = divisions.length > 1;
                
                // Remove the deleted division from pendingDivisions as well
                const updatedPendingDivisions = state.orgStructure.pendingDivisions.filter(
                  pendingDiv => pendingDiv.name !== divisionName
                );
                
                // Add the deleted division to deletedItems for restoration
                const updatedDeletedDivisions = [...state.orgStructure.deletedItems.divisions, {
                  ...divisionToDelete,
                  originalPendingIndex: state.orgStructure.pendingDivisions.findIndex(pd => pd.name === divisionName)
                }];
                
                return {
                  divisions,
                  orgStructure: {
                    ...state.orgStructure,
                    hasMultipleDivisions,
                    pendingDivisions: updatedPendingDivisions,
                    deletedItems: {
                      ...state.orgStructure.deletedItems,
                      divisions: updatedDeletedDivisions
                    }
                  },
                };
              });
              
              // Update cache
              get().updateCache('divisions');
              
              // Trigger a custom event to notify components that inactive entities should be refreshed
              window.dispatchEvent(new CustomEvent('inactiveEntitiesChanged', { 
                detail: { type: 'division', action: 'deleted', id } 
              }));
            }
            
            return { success: true, method: 'hard' };
          } else {
            return { success: false, method: 'soft', error: 'Failed to delete division (hard delete)' };
          }
        } else {
          return { success: false, method: 'soft', error: 'Division is in use' };
        }
      } else {
        return { success: false, method: 'soft', error: result.error || 'Failed to delete division' };
      }
    } catch (error) {
      console.error('Error deleting division:', error);
      return { success: false, method: 'soft', error: error instanceof Error ? error.message : 'Failed to delete division' };
    }
  },
  
  deleteCluster: async (id: number, forceHardDelete?: boolean) => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return { success: false, method: 'soft', error: 'No session token' };
    
    try {
      // Get the cluster name before deleting it
      const currentState = get();
      const clusterToDelete = currentState.clusters.find(c => c.id === id);
      const clusterName = clusterToDelete?.name;
      
      const response = await fetch(`/api/clusters/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      
      const result = await response.json();
      if (response.ok && result.success) {
        toast.success('Cluster deleted successfully');
        
        // Reload clusters data to update UI (without triggering setup flow)
        const clustersResponse = await fetch(`/api/clusters?companyId=${get().company?.id}`, {
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        
        if (clustersResponse.ok) {
          const result = await clustersResponse.json();
          const clusters = result.clusters || result;
          
          // Update state directly without triggering auto-initialization
          // Preserve existing orgStructure settings to maintain user selections
          set((state) => {
            const hasMultipleClusters = clusters.length > 1;
            
            // Remove the deleted cluster from pendingClusters as well
            const updatedPendingClusters = state.orgStructure.pendingClusters.filter(
              pendingCluster => pendingCluster.name !== clusterName
            );
            
            // Add the deleted cluster to deletedItems for restoration
            const updatedDeletedClusters = [...state.orgStructure.deletedItems.clusters, {
              ...clusterToDelete,
              originalPendingIndex: state.orgStructure.pendingClusters.findIndex(pc => pc.name === clusterName)
            }];
            
            return {
              clusters,
              orgStructure: {
                ...state.orgStructure,
                hasMultipleClusters,
                pendingClusters: updatedPendingClusters,
                deletedItems: {
                  ...state.orgStructure.deletedItems,
                  clusters: updatedDeletedClusters
                }
                // Don't trigger calculateSetupFlow to preserve setup flow settings
              },
            };
          });
          
          // Update cache
          get().updateCache('clusters');
          
          // Trigger a custom event to notify components that inactive entities should be refreshed
          window.dispatchEvent(new CustomEvent('inactiveEntitiesChanged', { 
            detail: { type: 'cluster', action: 'deleted', id } 
          }));
        }
        
        return { success: true, method: 'soft' };
      } else if (response.ok && result.error === 'Cluster is in use') {
        if (forceHardDelete) {
          const hardDeleteResponse = await fetch(`/api/clusters/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${sessionToken}`,
              'X-Force-Hard-Delete': 'true'
            }
          });
          
          if (hardDeleteResponse.ok && (await hardDeleteResponse.json()).success) {
            toast.success('Cluster deleted successfully (hard delete)');
            
            // Reload clusters data to update UI (without triggering setup flow)
            const clustersResponse = await fetch(`/api/clusters?companyId=${get().company?.id}`, {
              headers: { 'Authorization': `Bearer ${sessionToken}` }
            });
            
            if (clustersResponse.ok) {
              const result = await clustersResponse.json();
              const clusters = result.clusters || result;
              
              // Update state directly without triggering auto-initialization
              set((state) => {
                const hasMultipleClusters = clusters.length > 1;
                
                // Remove the deleted cluster from pendingClusters as well
                const updatedPendingClusters = state.orgStructure.pendingClusters.filter(
                  pendingCluster => pendingCluster.name !== clusterName
                );
                
                // Add the deleted cluster to deletedItems for restoration
                const updatedDeletedClusters = [...state.orgStructure.deletedItems.clusters, {
                  ...clusterToDelete,
                  originalPendingIndex: state.orgStructure.pendingClusters.findIndex(pc => pc.name === clusterName)
                }];
                
                return {
                  clusters,
                  orgStructure: {
                    ...state.orgStructure,
                    hasMultipleClusters,
                    pendingClusters: updatedPendingClusters,
                    deletedItems: {
                      ...state.orgStructure.deletedItems,
                      clusters: updatedDeletedClusters
                    }
                  },
                };
              });
              
              // Update cache
              get().updateCache('clusters');
              
              // Trigger a custom event to notify components that inactive entities should be refreshed
              window.dispatchEvent(new CustomEvent('inactiveEntitiesChanged', { 
                detail: { type: 'cluster', action: 'deleted', id } 
              }));
            }
            
            return { success: true, method: 'hard' };
          } else {
            return { success: false, method: 'soft', error: 'Failed to delete cluster (hard delete)' };
          }
        } else {
          return { success: false, method: 'soft', error: 'Cluster is in use' };
        }
      } else {
        return { success: false, method: 'soft', error: result.error || 'Failed to delete cluster' };
      }
    } catch (error) {
      console.error('Error deleting cluster:', error);
      return { success: false, method: 'soft', error: error instanceof Error ? error.message : 'Failed to delete cluster' };
    }
  },
  
  restoreDivision: async (id: number) => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return { success: false, error: 'No session token' };
    
    try {
      const response = await fetch(`/api/divisions/${id}/restore`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      
      const result = await response.json();
      if (response.ok && result.success) {
        toast.success('Division restored successfully');
        
        // Reload divisions data to update UI (without triggering setup flow)
        const divisionsResponse = await fetch(`/api/divisions?companyId=${get().company?.id}`, {
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        
        if (divisionsResponse.ok) {
          const result = await divisionsResponse.json();
          const divisions = result.divisions || result;
          
          // Update state directly without triggering auto-initialization
          // Preserve existing orgStructure settings to maintain user selections
          set((state) => {
            const hasMultipleDivisions = divisions.length > 1;
            
            // Find the restored division to add to pendingDivisions
            const restoredDivision = divisions.find(d => d.id === id);
            
            // Add the restored division to pendingDivisions if it's not already there
            let updatedPendingDivisions = [...state.orgStructure.pendingDivisions];
            if (restoredDivision && !updatedPendingDivisions.some(pd => pd.name === restoredDivision.name)) {
              updatedPendingDivisions.push({
                name: restoredDivision.name,
                description: restoredDivision.description || '',
                industry: restoredDivision.industry || '',
                fieldMapping: restoredDivision.fieldMapping || restoredDivision.name || '',
                isExisting: restoredDivision.isExisting || false, // Restore the isExisting flag
                id: restoredDivision.id // Restore the ID
              });
            }
            
            return {
              divisions,
              orgStructure: {
                ...state.orgStructure,
                hasMultipleDivisions,
                pendingDivisions: updatedPendingDivisions,
                // Don't trigger calculateSetupFlow to preserve setup flow settings
              },
            };
          });
          
          // Update cache
          get().updateCache('divisions');
          
          // Trigger a custom event to notify components that inactive entities should be refreshed
          window.dispatchEvent(new CustomEvent('inactiveEntitiesChanged', { 
            detail: { type: 'division', action: 'restored', id } 
          }));
        }
        
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Failed to restore division' };
      }
    } catch (error) {
      console.error('Error restoring division:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to restore division' };
    }
  },
  
  restoreCluster: async (id: number) => {
    console.log(`🔍 [RESTORE DEBUG] restoreCluster called with ID: ${id}`);
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      console.error(`🔍 [RESTORE DEBUG] No session token found`);
      return { success: false, error: 'No session token' };
    }
    
    try {
      const response = await fetch(`/api/clusters/${id}/restore`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      
      const result = await response.json();
      console.log(`🔍 [RESTORE DEBUG] API response:`, { status: response.status, success: result.success, result });
      if (response.ok && result.success) {
        console.log(`🔍 [RESTORE DEBUG] Cluster restored successfully via API`);
        toast.success('Cluster restored successfully');
        
        // Reload clusters data to update UI (without triggering setup flow)
        const clustersResponse = await fetch(`/api/clusters?companyId=${get().company?.id}`, {
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        
        if (clustersResponse.ok) {
          const result = await clustersResponse.json();
          const clusters = result.clusters || result;
          console.log(`🔍 [RESTORE DEBUG] Reloaded clusters:`, clusters);
          
          // Update state directly without triggering auto-initialization
          // Preserve existing orgStructure settings to maintain user selections
          set((state) => {
            const hasMultipleClusters = clusters.length > 1;
            
            // Find the restored cluster to add to pendingClusters
            const restoredCluster = clusters.find(c => c.id === id);
            console.log(`🔍 [RESTORE DEBUG] Found restored cluster:`, restoredCluster);
            
            // Add the restored cluster to pendingClusters if it's not already there
            let updatedPendingClusters = [...state.orgStructure.pendingClusters];
            if (restoredCluster && !updatedPendingClusters.some(pc => pc.name === restoredCluster.name)) {
              updatedPendingClusters.push({
                name: restoredCluster.name,
                description: restoredCluster.description || '',
                divisionId: restoredCluster.division_id,
                countryCode: restoredCluster.country_code || '',
                region: restoredCluster.region || '',
                fieldMapping: restoredCluster.fieldMapping || restoredCluster.name || '',
                isExisting: restoredCluster.isExisting || false, // Restore the isExisting flag
                id: restoredCluster.id // Restore the ID
              });
            }
            
            return {
              clusters,
              orgStructure: {
                ...state.orgStructure,
                hasMultipleClusters,
                pendingClusters: updatedPendingClusters,
                // Don't trigger calculateSetupFlow to preserve setup flow settings
              },
            };
          });
          
          // Update cache
          get().updateCache('clusters');
          
          // Trigger a custom event to notify components that inactive entities should be refreshed
          window.dispatchEvent(new CustomEvent('inactiveEntitiesChanged', { 
            detail: { type: 'cluster', action: 'restored', id } 
          }));
        }
        
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Failed to restore cluster' };
      }
    } catch (error) {
      console.error('Error restoring cluster:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to restore cluster' };
    }
  },
  
  // Setup Wizard pending operations (no immediate DB changes)
  deletePendingDivision: (idOrIndex: number) => {
    try {
      set((state) => {
        let divisionToDelete: any = null;
        let originalIndex = -1;
        
        // Try to find by ID first (for existing divisions)
        if (idOrIndex > 0) {
          divisionToDelete = state.orgStructure.pendingDivisions.find(d => d.id === idOrIndex);
          if (divisionToDelete) {
            originalIndex = state.orgStructure.pendingDivisions.findIndex(pd => pd.id === idOrIndex);
          }
        }
        
        // If not found by ID, treat as index (for new divisions without ID)
        if (!divisionToDelete && idOrIndex >= 0 && idOrIndex < state.orgStructure.pendingDivisions.length) {
          divisionToDelete = state.orgStructure.pendingDivisions[idOrIndex];
          originalIndex = idOrIndex;
        }
        
        if (!divisionToDelete) {
          console.error('Division not found for deletion:', { idOrIndex, pendingDivisionsLength: state.orgStructure.pendingDivisions.length });
          return state; // No changes if division not found
        }
        
        // Remove from pendingDivisions array
        const updatedPendingDivisions = state.orgStructure.pendingDivisions.filter((_, index) => index !== originalIndex);
        
        // Add to deletedItems for potential restoration
        const updatedDeletedDivisions = [...state.orgStructure.deletedItems.divisions, {
          id: divisionToDelete.id || 0,
          name: divisionToDelete.name,
          description: divisionToDelete.description,
          industry: divisionToDelete.industry,
          fieldMapping: divisionToDelete.fieldMapping,
          originalPendingIndex: originalIndex,
          isExisting: divisionToDelete.isExisting || false // Preserve the isExisting flag
        }];
        
        console.log('🔄 deletePendingDivision: Adding to deletedItems:', {
          divisionToDelete,
          updatedDeletedDivisionsLength: updatedDeletedDivisions.length,
          deletedItemsBefore: state.orgStructure.deletedItems.divisions.length
        });
        
        return {
          orgStructure: {
            ...state.orgStructure,
            pendingDivisions: updatedPendingDivisions,
            deletedItems: {
              ...state.orgStructure.deletedItems,
              divisions: updatedDeletedDivisions
            }
          },
        };
      });
      
      toast.success('Division marked for deletion (will be applied when setup is completed)');
      return { success: true };
    } catch (error) {
      console.error('Error deleting pending division:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete division' };
    }
  },
  
  deletePendingCluster: (idOrIndex: number) => {
    try {
      set((state) => {
        let clusterToDelete: any = null;
        let originalIndex = -1;
        
        // Try to find by ID first (for existing clusters)
        if (idOrIndex > 0) {
          clusterToDelete = state.orgStructure.pendingClusters.find(c => c.id === idOrIndex);
          if (clusterToDelete) {
            originalIndex = state.orgStructure.pendingClusters.findIndex(pc => pc.id === idOrIndex);
          }
        }
        
        // If not found by ID, treat as index (for new clusters without ID)
        if (!clusterToDelete && idOrIndex >= 0 && idOrIndex < state.orgStructure.pendingClusters.length) {
          clusterToDelete = state.orgStructure.pendingClusters[idOrIndex];
          originalIndex = idOrIndex;
        }
        
        if (!clusterToDelete) {
          console.error('Cluster not found for deletion:', { idOrIndex, pendingClustersLength: state.orgStructure.pendingClusters.length });
          return state; // No changes if cluster not found
        }
        
        // Remove from pendingClusters array
        const updatedPendingClusters = state.orgStructure.pendingClusters.filter((_, index) => index !== originalIndex);
        
        // Add to deletedItems for potential restoration
        const updatedDeletedClusters = [...state.orgStructure.deletedItems.clusters, {
          id: clusterToDelete.id || 0,
          name: clusterToDelete.name,
          description: clusterToDelete.description,
          country_code: clusterToDelete.countryCode,
          region: clusterToDelete.region,
          division_id: clusterToDelete.divisionId,
          divisionName: clusterToDelete.divisionName, // Store the division name for restoration
          fieldMapping: clusterToDelete.fieldMapping,
          originalPendingIndex: originalIndex,
          isExisting: clusterToDelete.isExisting || false // Preserve the isExisting flag
        }];
        
        return {
          orgStructure: {
            ...state.orgStructure,
            pendingClusters: updatedPendingClusters,
            deletedItems: {
              ...state.orgStructure.deletedItems,
              clusters: updatedDeletedClusters
            }
          },
        };
      });
      
      toast.success('Cluster marked for deletion (will be applied when setup is completed)');
      return { success: true };
    } catch (error) {
      console.error('Error deleting pending cluster:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete cluster' };
    }
  },
  
  restorePendingDivision: (id: number) => {
    try {
      set((state) => {
        // Find the division in deletedItems
        const deletedDivision = state.orgStructure.deletedItems.divisions.find(d => d.id === id);
        if (!deletedDivision) {
          return state; // No changes if division not found in deleted items
        }
        
        // Add back to divisions array
        const updatedDivisions = [...state.divisions, {
          id: deletedDivision.id,
          name: deletedDivision.name,
          description: deletedDivision.description,
          industry: deletedDivision.industry,
          fieldMapping: deletedDivision.fieldMapping
        }];
        
        // Add back to pendingDivisions array
        const updatedPendingDivisions = [...state.orgStructure.pendingDivisions, {
          name: deletedDivision.name,
          description: deletedDivision.description || '',
          industry: deletedDivision.industry || '',
          fieldMapping: deletedDivision.fieldMapping || deletedDivision.name || '',
          isExisting: deletedDivision.isExisting || false, // Restore the isExisting flag
          id: deletedDivision.id // Restore the ID
        }];
        
        // Remove from deletedItems
        const updatedDeletedDivisions = state.orgStructure.deletedItems.divisions.filter(d => d.id !== id);
        
        return {
          divisions: updatedDivisions,
          orgStructure: {
            ...state.orgStructure,
            hasMultipleDivisions: updatedDivisions.length > 1,
            pendingDivisions: updatedPendingDivisions,
            deletedItems: {
              ...state.orgStructure.deletedItems,
              divisions: updatedDeletedDivisions
            }
          },
        };
      });
      
      toast.success('Division restored (will be applied when setup is completed)');
      return { success: true };
    } catch (error) {
      console.error('Error restoring pending division:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to restore division' };
    }
  },
  
  restorePendingCluster: (id: number, clusterName?: string, divisionName?: string) => {
    console.log(`🔍 [RESTORE DEBUG] restorePendingCluster called with ID: ${id}, clusterName: ${clusterName}, divisionName: ${divisionName}`);
    try {
      set((state) => {
        console.log(`🔍 [RESTORE DEBUG] Current deleted clusters:`, state.orgStructure.deletedItems.clusters);
        
        // For pending clusters (id === 0), we need to find by a more unique identifier
        // since multiple clusters can have id === 0. Use name and divisionName for precise identification
        let deletedCluster;
        if (id === 0 && clusterName && divisionName) {
          // For pending clusters with name and divisionName, use them for precise identification
          deletedCluster = state.orgStructure.deletedItems.clusters.find(c => 
            c.id === id && c.name === clusterName && c.divisionName === divisionName
          );
        } else if (id === 0) {
          // For pending clusters without name/divisionName, fall back to first match (less precise)
          deletedCluster = state.orgStructure.deletedItems.clusters.find(c => c.id === id);
        } else {
          // For database clusters, use ID as before
          deletedCluster = state.orgStructure.deletedItems.clusters.find(c => c.id === id);
        }
        
        console.log(`🔍 [RESTORE DEBUG] Found deleted cluster:`, deletedCluster);
        if (!deletedCluster) {
          console.warn(`🔍 [RESTORE DEBUG] Cluster with ID ${id} not found in deleted items`);
          return state; // No changes if cluster not found in deleted items
        }
        
        // Add back to clusters array
        const updatedClusters = [...state.clusters, {
          id: deletedCluster.id,
          name: deletedCluster.name,
          description: deletedCluster.description,
          country_code: deletedCluster.country_code,
          region: deletedCluster.region,
          division_id: deletedCluster.division_id,
          fieldMapping: deletedCluster.fieldMapping
        }];
        
        // Add back to pendingClusters array
        const restoredPendingCluster = {
          name: deletedCluster.name,
          description: deletedCluster.description || '',
          divisionId: deletedCluster.division_id,
          divisionName: deletedCluster.divisionName || 'Unknown Division', // Use stored division name
          countryCode: deletedCluster.country_code || '',
          region: deletedCluster.region || '',
          fieldMapping: deletedCluster.fieldMapping || deletedCluster.name || '',
          isExisting: deletedCluster.isExisting || false, // Restore the isExisting flag
          id: deletedCluster.id // Restore the ID
        };
        console.log(`🔍 [RESTORE DEBUG] Restored pending cluster:`, restoredPendingCluster);
        const updatedPendingClusters = [...state.orgStructure.pendingClusters, restoredPendingCluster];
        
        // Remove from deletedItems - use name and divisionName for precise removal when id === 0
        const updatedDeletedClusters = state.orgStructure.deletedItems.clusters.filter(c => {
          if (id === 0 && clusterName && divisionName) {
            // For pending clusters, remove by name and divisionName to be precise
            return !(c.id === id && c.name === clusterName && c.divisionName === divisionName);
          } else {
            // For database clusters, remove by ID as before
            return c.id !== id;
          }
        });
        console.log(`🔍 [RESTORE DEBUG] Updated deleted clusters:`, updatedDeletedClusters);
        
        const newState = {
          clusters: updatedClusters,
          orgStructure: {
            ...state.orgStructure,
            hasMultipleClusters: (updatedClusters.length + updatedPendingClusters.length) > 1,
            pendingClusters: updatedPendingClusters,
            deletedItems: {
              ...state.orgStructure.deletedItems,
              clusters: updatedDeletedClusters
            }
          },
        };
        console.log(`🔍 [RESTORE DEBUG] New state pending clusters:`, newState.orgStructure.pendingClusters);
        return newState;
      });
      
      console.log(`🔍 [RESTORE DEBUG] Cluster restored successfully to pending list`);
      toast.success('Cluster restored (will be applied when setup is completed)');
      return { success: true };
    } catch (error) {
      console.error(`🔍 [RESTORE DEBUG] Error restoring pending cluster:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to restore cluster' };
    }
  },
  
  // Apply all pending changes to the database when setup is completed
  applyPendingChanges: async () => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return { success: false, error: 'No session token' };
    
    try {
      const currentState = get();
      const deletedDivisions = currentState.orgStructure.deletedItems.divisions || [];
      const deletedClusters = currentState.orgStructure.deletedItems.clusters || [];
      const pendingDivisions = currentState.orgStructure.pendingDivisions || [];
      const pendingClusters = currentState.orgStructure.pendingClusters || [];
      
      console.log('Applying pending changes:', {
        deletedDivisions: deletedDivisions.length,
        deletedClusters: deletedClusters.length,
        pendingDivisions: pendingDivisions.length,
        pendingClusters: pendingClusters.length,
        dbDivisions: deletedDivisions.filter(d => d.isExisting).length,
        dbClusters: deletedClusters.filter(c => c.isExisting).length,
        csvDivisions: deletedDivisions.filter(d => !d.isExisting).length,
        csvClusters: deletedClusters.filter(c => !c.isExisting).length
      });
      
      // Only delete items that came from the database (isExisting: true)
      // Items from CSV (isExisting: false) can be ignored since they were never saved
      const dbDeletedDivisions = deletedDivisions.filter(d => d.isExisting);
      const dbDeletedClusters = deletedClusters.filter(c => c.isExisting);
      
      // Track all operations for reporting
      const operations = [];
      
      // Handle division renames: Update database clusters when their division is renamed
      const divisionRenames = [];
      for (const pendingDivision of pendingDivisions) {
        if (pendingDivision.isExisting && pendingDivision.id) {
          // This is an existing division that might have been renamed
          const originalDivision = currentState.divisions.find(d => d.id === pendingDivision.id);
          if (originalDivision && originalDivision.name !== pendingDivision.name) {
            divisionRenames.push({
              divisionId: pendingDivision.id,
              oldName: originalDivision.name,
              newName: pendingDivision.name
            });
          }
        }
      }
      
      // Update clusters in the database when their division is renamed
      if (divisionRenames.length > 0) {
        console.log('Handling division renames:', divisionRenames);
        
        // Get all clusters from the database to find those affected by renames
        const response = await fetch('/api/clusters', {
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        const clustersResult = await response.json();
        
        if (clustersResult.success) {
          const dbClusters = clustersResult.clusters || [];
          const updatePromises = [];
          
          for (const rename of divisionRenames) {
            // Find clusters that belong to the renamed division
            const affectedClusters = dbClusters.filter(cluster => cluster.division_id === rename.divisionId);
            
            for (const cluster of affectedClusters) {
              // Update the cluster's field mapping to reflect the new division name
              const oldFieldMapping = cluster.fieldMapping || `${rename.oldName}_${cluster.name}`;
              const newFieldMapping = oldFieldMapping.replace(`${rename.oldName}_`, `${rename.newName}_`);
              
              if (oldFieldMapping !== newFieldMapping) {
                updatePromises.push(
                  fetch(`/api/clusters/${cluster.id}`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${sessionToken}`
                    },
                    body: JSON.stringify({
                      fieldMapping: newFieldMapping
                    })
                  }).then(response => response.json())
                );
                
                operations.push(`Updated cluster "${cluster.name}" field mapping for division rename`);
              }
            }
          }
          
          // Wait for all cluster updates to complete
          if (updatePromises.length > 0) {
            const updateResults = await Promise.all(updatePromises);
            const failedUpdates = updateResults.filter(result => !result.success);
            if (failedUpdates.length > 0) {
              console.error('Some cluster updates failed:', failedUpdates);
              return { success: false, error: 'Some cluster updates failed' };
            }
          }
        }
      }
      
      // Apply all pending deletions for DB items only
      const deletePromises = [];
      
      // Delete divisions from DB
      for (const division of dbDeletedDivisions) {
        deletePromises.push(
          fetch(`/api/divisions/${division.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${sessionToken}` }
          }).then(response => response.json())
        );
        operations.push(`Deleted division "${division.name}"`);
      }
      
      // Delete clusters from DB
      for (const cluster of dbDeletedClusters) {
        deletePromises.push(
          fetch(`/api/clusters/${cluster.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${sessionToken}` }
          }).then(response => response.json())
        );
        operations.push(`Deleted cluster "${cluster.name}"`);
      }
      
      // Wait for all deletions to complete
      const results = await Promise.all(deletePromises);
      
      // Check if all deletions were successful
      const failedDeletions = results.filter(result => !result.success);
      if (failedDeletions.length > 0) {
        console.error('Some pending deletions failed:', failedDeletions);
        return { success: false, error: 'Some pending deletions failed' };
      }
      
      // Clear the deletedItems after successful application
      set((state) => ({
        orgStructure: {
          ...state.orgStructure,
          deletedItems: {
            divisions: [],
            clusters: []
          }
        }
      }));
      
      const totalApplied = dbDeletedDivisions.length + dbDeletedClusters.length + operations.length;
      const totalIgnored = (deletedDivisions.length - dbDeletedDivisions.length) + (deletedClusters.length - dbDeletedClusters.length);
      
      if (totalIgnored > 0) {
        toast.success(`Applied ${totalApplied} DB changes, ignored ${totalIgnored} CSV items`);
      } else {
        toast.success(`Applied ${totalApplied} pending changes`);
      }
      
      console.log('Applied operations:', operations);
      return { success: true };
    } catch (error) {
      console.error('Error applying pending changes:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to apply pending changes' };
    }
  },
}));