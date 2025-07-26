import { Pool } from 'pg';

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/forecast_alchemy' 
});

async function testDataCleaningTrigger() {
  try {
    console.log('🧪 Testing data cleaning optimization trigger...');
    
    // Check if there are any datasets
    const datasetsResult = await pool.query(`
      SELECT id, name, dataset_hash 
      FROM datasets 
      WHERE company_id = 1 
      ORDER BY uploaded_at DESC 
      LIMIT 1
    `);
    
    if (datasetsResult.rows.length === 0) {
      console.log('❌ No datasets found. Please upload a dataset first.');
      return;
    }
    
    const dataset = datasetsResult.rows[0];
    console.log(`📊 Found dataset: ${dataset.name} (ID: ${dataset.id})`);
    
    // Check if there are any SKUs in this dataset
    const skusResult = await pool.query(`
      SELECT DISTINCT sku_code 
      FROM time_series_data 
      WHERE dataset_id = $1 
      LIMIT 5
    `, [dataset.id]);
    
    if (skusResult.rows.length === 0) {
      console.log('❌ No SKUs found in dataset. Please check the data.');
      return;
    }
    
    const testSku = skusResult.rows[0].sku_code;
    console.log(`🔍 Testing with SKU: ${testSku}`);
    
    // Check current optimization jobs for this SKU
    const currentJobsResult = await pool.query(`
      SELECT id, status, reason, created_at 
      FROM optimization_jobs 
      WHERE company_id = 1 AND user_id = 1 AND sku = $1
      ORDER BY created_at DESC 
      LIMIT 5
    `, [testSku]);
    
    console.log(`📋 Current optimization jobs for SKU ${testSku}:`);
    currentJobsResult.rows.forEach(job => {
      console.log(`  - Job ${job.id}: ${job.status} (${job.reason}) - ${job.created_at}`);
    });
    
    // Simulate a data cleaning operation by making a request to the backend
    console.log('\n🔄 Simulating data cleaning operation...');
    
    const response = await fetch('http://localhost:3001/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skus: [testSku],
        models: ['simple-exponential-smoothing', 'moving-average'],
        method: 'grid',
        reason: 'manual_edit_data_cleaning',
        datasetId: dataset.id,
        batchId: `test-${Date.now()}`,
        optimizationHash: `test-hash-${Date.now()}`
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Failed to create optimization job:', errorData);
      return;
    }
    
    const result = await response.json();
    console.log('✅ Successfully created optimization job:', result);
    
    // Wait a moment and check for new jobs
    console.log('\n⏳ Waiting 2 seconds for job to be created...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const newJobsResult = await pool.query(`
      SELECT id, status, reason, created_at 
      FROM optimization_jobs 
      WHERE company_id = 1 AND user_id = 1 AND sku = $1
      ORDER BY created_at DESC 
      LIMIT 5
    `, [testSku]);
    
    console.log(`📋 Updated optimization jobs for SKU ${testSku}:`);
    newJobsResult.rows.forEach(job => {
      console.log(`  - Job ${job.id}: ${job.status} (${job.reason}) - ${job.created_at}`);
    });
    
    const newJobsCount = newJobsResult.rows.length - currentJobsResult.rows.length;
    if (newJobsCount > 0) {
      console.log(`✅ SUCCESS: ${newJobsCount} new optimization job(s) created for data cleaning!`);
    } else {
      console.log('⚠️ No new jobs created. This might be due to duplicate detection.');
    }
    
  } catch (error) {
    console.error('❌ Error testing data cleaning trigger:', error);
  } finally {
    await pool.end();
  }
}

testDataCleaningTrigger(); 