// State Machine for Setup Wizard
// Manages complex state transitions and business logic

import { setupWizardConfigManager } from '@/config/SetupWizardConfig';

export type SetupWizardState = 
  | 'initializing'
  | 'business-configuration'
  | 'csv-import'
  | 'csv-mapping'
  | 'divisions'
  | 'clusters'
  | 'product-lifecycle'
  | 'sop-cycles'
  | 'setup-complete'
  | 'error';

export type SetupWizardEvent = 
  | 'INITIALIZE'
  | 'BUSINESS_CONFIG_CHANGED'
  | 'CSV_IMPORTED'
  | 'CSV_MAPPING_COMPLETE'
  | 'DIVISIONS_CONFIGURED'
  | 'CLUSTERS_CONFIGURED'
  | 'LIFECYCLE_CONFIGURED'
  | 'SOP_CONFIGURED'
  | 'NEXT_STEP'
  | 'PREVIOUS_STEP'
  | 'SKIP_STEP'
  | 'ERROR'
  | 'RESET';

export interface StateTransition {
  from: SetupWizardState;
  to: SetupWizardState;
  event: SetupWizardEvent;
  condition?: (context: SetupWizardContext) => boolean;
  action?: (context: SetupWizardContext) => void;
}

export interface SetupWizardContext {
  currentState: SetupWizardState;
  previousState: SetupWizardState | null;
  stepData: Record<string, any>;
  validationErrors: Record<string, string[]>;
  isStepComplete: Record<string, boolean>;
  canProceed: Record<string, boolean>;
  importLevel: string;
  hasMultipleDivisions: boolean;
  hasMultipleClusters: boolean;
  enableLifecycleTracking: boolean;
  csvImportData: any;
  extractedDivisions: any[];
  extractedClusters: any[];
  pendingDivisions: any[];
  pendingClusters: any[];
  lifecycleMappings: any[];
  multipleCsvImport: any;
}

export class SetupWizardStateMachine {
  private currentState: SetupWizardState = 'initializing';
  private previousState: SetupWizardState | null = null;
  private context: SetupWizardContext;
  private transitions: StateTransition[];

  constructor() {
    this.context = this.createInitialContext();
    this.transitions = this.createTransitions();
  }

  private createInitialContext(): SetupWizardContext {
    return {
      currentState: 'initializing',
      previousState: null,
      stepData: {},
      validationErrors: {},
      isStepComplete: {},
      canProceed: {},
      importLevel: 'company',
      hasMultipleDivisions: false,
      hasMultipleClusters: false,
      enableLifecycleTracking: false,
      csvImportData: null,
      extractedDivisions: [],
      extractedClusters: [],
      pendingDivisions: [],
      pendingClusters: [],
      lifecycleMappings: [],
      multipleCsvImport: {
        isEnabled: false,
        importedCsvs: [],
        remainingDivisions: []
      }
    };
  }

  private createTransitions(): StateTransition[] {
    return [
      // Initialization
      {
        from: 'initializing',
        to: 'business-configuration',
        event: 'INITIALIZE',
        action: (context) => {
          context.currentState = 'business-configuration';
          context.previousState = 'initializing';
        }
      },

      // Business Configuration
      {
        from: 'business-configuration',
        to: 'csv-import',
        event: 'NEXT_STEP',
        condition: (context) => {
          const config = setupWizardConfigManager.getConfig();
          const validation = config.validateBusinessConfiguration({
            hasMultipleDivisions: context.hasMultipleDivisions,
            hasMultipleClusters: context.hasMultipleClusters,
            importLevel: context.importLevel
          });
          return validation.isValid;
        },
        action: (context) => {
          context.previousState = context.currentState;
          context.currentState = 'csv-import';
          // Clear CSV data when business config changes
          this.clearCsvData(context);
        }
      },

      // CSV Import
      {
        from: 'csv-import',
        to: 'csv-mapping',
        event: 'CSV_IMPORTED',
        action: (context) => {
          context.previousState = context.currentState;
          context.currentState = 'csv-mapping';
        }
      },

      {
        from: 'csv-import',
        to: 'divisions',
        event: 'SKIP_STEP',
        condition: (context) => {
          const config = setupWizardConfigManager.getConfig();
          const importLevel = config.getImportLevel(context.importLevel);
          return importLevel?.requiresDivisionMapping || false;
        },
        action: (context) => {
          context.previousState = context.currentState;
          context.currentState = 'divisions';
        }
      },

      {
        from: 'csv-import',
        to: 'clusters',
        event: 'SKIP_STEP',
        condition: (context) => {
          const config = setupWizardConfigManager.getConfig();
          const importLevel = config.getImportLevel(context.importLevel);
          return !importLevel?.requiresDivisionMapping;
        },
        action: (context) => {
          context.previousState = context.currentState;
          context.currentState = 'clusters';
        }
      },

      // CSV Mapping
      {
        from: 'csv-mapping',
        to: 'divisions',
        event: 'CSV_MAPPING_COMPLETE',
        condition: (context) => {
          const config = setupWizardConfigManager.getConfig();
          const importLevel = config.getImportLevel(context.importLevel);
          return importLevel?.requiresDivisionMapping || false;
        },
        action: (context) => {
          context.previousState = context.currentState;
          context.currentState = 'divisions';
          this.processCsvData(context);
        }
      },

      {
        from: 'csv-mapping',
        to: 'clusters',
        event: 'CSV_MAPPING_COMPLETE',
        condition: (context) => {
          const config = setupWizardConfigManager.getConfig();
          const importLevel = config.getImportLevel(context.importLevel);
          return !importLevel?.requiresDivisionMapping;
        },
        action: (context) => {
          context.previousState = context.currentState;
          context.currentState = 'clusters';
          this.processCsvData(context);
        }
      },

      // Divisions
      {
        from: 'divisions',
        to: 'clusters',
        event: 'NEXT_STEP',
        condition: (context) => {
          const config = setupWizardConfigManager.getConfig();
          const validation = config.validateDivisions(context.pendingDivisions);
          return validation.isValid;
        },
        action: (context) => {
          context.previousState = context.currentState;
          context.currentState = 'clusters';
        }
      },

      // Clusters
      {
        from: 'clusters',
        to: 'product-lifecycle',
        event: 'NEXT_STEP',
        condition: (context) => {
          const config = setupWizardConfigManager.getConfig();
          const validation = config.validateClusters(context.pendingClusters, context.pendingDivisions);
          return validation.isValid && context.enableLifecycleTracking;
        },
        action: (context) => {
          context.previousState = context.currentState;
          context.currentState = 'product-lifecycle';
        }
      },

      {
        from: 'clusters',
        to: 'sop-cycles',
        event: 'NEXT_STEP',
        condition: (context) => {
          const config = setupWizardConfigManager.getConfig();
          const validation = config.validateClusters(context.pendingClusters, context.pendingDivisions);
          return validation.isValid && !context.enableLifecycleTracking;
        },
        action: (context) => {
          context.previousState = context.currentState;
          context.currentState = 'sop-cycles';
        }
      },

      // Product Lifecycle
      {
        from: 'product-lifecycle',
        to: 'sop-cycles',
        event: 'NEXT_STEP',
        action: (context) => {
          context.previousState = context.currentState;
          context.currentState = 'sop-cycles';
        }
      },

      // SOP Cycles
      {
        from: 'sop-cycles',
        to: 'setup-complete',
        event: 'NEXT_STEP',
        action: (context) => {
          context.previousState = context.currentState;
          context.currentState = 'setup-complete';
        }
      },

      // Navigation (Previous Step)
      {
        from: 'csv-import',
        to: 'business-configuration',
        event: 'PREVIOUS_STEP',
        action: (context) => {
          context.previousState = context.currentState;
          context.currentState = 'business-configuration';
        }
      },

      {
        from: 'csv-mapping',
        to: 'csv-import',
        event: 'PREVIOUS_STEP',
        action: (context) => {
          context.previousState = context.currentState;
          context.currentState = 'csv-import';
        }
      },

      {
        from: 'divisions',
        to: 'csv-import',
        event: 'PREVIOUS_STEP',
        condition: (context) => context.csvImportData !== null,
        action: (context) => {
          context.previousState = context.currentState;
          context.currentState = 'csv-mapping';
        }
      },

      {
        from: 'divisions',
        to: 'csv-import',
        event: 'PREVIOUS_STEP',
        condition: (context) => context.csvImportData === null,
        action: (context) => {
          context.previousState = context.currentState;
          context.currentState = 'csv-import';
        }
      },

      {
        from: 'clusters',
        to: 'divisions',
        event: 'PREVIOUS_STEP',
        condition: (context) => {
          const config = setupWizardConfigManager.getConfig();
          const importLevel = config.getImportLevel(context.importLevel);
          return importLevel?.requiresDivisionMapping || false;
        },
        action: (context) => {
          context.previousState = context.currentState;
          context.currentState = 'divisions';
        }
      },

      {
        from: 'clusters',
        to: 'csv-import',
        event: 'PREVIOUS_STEP',
        condition: (context) => {
          const config = setupWizardConfigManager.getConfig();
          const importLevel = config.getImportLevel(context.importLevel);
          return !importLevel?.requiresDivisionMapping;
        },
        action: (context) => {
          context.previousState = context.currentState;
          context.currentState = 'csv-import';
        }
      },

      {
        from: 'product-lifecycle',
        to: 'clusters',
        event: 'PREVIOUS_STEP',
        action: (context) => {
          context.previousState = context.currentState;
          context.currentState = 'clusters';
        }
      },

      {
        from: 'sop-cycles',
        to: 'product-lifecycle',
        event: 'PREVIOUS_STEP',
        condition: (context) => context.enableLifecycleTracking,
        action: (context) => {
          context.previousState = context.currentState;
          context.currentState = 'product-lifecycle';
        }
      },

      {
        from: 'sop-cycles',
        to: 'clusters',
        event: 'PREVIOUS_STEP',
        condition: (context) => !context.enableLifecycleTracking,
        action: (context) => {
          context.previousState = context.currentState;
          context.currentState = 'clusters';
        }
      },

      // Error handling
      {
        from: '*',
        to: 'error',
        event: 'ERROR',
        action: (context) => {
          context.previousState = context.currentState;
          context.currentState = 'error';
        }
      },

      // Reset
      {
        from: '*',
        to: 'initializing',
        event: 'RESET',
        action: (context) => {
          this.context = this.createInitialContext();
          context.currentState = 'initializing';
          context.previousState = null;
        }
      }
    ];
  }

  // Public methods
  getCurrentState(): SetupWizardState {
    return this.currentState;
  }

  getPreviousState(): SetupWizardState | null {
    return this.previousState;
  }

  getContext(): SetupWizardContext {
    return { ...this.context };
  }

  updateContext(updates: Partial<SetupWizardContext>): void {
    this.context = { ...this.context, ...updates };
  }

  canTransition(event: SetupWizardEvent): boolean {
    const validTransitions = this.transitions.filter(t => 
      (t.from === this.currentState || t.from === '*') && 
      t.event === event
    );

    return validTransitions.some(t => 
      !t.condition || t.condition(this.context)
    );
  }

  transition(event: SetupWizardEvent): boolean {
    const validTransitions = this.transitions.filter(t => 
      (t.from === this.currentState || t.from === '*') && 
      t.event === event
    );

    const transition = validTransitions.find(t => 
      !t.condition || t.condition(this.context)
    );

    if (transition) {
      this.previousState = this.currentState;
      this.currentState = transition.to;
      
      if (transition.action) {
        transition.action(this.context);
      }

      console.log(`[StateMachine] Transitioned from ${this.previousState} to ${this.currentState} via ${event}`);
      return true;
    }

    console.warn(`[StateMachine] Invalid transition: ${this.currentState} -> ${event}`);
    return false;
  }

  // Business logic methods
  private clearCsvData(context: SetupWizardContext): void {
    context.csvImportData = null;
    context.extractedDivisions = [];
    context.extractedClusters = [];
    context.pendingDivisions = context.pendingDivisions.filter(d => !d.sourceFile);
    context.pendingClusters = context.pendingClusters.filter(c => !c.sourceFile);
    context.lifecycleMappings = [];
    context.multipleCsvImport = {
      isEnabled: false,
      importedCsvs: [],
      remainingDivisions: []
    };
  }

  private processCsvData(context: SetupWizardContext): void {
    if (context.csvImportData) {
      // Process extracted divisions and clusters
      // This would integrate with the existing CSV processing logic
      console.log('[StateMachine] Processing CSV data');
    }
  }

  // Validation helpers
  validateCurrentStep(): boolean {
    const config = setupWizardConfigManager.getConfig();
    
    switch (this.currentState) {
      case 'business-configuration':
        const businessValidation = config.validateBusinessConfiguration({
          hasMultipleDivisions: this.context.hasMultipleDivisions,
          hasMultipleClusters: this.context.hasMultipleClusters,
          importLevel: this.context.importLevel
        });
        return businessValidation.isValid;

      case 'divisions':
        const divisionValidation = config.validateDivisions(this.context.pendingDivisions);
        return divisionValidation.isValid;

      case 'clusters':
        const clusterValidation = config.validateClusters(this.context.pendingClusters, this.context.pendingDivisions);
        return clusterValidation.isValid;

      default:
        return true;
    }
  }

  getValidationErrors(): Record<string, string[]> {
    const config = setupWizardConfigManager.getConfig();
    
    switch (this.currentState) {
      case 'business-configuration':
        const businessValidation = config.validateBusinessConfiguration({
          hasMultipleDivisions: this.context.hasMultipleDivisions,
          hasMultipleClusters: this.context.hasMultipleClusters,
          importLevel: this.context.importLevel
        });
        return { business: businessValidation.errors };

      case 'divisions':
        const divisionValidation = config.validateDivisions(this.context.pendingDivisions);
        return { divisions: divisionValidation.errors };

      case 'clusters':
        const clusterValidation = config.validateClusters(this.context.pendingClusters, this.context.pendingDivisions);
        return { clusters: clusterValidation.errors };

      default:
        return {};
    }
  }

  // Step completion helpers
  isStepComplete(stepId: string): boolean {
    switch (stepId) {
      case 'business-configuration':
        return this.validateCurrentStep();

      case 'csv-import':
        return this.context.csvImportData !== null || 
               this.context.multipleCsvImport.importedCsvs.length > 0;

      case 'csv-mapping':
        return this.context.extractedDivisions.length > 0 || 
               this.context.extractedClusters.length > 0;

      case 'divisions':
        return this.context.pendingDivisions.length > 0;

      case 'clusters':
        return this.context.pendingClusters.length > 0;

      case 'product-lifecycle':
        return this.context.lifecycleMappings.length > 0 || !this.context.enableLifecycleTracking;

      case 'sop-cycles':
        return true; // Always complete as it's optional

      default:
        return false;
    }
  }

  canProceedToNextStep(): boolean {
    return this.validateCurrentStep() && this.canTransition('NEXT_STEP');
  }

  canGoToPreviousStep(): boolean {
    return this.canTransition('PREVIOUS_STEP');
  }
}

// Export singleton instance
export const setupWizardStateMachine = new SetupWizardStateMachine(); 