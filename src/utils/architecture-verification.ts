// Architecture Verification Utility
// This utility helps verify that the refactored architecture is working correctly

import { setupWizardConfigManager } from '../config/SetupWizardConfig';
import { importStrategyManager } from '../strategies/ImportStrategy';
import { commandManager } from '../commands/SetupWizardCommands';

export interface VerificationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  details: {
    configurationManager: boolean;
    strategyManager: boolean;
    commandManager: boolean;
    importStrategies: boolean;
    workflowSteps: boolean;
  };
}

export function verifyRefactoredArchitecture(): VerificationResult {
  const result: VerificationResult = {
    success: true,
    errors: [],
    warnings: [],
    details: {
      configurationManager: false,
      strategyManager: false,
      commandManager: false,
      importStrategies: false,
      workflowSteps: false
    }
  };

  try {
    // Test Configuration Manager
    const config = setupWizardConfigManager.getConfig();
    if (config && config.importLevels && config.workflowSteps) {
      result.details.configurationManager = true;
    } else {
      result.errors.push('Configuration Manager not working properly');
      result.success = false;
    }

    // Test Strategy Manager
    const strategies = importStrategyManager.getAvailableStrategies();
    if (strategies && strategies.length > 0) {
      result.details.strategyManager = true;
      
      // Test specific strategies
      const companyStrategy = strategies.find(s => s.name === 'Company-wide Import');
      const divisionStrategy = strategies.find(s => s.name === 'Division-specific Import');
      
      if (companyStrategy && divisionStrategy) {
        result.details.importStrategies = true;
      } else {
        result.warnings.push('Some import strategies missing');
      }
    } else {
      result.errors.push('Strategy Manager not working properly');
      result.success = false;
    }

    // Test Command Manager
    if (commandManager && typeof commandManager.canUndo === 'function') {
      result.details.commandManager = true;
    } else {
      result.errors.push('Command Manager not working properly');
      result.success = false;
    }

    // Test Workflow Steps
    const visibleSteps = setupWizardConfigManager.getVisibleSteps();
    if (visibleSteps && visibleSteps.length > 0) {
      result.details.workflowSteps = true;
    } else {
      result.errors.push('Workflow steps not configured properly');
      result.success = false;
    }

  } catch (error) {
    result.errors.push(`Verification failed with error: ${error}`);
    result.success = false;
  }

  return result;
}

export function logVerificationResult(result: VerificationResult): void {
  console.log('🔍 [ARCHITECTURE VERIFICATION] Starting verification...');
  
  if (result.success) {
    console.log('✅ [ARCHITECTURE VERIFICATION] All architecture patterns working correctly!');
  } else {
    console.log('❌ [ARCHITECTURE VERIFICATION] Some issues found:');
    result.errors.forEach(error => console.log(`   - Error: ${error}`));
  }

  if (result.warnings.length > 0) {
    console.log('⚠️ [ARCHITECTURE VERIFICATION] Warnings:');
    result.warnings.forEach(warning => console.log(`   - Warning: ${warning}`));
  }

  console.log('📊 [ARCHITECTURE VERIFICATION] Details:');
  console.log(`   - Configuration Manager: ${result.details.configurationManager ? '✅' : '❌'}`);
  console.log(`   - Strategy Manager: ${result.details.strategyManager ? '✅' : '❌'}`);
  console.log(`   - Command Manager: ${result.details.commandManager ? '✅' : '❌'}`);
  console.log(`   - Import Strategies: ${result.details.importStrategies ? '✅' : '❌'}`);
  console.log(`   - Workflow Steps: ${result.details.workflowSteps ? '✅' : '❌'}`);
  
  console.log('🔍 [ARCHITECTURE VERIFICATION] Verification complete!');
} 