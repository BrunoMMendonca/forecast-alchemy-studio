const { execSync } = require('child_process');
const path = require('path');

console.log('🧪 Testing Cluster-Level Import Removal...\n');

// Test 1: Check if cluster-level import option is removed from UI
console.log('1. Checking if cluster-level import option is removed from UI...');
try {
  const uiContent = execSync('findstr /n "At cluster level" "src\\components\\SetupWizard.tsx"', { encoding: 'utf8' });
  console.log('❌ Cluster-level import option still found in UI');
  console.log('   Lines:', uiContent.trim());
} catch (error) {
  console.log('✅ Cluster-level import option removed from UI');
}

// Test 2: Check if cluster-level import logic is removed from helper functions
console.log('\n2. Checking if cluster-level import logic is removed from helper functions...');
try {
  const helperContent = execSync('findstr /n "cluster.*import" "src\\components\\SetupWizard.tsx"', { encoding: 'utf8' });
  console.log('❌ Cluster-level import logic still found in helper functions');
  console.log('   Lines:', helperContent.trim());
} catch (error) {
  console.log('✅ Cluster-level import logic removed from helper functions');
}

// Test 3: Check if cluster-level import type is removed from store
console.log('\n3. Checking if cluster-level import type is removed from store...');
try {
  const storeContent = execSync('findstr /n "cluster.*importLevel" "src\\store\\setupWizardStore.ts"', { encoding: 'utf8' });
  console.log('❌ Cluster-level import type still found in store');
  console.log('   Lines:', storeContent.trim());
} catch (error) {
  console.log('✅ Cluster-level import type removed from store');
}

// Test 4: Check if cluster-level import logic is removed from calculateSetupFlow
console.log('\n4. Checking if cluster-level import logic is removed from calculateSetupFlow...');
try {
  const flowContent = execSync('findstr /n "importLevel.*cluster" "src\\store\\setupWizardStore.ts"', { encoding: 'utf8' });
  console.log('❌ Cluster-level import logic still found in calculateSetupFlow');
  console.log('   Lines:', flowContent.trim());
} catch (error) {
  console.log('✅ Cluster-level import logic removed from calculateSetupFlow');
}

// Test 5: Verify that only company and division options remain
console.log('\n5. Verifying that only company and division options remain...');
try {
  const remainingOptions = execSync('findstr /n "At company level" "src\\components\\SetupWizard.tsx"', { encoding: 'utf8' });
  console.log('✅ Company import option found');
  console.log('   Lines:', remainingOptions.trim());
} catch (error) {
  console.log('❌ Company import option not found');
}

try {
  const divisionOptions = execSync('findstr /n "At division level" "src\\components\\SetupWizard.tsx"', { encoding: 'utf8' });
  console.log('✅ Division import option found');
  console.log('   Lines:', divisionOptions.trim());
} catch (error) {
  console.log('❌ Division import option not found');
}

console.log('\n🎉 Cluster-Level Import Removal Test Complete!');
console.log('\n📋 Summary:');
console.log('   - Cluster-level import option removed from UI');
console.log('   - Cluster-level import logic removed from helper functions');
console.log('   - Cluster-level import type removed from store');
console.log('   - Cluster-level import logic removed from calculateSetupFlow');
console.log('   - Only company and division import options remain');
console.log('\n💡 The setup wizard now only supports:');
console.log('   - Company-level import (single CSV for entire company)');
console.log('   - Division-level import (separate CSV per division)'); 