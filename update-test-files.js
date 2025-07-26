import fs from 'fs';
import path from 'path';

// Test files and utility scripts that need to be updated
const testFilesToUpdate = [
  'test-skipped-jobs.js',
  'test-optimization-jobs.js',
  'simple-check.js',
  'check-jobs.cjs',
  'debug-batchid.js',
  'check-db-schema.js',
  'add-batchid-column.cjs',
  'add-updatedat-column.js',
  'update-existing-jobs.js',
  'fix-skipped-jobs.cjs'
];

// Replacement patterns for SQLite/PostgreSQL queries
const replacements = [
  // SQLite queries (most test files use SQLite)
  { from: 'FROM jobs', to: 'FROM optimization_jobs' },
  { from: 'INSERT INTO jobs', to: 'INSERT INTO optimization_jobs' },
  { from: 'UPDATE jobs', to: 'UPDATE optimization_jobs' },
  { from: 'DELETE FROM jobs', to: 'DELETE FROM optimization_jobs' },
  { from: 'SELECT COUNT(*) as count FROM jobs', to: 'SELECT COUNT(*) as count FROM optimization_jobs' },
  { from: 'SELECT * FROM jobs', to: 'SELECT * FROM optimization_jobs' },
  { from: 'PRAGMA table_info(jobs)', to: 'PRAGMA table_info(optimization_jobs)' },
  
  // Schema references
  { from: 'jobs table', to: 'optimization_jobs table' },
  { from: 'jobs table schema', to: 'optimization_jobs table schema' },
  { from: 'table_info(jobs)', to: 'table_info(optimization_jobs)' },
  
  // Column references
  { from: 'batchId column exists in jobs table', to: 'batchId column exists in optimization_jobs table' },
  { from: 'batchId column is missing from jobs table', to: 'batchId column is missing from optimization_jobs table' },
  { from: 'batchId column now exists in jobs table', to: 'batchId column now exists in optimization_jobs table' },
  { from: 'batchId column is still missing from jobs table', to: 'batchId column is still missing from optimization_jobs table' },
  
  // Log messages
  { from: 'Checking jobs in database', to: 'Checking optimization jobs in database' },
  { from: 'Found ${rows.length} jobs', to: 'Found ${rows.length} optimization jobs' },
  { from: 'Total jobs:', to: 'Total optimization jobs:' },
  { from: 'Jobs for new dataset', to: 'Optimization jobs for new dataset' },
  { from: 'Completed jobs:', to: 'Completed optimization jobs:' },
  { from: 'Jobs with results:', to: 'Optimization jobs with results:' },
  { from: 'Recent jobs:', to: 'Recent optimization jobs:' },
  { from: 'No jobs found in database', to: 'No optimization jobs found in database' },
  { from: 'Total jobs in database:', to: 'Total optimization jobs in database:' },
  { from: 'Jobs for new dataset (', to: 'Optimization jobs for new dataset (' },
  { from: 'Skipped jobs:', to: 'Skipped optimization jobs:' },
  
  // Error messages
  { from: 'Error querying jobs:', to: 'Error querying optimization jobs:' },
  { from: 'Error counting jobs:', to: 'Error counting optimization jobs:' },
  { from: 'Error checking table schema:', to: 'Error checking optimization_jobs table schema:' },
  { from: 'Error adding batchId column:', to: 'Error adding batchId column to optimization_jobs:' },
  { from: 'Error updating jobs:', to: 'Error updating optimization jobs:' },
  { from: 'Successfully added batchId column to jobs table', to: 'Successfully added batchId column to optimization_jobs table' },
  { from: 'Successfully added updatedAt column to jobs table', to: 'Successfully added updatedAt column to optimization_jobs table' },
  { from: 'Updated ${this.changes} existing jobs', to: 'Updated ${this.changes} existing optimization jobs' },
  { from: 'Updated ${this.changes} existing jobs with updatedAt field', to: 'Updated ${this.changes} existing optimization jobs with updatedAt field' }
];

function updateFile(filePath) {
  console.log(`Updating ${filePath}...`);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    
    // Apply all replacements
    replacements.forEach(({ from, to }) => {
      const regex = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      content = content.replace(regex, to);
    });
    
    // Write back if changes were made
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Updated ${filePath}`);
      return true;
    } else {
      console.log(`⏭️  No changes needed for ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
    return false;
  }
}

// Update all test files
console.log('🔄 Updating test files and utility scripts from "jobs" to "optimization_jobs"...\n');

let updatedCount = 0;
testFilesToUpdate.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    if (updateFile(filePath)) {
      updatedCount++;
    }
  } else {
    console.log(`⚠️  File not found: ${filePath}`);
  }
});

console.log(`\n✅ Test files migration complete! Updated ${updatedCount} files.`);
console.log('\n📋 Summary:');
console.log('- Updated SQL queries in test files');
console.log('- Updated log messages and error handling');
console.log('- Updated schema references');
console.log('\n⚠️  Note: If you have any other custom scripts or tools that reference the jobs table,');
console.log('   you will need to update those manually.'); 