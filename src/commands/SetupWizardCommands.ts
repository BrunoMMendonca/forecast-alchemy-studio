// Command Pattern for Setup Wizard State Changes
// Enables undo/redo and provides a clean interface for state modifications

import { setupWizardStateMachine } from '@/state/SetupWizardStateMachine';
import { setupWizardConfigManager } from '@/config/SetupWizardConfig';
import { importStrategyManager } from '@/strategies/ImportStrategy';

export interface Command {
  execute(): void;
  undo(): void;
  canExecute(): boolean;
  getDescription(): string;
}

export interface CommandResult {
  success: boolean;
  message: string;
  errors?: string[];
}

// Base command class
export abstract class BaseCommand implements Command {
  protected stateMachine = setupWizardStateMachine;
  protected configManager = setupWizardConfigManager;
  protected strategyManager = importStrategyManager;

  abstract execute(): void;
  abstract undo(): void;
  abstract canExecute(): boolean;
  abstract getDescription(): string;

  protected log(message: string): void {
    console.log(`[Command: ${this.constructor.name}] ${message}`);
  }
}

// Business Configuration Commands
export class UpdateBusinessConfigurationCommand extends BaseCommand {
  private previousConfig: any;
  private newConfig: any;

  constructor(newConfig: any) {
    super();
    this.newConfig = newConfig;
  }

  execute(): void {
    const context = this.stateMachine.getContext();
    this.previousConfig = {
      hasMultipleDivisions: context.hasMultipleDivisions,
      hasMultipleClusters: context.hasMultipleClusters,
      importLevel: context.importLevel,
      enableLifecycleTracking: context.enableLifecycleTracking
    };

    // Update context
    this.stateMachine.updateContext({
      hasMultipleDivisions: this.newConfig.hasMultipleDivisions,
      hasMultipleClusters: this.newConfig.hasMultipleClusters,
      importLevel: this.newConfig.importLevel,
      enableLifecycleTracking: this.newConfig.enableLifecycleTracking
    });

    this.log(`Updated business configuration: ${JSON.stringify(this.newConfig)}`);
  }

  undo(): void {
    if (this.previousConfig) {
      this.stateMachine.updateContext(this.previousConfig);
      this.log(`Reverted business configuration to: ${JSON.stringify(this.previousConfig)}`);
    }
  }

  canExecute(): boolean {
    const validation = this.configManager.validateBusinessConfiguration(this.newConfig);
    return validation.isValid;
  }

  getDescription(): string {
    return `Update business configuration: ${JSON.stringify(this.newConfig)}`;
  }
}

// CSV Import Commands
export class ImportCsvDataCommand extends BaseCommand {
  private previousCsvData: any;
  private csvData: any;
  private importLevel: string;

  constructor(csvData: any, importLevel: string) {
    super();
    this.csvData = csvData;
    this.importLevel = importLevel;
  }

  execute(): void {
    const context = this.stateMachine.getContext();
    this.previousCsvData = context.csvImportData;

    // Use strategy manager to process import
    const importContext = {
      importLevel: this.importLevel,
      hasMultipleDivisions: context.hasMultipleDivisions,
      hasMultipleClusters: context.hasMultipleClusters,
      csvData: this.csvData,
      existingData: context.csvImportData
    };

    const result = this.strategyManager.processImport(importContext);

    if (result.success) {
      this.stateMachine.updateContext({
        csvImportData: result.data
      });

      // Trigger state transition
      this.stateMachine.transition('CSV_IMPORTED');

      this.log(`Imported CSV data: ${result.data?.fileName || 'Unknown file'}`);
    } else {
      throw new Error(`CSV import failed: ${result.errors.join(', ')}`);
    }
  }

  undo(): void {
    if (this.previousCsvData !== undefined) {
      this.stateMachine.updateContext({
        csvImportData: this.previousCsvData
      });
      this.log(`Reverted CSV import`);
    }
  }

  canExecute(): boolean {
    const importContext = {
      importLevel: this.importLevel,
      hasMultipleDivisions: false,
      hasMultipleClusters: false,
      csvData: this.csvData,
      existingData: null
    };

    const validation = this.strategyManager.validateImport(importContext);
    return validation.success;
  }

  getDescription(): string {
    return `Import CSV data: ${this.csvData?.fileName || 'Unknown file'}`;
  }
}

// Data Clearing Commands
export class ClearCsvDataCommand extends BaseCommand {
  private previousData: any;

  constructor() {
    super();
  }

  execute(): void {
    const context = this.stateMachine.getContext();
    
    // Store previous state
    this.previousData = {
      csvImportData: context.csvImportData,
      extractedDivisions: context.extractedDivisions,
      extractedClusters: context.extractedClusters,
      pendingDivisions: context.pendingDivisions,
      pendingClusters: context.pendingClusters,
      lifecycleMappings: context.lifecycleMappings,
      multipleCsvImport: context.multipleCsvImport
    };

    // Clear CSV-related data
    this.stateMachine.updateContext({
      csvImportData: null,
      extractedDivisions: [],
      extractedClusters: [],
      pendingDivisions: context.pendingDivisions.filter(d => !d.sourceFile),
      pendingClusters: context.pendingClusters.filter(c => !c.sourceFile),
      lifecycleMappings: [],
      multipleCsvImport: {
        isEnabled: false,
        importedCsvs: [],
        remainingDivisions: []
      }
    });

    this.log('Cleared all CSV import data');
  }

  undo(): void {
    if (this.previousData) {
      this.stateMachine.updateContext(this.previousData);
      this.log('Restored CSV import data');
    }
  }

  canExecute(): boolean {
    const context = this.stateMachine.getContext();
    return !!(context.csvImportData || 
              context.extractedDivisions.length > 0 || 
              context.extractedClusters.length > 0 ||
              context.lifecycleMappings.length > 0 ||
              context.multipleCsvImport.importedCsvs.length > 0);
  }

  getDescription(): string {
    return 'Clear all CSV import data';
  }
}

// Division Management Commands
export class AddDivisionCommand extends BaseCommand {
  private division: any;
  private previousDivisions: any[];

  constructor(division: any) {
    super();
    this.division = division;
  }

  execute(): void {
    const context = this.stateMachine.getContext();
    this.previousDivisions = [...context.pendingDivisions];

    const newDivisions = [...context.pendingDivisions, this.division];
    this.stateMachine.updateContext({
      pendingDivisions: newDivisions
    });

    this.log(`Added division: ${this.division.name}`);
  }

  undo(): void {
    if (this.previousDivisions) {
      this.stateMachine.updateContext({
        pendingDivisions: this.previousDivisions
      });
      this.log(`Removed division: ${this.division.name}`);
    }
  }

  canExecute(): boolean {
    const context = this.stateMachine.getContext();
    const validation = this.configManager.validateDivisions([...context.pendingDivisions, this.division]);
    return validation.isValid;
  }

  getDescription(): string {
    return `Add division: ${this.division.name}`;
  }
}

export class UpdateDivisionCommand extends BaseCommand {
  private divisionId: number;
  private previousDivision: any;
  private updatedDivision: any;

  constructor(divisionId: number, updatedDivision: any) {
    super();
    this.divisionId = divisionId;
    this.updatedDivision = updatedDivision;
  }

  execute(): void {
    const context = this.stateMachine.getContext();
    const divisionIndex = context.pendingDivisions.findIndex(d => d.id === this.divisionId);
    
    if (divisionIndex === -1) {
      throw new Error(`Division with ID ${this.divisionId} not found`);
    }

    this.previousDivision = { ...context.pendingDivisions[divisionIndex] };

    const newDivisions = [...context.pendingDivisions];
    newDivisions[divisionIndex] = { ...newDivisions[divisionIndex], ...this.updatedDivision };

    this.stateMachine.updateContext({
      pendingDivisions: newDivisions
    });

    this.log(`Updated division: ${this.updatedDivision.name}`);
  }

  undo(): void {
    if (this.previousDivision) {
      const context = this.stateMachine.getContext();
      const divisionIndex = context.pendingDivisions.findIndex(d => d.id === this.divisionId);
      
      if (divisionIndex !== -1) {
        const newDivisions = [...context.pendingDivisions];
        newDivisions[divisionIndex] = this.previousDivision;
        
        this.stateMachine.updateContext({
          pendingDivisions: newDivisions
        });
        
        this.log(`Reverted division update: ${this.previousDivision.name}`);
      }
    }
  }

  canExecute(): boolean {
    const context = this.stateMachine.getContext();
    const divisionIndex = context.pendingDivisions.findIndex(d => d.id === this.divisionId);
    return divisionIndex !== -1;
  }

  getDescription(): string {
    return `Update division: ${this.updatedDivision.name}`;
  }
}

export class DeleteDivisionCommand extends BaseCommand {
  private divisionId: number;
  private deletedDivision: any;
  private deletedClusters: any[];

  constructor(divisionId: number) {
    super();
    this.divisionId = divisionId;
  }

  execute(): void {
    const context = this.stateMachine.getContext();
    const divisionIndex = context.pendingDivisions.findIndex(d => d.id === this.divisionId);
    
    if (divisionIndex === -1) {
      throw new Error(`Division with ID ${this.divisionId} not found`);
    }

    this.deletedDivision = { ...context.pendingDivisions[divisionIndex] };
    this.deletedClusters = context.pendingClusters.filter(c => c.divisionId === this.divisionId);

    // Remove division and its clusters
    const newDivisions = context.pendingDivisions.filter(d => d.id !== this.divisionId);
    const newClusters = context.pendingClusters.filter(c => c.divisionId !== this.divisionId);

    this.stateMachine.updateContext({
      pendingDivisions: newDivisions,
      pendingClusters: newClusters
    });

    this.log(`Deleted division: ${this.deletedDivision.name} and ${this.deletedClusters.length} clusters`);
  }

  undo(): void {
    if (this.deletedDivision) {
      const context = this.stateMachine.getContext();
      
      const newDivisions = [...context.pendingDivisions, this.deletedDivision];
      const newClusters = [...context.pendingClusters, ...this.deletedClusters];

      this.stateMachine.updateContext({
        pendingDivisions: newDivisions,
        pendingClusters: newClusters
      });

      this.log(`Restored division: ${this.deletedDivision.name}`);
    }
  }

  canExecute(): boolean {
    const context = this.stateMachine.getContext();
    return context.pendingDivisions.some(d => d.id === this.divisionId);
  }

  getDescription(): string {
    return `Delete division: ${this.divisionId}`;
  }
}

// Cluster Management Commands
export class AddClusterCommand extends BaseCommand {
  private cluster: any;
  private previousClusters: any[];

  constructor(cluster: any) {
    super();
    this.cluster = cluster;
  }

  execute(): void {
    const context = this.stateMachine.getContext();
    this.previousClusters = [...context.pendingClusters];

    const newClusters = [...context.pendingClusters, this.cluster];
    this.stateMachine.updateContext({
      pendingClusters: newClusters
    });

    this.log(`Added cluster: ${this.cluster.name} to division: ${this.cluster.divisionName}`);
  }

  undo(): void {
    if (this.previousClusters) {
      this.stateMachine.updateContext({
        pendingClusters: this.previousClusters
      });
      this.log(`Removed cluster: ${this.cluster.name}`);
    }
  }

  canExecute(): boolean {
    const context = this.stateMachine.getContext();
    const validation = this.configManager.validateClusters([...context.pendingClusters, this.cluster], context.pendingDivisions);
    return validation.isValid;
  }

  getDescription(): string {
    return `Add cluster: ${this.cluster.name} to ${this.cluster.divisionName}`;
  }
}

export class UpdateClusterCommand extends BaseCommand {
  private clusterId: number;
  private previousCluster: any;
  private updatedCluster: any;

  constructor(clusterId: number, updatedCluster: any) {
    super();
    this.clusterId = clusterId;
    this.updatedCluster = updatedCluster;
  }

  execute(): void {
    const context = this.stateMachine.getContext();
    const clusterIndex = context.pendingClusters.findIndex(c => c.id === this.clusterId);
    
    if (clusterIndex === -1) {
      throw new Error(`Cluster with ID ${this.clusterId} not found`);
    }

    this.previousCluster = { ...context.pendingClusters[clusterIndex] };

    const newClusters = [...context.pendingClusters];
    newClusters[clusterIndex] = { ...newClusters[clusterIndex], ...this.updatedCluster };

    this.stateMachine.updateContext({
      pendingClusters: newClusters
    });

    this.log(`Updated cluster: ${this.updatedCluster.name}`);
  }

  undo(): void {
    if (this.previousCluster) {
      const context = this.stateMachine.getContext();
      const clusterIndex = context.pendingClusters.findIndex(c => c.id === this.clusterId);
      
      if (clusterIndex !== -1) {
        const newClusters = [...context.pendingClusters];
        newClusters[clusterIndex] = this.previousCluster;
        
        this.stateMachine.updateContext({
          pendingClusters: newClusters
        });
        
        this.log(`Reverted cluster update: ${this.previousCluster.name}`);
      }
    }
  }

  canExecute(): boolean {
    const context = this.stateMachine.getContext();
    return context.pendingClusters.some(c => c.id === this.clusterId);
  }

  getDescription(): string {
    return `Update cluster: ${this.updatedCluster.name}`;
  }
}

export class DeleteClusterCommand extends BaseCommand {
  private clusterId: number;
  private deletedCluster: any;

  constructor(clusterId: number) {
    super();
    this.clusterId = clusterId;
  }

  execute(): void {
    const context = this.stateMachine.getContext();
    const clusterIndex = context.pendingClusters.findIndex(c => c.id === this.clusterId);
    
    if (clusterIndex === -1) {
      throw new Error(`Cluster with ID ${this.clusterId} not found`);
    }

    this.deletedCluster = { ...context.pendingClusters[clusterIndex] };

    const newClusters = context.pendingClusters.filter(c => c.id !== this.clusterId);

    this.stateMachine.updateContext({
      pendingClusters: newClusters
    });

    this.log(`Deleted cluster: ${this.deletedCluster.name}`);
  }

  undo(): void {
    if (this.deletedCluster) {
      const context = this.stateMachine.getContext();
      
      const newClusters = [...context.pendingClusters, this.deletedCluster];

      this.stateMachine.updateContext({
        pendingClusters: newClusters
      });

      this.log(`Restored cluster: ${this.deletedCluster.name}`);
    }
  }

  canExecute(): boolean {
    const context = this.stateMachine.getContext();
    return context.pendingClusters.some(c => c.id === this.clusterId);
  }

  getDescription(): string {
    return `Delete cluster: ${this.clusterId}`;
  }
}

// Command Manager for coordinating commands
export class CommandManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxStackSize = 50;

  executeCommand(command: Command): CommandResult {
    try {
      if (!command.canExecute()) {
        return {
          success: false,
          message: 'Command cannot be executed',
          errors: ['Command validation failed']
        };
      }

      command.execute();
      
      // Add to undo stack
      this.undoStack.push(command);
      if (this.undoStack.length > this.maxStackSize) {
        this.undoStack.shift();
      }

      // Clear redo stack when new command is executed
      this.redoStack = [];

      return {
        success: true,
        message: `Executed: ${command.getDescription()}`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Command execution failed',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  undo(): CommandResult {
    if (this.undoStack.length === 0) {
      return {
        success: false,
        message: 'Nothing to undo'
      };
    }

    try {
      const command = this.undoStack.pop()!;
      command.undo();
      
      // Add to redo stack
      this.redoStack.push(command);
      if (this.redoStack.length > this.maxStackSize) {
        this.redoStack.shift();
      }

      return {
        success: true,
        message: `Undid: ${command.getDescription()}`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Undo failed',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  redo(): CommandResult {
    if (this.redoStack.length === 0) {
      return {
        success: false,
        message: 'Nothing to redo'
      };
    }

    try {
      const command = this.redoStack.pop()!;
      command.execute();
      
      // Add back to undo stack
      this.undoStack.push(command);
      if (this.undoStack.length > this.maxStackSize) {
        this.undoStack.shift();
      }

      return {
        success: true,
        message: `Redid: ${command.getDescription()}`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Redo failed',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clearHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  getUndoStackSize(): number {
    return this.undoStack.length;
  }

  getRedoStackSize(): number {
    return this.redoStack.length;
  }
}

// Export singleton instance
export const commandManager = new CommandManager(); 