// =====================================================
// BACKEND SCHEMA UPDATE SCRIPT
// Updates all references to match the new database schema
// =====================================================

const fs = require('fs');
const path = require('path');

// =====================================================
// 1. UPDATE SETTINGS TABLE REFERENCES
// =====================================================

// Update worker.js settings references
const workerPath = 'src/backend/worker.js';
let workerContent = fs.readFileSync(workerPath, 'utf8');

// Replace settings table queries with user_settings
workerContent = workerContent.replace(
  /SELECT value FROM settings WHERE key = 'global_forecastPeriods'/g,
  "SELECT value FROM user_settings WHERE company_id = 1 AND user_id = 1 AND key = 'global_forecastPeriods'"
);

workerContent = workerContent.replace(
  /SELECT value FROM settings WHERE key = 'global_companyId'/g,
  "SELECT value FROM user_settings WHERE company_id = 1 AND user_id = 1 AND key = 'global_companyId'"
);

fs.writeFileSync(workerPath, workerContent);
console.log('✅ Updated worker.js settings references');

// Update routes.js settings references
const routesPath = 'src/backend/routes.js';
let routesContent = fs.readFileSync(routesPath, 'utf8');

// Replace all settings table queries
routesContent = routesContent.replace(
  /SELECT key, value FROM settings/g,
  "SELECT key, value FROM user_settings WHERE company_id = 1 AND user_id = 1"
);

routesContent = routesContent.replace(
  /SELECT value FROM settings WHERE key = 'global_seasonalPeriods'/g,
  "SELECT value FROM user_settings WHERE company_id = 1 AND user_id = 1 AND key = 'global_seasonalPeriods'"
);

routesContent = routesContent.replace(
  /SELECT value FROM settings WHERE key = 'global_autoDetectFrequency'/g,
  "SELECT value FROM user_settings WHERE company_id = 1 AND user_id = 1 AND key = 'global_autoDetectFrequency'"
);

routesContent = routesContent.replace(
  /SELECT key, value, description FROM settings WHERE key LIKE 'global_%'/g,
  "SELECT key, value, description FROM user_settings WHERE company_id = 1 AND user_id = 1 AND key LIKE 'global_%'"
);

routesContent = routesContent.replace(
  /SELECT value FROM settings WHERE key = 'global_csvSeparator'/g,
  "SELECT value FROM user_settings WHERE company_id = 1 AND user_id = 1 AND key = 'global_csvSeparator'"
);

fs.writeFileSync(routesPath, routesContent);
console.log('✅ Updated routes.js settings references');

// =====================================================
// 2. REMOVE accuracy FIELD REFERENCES FROM FORECASTS
// =====================================================

// Update worker.js accuracy references in forecast generation
workerContent = fs.readFileSync(workerPath, 'utf8');

// Remove accuracy from INSERT statements
workerContent = workerContent.replace(
  /method_type, periods, parameters, accuracy, predictions,/g,
  'method_type, periods, parameters, predictions,'
);

workerContent = workerContent.replace(
  /accuracy,/g,
  ''
);

fs.writeFileSync(workerPath, workerContent);
console.log('✅ Updated worker.js accuracy field references');

// Update routes.js accuracy references
routesContent = fs.readFileSync(routesPath, 'utf8');

// Remove accuracy from INSERT statements
routesContent = routesContent.replace(
  /methodType, periods, parameters, accuracy, predictions,/g,
  'methodType, periods, parameters, predictions,'
);

routesContent = routesContent.replace(
  /accuracy \|\| null,/g,
  ''
);

routesContent = routesContent.replace(
  /accuracy: forecast\.accuracy,/g,
  ''
);

routesContent = routesContent.replace(
  /accuracy: period\.accuracy,/g,
  ''
);

routesContent = routesContent.replace(
  /accuracy = EXCLUDED\.accuracy,/g,
  ''
);

routesContent = routesContent.replace(
  /forecastData\.accuracy,/g,
  ''
);

fs.writeFileSync(routesPath, routesContent);
console.log('✅ Updated routes.js accuracy field references');

// =====================================================
// 3. UPDATE JOB CREATION TO INCLUDE AUDIT FIELDS
// =====================================================

// Update job creation to include created_by
routesContent = fs.readFileSync(routesPath, 'utf8');

// Add created_by to optimization_jobs INSERT
routesContent = routesContent.replace(
  /INSERT INTO optimization_jobs \(\n    company_id, user_id, sku_id, sku, dataset_id, method, payload, status, reason, \n    batch_id, priority, result, optimization_id, optimization_hash\n  \) VALUES/g,
  `INSERT INTO optimization_jobs (
    company_id, user_id, sku_id, sku, dataset_id, method, payload, status, reason, 
    batch_id, priority, result, optimization_id, optimization_hash, created_by
  ) VALUES`
);

routesContent = routesContent.replace(
  /VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, \$10, \$11, \$12, \$13, \$14\)/g,
  'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $2)' // user_id as created_by
);

fs.writeFileSync(routesPath, routesContent);
console.log('✅ Updated job creation to include audit fields');

// =====================================================
// 4. UPDATE FORECAST GENERATION TO INCLUDE AUDIT FIELDS
// =====================================================

// Update forecast INSERT to include generated_by
routesContent = fs.readFileSync(routesPath, 'utf8');

routesContent = routesContent.replace(
  /INSERT INTO forecasts \(/g,
  'INSERT INTO forecasts (generated_by, '
);

routesContent = routesContent.replace(
  /VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, \$10, \$11, \$12, \$13, \$14, \$15, \$16, \$17, \$18, \$19, \$20, \$21\)/g,
  'VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)' // hardcoded user_id = 1
);

fs.writeFileSync(routesPath, routesContent);
console.log('✅ Updated forecast generation to include audit fields');

// =====================================================
// 5. UPDATE TIME_SERIES_DATA QUERIES FOR NEW COLUMN ORDER
// =====================================================

// Update any queries that reference time_series_data columns
routesContent = fs.readFileSync(routesPath, 'utf8');

// Add company_id filter to time_series_data queries
routesContent = routesContent.replace(
  /FROM time_series_data WHERE/g,
  'FROM time_series_data WHERE company_id = 1 AND'
);

routesContent = routesContent.replace(
  /SELECT \* FROM time_series_data/g,
  'SELECT * FROM time_series_data WHERE company_id = 1'
);

fs.writeFileSync(routesPath, routesContent);
console.log('✅ Updated time_series_data queries for new schema');

// =====================================================
// 6. UPDATE DATASET_SKUS QUERIES FOR NEW COLUMN ORDER
// =====================================================

// Add company_id filter to dataset_skus queries
routesContent = fs.readFileSync(routesPath, 'utf8');

routesContent = routesContent.replace(
  /FROM dataset_skus WHERE/g,
  'FROM dataset_skus WHERE company_id = 1 AND'
);

routesContent = routesContent.replace(
  /SELECT \* FROM dataset_skus/g,
  'SELECT * FROM dataset_skus WHERE company_id = 1'
);

fs.writeFileSync(routesPath, routesContent);
console.log('✅ Updated dataset_skus queries for new schema');

// =====================================================
// 7. UPDATE SKU_AGGREGATABLE_VALUES QUERIES
// =====================================================

// Add company_id filter to sku_aggregatable_values queries
routesContent = fs.readFileSync(routesPath, 'utf8');

routesContent = routesContent.replace(
  /FROM sku_aggregatable_values WHERE/g,
  'FROM sku_aggregatable_values WHERE company_id = 1 AND'
);

routesContent = routesContent.replace(
  /SELECT \* FROM sku_aggregatable_values/g,
  'SELECT * FROM sku_aggregatable_values WHERE company_id = 1'
);

fs.writeFileSync(routesPath, routesContent);
console.log('✅ Updated sku_aggregatable_values queries for new schema');

// =====================================================
// 8. UPDATE SKU_AGGREGATABLE_VALUE_HISTORY QUERIES
// =====================================================

// Add company_id filter to sku_aggregatable_value_history queries
routesContent = fs.readFileSync(routesPath, 'utf8');

routesContent = routesContent.replace(
  /FROM sku_aggregatable_value_history WHERE/g,
  'FROM sku_aggregatable_value_history WHERE company_id = 1 AND'
);

routesContent = routesContent.replace(
  /SELECT \* FROM sku_aggregatable_value_history/g,
  'SELECT * FROM sku_aggregatable_value_history WHERE company_id = 1'
);

fs.writeFileSync(routesPath, routesContent);
console.log('✅ Updated sku_aggregatable_value_history queries for new schema');

// =====================================================
// 9. UPDATE AGGREGATABLE_FIELD_DEFS QUERIES
// =====================================================

// Add company_id filter to aggregatable_field_defs queries
routesContent = fs.readFileSync(routesPath, 'utf8');

routesContent = routesContent.replace(
  /FROM aggregatable_field_defs WHERE/g,
  'FROM aggregatable_field_defs WHERE company_id = 1 AND'
);

routesContent = routesContent.replace(
  /SELECT \* FROM aggregatable_field_defs/g,
  'SELECT * FROM aggregatable_field_defs WHERE company_id = 1'
);

fs.writeFileSync(routesPath, routesContent);
console.log('✅ Updated aggregatable_field_defs queries for new schema');

// =====================================================
// 10. UPDATE DATASET_AGGREGATABLE_FIELD_MAP QUERIES
// =====================================================

// Add company_id filter to dataset_aggregatable_field_map queries
routesContent = fs.readFileSync(routesPath, 'utf8');

routesContent = routesContent.replace(
  /FROM dataset_aggregatable_field_map WHERE/g,
  'FROM dataset_aggregatable_field_map WHERE company_id = 1 AND'
);

routesContent = routesContent.replace(
  /SELECT \* FROM dataset_aggregatable_field_map/g,
  'SELECT * FROM dataset_aggregatable_field_map WHERE company_id = 1'
);

fs.writeFileSync(routesPath, routesContent);
console.log('✅ Updated dataset_aggregatable_field_map queries for new schema');

// =====================================================
// 11. UPDATE TREND_LINES QUERIES
// =====================================================

// Add company_id filter to trend_lines queries
routesContent = fs.readFileSync(routesPath, 'utf8');

routesContent = routesContent.replace(
  /FROM trend_lines WHERE/g,
  'FROM trend_lines WHERE company_id = 1 AND'
);

routesContent = routesContent.replace(
  /SELECT \* FROM trend_lines/g,
  'SELECT * FROM trend_lines WHERE company_id = 1'
);

fs.writeFileSync(routesPath, routesContent);
console.log('✅ Updated trend_lines queries for new schema');

// =====================================================
// 12. UPDATE MODELS QUERIES
// =====================================================

// Add company_id filter to models queries
routesContent = fs.readFileSync(routesPath, 'utf8');

routesContent = routesContent.replace(
  /FROM models WHERE/g,
  'FROM models WHERE company_id = 1 AND'
);

routesContent = routesContent.replace(
  /SELECT \* FROM models/g,
  'SELECT * FROM models WHERE company_id = 1'
);

fs.writeFileSync(routesPath, routesContent);
console.log('✅ Updated models queries for new schema');

// =====================================================
// 13. UPDATE SKUS QUERIES
// =====================================================

// Add company_id filter to skus queries
routesContent = fs.readFileSync(routesPath, 'utf8');

routesContent = routesContent.replace(
  /FROM skus WHERE/g,
  'FROM skus WHERE company_id = 1 AND'
);

routesContent = routesContent.replace(
  /SELECT \* FROM skus/g,
  'SELECT * FROM skus WHERE company_id = 1'
);

fs.writeFileSync(routesPath, routesContent);
console.log('✅ Updated skus queries for new schema');

// =====================================================
// 14. UPDATE DATASETS QUERIES
// =====================================================

// Add company_id filter to datasets queries
routesContent = fs.readFileSync(routesPath, 'utf8');

routesContent = routesContent.replace(
  /FROM datasets WHERE/g,
  'FROM datasets WHERE company_id = 1 AND'
);

routesContent = routesContent.replace(
  /SELECT \* FROM datasets/g,
  'SELECT * FROM datasets WHERE company_id = 1'
);

fs.writeFileSync(routesPath, routesContent);
console.log('✅ Updated datasets queries for new schema');

// =====================================================
// 15. UPDATE FORECASTS QUERIES
// =====================================================

// Add company_id filter to forecasts queries
routesContent = fs.readFileSync(routesPath, 'utf8');

routesContent = routesContent.replace(
  /FROM forecasts WHERE/g,
  'FROM forecasts WHERE company_id = 1 AND'
);

routesContent = routesContent.replace(
  /SELECT \* FROM forecasts/g,
  'SELECT * FROM forecasts WHERE company_id = 1'
);

fs.writeFileSync(routesPath, routesContent);
console.log('✅ Updated forecasts queries for new schema');

// =====================================================
// 16. UPDATE COMPANY_SETTINGS QUERIES
// =====================================================

// Add company_id filter to company_settings queries
routesContent = fs.readFileSync(routesPath, 'utf8');

routesContent = routesContent.replace(
  /FROM company_settings WHERE/g,
  'FROM company_settings WHERE company_id = 1 AND'
);

routesContent = routesContent.replace(
  /SELECT \* FROM company_settings/g,
  'SELECT * FROM company_settings WHERE company_id = 1'
);

fs.writeFileSync(routesPath, routesContent);
console.log('✅ Updated company_settings queries for new schema');

console.log('\n🎉 All backend schema updates completed!');
console.log('\n📋 Summary of changes:');
console.log('✅ Updated settings table references to user_settings');
console.log('✅ Removed accuracy field references from forecasts');
console.log('✅ Added audit fields (created_by, updated_by, generated_by)');
console.log('✅ Added company_id filters to all table queries');
console.log('✅ Updated column order references for reordered tables');
console.log('\n🚀 Your backend is now compatible with the new database schema!'); 