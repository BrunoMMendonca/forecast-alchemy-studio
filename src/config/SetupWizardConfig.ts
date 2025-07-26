// Configuration-driven architecture for Setup Wizard
// This centralizes all complex business logic and workflow paths

export interface ImportLevel {
  id: 'company' | 'division';
  label: string;
  description: string;
  supportsMultipleFiles: boolean;
  requiresDivisionMapping: boolean;
  csvReplacementBehavior: 'allow' | 'block' | 'confirm';
  dataClearingBehavior: 'clearAll' | 'preserveMultiple' | 'preserveDivision';
}

export interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  isRequired: boolean;
  isVisible: (config: SetupWizardConfig) => boolean;
  canProceed: (config: SetupWizardConfig) => boolean;
  validationRules?: ValidationRule[];
}

export interface ValidationRule {
  field: string;
  condition: (value: any, config: SetupWizardConfig) => boolean;
  message: string;
}

export interface DataClearingPolicy {
  whenBusinessConfigChanges: boolean;
  whenImportLevelChanges: boolean;
  whenDivisionStructureChanges: boolean;
  preserveMultipleCsvImport: boolean;
  preserveDivisionLevelData: boolean;
}

export interface SetupWizardConfig {
  // Core configuration
  importLevels: ImportLevel[];
  workflowSteps: WorkflowStep[];
  dataClearingPolicy: DataClearingPolicy;
  
  // Business logic functions
  shouldShowCsvReplacementDialog: (hasExistingImport: boolean, importLevel: string) => boolean;
  shouldClearAllData: (importLevel: string, hasMultipleCsvImport: boolean) => boolean;
  getVisibleInactiveEntities: (currentStep: string) => 'all' | 'division' | 'cluster';
  shouldAutoCloseInactivePanel: (entityType: string, remainingCount: number) => boolean;
  
  // Validation functions
  validateBusinessConfiguration: (config: any) => ValidationResult;
  validateCsvImport: (data: any, importLevel: string) => ValidationResult;
  validateDivisions: (divisions: any[]) => ValidationResult;
  validateClusters: (clusters: any[], divisions: any[]) => ValidationResult;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Default configuration
export const defaultSetupWizardConfig: SetupWizardConfig = {
  importLevels: [
    {
      id: 'company',
      label: 'Company-wide',
      description: 'Import data for the entire company in a single CSV file',
      supportsMultipleFiles: false,
      requiresDivisionMapping: false,
      csvReplacementBehavior: 'confirm',
      dataClearingBehavior: 'clearAll'
    },
    {
      id: 'division',
      label: 'Division-specific',
      description: 'Import separate CSV files for each division',
      supportsMultipleFiles: true,
      requiresDivisionMapping: true,
      csvReplacementBehavior: 'allow',
      dataClearingBehavior: 'preserveDivision'
    }
  ],

  workflowSteps: [
    {
      id: 'business-configuration',
      title: 'Business Configuration',
      description: 'Configure your organizational structure and import preferences',
      isRequired: true,
      isVisible: () => true,
      canProceed: (config) => true,
      validationRules: [
        {
          field: 'hasMultipleDivisions',
          condition: (value) => value !== undefined,
          message: 'Please specify if you have multiple divisions'
        },
        {
          field: 'hasMultipleClusters',
          condition: (value) => value !== undefined,
          message: 'Please specify if you have multiple clusters'
        }
      ]
    },
    {
      id: 'csv-import',
      title: 'CSV Import & Mapping',
      description: 'Upload and map your CSV data',
      isRequired: true,
      isVisible: () => true,
      canProceed: (config) => {
        // Can proceed if CSV data is imported or if user chooses to skip
        return true; // This will be enhanced with actual validation
      }
    },
    {
      id: 'divisions',
      title: 'Create Divisions',
      description: 'Review and manage your divisions',
      isRequired: true,
      isVisible: (config) => config.importLevels.find(level => level.id === 'company')?.requiresDivisionMapping || false,
      canProceed: (config) => {
        // Can proceed if divisions are configured
        return true; // This will be enhanced with actual validation
      }
    },
    {
      id: 'clusters',
      title: 'Create Clusters',
      description: 'Review and manage your clusters',
      isRequired: true,
      isVisible: (config) => true,
      canProceed: (config) => {
        // Can proceed if clusters are configured
        return true; // This will be enhanced with actual validation
      }
    },
    {
      id: 'product-lifecycle',
      title: 'Product Lifecycle',
      description: 'Configure product lifecycle tracking',
      isRequired: false,
      isVisible: (config) => true,
      canProceed: () => true
    },
    {
      id: 'sop-cycles',
      title: 'SOP Cycles',
      description: 'Configure Sales & Operations Planning cycles',
      isRequired: false,
      isVisible: (config) => true,
      canProceed: () => true
    },
    {
      id: 'setup-complete',
      title: 'Setup Complete',
      description: 'Your setup is complete',
      isRequired: true,
      isVisible: () => true,
      canProceed: () => true
    }
  ],

  dataClearingPolicy: {
    whenBusinessConfigChanges: true,
    whenImportLevelChanges: true,
    whenDivisionStructureChanges: true,
    preserveMultipleCsvImport: false,
    preserveDivisionLevelData: false
  },

  // Business logic functions
  shouldShowCsvReplacementDialog: (hasExistingImport: boolean, importLevel: string) => {
    if (!hasExistingImport) return false;
    
    const level = defaultSetupWizardConfig.importLevels.find(l => l.id === importLevel);
    return level?.csvReplacementBehavior === 'confirm';
  },

  shouldClearAllData: (importLevel: string, hasMultipleCsvImport: boolean) => {
    // Always clear all data when business config changes (as per current requirement)
    return true;
  },

  getVisibleInactiveEntities: (currentStep: string) => {
    switch (currentStep) {
      case 'divisions':
        return 'division';
      case 'clusters':
        return 'cluster';
      default:
        return 'all';
    }
  },

  shouldAutoCloseInactivePanel: (entityType: string, remainingCount: number) => {
    return remainingCount === 0;
  },

  // Validation functions
  validateBusinessConfiguration: (config: any): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.hasMultipleDivisions === undefined) {
      errors.push('Please specify if you have multiple divisions');
    }

    if (config.hasMultipleClusters === undefined) {
      errors.push('Please specify if you have multiple clusters');
    }

    if (config.importLevel === undefined) {
      errors.push('Please select an import level');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  },

  validateCsvImport: (data: any, importLevel: string): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data) {
      errors.push('No CSV data provided');
    }

    const level = defaultSetupWizardConfig.importLevels.find(l => l.id === importLevel);
    if (level?.requiresDivisionMapping && !data?.divisions?.length) {
      errors.push('Division mapping is required for this import level');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  },

  validateDivisions: (divisions: any[]): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!divisions || divisions.length === 0) {
      errors.push('At least one division is required');
    }

    // Check for duplicate names
    const names = divisions.map(d => d.name);
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    if (duplicates.length > 0) {
      errors.push(`Duplicate division names found: ${duplicates.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  },

  validateClusters: (clusters: any[], divisions: any[]): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!clusters || clusters.length === 0) {
      errors.push('At least one cluster is required');
    }

    // Check for clusters without divisions
    const orphanedClusters = clusters.filter(c => !c.divisionName);
    if (orphanedClusters.length > 0) {
      errors.push(`${orphanedClusters.length} cluster(s) are not assigned to any division`);
    }

    // Check for duplicate names within the same division
    const divisionClusterMap = new Map<string, string[]>();
    clusters.forEach(cluster => {
      const division = cluster.divisionName || 'Unknown';
      if (!divisionClusterMap.has(division)) {
        divisionClusterMap.set(division, []);
      }
      divisionClusterMap.get(division)!.push(cluster.name);
    });

    divisionClusterMap.forEach((clusterNames, division) => {
      const duplicates = clusterNames.filter((name, index) => clusterNames.indexOf(name) !== index);
      if (duplicates.length > 0) {
        errors.push(`Duplicate cluster names in ${division}: ${duplicates.join(', ')}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
};

// Configuration manager class
export class SetupWizardConfigManager {
  private config: SetupWizardConfig;

  constructor(config: SetupWizardConfig = defaultSetupWizardConfig) {
    this.config = config;
  }

  // Get current configuration
  getConfig(): SetupWizardConfig {
    return this.config;
  }

  // Update configuration
  updateConfig(updates: Partial<SetupWizardConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  // Get import level configuration
  getImportLevel(levelId: string): ImportLevel | undefined {
    return this.config.importLevels.find(level => level.id === levelId);
  }

  // Get workflow step configuration
  getWorkflowStep(stepId: string): WorkflowStep | undefined {
    return this.config.workflowSteps.find(step => step.id === stepId);
  }

  // Get visible steps for current configuration
  getVisibleSteps(): WorkflowStep[] {
    return this.config.workflowSteps.filter(step => step.isVisible(this.config));
  }

  // Check if step can proceed
  canProceedToStep(stepId: string): boolean {
    const step = this.getWorkflowStep(stepId);
    return step ? step.canProceed(this.config) : false;
  }

  // Validate business configuration
  validateBusinessConfiguration(config: any): ValidationResult {
    return this.config.validateBusinessConfiguration(config);
  }

  // Validate CSV import
  validateCsvImport(data: any, importLevel: string): ValidationResult {
    return this.config.validateCsvImport(data, importLevel);
  }

  // Validate divisions
  validateDivisions(divisions: any[]): ValidationResult {
    return this.config.validateDivisions(divisions);
  }

  // Validate clusters
  validateClusters(clusters: any[], divisions: any[]): ValidationResult {
    return this.config.validateClusters(clusters, divisions);
  }

  // Business logic helpers
  shouldShowCsvReplacementDialog(hasExistingImport: boolean, importLevel: string): boolean {
    return this.config.shouldShowCsvReplacementDialog(hasExistingImport, importLevel);
  }

  shouldClearAllData(importLevel: string, hasMultipleCsvImport: boolean): boolean {
    return this.config.shouldClearAllData(importLevel, hasMultipleCsvImport);
  }

  getVisibleInactiveEntities(currentStep: string): 'all' | 'division' | 'cluster' {
    return this.config.getVisibleInactiveEntities(currentStep);
  }

  shouldAutoCloseInactivePanel(entityType: string, remainingCount: number): boolean {
    return this.config.shouldAutoCloseInactivePanel(entityType, remainingCount);
  }
}

// Export singleton instance
export const setupWizardConfigManager = new SetupWizardConfigManager(); 