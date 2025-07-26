import { pgPool } from './src/backend/db.js';

async function clearOptimizationJobs() {
  try {
    console.log('🔄 Clearing all optimization jobs...\n');

    // First, let's see what we're about to delete
    const countQuery = `
      SELECT 
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_jobs,
        COUNT(CASE WHEN status = 'running' THEN 1 END) as running_jobs,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_jobs,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_jobs
      FROM optimization_jobs
    `;

    const countResult = await pgPool.query(countQuery);
    const counts = countResult.rows[0];

    console.log('📊 Current job counts:');
    console.log(`  Total jobs: ${counts.total_jobs}`);
    console.log(`  Pending: ${counts.pending_jobs}`);
    console.log(`  Running: ${counts.running_jobs}`);
    console.log(`  Completed: ${counts.completed_jobs}`);
    console.log(`  Failed: ${counts.failed_jobs}`);
    console.log(`  Cancelled: ${counts.cancelled_jobs}\n`);

    if (counts.total_jobs === 0) {
      console.log('✅ No jobs to clear - table is already empty');
      return;
    }

    // Clear all jobs
    const deleteResult = await pgPool.query('DELETE FROM optimization_jobs');
    console.log(`🗑️  Deleted ${deleteResult.rowCount} jobs`);

    // Verify the table is empty
    const verifyResult = await pgPool.query('SELECT COUNT(*) as remaining_jobs FROM optimization_jobs');
    const remainingJobs = verifyResult.rows[0].remaining_jobs;

    if (remainingJobs === 0) {
      console.log('✅ Successfully cleared all optimization jobs');
      console.log('🎯 Ready for testing - create new jobs to verify they work correctly');
    } else {
      console.log(`⚠️  Warning: ${remainingJobs} jobs still remain in the table`);
    }

  } catch (error) {
    console.error('❌ Error clearing optimization jobs:', error.message);
    process.exit(1);
  } finally {
    // Close the database connection
    await pgPool.end();
  }
}

// Run the script
clearOptimizationJobs(); 