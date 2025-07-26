// Strategy Pattern for Import Behaviors
// Encapsulates different import behaviors and business logic

import { setupWizardConfigManager } from '@/config/SetupWizardConfig';

export interface ImportContext {
  importLevel: string;
  hasMultipleDivisions: boolean;
  hasMultipleClusters: boolean;
  csvData: any;
  existingData: any;
}

export interface ImportResult {
  success: boolean;
  data: any;
  errors: string[];
  warnings: string[];
  shouldShowReplacementDialog: boolean;
  shouldClearExistingData: boolean;
}

export interface ImportStrategy {
  name: string;
  description: string;
  
  // Core import logic
  canHandle(context: ImportContext): boolean;
  validate(context: ImportContext): ImportResult;
  process(context: ImportContext): ImportResult;
  
  // Business logic
  shouldShowReplacementDialog(context: ImportContext): boolean;
  shouldClearExistingData(context: ImportContext): boolean;
  getDataClearingPolicy(): string[];
  
  // UI behavior
  getSkipButtonText(): string;
  getSkipButtonDescription(): string;
  isSkipButtonDisabled(context: ImportContext): boolean;
  getDropzoneText(): string;
  isDropzoneDisabled(context: ImportContext): boolean;
}

// Company-wide import strategy
export class CompanyWideImportStrategy implements ImportStrategy {
  name = 'Company-wide Import';
  description = 'Single CSV file for entire company';

  canHandle(context: ImportContext): boolean {
    return context.importLevel === 'company';
  }

  validate(context: ImportContext): ImportResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!context.csvData) {
      errors.push('No CSV data provided');
    }

    if (context.csvData && !context.csvData.columns) {
      errors.push('CSV data is missing column information');
    }

    if (context.csvData && context.csvData.columns && context.csvData.columns.length === 0) {
      errors.push('CSV file contains no columns');
    }

    return {
      success: errors.length === 0,
      data: context.csvData,
      errors,
      warnings,
      shouldShowReplacementDialog: this.shouldShowReplacementDialog(context),
      shouldClearExistingData: this.shouldClearExistingData(context)
    };
  }

  process(context: ImportContext): ImportResult {
    const validation = this.validate(context);
    
    if (!validation.success) {
      return validation;
    }

    // Process company-wide data
    const processedData = {
      ...context.csvData,
      importLevel: 'company',
      processedAt: new Date().toISOString()
    };

    return {
      success: true,
      data: processedData,
      errors: [],
      warnings: [],
      shouldShowReplacementDialog: this.shouldShowReplacementDialog(context),
      shouldClearExistingData: this.shouldClearExistingData(context)
    };
  }

  shouldShowReplacementDialog(context: ImportContext): boolean {
    return setupWizardConfigManager.shouldShowCsvReplacementDialog(
      !!context.existingData,
      context.importLevel
    );
  }

  shouldClearExistingData(context: ImportContext): boolean {
    return setupWizardConfigManager.shouldClearAllData(
      context.importLevel,
      false // company-wide doesn't support multiple CSV
    );
  }

  getDataClearingPolicy(): string[] {
    return [
      'CSV files and mappings',
      'Extracted divisions and clusters',
      'Lifecycle phase mappings',
      'Multiple CSV import progress'
    ];
  }

  getSkipButtonText(): string {
    return 'Skip CSV Import';
  }

  getSkipButtonDescription(): string {
    return 'You can import CSV data later in the forecast workflow';
  }

  isSkipButtonDisabled(context: ImportContext): boolean {
    return !!context.existingData;
  }

  getDropzoneText(): string {
    return 'Drop your CSV file here or click to browse';
  }

  isDropzoneDisabled(context: ImportContext): boolean {
    return !!context.existingData;
  }
}

// Division-specific import strategy
export class DivisionSpecificImportStrategy implements ImportStrategy {
  name = 'Division-specific Import';
  description = 'Multiple CSV files, one per division';

  canHandle(context: ImportContext): boolean {
    return context.importLevel === 'division';
  }

  validate(context: ImportContext): ImportResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!context.csvData && !context.existingData) {
      errors.push('No CSV data provided');
    }

    if (context.csvData && !context.csvData.divisionName) {
      errors.push('Division name is required for division-specific imports');
    }

    if (context.csvData && context.csvData.divisionName) {
      // Check if division already has data
      const existingDivisionData = context.existingData?.divisions?.find(
        (d: any) => d.name === context.csvData.divisionName
      );
      
      if (existingDivisionData) {
        warnings.push(`Division "${context.csvData.divisionName}" already has imported data`);
      }
    }

    return {
      success: errors.length === 0,
      data: context.csvData,
      errors,
      warnings,
      shouldShowReplacementDialog: this.shouldShowReplacementDialog(context),
      shouldClearExistingData: this.shouldClearExistingData(context)
    };
  }

  process(context: ImportContext): ImportResult {
    const validation = this.validate(context);
    
    if (!validation.success) {
      return validation;
    }

    // Process division-specific data
    const processedData = {
      ...context.csvData,
      importLevel: 'division',
      divisionName: context.csvData.divisionName,
      processedAt: new Date().toISOString()
    };

    return {
      success: true,
      data: processedData,
      errors: [],
      warnings: validation.warnings,
      shouldShowReplacementDialog: this.shouldShowReplacementDialog(context),
      shouldClearExistingData: this.shouldClearExistingData(context)
    };
  }

  shouldShowReplacementDialog(context: ImportContext): boolean {
    return setupWizardConfigManager.shouldShowCsvReplacementDialog(
      !!context.existingData,
      context.importLevel
    );
  }

  shouldClearExistingData(context: ImportContext): boolean {
    return setupWizardConfigManager.shouldClearAllData(
      context.importLevel,
      true // division-specific supports multiple CSV
    );
  }

  getDataClearingPolicy(): string[] {
    return [
      'CSV files and mappings',
      'Extracted divisions and clusters',
      'Lifecycle phase mappings',
      'Multiple CSV import progress'
    ];
  }

  getSkipButtonText(): string {
    return 'Skip CSV Import';
  }

  getSkipButtonDescription(): string {
    return 'You can import CSV data later in the forecast workflow';
  }

  isSkipButtonDisabled(context: ImportContext): boolean {
    return false; // Division-specific allows skipping
  }

  getDropzoneText(): string {
    return 'Drop your division CSV file here or click to browse';
  }

  isDropzoneDisabled(context: ImportContext): boolean {
    return false; // Division-specific allows multiple files
  }
}

// Strategy factory
export class ImportStrategyFactory {
  private strategies: ImportStrategy[] = [
    new CompanyWideImportStrategy(),
    new DivisionSpecificImportStrategy()
  ];

  getStrategy(context: ImportContext): ImportStrategy | null {
    return this.strategies.find(strategy => strategy.canHandle(context)) || null;
  }

  getAllStrategies(): ImportStrategy[] {
    return [...this.strategies];
  }

  getStrategyByName(name: string): ImportStrategy | null {
    return this.strategies.find(strategy => strategy.name === name) || null;
  }
}

// Strategy manager for coordinating import operations
export class ImportStrategyManager {
  private factory: ImportStrategyFactory;

  constructor() {
    this.factory = new ImportStrategyFactory();
  }

  processImport(context: ImportContext): ImportResult {
    const strategy = this.factory.getStrategy(context);
    
    if (!strategy) {
      return {
        success: false,
        data: null,
        errors: [`No strategy found for import level: ${context.importLevel}`],
        warnings: [],
        shouldShowReplacementDialog: false,
        shouldClearExistingData: false
      };
    }

    console.log(`[ImportStrategyManager] Using strategy: ${strategy.name}`);
    return strategy.process(context);
  }

  validateImport(context: ImportContext): ImportResult {
    const strategy = this.factory.getStrategy(context);
    
    if (!strategy) {
      return {
        success: false,
        data: null,
        errors: [`No strategy found for import level: ${context.importLevel}`],
        warnings: [],
        shouldShowReplacementDialog: false,
        shouldClearExistingData: false
      };
    }

    return strategy.validate(context);
  }

  getImportBehavior(context: ImportContext): {
    shouldShowReplacementDialog: boolean;
    shouldClearExistingData: boolean;
    skipButtonText: string;
    skipButtonDescription: string;
    isSkipButtonDisabled: boolean;
    dropzoneText: string;
    isDropzoneDisabled: boolean;
    dataClearingPolicy: string[];
  } {
    const strategy = this.factory.getStrategy(context);
    
    if (!strategy) {
      return {
        shouldShowReplacementDialog: false,
        shouldClearExistingData: false,
        skipButtonText: 'Skip CSV Import',
        skipButtonDescription: 'You can import CSV data later',
        isSkipButtonDisabled: false,
        dropzoneText: 'Drop your CSV file here',
        isDropzoneDisabled: false,
        dataClearingPolicy: []
      };
    }

    return {
      shouldShowReplacementDialog: strategy.shouldShowReplacementDialog(context),
      shouldClearExistingData: strategy.shouldClearExistingData(context),
      skipButtonText: strategy.getSkipButtonText(),
      skipButtonDescription: strategy.getSkipButtonDescription(),
      isSkipButtonDisabled: strategy.isSkipButtonDisabled(context),
      dropzoneText: strategy.getDropzoneText(),
      isDropzoneDisabled: strategy.isDropzoneDisabled(context),
      dataClearingPolicy: strategy.getDataClearingPolicy()
    };
  }

  getAvailableStrategies(): ImportStrategy[] {
    return this.factory.getAllStrategies();
  }
}

// Export singleton instance
export const importStrategyManager = new ImportStrategyManager(); 