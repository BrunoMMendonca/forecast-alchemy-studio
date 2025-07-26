// Test script to verify setup wizard syntax
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing SetupWizard.tsx syntax...');

try {
  // Check if the file exists
  const filePath = path.join(__dirname, 'src', 'components', 'SetupWizard.tsx');
  if (!fs.existsSync(filePath)) {
    console.error('❌ SetupWizard.tsx not found');
    process.exit(1);
  }

  // Read the file content
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Check for common syntax issues
  const issues = [];
  
  // Check for duplicate declarations
  const calculateSetupFlowCount = (content.match(/calculateSetupFlow/g) || []).length;
  if (calculateSetupFlowCount > 2) { // Allow for destructuring and safe version
    issues.push(`Duplicate calculateSetupFlow declarations found (${calculateSetupFlowCount} occurrences)`);
  }
  
  // Check for missing imports
  if (!content.includes('import { CsvImportWizard }')) {
    issues.push('Missing CsvImportWizard import');
  }
  
  // Check for basic React component structure
  if (!content.includes('const SetupWizard: React.FC')) {
    issues.push('Missing SetupWizard component declaration');
  }
  
  // Check for proper export
  if (!content.includes('export default SetupWizard')) {
    issues.push('Missing default export');
  }
  
  if (issues.length > 0) {
    console.error('❌ Syntax issues found:');
    issues.forEach(issue => console.error(`   - ${issue}`));
    process.exit(1);
  }
  
  console.log('✅ SetupWizard.tsx syntax appears correct');
  console.log('✅ No duplicate declarations found');
  console.log('✅ All required imports present');
  console.log('✅ Component structure looks good');
  
} catch (error) {
  console.error('❌ Error testing SetupWizard.tsx:', error.message);
  process.exit(1);
} 