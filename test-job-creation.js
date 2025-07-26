// Test script to verify job creation is working
import { pgPool } from './src/backend/db.js';

const DATASET_ID = 43; // Use the correct dataset ID

async function testJobCreation() {
  try {
    // Print all datasets
    const datasets = await pgPool.query('SELECT id, name, file_path FROM datasets');
    console.log('📦 Datasets in DB:', datasets.rows);
    
    console.log('🧪 Testing job creation...');
    // First, manually insert a test SKU
    console.log('📝 Inserting test SKU...');
    await pgPool.query(
      'INSERT INTO skus (company_id, sku_code) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [1, '95000000']
    );
    console.log('✅ Test SKU inserted');
    // Check if SKU exists
    const skuResult = await pgPool.query(
      'SELECT id FROM skus WHERE company_id = $1 AND sku_code = $2',
      [1, '95000000']
    );
    if (skuResult.rows.length > 0) {
      console.log('✅ SKU found in database, ID:', skuResult.rows[0].id);
      // Test job creation directly in database
      console.log('📝 Testing job insertion...');
      const jobResult = await pgPool.query(`
        INSERT INTO optimization_jobs (
          company_id, user_id, sku_id, sku, dataset_id, method, payload, status, reason, 
          batch_id, priority, result, optimization_id, optimization_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        1, 1, skuResult.rows[0].id, '95000000', DATASET_ID, 'grid', 
        JSON.stringify({ skuData: [], businessContext: null }), 'pending', 'test', 
        'test-batch-' + Date.now(), 1, JSON.stringify({ modelTypes: ['simple-exponential-smoothing'], optimizationType: 'grid', name: 'Test', sku: '95000000' }), 
        'test-optimization-id', 'test-hash'
      ]);
      console.log('✅ Job created successfully!');
    } else {
      console.log('❌ SKU not found in database');
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pgPool.end();
  }
}

testJobCreation(); 