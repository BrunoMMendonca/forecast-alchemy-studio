# Phase 3: Cleanup Guide

## Overview
This document outlines the cleanup process for removing old, scattered business logic and completing the migration to the new refactored architecture.

## Files to Remove (Old Architecture)

### Old Components (Replace with Refactored Versions)
- `src/components/SetupWizard/steps/BusinessConfigurationStep.tsx` → Use `BusinessConfigurationStepRefactored.tsx`
- `src/components/SetupWizard/steps/CsvImportStep.tsx` → Use `CsvImportStepRefactored.tsx`
- `src/components/SetupWizard/steps/DivisionsStep.tsx` → Use `DivisionsStepRefactored.tsx`
- `src/components/SetupWizard/steps/ClustersStep.tsx` → Use `ClustersStepRefactored.tsx`
- `src/components/SetupWizard/steps/ProductLifecycleStep.tsx` → Use `ProductLifecycleStepRefactored.tsx`

### Old Store (Replace with Refactored Store)
- `src/store/setupWizardStore.ts` → Use `setupWizardStoreRefactored.ts`

### Old Setup Wizard (Replace with Refactored Version)
- `src/components/SetupWizard/SetupWizard.tsx` → Use `SetupWizardRefactored.tsx`

## Files to Keep (New Architecture)

### Core Architecture Files
- `src/config/SetupWizardConfig.ts` - Configuration Manager
- `src/state/SetupWizardStateMachine.ts` - State Machine
- `src/strategies/ImportStrategy.ts` - Strategy Pattern
- `src/commands/SetupWizardCommands.ts` - Command Pattern
- `src/store/setupWizardStoreRefactored.ts` - Refactored Store

### Refactored Components
- `src/components/SetupWizard/steps/BusinessConfigurationStepRefactored.tsx`
- `src/components/SetupWizard/steps/CsvImportStepRefactored.tsx`
- `src/components/SetupWizard/steps/DivisionsStepRefactored.tsx`
- `src/components/SetupWizard/steps/ClustersStepRefactored.tsx`
- `src/components/SetupWizard/steps/ProductLifecycleStepRefactored.tsx`
- `src/components/SetupWizard/SetupWizardRefactored.tsx`

### Test and Documentation
- `src/pages/SetupWizardTestPage.tsx` - Test page
- `REFACTORING-ARCHITECTURE.md` - Architecture documentation

## Cleanup Steps

### Step 1: Update Imports
- Update all imports to use refactored components
- Update store imports to use refactored store
- Remove old component imports

### Step 2: Remove Old Files
- Delete old component files
- Delete old store file
- Clean up any remaining references

### Step 3: Update Routing
- Update App.tsx to use refactored SetupWizard
- Remove old component references

### Step 4: Add Tests
- Add unit tests for each architecture pattern
- Add integration tests for complete workflow
- Add performance tests

### Step 5: Optimize Performance
- Optimize state machine transitions
- Optimize command pattern execution
- Profile and improve overall performance

### Step 6: Update Documentation
- Update component documentation
- Create maintenance guides
- Update README files

## Benefits After Cleanup

1. **Cleaner Codebase**: Remove old, complex code
2. **Better Performance**: Optimized architecture
3. **Easier Maintenance**: Well-tested, documented code
4. **Future-Proof**: Professional architecture for growth
5. **Reduced Complexity**: Single source of truth for business logic
6. **Better Testing**: Comprehensive test coverage
7. **Professional Standards**: Enterprise-grade patterns

## Risk Mitigation

1. **Backup**: Keep old files in git history
2. **Testing**: Comprehensive testing before removal
3. **Gradual Removal**: Remove files one by one
4. **Validation**: Verify functionality after each removal
5. **Rollback Plan**: Ability to revert if issues arise

## Success Criteria

- [ ] All old components removed
- [ ] All old store code removed
- [ ] All imports updated to use refactored components
- [ ] All functionality working with new architecture
- [ ] Comprehensive tests added
- [ ] Performance optimized
- [ ] Documentation updated
- [ ] No breaking changes
- [ ] Clean, maintainable codebase 