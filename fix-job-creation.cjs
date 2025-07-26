// =====================================================
// FIX JOB CREATION LOGIC
// Updates the job creation to include company_id, sku_id, and audit fields
// =====================================================

const fs = require('fs');

// Read the routes.js file
const routesPath = 'src/backend/routes.js';
let routesContent = fs.readFileSync(routesPath, 'utf8');

// =====================================================
// 1. ADD HARDCODED COMPANY AND USER IDS AT THE TOP
// =====================================================

// Add the hardcoded IDs after the imports
const addHardcodedIds = `
// Set hardcoded company and user for now
const companyId = 1;
const userId = 1;

`;

// Find the first function or route definition and add the IDs before it
const firstRouteMatch = routesContent.match(/(router\.(get|post|put|delete))/);
if (firstRouteMatch) {
  const insertIndex = routesContent.indexOf(firstRouteMatch[0]);
  routesContent = routesContent.slice(0, insertIndex) + addHardcodedIds + routesContent.slice(insertIndex);
}

// =====================================================
// 2. UPDATE JOB CREATION INSERT STATEMENTS
// =====================================================

// Update the first job creation INSERT (around line 530)
routesContent = routesContent.replace(
  /INSERT INTO optimization_jobs \(\n                    user_id, sku, dataset_id, method, payload, status, reason, \n                    batch_id, priority, result, optimization_id, optimization_hash\n                  \) VALUES/g,
  `INSERT INTO optimization_jobs (
                    company_id, user_id, sku_id, sku, dataset_id, method, payload, status, reason, 
                    batch_id, priority, result, optimization_id, optimization_hash, created_by
                  ) VALUES`
);

// Update the VALUES clause for the first INSERT
routesContent = routesContent.replace(
  /VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, \$10, \$11, \$12\)/g,
  'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)'
);

// Update the parameters array for the first INSERT
routesContent = routesContent.replace(
  /await pgPool\.query\(insertQuery, \[\n                  userId, sku, datasetId, method, payload, 'merged', \n                  reason \|\| 'manual_trigger', batchId, priority, \n                  JSON\.stringify\(jobData\), optimizationId, optimizationHash\n                \]\);/g,
  `// Lookup sku_id from skus table
                const skuIdResult = await pgPool.query(
                  'SELECT id FROM skus WHERE sku_code = $1 AND company_id = $2',
                  [sku, companyId]
                );
                const skuId = skuIdResult.rows[0]?.id;
                if (!skuId) throw new Error(\`SKU not found: \${sku}\`);
                
                await pgPool.query(insertQuery, [
                  companyId, userId, skuId, sku, datasetId, method, payload, 'merged', 
                  reason || 'manual_trigger', batchId, priority, 
                  JSON.stringify(jobData), optimizationId, optimizationHash, userId
                ]);`
);

// Update the second job creation INSERT (around line 560)
routesContent = routesContent.replace(
  /INSERT INTO optimization_jobs \(\n                    user_id, sku, dataset_id, method, payload, status, reason, \n                    batch_id, priority, result, optimization_id, optimization_hash\n                  \) VALUES/g,
  `INSERT INTO optimization_jobs (
                    company_id, user_id, sku_id, sku, dataset_id, method, payload, status, reason, 
                    batch_id, priority, result, optimization_id, optimization_hash, created_by
                  ) VALUES`
);

// Update the second VALUES clause
routesContent = routesContent.replace(
  /VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, \$10, \$11, \$12\)/g,
  'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)'
);

// Update the second parameters array
routesContent = routesContent.replace(
  /await pgPool\.query\(insertQuery, \[\n                  userId, sku, datasetId, method, payload, 'merged', \n                  reason \|\| 'manual_trigger', batchId, priority, \n                  JSON\.stringify\(jobData\), optimizationId, optimizationHash\n                \]\);/g,
  `// Lookup sku_id from skus table
                const skuIdResult = await pgPool.query(
                  'SELECT id FROM skus WHERE sku_code = $1 AND company_id = $2',
                  [sku, companyId]
                );
                const skuId = skuIdResult.rows[0]?.id;
                if (!skuId) throw new Error(\`SKU not found: \${sku}\`);
                
                await pgPool.query(insertQuery, [
                  companyId, userId, skuId, sku, datasetId, method, payload, 'merged', 
                  reason || 'manual_trigger', batchId, priority, 
                  JSON.stringify(jobData), optimizationId, optimizationHash, userId
                ]);`
);

// Update the main job creation INSERT (around line 610)
routesContent = routesContent.replace(
  /INSERT INTO optimization_jobs \(\n              user_id, sku, dataset_id, method, payload, status, reason, \n              batch_id, priority, result, optimization_id, optimization_hash\n            \) VALUES/g,
  `INSERT INTO optimization_jobs (
              company_id, user_id, sku_id, sku, dataset_id, method, payload, status, reason, 
              batch_id, priority, result, optimization_id, optimization_hash, created_by
            ) VALUES`
);

// Update the main VALUES clause
routesContent = routesContent.replace(
  /VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, \$10, \$11, \$12\)/g,
  'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)'
);

// Update the main parameters array
routesContent = routesContent.replace(
  /await pgPool\.query\(insertQuery, \[\n            userId, sku, datasetId, method, payload, 'pending', \n            reason \|\| 'manual_trigger', batchId, priority, \n            JSON\.stringify\(jobData\), optimizationId, optimizationHash\n          \]\);/g,
  `// Lookup sku_id from skus table
            const skuIdResult = await pgPool.query(
              'SELECT id FROM skus WHERE sku_code = $1 AND company_id = $2',
              [sku, companyId]
            );
            const skuId = skuIdResult.rows[0]?.id;
            if (!skuId) throw new Error(\`SKU not found: \${sku}\`);
            
            await pgPool.query(insertQuery, [
              companyId, userId, skuId, sku, datasetId, method, payload, 'pending', 
              reason || 'manual_trigger', batchId, priority, 
              JSON.stringify(jobData), optimizationId, optimizationHash, userId
            ]);`
);

// =====================================================
// 3. UPDATE JOB STATUS QUERIES
// =====================================================

// Update the /jobs/status endpoint
routesContent = routesContent.replace(
  /SELECT \* FROM optimization_jobs WHERE user_id = \$1 ORDER BY/g,
  'SELECT * FROM optimization_jobs WHERE company_id = $1 AND user_id = $2 ORDER BY'
);

routesContent = routesContent.replace(
  /pgPool\.query\(`\n    SELECT \* FROM optimization_jobs WHERE user_id = \$1 ORDER BY method DESC, priority ASC, sku_id ASC, created_at ASC\n  `, \[userId\],/g,
  `pgPool.query(\`
    SELECT * FROM optimization_jobs WHERE company_id = $1 AND user_id = $2 ORDER BY method DESC, priority ASC, sku_id ASC, created_at ASC
  \`, [companyId, userId],`
);

// =====================================================
// 4. UPDATE OPTIMIZATION STATUS QUERY
// =====================================================

// The optimization status query is already correct, but let's make sure
routesContent = routesContent.replace(
  /WHERE j\.company_id = \$1 AND j\.user_id = \$2/g,
  'WHERE j.company_id = $1 AND j.user_id = $2'
);

routesContent = routesContent.replace(
  /`, \[userId\],/g,
  '`, [companyId, userId],'
);

// Write the updated content back to the file
fs.writeFileSync(routesPath, routesContent);

console.log('✅ Job creation logic updated successfully!');
console.log('📋 Changes made:');
console.log('  - Added hardcoded companyId = 1 and userId = 1');
console.log('  - Updated all job creation INSERT statements to include company_id, sku_id, and created_by');
console.log('  - Added SKU lookup logic to get sku_id from sku_code');
console.log('  - Updated job status queries to include company_id filter');
console.log('  - Updated optimization status queries to use both company_id and user_id');
console.log('\n🚀 Your job creation is now compatible with the new schema!'); 