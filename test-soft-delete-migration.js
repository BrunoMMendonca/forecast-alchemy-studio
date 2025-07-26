// Test script to verify soft delete migration
console.log('🔧 Testing Soft Delete Migration\n');

console.log('📋 Issue Identified:');
console.log('   - Error: "column \"deleted_at\" of relation \"divisions\" does not exist"');
console.log('   - Soft delete columns not added to database');
console.log('   - Migration script not run yet');

console.log('\n🔧 Solution:');

console.log('\n**Option 1: Run SQL Script (Recommended)**');
console.log('   - Open DBeaver');
console.log('   - Connect to your database');
console.log('   - Run: check-and-add-soft-delete-columns.sql');
console.log('   - This will add the missing columns');

console.log('\n**Option 2: Run Node.js Script**');
console.log('   - Run: node run-soft-delete-migration.js');
console.log('   - This will automatically add the columns');

console.log('\n🎯 What Gets Added:');

console.log('\n**Divisions Table**:');
console.log('   - is_active BOOLEAN DEFAULT true');
console.log('   - deleted_at TIMESTAMP');
console.log('   - deleted_by INTEGER');

console.log('\n**Clusters Table**:');
console.log('   - is_active BOOLEAN DEFAULT true');
console.log('   - deleted_at TIMESTAMP');
console.log('   - deleted_by INTEGER');

console.log('\n**Indexes**:');
console.log('   - idx_divisions_is_active');
console.log('   - idx_divisions_deleted_at');
console.log('   - idx_clusters_is_active');
console.log('   - idx_clusters_deleted_at');

console.log('\n🔍 Verification Steps:');

console.log('\n**Step 1: Run Migration**');
console.log('   - Execute the SQL script or Node.js script');
console.log('   - Should see success messages');

console.log('\n**Step 2: Test Soft Delete**');
console.log('   - Go to Setup Wizard → Divisions step');
console.log('   - Try deleting an existing division');
console.log('   - Should work without database errors');

console.log('\n**Step 3: Check Database**');
console.log('   - Verify columns exist in DBeaver');
console.log('   - Check that soft deleted divisions have is_active = false');

console.log('\n✅ After running the migration, soft delete should work!');
console.log('🚀 The database will have the required columns for soft delete functionality.'); 
 
 
 
 
 
 
 
 
 