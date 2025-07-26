import fs from 'fs';
import path from 'path';

// Files that need to be updated
const filesToUpdate = [
  'src/backend/routes.js',
  'src/backend/worker.js',
  'src/backend/init-postgres-schema.sql'
];

// Replacement patterns
const replacements = [
  // SQL queries
  { from: 'FROM jobs', to: 'FROM optimization_jobs' },
  { from: 'INSERT INTO jobs', to: 'INSERT INTO optimization_jobs' },
  { from: 'UPDATE jobs', to: 'UPDATE optimization_jobs' },
  { from: 'DELETE FROM jobs', to: 'DELETE FROM optimization_jobs' },
  { from: 'table_name = \'jobs\'', to: 'table_name = \'optimization_jobs\'' },
  { from: 'WHERE table_name = \'jobs\'', to: 'WHERE table_name = \'optimization_jobs\'' },
  
  // Schema references
  { from: 'CREATE TABLE IF NOT EXISTS jobs', to: 'CREATE TABLE IF NOT EXISTS optimization_jobs' },
  { from: 'REFERENCES jobs(id)', to: 'REFERENCES optimization_jobs(id)' },
  { from: 'idx_jobs_company_status', to: 'idx_optimization_jobs_company_status' },
  
  // Comments and documentation
  { from: '-- Optimization Jobs', to: '-- Optimization Jobs (renamed from jobs for clarity)' },
  { from: 'table: \'jobs\'', to: 'table: \'optimization_jobs\'' },
  
  // Error messages and logs
  { from: 'Database tables not initialized yet, returning empty job status', to: 'Database tables not initialized yet, returning empty optimization job status' },
  { from: 'Failed to get job status', to: 'Failed to get optimization job status' },
  { from: 'Failed to reset jobs', to: 'Failed to reset optimization jobs' },
  { from: 'All jobs have been reset', to: 'All optimization jobs have been reset' },
  { from: 'Failed to clear completed jobs', to: 'Failed to clear completed optimization jobs' },
  { from: 'All completed jobs have been cleared', to: 'All completed optimization jobs have been cleared' },
  { from: 'Failed to clear pending jobs', to: 'Failed to clear pending optimization jobs' },
  { from: 'All pending jobs have been cleared', to: 'All pending optimization jobs have been cleared' }
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

// Update all files
console.log('🔄 Updating backend references from "jobs" to "optimization_jobs"...\n');

let updatedCount = 0;
filesToUpdate.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    if (updateFile(filePath)) {
      updatedCount++;
    }
  } else {
    console.log(`⚠️  File not found: ${filePath}`);
  }
});

console.log(`\n✅ Migration complete! Updated ${updatedCount} files.`);
console.log('\n📋 Next steps:');
console.log('1. Run the SQL migration: psql -d your_database -f rename-jobs-table.sql');
console.log('2. Restart your backend server');
console.log('3. Test the application to ensure everything works correctly');
console.log('\n⚠️  Note: You may also need to update any test files or scripts that reference the jobs table'); 