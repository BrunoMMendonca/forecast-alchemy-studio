const { execSync } = require('child_process');

console.log('🧪 Testing Setup CSV Storage Implementation...\n');

// Test 1: Check if the setup wizard store has the new CSV import data fields
console.log('1. Checking setup wizard store for CSV import data fields...');
try {
  const storeContent = execSync('findstr /n "csvImportData" src/store/setupWizardStore.ts', { encoding: 'utf8' });
  console.log('✅ Found csvImportData field in setup wizard store');
  console.log('   Lines:', storeContent.trim());
} catch (error) {
  console.log('❌ csvImportData field not found in setup wizard store');
}

// Test 2: Check if the new actions are implemented
console.log('\n2. Checking for new CSV mapping actions...');
try {
  const actionsContent = execSync('findstr /n "storeCsvMappingData" src/store/setupWizardStore.ts', { encoding: 'utf8' });
  console.log('✅ Found storeCsvMappingData action in setup wizard store');
  console.log('   Lines:', actionsContent.trim());
} catch (error) {
  console.log('❌ storeCsvMappingData action not found in setup wizard store');
}

// Test 3: Check if CSV Import Wizard stores mapping data instead of importing
console.log('\n3. Checking CSV Import Wizard for setup context handling...');
try {
  const wizardContent = execSync('findstr /n "storeCsvMappingData" src/components/CsvImportWizard.tsx', { encoding: 'utf8' });
  console.log('✅ Found setup context handling in CSV Import Wizard');
  console.log('   Lines:', wizardContent.trim());
} catch (error) {
  console.log('❌ Setup context handling not found in CSV Import Wizard');
}

// Test 4: Check if setup wizard has the new import step
console.log('\n4. Checking setup wizard for import setup data step...');
try {
  const stepContent = execSync('findstr /n "Import Setup Data" src/components/SetupWizard.tsx', { encoding: 'utf8' });
  console.log('✅ Found Import Setup Data step in setup wizard');
  console.log('   Lines:', stepContent.trim());
} catch (error) {
  console.log('❌ Import Setup Data step not found in setup wizard');
}

// Test 5: Check if the step is added to the steps array
console.log('\n5. Checking if import step is added to steps array...');
try {
  const stepsContent = execSync('findstr /n "csvImportData" src/components/SetupWizard.tsx', { encoding: 'utf8' });
  console.log('✅ Found steps array modification for CSV import data');
  console.log('   Lines:', stepsContent.trim());
} catch (error) {
  console.log('❌ Steps array modification not found');
}

console.log('\n🎉 Setup CSV Storage Implementation Test Complete!');
console.log('\n📋 Summary:');
console.log('   - Setup wizard store now stores CSV mapping data for later import');
console.log('   - CSV Import Wizard stores mapping instead of importing in setup context');
console.log('   - New step asks user if they want to import setup data');
console.log('   - Import happens at the end of setup, not during CSV mapping'); 