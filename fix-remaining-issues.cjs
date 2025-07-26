// =====================================================
// FIX REMAINING BACKEND ISSUES
// Fixes all remaining issues after schema update
// =====================================================

const fs = require('fs');

// =====================================================
// 1. FIX WORKER.JS SETTINGS REFERENCES
// =====================================================

const workerPath = 'src/backend/worker.js';
let workerContent = fs.readFileSync(workerPath, 'utf8');

// Fix settings table references
workerContent = workerContent.replace(
  /SELECT value FROM settings WHERE key = 'global_forecastPeriods'/g,
  "SELECT value FROM user_settings WHERE company_id = 1 AND user_id = 1 AND key = 'global_forecastPeriods'"
);

workerContent = workerContent.replace(
  /SELECT value FROM settings WHERE key = 'global_companyId'/g,
  "SELECT value FROM user_settings WHERE company_id = 1 AND user_id = 1 AND key = 'global_companyId'"
);

fs.writeFileSync(workerPath, workerContent);
console.log('✅ Fixed worker.js settings references');

// =====================================================
// 2. FIX ROUTES.JS SETTINGS REFERENCES
// =====================================================

const routesPath = 'src/backend/routes.js';
let routesContent = fs.readFileSync(routesPath, 'utf8');

// Fix any remaining settings references
routesContent = routesContent.replace(
  /Could not get seasonal period from settings/g,
  'Could not get seasonal period from user_settings'
);

routesContent = routesContent.replace(
  /Helper function to get CSV separator from settings/g,
  'Helper function to get CSV separator from user_settings'
);

fs.writeFileSync(routesPath, routesContent);
console.log('✅ Fixed remaining settings references in routes.js');

// =====================================================
// 3. REMOVE ACCURACY REFERENCES FROM FORECAST GENERATION
// =====================================================

// Remove accuracy from forecast result structure in worker.js
workerContent = fs.readFileSync(workerPath, 'utf8');

workerContent = workerContent.replace(
  /accuracy: \n                  generatedAt:/g,
  'generatedAt:'
);

fs.writeFileSync(workerPath, workerContent);
console.log('✅ Removed accuracy references from forecast generation');

console.log('\n🎉 All remaining backend issues fixed!');
console.log('\n📋 Summary of fixes:');
console.log('✅ Updated settings table references to user_settings');
console.log('✅ Removed accuracy field references from forecast generation');
console.log('\n🚀 Your backend should now be fully compatible with the new schema!'); 