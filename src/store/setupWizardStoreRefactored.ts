// Refactored Setup Wizard Store
// Integrates with Configuration Manager, State Machine, Strategy Pattern, and Command Pattern

import { create } from 'zustand';
import { setupWizardStateMachine } from '@/state/SetupWizardStateMachine';
import { setupWizardConfigManager } from '@/config/SetupWizardConfig';
import { importStrategyManager } from '@/strategies/ImportStrategy';
import { commandManager, UpdateBusinessConfigurationCommand, ImportCsvDataCommand, ClearCsvDataCommand, AddDivisionCommand, UpdateDivisionCommand, DeleteDivisionCommand, AddClusterCommand, UpdateClusterCommand, DeleteClusterCommand } from '@/commands/SetupWizardCommands';

// Types
export interface RefactoredSetupWizardState {
  // State Machine Integration
  currentState: string;
  previousState: string | null;
  canProceedToNext: boolean;
  canGoToPrevious: boolean;
  validationErrors: Record<string, string[]>;
  
  // Business Configuration
  businessConfig: {
    hasMultipleDivisions: boolean;
    hasMultipleClusters: boolean;
    importLevel: 'company' | 'division';
    enableLifecycleTracking: boolean;
  };
  
  // CSV Import Data
  csvImportData: any;
  extractedDivisions: any[];
  extractedClusters: any[];
  divisionClusterMap: Record<string, string[]>;
  
  // Pending Items (from CSV)
  pendingDivisions: any[];
  pendingClusters: any[];
  
  // Lifecycle Mappings
  lifecycleMappings: Array<{
    id: string;
    value: string;
    phase: 'launch' | 'growth' | 'end-of-life';
    isCustom?: boolean;
  }>;
  
  // Multiple CSV Import
  multipleCsvImport: {
    isEnabled: boolean;
    importedCsvs: any[];
    remainingDivisions: string[];
  };
  
  // Deleted Items (for restoration)
  deletedItems: {
    divisions: any[];
    clusters: any[];
  };
  
  // UI State
  showInactivePanel: boolean;
  inactivePanelEntityType: 'all' | 'division' | 'cluster';
  
  // Command History
  canUndo: boolean;
  canRedo: boolean;
  undoStackSize: number;
  redoStackSize: number;
}

export interface RefactoredSetupWizardActions {
  // State Machine Actions
  initialize: () => void;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (stepId: string) => void;
  
  // Business Configuration Actions
  updateBusinessConfiguration: (config: Partial<RefactoredSetupWizardState['businessConfig']>) => void;
  
  // CSV Import Actions
  importCsvData: (csvData: any, importLevel: string) => void;
  clearCsvData: () => void;
  processCsvData: (data: any) => void;
  
  // Division Management Actions
  addDivision: (division: any) => void;
  updateDivision: (id: number, updates: any) => void;
  deleteDivision: (id: number) => void;
  restoreDivision: (division: any) => void;
  
  // Cluster Management Actions
  addCluster: (cluster: any) => void;
  updateCluster: (id: number, updates: any) => void;
  deleteCluster: (id: number) => void;
  restoreCluster: (cluster: any) => void;
  
  // Lifecycle Management Actions
  setLifecycleMappings: (mappings: any[]) => void;
  addLifecycleMapping: (mapping: any) => void;
  removeLifecycleMapping: (id: string) => void;
  
  // Multiple CSV Import Actions
  enableMultipleCsvImport: () => void;
  disableMultipleCsvImport: () => void;
  addImportedCsv: (csvData: any) => void;
  removeImportedCsv: (fileName: string) => void;
  
  // UI Actions
  setShowInactivePanel: (show: boolean) => void;
  setInactivePanelEntityType: (type: 'all' | 'division' | 'cluster') => void;
  
  // Command History Actions
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  
  // Utility Actions
  reset: () => void;
  getImportBehavior: () => any;
  validateCurrentStep: () => boolean;
  getStepValidationErrors: () => Record<string, string[]>;
}

export type RefactoredSetupWizardStore = RefactoredSetupWizardState & RefactoredSetupWizardActions;

// Initial state
const initialState: RefactoredSetupWizardState = {
  // State Machine Integration
  currentState: 'initializing',
  previousState: null,
  canProceedToNext: false,
  canGoToPrevious: false,
  validationErrors: {},
  
  // Business Configuration
  businessConfig: {
    hasMultipleDivisions: false,
    hasMultipleClusters: false,
    importLevel: 'company',
    enableLifecycleTracking: false,
  },
  
  // CSV Import Data
  csvImportData: null,
  extractedDivisions: [],
  extractedClusters: [],
  divisionClusterMap: {},
  
  // Pending Items
  pendingDivisions: [],
  pendingClusters: [],
  
  // Lifecycle Mappings
  lifecycleMappings: [],
  
  // Multiple CSV Import
  multipleCsvImport: {
    isEnabled: false,
    importedCsvs: [],
    remainingDivisions: []
  },
  
  // Deleted Items
  deletedItems: {
    divisions: [],
    clusters: []
  },
  
  // UI State
  showInactivePanel: false,
  inactivePanelEntityType: 'all',
  
  // Command History
  canUndo: false,
  canRedo: false,
  undoStackSize: 0,
  redoStackSize: 0,
};

// Helper function to sync state machine with Zustand
const syncStateMachine = (state: RefactoredSetupWizardState) => {
  // Update state machine context
  setupWizardStateMachine.updateContext({
    currentState: state.currentState as any,
    previousState: state.previousState as any,
    importLevel: state.businessConfig.importLevel,
    hasMultipleDivisions: state.businessConfig.hasMultipleDivisions,
    hasMultipleClusters: state.businessConfig.hasMultipleClusters,
    enableLifecycleTracking: state.businessConfig.enableLifecycleTracking,
    csvImportData: state.csvImportData,
    extractedDivisions: state.extractedDivisions,
    extractedClusters: state.extractedClusters,
    pendingDivisions: state.pendingDivisions,
    pendingClusters: state.pendingClusters,
    lifecycleMappings: state.lifecycleMappings,
    multipleCsvImport: state.multipleCsvImport,
  });
};

// Helper function to sync Zustand with state machine
const syncZustandState = (state: RefactoredSetupWizardState) => {
  const context = setupWizardStateMachine.getContext();
  
  return {
    ...state,
    currentState: context.currentState,
    previousState: context.previousState,
    canProceedToNext: setupWizardStateMachine.canProceedToNextStep(),
    canGoToPrevious: setupWizardStateMachine.canGoToPreviousStep(),
    validationErrors: setupWizardStateMachine.getValidationErrors(),
    canUndo: commandManager.canUndo(),
    canRedo: commandManager.canRedo(),
    undoStackSize: commandManager.getUndoStackSize(),
    redoStackSize: commandManager.getRedoStackSize(),
  };
};

export const useSetupWizardStoreRefactored = create<RefactoredSetupWizardStore>((set, get) => ({
  ...initialState,

  // State Machine Actions
  initialize: () => {
    const result = commandManager.executeCommand({
      execute: () => {
        setupWizardStateMachine.transition('INITIALIZE');
        set(syncZustandState);
      },
      undo: () => {
        setupWizardStateMachine.transition('RESET');
        set(syncZustandState);
      },
      canExecute: () => true,
      getDescription: () => 'Initialize Setup Wizard'
    });
    
    if (result.success) {
      console.log('[RefactoredStore] Initialized Setup Wizard');
    }
  },

  nextStep: () => {
    const state = get();
    if (state.canProceedToNext) {
      const result = commandManager.executeCommand({
        execute: () => {
          setupWizardStateMachine.transition('NEXT_STEP');
          set(syncZustandState);
        },
        undo: () => {
          setupWizardStateMachine.transition('PREVIOUS_STEP');
          set(syncZustandState);
        },
        canExecute: () => state.canProceedToNext,
        getDescription: () => 'Next Step'
      });
      
      if (result.success) {
        console.log('[RefactoredStore] Moved to next step');
      }
    }
  },

  previousStep: () => {
    const state = get();
    if (state.canGoToPrevious) {
      const result = commandManager.executeCommand({
        execute: () => {
          setupWizardStateMachine.transition('PREVIOUS_STEP');
          set(syncZustandState);
        },
        undo: () => {
          setupWizardStateMachine.transition('NEXT_STEP');
          set(syncZustandState);
        },
        canExecute: () => state.canGoToPrevious,
        getDescription: () => 'Previous Step'
      });
      
      if (result.success) {
        console.log('[RefactoredStore] Moved to previous step');
      }
    }
  },

  goToStep: (stepId: string) => {
    const state = get();
    const currentStepIndex = setupWizardConfigManager.getConfig().workflowSteps.findIndex(
      step => step.id === state.currentState
    );
    const targetStepIndex = setupWizardConfigManager.getConfig().workflowSteps.findIndex(
      step => step.id === stepId
    );
    
    if (currentStepIndex !== -1 && targetStepIndex !== -1) {
      const direction = targetStepIndex > currentStepIndex ? 'NEXT_STEP' : 'PREVIOUS_STEP';
      const stepsToMove = Math.abs(targetStepIndex - currentStepIndex);
      
      for (let i = 0; i < stepsToMove; i++) {
        setupWizardStateMachine.transition(direction as any);
      }
      
      set(syncZustandState);
      console.log(`[RefactoredStore] Moved to step: ${stepId}`);
    }
  },

  // Business Configuration Actions
  updateBusinessConfiguration: (config) => {
    const state = get();
    const newConfig = { ...state.businessConfig, ...config };
    
    const command = new UpdateBusinessConfigurationCommand(newConfig);
    const result = commandManager.executeCommand(command);
    
    if (result.success) {
      set((state) => {
        const newState = {
          ...state,
          businessConfig: newConfig
        };
        syncStateMachine(newState);
        return syncZustandState(newState);
      });
    } else {
      console.error('[RefactoredStore] Failed to update business configuration:', result.errors);
    }
  },

  // CSV Import Actions
  importCsvData: (csvData, importLevel) => {
    const command = new ImportCsvDataCommand(csvData, importLevel);
    const result = commandManager.executeCommand(command);
    
    if (result.success) {
      set((state) => {
        const newState = {
          ...state,
          csvImportData: csvData
        };
        syncStateMachine(newState);
        return syncZustandState(newState);
      });
    } else {
      console.error('[RefactoredStore] Failed to import CSV data:', result.errors);
    }
  },

  clearCsvData: () => {
    const command = new ClearCsvDataCommand();
    const result = commandManager.executeCommand(command);
    
    if (result.success) {
      set((state) => {
        const newState = {
          ...state,
          csvImportData: null,
          extractedDivisions: [],
          extractedClusters: [],
          pendingDivisions: state.pendingDivisions.filter(d => !d.sourceFile),
          pendingClusters: state.pendingClusters.filter(c => !c.sourceFile),
          lifecycleMappings: [],
          multipleCsvImport: {
            isEnabled: false,
            importedCsvs: [],
            remainingDivisions: []
          }
        };
        syncStateMachine(newState);
        return syncZustandState(newState);
      });
    }
  },

  processCsvData: (data) => {
    set((state) => {
      const newState = {
        ...state,
        extractedDivisions: data.divisions || [],
        extractedClusters: data.clusters || [],
        divisionClusterMap: data.divisionClusterMap || {},
        lifecycleMappings: data.lifecycleMappings || []
      };
      syncStateMachine(newState);
      return syncZustandState(newState);
    });
  },





  // Multiple CSV Import Actions
  enableMultipleCsvImport: () => {
    set((state) => {
      const newState = {
        ...state,
        multipleCsvImport: {
          ...state.multipleCsvImport,
          isEnabled: true
        }
      };
      syncStateMachine(newState);
      return syncZustandState(newState);
    });
  },

  disableMultipleCsvImport: () => {
    set((state) => {
      const newState = {
        ...state,
        multipleCsvImport: {
          ...state.multipleCsvImport,
          isEnabled: false
        }
      };
      syncStateMachine(newState);
      return syncZustandState(newState);
    });
  },

  addImportedCsv: (csvData) => {
    set((state) => {
      const newState = {
        ...state,
        multipleCsvImport: {
          ...state.multipleCsvImport,
          importedCsvs: [...state.multipleCsvImport.importedCsvs, csvData]
        }
      };
      syncStateMachine(newState);
      return syncZustandState(newState);
    });
  },

  removeImportedCsv: (fileName) => {
    set((state) => {
      const newState = {
        ...state,
        multipleCsvImport: {
          ...state.multipleCsvImport,
          importedCsvs: state.multipleCsvImport.importedCsvs.filter(csv => csv.fileName !== fileName)
        }
      };
      syncStateMachine(newState);
      return syncZustandState(newState);
    });
  },

  // Division Management Actions
  addDivision: (division) => {
    const result = commandManager.executeCommand(new AddDivisionCommand(division));
    if (result.success) {
      set(syncZustandState);
    }
  },

  updateDivision: (id, updates) => {
    const result = commandManager.executeCommand(new UpdateDivisionCommand(id, updates));
    if (result.success) {
      set(syncZustandState);
    }
  },

  deleteDivision: (id) => {
    const result = commandManager.executeCommand(new DeleteDivisionCommand(id));
    if (result.success) {
      set(syncZustandState);
    }
  },

  restoreDivision: (division) => {
    set((state) => {
      const newState = {
        ...state,
        pendingDivisions: [...state.pendingDivisions, division],
        deletedItems: {
          ...state.deletedItems,
          divisions: state.deletedItems.divisions.filter(d => d.id !== division.id)
        }
      };
      syncStateMachine(newState);
      return syncZustandState(newState);
    });
  },

  // Cluster Management Actions
  addCluster: (cluster) => {
    const result = commandManager.executeCommand(new AddClusterCommand(cluster));
    if (result.success) {
      set(syncZustandState);
    }
  },

  updateCluster: (id, updates) => {
    const result = commandManager.executeCommand(new UpdateClusterCommand(id, updates));
    if (result.success) {
      set(syncZustandState);
    }
  },

  deleteCluster: (id) => {
    const result = commandManager.executeCommand(new DeleteClusterCommand(id));
    if (result.success) {
      set(syncZustandState);
    }
  },

  restoreCluster: (cluster) => {
    set((state) => {
      const newState = {
        ...state,
        pendingClusters: [...state.pendingClusters, cluster],
        deletedItems: {
          ...state.deletedItems,
          clusters: state.deletedItems.clusters.filter(c => c.id !== cluster.id)
        }
      };
      syncStateMachine(newState);
      return syncZustandState(newState);
    });
  },

  // Lifecycle Management Actions
  setLifecycleMappings: (mappings) => {
    set((state) => {
      const newState = {
        ...state,
        lifecycleMappings: mappings
      };
      syncStateMachine(newState);
      return syncZustandState(newState);
    });
  },

  addLifecycleMapping: (mapping) => {
    set((state) => {
      const newState = {
        ...state,
        lifecycleMappings: [...state.lifecycleMappings, mapping]
      };
      syncStateMachine(newState);
      return syncZustandState(newState);
    });
  },

  removeLifecycleMapping: (id) => {
    set((state) => {
      const newState = {
        ...state,
        lifecycleMappings: state.lifecycleMappings.filter(m => m.id !== id)
      };
      syncStateMachine(newState);
      return syncZustandState(newState);
    });
  },

  // UI Actions
  setShowInactivePanel: (show) => {
    set((state) => ({
      ...state,
      showInactivePanel: show
    }));
  },

  setInactivePanelEntityType: (type) => {
    set((state) => ({
      ...state,
      inactivePanelEntityType: type
    }));
  },

  // Command History Actions
  undo: () => {
    const result = commandManager.undo();
    if (result.success) {
      set(syncZustandState);
    }
  },

  redo: () => {
    const result = commandManager.redo();
    if (result.success) {
      set(syncZustandState);
    }
  },

  clearHistory: () => {
    commandManager.clearHistory();
    set(syncZustandState);
  },

  // Utility Actions
  reset: () => {
    setupWizardStateMachine.transition('RESET');
    commandManager.clearHistory();
    set(initialState);
  },

  getImportBehavior: () => {
    const state = get();
    const importContext = {
      importLevel: state.businessConfig.importLevel,
      hasMultipleDivisions: state.businessConfig.hasMultipleDivisions,
      hasMultipleClusters: state.businessConfig.hasMultipleClusters,
      csvData: state.csvImportData,
      existingData: state.csvImportData
    };
    
    return importStrategyManager.getImportBehavior(importContext);
  },

  validateCurrentStep: () => {
    return setupWizardStateMachine.validateCurrentStep();
  },

  getStepValidationErrors: () => {
    return setupWizardStateMachine.getValidationErrors();
  },
})); 