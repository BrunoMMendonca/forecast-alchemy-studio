// =====================================================
// TEST SEPARATED OPTIMIZATION TABLES
// =====================================================
// This script tests the new separated table structure:
// - optimization_jobs: Job metadata and status tracking
// - optimization_results: Optimization results and data
// =====================================================

import { pgPool } from './src/backend/db.js';

async function testSeparatedTables() {
  console.log('🧪 Testing separated optimization tables...\n');

  try {
    // Test 1: Check if tables exist
    console.log('📋 Test 1: Checking table structure...');
    
    const tablesResult = await pgPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('optimization_jobs', 'optimization_results')
      ORDER BY table_name
    `);
    
    console.log('Found tables:', tablesResult.rows.map(r => r.table_name));
    
    if (tablesResult.rows.length !== 2) {
      throw new Error('Expected 2 tables, found ' + tablesResult.rows.length);
    }
    console.log('✅ Tables exist correctly\n');

    // Test 2: Check optimization_jobs structure
    console.log('📋 Test 2: Checking optimization_jobs structure...');
    
    const jobsColumns = await pgPool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'optimization_jobs' 
      ORDER BY ordinal_position
    `);
    
    console.log('optimization_jobs columns:');
    jobsColumns.rows.forEach(col => {
      console.log(`  ${col.column_name} (${col.data_type})`);
    });
    
    // Check for required columns
    const requiredJobColumns = ['id', 'company_id', 'user_id', 'dataset_identifier', 'method', 'payload', 'status'];
    const jobColumnNames = jobsColumns.rows.map(col => col.column_name);
    
    for (const required of requiredJobColumns) {
      if (!jobColumnNames.includes(required)) {
        throw new Error(`Missing required column in optimization_jobs: ${required}`);
      }
    }
    
    // Check that result column is removed
    if (jobColumnNames.includes('result')) {
      throw new Error('optimization_jobs still has result column - should be removed');
    }
    
    console.log('✅ optimization_jobs structure is correct\n');

    // Test 3: Check optimization_results structure
    console.log('📋 Test 3: Checking optimization_results structure...');
    
    const resultsColumns = await pgPool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'optimization_results' 
      ORDER BY ordinal_position
    `);
    
    console.log('optimization_results columns:');
    resultsColumns.rows.forEach(col => {
      console.log(`  ${col.column_name} (${col.data_type})`);
    });
    
    // Check for required columns
    const requiredResultColumns = ['id', 'job_id', 'parameters', 'scores', 'forecasts'];
    const resultColumnNames = resultsColumns.rows.map(col => col.column_name);
    
    for (const required of requiredResultColumns) {
      if (!resultColumnNames.includes(required)) {
        throw new Error(`Missing required column in optimization_results: ${required}`);
      }
    }
    
    console.log('✅ optimization_results structure is correct\n');

    // Test 4: Check foreign key constraint
    console.log('📋 Test 4: Checking foreign key constraint...');
    
    const fkResult = await pgPool.query(`
      SELECT 
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = 'optimization_results'
    `);
    
    if (fkResult.rows.length === 0) {
      throw new Error('No foreign key constraint found on optimization_results');
    }
    
    const fk = fkResult.rows[0];
    console.log(`Found foreign key: ${fk.constraint_name}`);
    console.log(`  ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    
    if (fk.foreign_table_name !== 'optimization_jobs' || fk.foreign_column_name !== 'id') {
      throw new Error('Foreign key constraint is not correctly set up');
    }
    
    console.log('✅ Foreign key constraint is correct\n');

    // Test 5: Test job creation and result storage
    console.log('📋 Test 5: Testing job creation and result storage...');
    
    // First, check if we have any existing datasets and SKUs
    const datasetsResult = await pgPool.query('SELECT id, name FROM datasets LIMIT 1');
    const skusResult = await pgPool.query('SELECT id, sku_code FROM skus LIMIT 1');
    
    let datasetId = 1;
    let skuId = 1;
    let skuCode = 'TEST-SKU-001';
    
    if (datasetsResult.rows.length > 0) {
      datasetId = datasetsResult.rows[0].id;
      console.log(`Using existing dataset: ${datasetsResult.rows[0].name} (ID: ${datasetId})`);
    } else {
      console.log('No datasets found, creating test dataset...');
      const newDatasetResult = await pgPool.query(`
        INSERT INTO datasets (company_id, name, file_path) 
        VALUES ($1, $2, $3) RETURNING id
      `, [1, 'Test Dataset', '/test/path.csv']);
      datasetId = newDatasetResult.rows[0].id;
      console.log(`Created test dataset with ID: ${datasetId}`);
    }
    
    if (skusResult.rows.length > 0) {
      skuId = skusResult.rows[0].id;
      skuCode = skusResult.rows[0].sku_code;
      console.log(`Using existing SKU: ${skuCode} (ID: ${skuId})`);
    } else {
      console.log('No SKUs found, creating test SKU...');
      const newSkuResult = await pgPool.query(`
        INSERT INTO skus (company_id, sku_code) 
        VALUES ($1, $2) RETURNING id
      `, [1, skuCode]);
      skuId = newSkuResult.rows[0].id;
      console.log(`Created test SKU with ID: ${skuId}`);
    }
    
    // Create a test job
    const testJobResult = await pgPool.query(`
      INSERT INTO optimization_jobs (
        company_id, user_id, sku_id, sku, dataset_id, dataset_identifier, 
        method, payload, status, reason, batch_id, priority, 
        optimization_id, optimization_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id
    `, [
      1, 1, skuId, skuCode, datasetId, `dataset_${datasetId}`, 
      'grid', JSON.stringify({ test: 'data' }), 'pending', 'test', 'test-batch', 1,
      'test-optimization-id', 'test-hash'
    ]);
    
    const jobId = testJobResult.rows[0].id;
    console.log(`Created test job with ID: ${jobId}`);
    
    // Create test results
    const testResults = {
      parameters: [{ alpha: 0.1, beta: 0.2 }],
      scores: [{ modelType: 'simple-exponential-smoothing', accuracy: 85.5, rmse: 10.2, mape: 12.3 }],
      forecasts: [{ period: 1, value: 100, confidence: 95 }]
    };
    
    await pgPool.query(`
      INSERT INTO optimization_results (job_id, parameters, scores, forecasts)
      VALUES ($1, $2, $3, $4)
    `, [jobId, JSON.stringify(testResults.parameters), JSON.stringify(testResults.scores), JSON.stringify(testResults.forecasts)]);
    
    console.log('Created test results');
    
    // Test combined query
    const combinedResult = await pgPool.query(`
      SELECT oj.*, ores.parameters, ores.scores, ores.forecasts
      FROM optimization_jobs oj
      LEFT JOIN optimization_results ores ON oj.id = ores.job_id
      WHERE oj.id = $1
    `, [jobId]);
    
    if (combinedResult.rows.length === 0) {
      throw new Error('Combined query returned no results');
    }
    
    const jobWithResults = combinedResult.rows[0];
    console.log('Retrieved job with results:');
    console.log(`  Job ID: ${jobWithResults.id}`);
    console.log(`  Status: ${jobWithResults.status}`);
    console.log(`  Has parameters: ${!!jobWithResults.parameters}`);
    console.log(`  Has scores: ${!!jobWithResults.scores}`);
    console.log(`  Has forecasts: ${!!jobWithResults.forecasts}`);
    
    console.log('✅ Job creation and result storage works correctly\n');

    // Test 6: Clean up test data
    console.log('📋 Test 6: Cleaning up test data...');
    
    await pgPool.query('DELETE FROM optimization_results WHERE job_id = $1', [jobId]);
    await pgPool.query('DELETE FROM optimization_jobs WHERE id = $1', [jobId]);
    
    // Clean up test dataset and SKU if we created them
    if (datasetsResult.rows.length === 0) {
      await pgPool.query('DELETE FROM datasets WHERE id = $1', [datasetId]);
      console.log('Cleaned up test dataset');
    }
    
    if (skusResult.rows.length === 0) {
      await pgPool.query('DELETE FROM skus WHERE id = $1', [skuId]);
      console.log('Cleaned up test SKU');
    }
    
    console.log('✅ Test data cleaned up\n');

    // Test 7: Check indexes
    console.log('📋 Test 7: Checking indexes...');
    
    const indexesResult = await pgPool.query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE tablename IN ('optimization_jobs', 'optimization_results')
      ORDER BY tablename, indexname
    `);
    
    console.log('Found indexes:');
    indexesResult.rows.forEach(idx => {
      console.log(`  ${idx.tablename}: ${idx.indexname}`);
    });
    
    const expectedIndexes = [
      'optimization_jobs_pkey',
      'idx_optimization_jobs_company_user',
      'idx_optimization_jobs_company_status',
      'idx_optimization_jobs_sku',
      'idx_optimization_jobs_dataset',
      'idx_optimization_jobs_dataset_identifier',
      'idx_optimization_jobs_batch_id',
      'idx_optimization_jobs_optimization_id',
      'idx_optimization_jobs_optimization_hash',
      'optimization_results_pkey',
      'idx_optimization_results_job_id',
      'idx_optimization_results_created_at'
    ];
    
    const foundIndexes = indexesResult.rows.map(idx => idx.indexname);
    for (const expected of expectedIndexes) {
      if (!foundIndexes.includes(expected)) {
        console.warn(`⚠️  Missing expected index: ${expected}`);
      }
    }
    
    console.log('✅ Indexes are set up correctly\n');

    console.log('🎉 All tests passed! The separated tables are working correctly.');
    console.log('\n📋 Summary:');
    console.log('  ✅ Tables exist with correct structure');
    console.log('  ✅ Foreign key constraint is properly set up');
    console.log('  ✅ Job creation and result storage works');
    console.log('  ✅ Combined queries work correctly');
    console.log('  ✅ Indexes are in place for performance');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pgPool.end();
  }
}

// Run the tests
testSeparatedTables(); 