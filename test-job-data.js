import { Pool } from 'pg';

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/forecast_alchemy' 
});

async function testJobData() {
  try {
    console.log('🔍 Testing job data and database state...');
    
    // Check recent jobs
    const jobsResult = await pool.query(`
      SELECT id, sku, dataset_id, status, reason, result, created_at 
      FROM optimization_jobs 
      WHERE company_id = 1 AND user_id = 1
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    if (jobsResult.rows.length === 0) {
      console.log('❌ No jobs found in database');
      return;
    }
    
    console.log(`📋 Found ${jobsResult.rows.length} recent jobs:`);
    jobsResult.rows.forEach(job => {
      console.log(`\nJob ${job.id}:`);
      console.log(`  SKU: ${job.sku}`);
      console.log(`  Dataset ID: ${job.dataset_id}`);
      console.log(`  Status: ${job.status}`);
      console.log(`  Reason: ${job.reason}`);
      console.log(`  Created: ${job.created_at}`);
      
      if (job.result) {
        try {
          const jobData = JSON.parse(job.result);
          console.log(`  Job Data:`, jobData);
        } catch (e) {
          console.log(`  Job Data: Invalid JSON - ${job.result}`);
        }
      } else {
        console.log(`  Job Data: null`);
      }
    });
    
    // Check if datasets exist
    const datasetsResult = await pool.query(`
      SELECT id, name, metadata 
      FROM datasets 
      WHERE company_id = 1
      ORDER BY uploaded_at DESC 
      LIMIT 3
    `);
    
    console.log(`\n📊 Found ${datasetsResult.rows.length} datasets:`);
    datasetsResult.rows.forEach(dataset => {
      console.log(`\nDataset ${dataset.id}: ${dataset.name}`);
      if (dataset.metadata) {
        console.log(`  Metadata keys:`, Object.keys(dataset.metadata));
        if (dataset.metadata.cleaningMetadata) {
          console.log(`  Has cleaning metadata:`, !!dataset.metadata.cleaningMetadata);
          if (dataset.metadata.cleaningMetadata.activeCorrections) {
            const corrections = dataset.metadata.cleaningMetadata.activeCorrections;
            console.log(`  Active corrections:`, Object.keys(corrections));
          }
        }
      }
    });
    
    // Check time series data for the first dataset
    if (datasetsResult.rows.length > 0) {
      const firstDataset = datasetsResult.rows[0];
      const timeSeriesResult = await pool.query(`
        SELECT COUNT(*) as total_rows, COUNT(DISTINCT sku_code) as unique_skus
        FROM time_series_data 
        WHERE dataset_id = $1
      `, [firstDataset.id]);
      
      console.log(`\n📈 Time series data for dataset ${firstDataset.id}:`);
      console.log(`  Total rows: ${timeSeriesResult.rows[0].total_rows}`);
      console.log(`  Unique SKUs: ${timeSeriesResult.rows[0].unique_skus}`);
      
      // Check specific SKU data
      const skuDataResult = await pool.query(`
        SELECT sku_code, COUNT(*) as row_count, MIN(date) as min_date, MAX(date) as max_date
        FROM time_series_data 
        WHERE dataset_id = $1
        GROUP BY sku_code
        ORDER BY sku_code
        LIMIT 5
      `, [firstDataset.id]);
      
      console.log(`\n📋 Sample SKU data:`);
      skuDataResult.rows.forEach(row => {
        console.log(`  SKU ${row.sku_code}: ${row.row_count} rows (${row.min_date} to ${row.max_date})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error testing job data:', error);
  } finally {
    await pool.end();
  }
}

testJobData(); 