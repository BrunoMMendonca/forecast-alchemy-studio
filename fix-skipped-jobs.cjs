const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./forecast-jobs.db');

console.log('Fixing skipped jobs with empty batchId...');

// First, let's see what we're working with
db.all('SELECT id, sku, batchId, status, createdAt FROM optimization_jobs WHERE status = "skipped" AND (batchId IS NULL OR batchId = "")', (err, rows) => {
  if (err) {
    console.error('Error querying skipped jobs:', err);
    db.close();
    return;
  }
  
  console.log(`Found ${rows.length} skipped jobs with empty batchId`);
  
  if (rows.length === 0) {
    console.log('No skipped jobs to fix');
    db.close();
    return;
  }
  
  // Group skipped jobs by SKU and creation date (within 1 hour window)
  const jobGroups = {};
  rows.forEach(job => {
    const createdAt = new Date(job.createdAt);
    const hourKey = `${job.sku}-${createdAt.getFullYear()}-${createdAt.getMonth()}-${createdAt.getDate()}-${createdAt.getHours()}`;
    
    if (!jobGroups[hourKey]) {
      jobGroups[hourKey] = [];
    }
    jobGroups[hourKey].push(job);
  });
  
  console.log(`Grouped into ${Object.keys(jobGroups).length} batches`);
  
  // Update each group with a proper batchId
  let updatedCount = 0;
  Object.entries(jobGroups).forEach(([hourKey, jobs]) => {
    const [sku, year, month, day, hour] = hourKey.split('-');
    const batchTimestamp = new Date(parseInt(year), parseInt(month), parseInt(day), parseInt(hour)).getTime();
    const batchId = `fixed-${sku}-${batchTimestamp}`;
    
    console.log(`Updating ${jobs.length} jobs for SKU ${sku} with batchId: ${batchId}`);
    
    // Update all jobs in this group
    jobs.forEach(job => {
      db.run('UPDATE optimization_jobs SET batchId = ? WHERE id = ?', [batchId, job.id], function(err) {
        if (err) {
          console.error(`Error updating job ${job.id}:`, err);
        } else {
          updatedCount++;
          console.log(`Updated job ${job.id} with batchId: ${batchId}`);
        }
      });
    });
  });
  
  // Wait a moment for all updates to complete, then verify
  setTimeout(() => {
    console.log(`\nVerification: Checking updated jobs...`);
    db.all('SELECT COUNT(*) as count FROM optimization_jobs WHERE status = "skipped" AND (batchId IS NULL OR batchId = "")', (err, row) => {
      if (err) {
        console.error('Error verifying updates:', err);
      } else {
        console.log(`Remaining skipped jobs with empty batchId: ${row.count}`);
        if (row.count === 0) {
          console.log('✅ All skipped jobs have been fixed!');
        } else {
          console.log('⚠️  Some skipped jobs still have empty batchId');
        }
      }
      
      db.close();
    });
  }, 1000);
}); 