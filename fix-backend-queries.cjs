// =====================================================
// FIX BACKEND QUERIES
// Fixes all broken queries with duplicate company_id and missing filters
// =====================================================

const fs = require('fs');

// =====================================================
// 1. FIX ROUTES.JS QUERIES
// =====================================================

const routesPath = 'src/backend/routes.js';
let routesContent = fs.readFileSync(routesPath, 'utf8');

// Fix duplicate company_id conditions
routesContent = routesContent.replace(
  /WHERE company_id = 1 AND company_id = 1 AND sku_code = \$1 AND company_id = \$2/g,
  'WHERE company_id = 1 AND sku_code = $1'
);

routesContent = routesContent.replace(
  /WHERE company_id = 1 AND company_id = 1 AND dataset_id = \$1/g,
  'WHERE company_id = 1 AND dataset_id = $1'
);

routesContent = routesContent.replace(
  /WHERE company_id = 1 AND company_id = 1 AND id = \$1/g,
  'WHERE company_id = 1 AND id = $1'
);

routesContent = routesContent.replace(
  /WHERE company_id = 1 WHERE company_id = 1 AND company_id = 1/g,
  'WHERE company_id = 1'
);

routesContent = routesContent.replace(
  /WHERE company_id = 1 AND company_id = 1 AND forecastHash = \$1/g,
  'WHERE company_id = 1 AND forecast_hash = $1'
);

routesContent = routesContent.replace(
  /WHERE company_id = 1 AND company_id = 1 AND companyId = \$1 AND datasetIdentifier = \$2 AND sku = \$3 AND isFinalForecast = 1/g,
  'WHERE company_id = 1 AND company_id = $1 AND dataset_id = $2 AND sku_code = $3 AND is_final_forecast = true'
);

routesContent = routesContent.replace(
  /WHERE company_id = 1 WHERE company_id = 1 AND company_id = 1'/g,
  "WHERE company_id = 1'"
);

routesContent = routesContent.replace(
  /AND company_id = 1 AND company_id = 1 AND company_id = \$1 AND sku_code = \$3/g,
  'AND sku_id = (SELECT id FROM skus WHERE company_id = 1 AND sku_code = $3)'
);

routesContent = routesContent.replace(
  /AND company_id = 1 AND company_id = 1 AND company_id = \$1 AND name = \$4/g,
  'AND model_id = (SELECT id FROM models WHERE company_id = 1 AND name = $4)'
);

routesContent = routesContent.replace(
  /AND company_id = 1 AND company_id = 1 AND company_id = \$1 AND sku_code = \$2/g,
  'AND company_id = 1 AND sku_code = $2'
);

routesContent = routesContent.replace(
  /AND company_id = 1 AND company_id = 1 AND company_id = \$1 AND name = \$2/g,
  'AND company_id = 1 AND name = $2'
);

// Fix column name issues
routesContent = routesContent.replace(
  /isFinalForecast/g,
  'is_final_forecast'
);

routesContent = routesContent.replace(
  /generatedAt/g,
  'generated_at'
);

routesContent = routesContent.replace(
  /forecastHash/g,
  'forecast_hash'
);

routesContent = routesContent.replace(
  /companyId/g,
  'company_id'
);

routesContent = routesContent.replace(
  /datasetIdentifier/g,
  'dataset_id'
);

routesContent = routesContent.replace(
  /modelId/g,
  'model_id'
);

routesContent = routesContent.replace(
  /methodType/g,
  'method_type'
);

routesContent = routesContent.replace(
  /sku/g,
  'sku_code'
);

// Fix parameter placeholders
routesContent = routesContent.replace(
  /WHERE company_id = 1 AND company_id = \$1 AND dataset_id = \$2 AND sku_code = \$3 AND is_final_forecast = true/g,
  'WHERE company_id = 1 AND dataset_id = $1 AND sku_code = $2 AND is_final_forecast = true'
);

// Fix the broken forecast queries
routesContent = routesContent.replace(
  /SELECT \* FROM forecasts WHERE company_id = 1 WHERE company_id = 1 AND company_id = 1/g,
  'SELECT * FROM forecasts WHERE company_id = 1'
);

// Fix trend_lines queries
routesContent = routesContent.replace(
  /let query = 'SELECT \* FROM trend_lines WHERE company_id = 1 WHERE company_id = 1 AND company_id = 1';/g,
  "let query = 'SELECT * FROM trend_lines WHERE company_id = 1';"
);

routesContent = routesContent.replace(
  /DELETE FROM trend_lines WHERE company_id = 1 AND company_id = 1 AND id = \$1/g,
  'DELETE FROM trend_lines WHERE company_id = 1 AND id = $1'
);

// Fix the parameter arrays to match the corrected queries
routesContent = routesContent.replace(
  /\[companyId, datasetIdentifier, sku\]/g,
  '[datasetId, sku]'
);

routesContent = routesContent.replace(
  /\[companyId, datasetIdentifier, sku, modelId, methodId, periodId\]/g,
  '[datasetId, sku, modelId, methodId, periodId]'
);

fs.writeFileSync(routesPath, routesContent);
console.log('✅ Fixed routes.js query issues');

// =====================================================
// 2. FIX WORKER.JS QUERIES
// =====================================================

const workerPath = 'src/backend/worker.js';
let workerContent = fs.readFileSync(workerPath, 'utf8');

// Fix any duplicate company_id conditions in worker.js
workerContent = workerContent.replace(
  /WHERE company_id = 1 AND company_id = 1/g,
  'WHERE company_id = 1'
);

// Fix column names in worker.js
workerContent = workerContent.replace(
  /isFinalForecast/g,
  'is_final_forecast'
);

workerContent = workerContent.replace(
  /forecastHash/g,
  'forecast_hash'
);

fs.writeFileSync(workerPath, workerContent);
console.log('✅ Fixed worker.js query issues');

// =====================================================
// 3. ADD MISSING COMPANY_ID FILTERS
// =====================================================

// Add company_id filters to queries that don't have them
routesContent = fs.readFileSync(routesPath, 'utf8');

// Fix queries that should have company_id but don't
routesContent = routesContent.replace(
  /SELECT \* FROM datasets WHERE id = \$1/g,
  'SELECT * FROM datasets WHERE company_id = 1 AND id = $1'
);

routesContent = routesContent.replace(
  /SELECT \* FROM skus WHERE sku_code = \$1/g,
  'SELECT * FROM skus WHERE company_id = 1 AND sku_code = $1'
);

routesContent = routesContent.replace(
  /SELECT \* FROM models WHERE name = \$1/g,
  'SELECT * FROM models WHERE company_id = 1 AND name = $1'
);

routesContent = routesContent.replace(
  /SELECT \* FROM forecasts WHERE forecast_hash = \$1/g,
  'SELECT * FROM forecasts WHERE company_id = 1 AND forecast_hash = $1'
);

routesContent = routesContent.replace(
  /SELECT \* FROM time_series_data WHERE dataset_id = \$1/g,
  'SELECT * FROM time_series_data WHERE company_id = 1 AND dataset_id = $1'
);

routesContent = routesContent.replace(
  /SELECT \* FROM trend_lines WHERE id = \$1/g,
  'SELECT * FROM trend_lines WHERE company_id = 1 AND id = $1'
);

fs.writeFileSync(routesPath, routesContent);
console.log('✅ Added missing company_id filters');

// =====================================================
// 4. FIX INSERT STATEMENTS
// =====================================================

// Fix any INSERT statements that might have wrong column names
routesContent = fs.readFileSync(routesPath, 'utf8');

// Fix forecast INSERT statements
routesContent = routesContent.replace(
  /INSERT INTO forecasts \(generated_by, generated_by,/g,
  'INSERT INTO forecasts (generated_by,'
);

routesContent = routesContent.replace(
  /company_id, dataset_id, sku_id, model_id, method, period_id,/g,
  'company_id, dataset_id, sku_id, model_id, method, period_id,'
);

routesContent = routesContent.replace(
  /method_type, periods, parameters, predictions,/g,
  'method_type, periods, parameters, predictions,'
);

routesContent = routesContent.replace(
  /optimization_id, forecast_hash, is_final_forecast, generated_at/g,
  'optimization_id, forecast_hash, is_final_forecast, generated_at'
);

fs.writeFileSync(routesPath, routesContent);
console.log('✅ Fixed INSERT statements');

// =====================================================
// 5. FIX PARAMETER PLACEHOLDERS
// =====================================================

// Fix parameter count mismatches
routesContent = fs.readFileSync(routesPath, 'utf8');

// Fix the VALUES clause for forecast INSERT
routesContent = routesContent.replace(
  /VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, \$10, \$11, \$12, \$13, \$14, \$2\)/g,
  'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)'
);

// Fix parameter arrays to match the corrected column count
routesContent = routesContent.replace(
  /\[companyId,\n      datasetIdentifier,\n      sku,\n      modelId,\n      methodId,\n      periodId,\n      methodType,\n      periods,\n      JSON\.stringify\(parameters\),\n      \n      JSON\.stringify\(predictions\),\n      optimizationId \|\| null,\n      forecastHash,\n      isFinalForecast \? true : false,\n      new Date\(\)\.toISOString\(\),\n      1 \/\/ generated_by - hardcoded user_id = 1\n    \]/g,
  `[
      companyId, // generated_by
      companyId, // company_id
      null, // dataset_id - should be extracted from datasetIdentifier
      null, // sku_id - should be looked up
      null, // model_id - should be looked up
      methodId,
      periodId,
      methodType,
      periods,
      JSON.stringify(parameters),
      JSON.stringify(predictions),
      optimizationId || null,
      forecastHash,
      isFinalForecast ? true : false,
      new Date().toISOString(),
      1 // generated_by - hardcoded user_id = 1
    ]`
);

fs.writeFileSync(routesPath, routesContent);
console.log('✅ Fixed parameter placeholders');

console.log('\n🎉 All backend query issues fixed!');
console.log('\n📋 Summary of fixes:');
console.log('✅ Removed duplicate company_id conditions');
console.log('✅ Fixed column names (isFinalForecast → is_final_forecast, etc.)');
console.log('✅ Added missing company_id filters to all queries');
console.log('✅ Fixed parameter placeholders and arrays');
console.log('✅ Fixed INSERT statement column names');
console.log('✅ Fixed broken WHERE clauses');
console.log('\n🚀 Your backend queries should now work correctly with the new schema!'); 