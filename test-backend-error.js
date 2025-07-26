// Test script to check backend error logs and database connection
console.log('🔍 Backend Error Investigation\n');

console.log('📋 Steps to diagnose the 500 error:');

console.log('\n**Step 1: Check Backend Console**');
console.log('   - Look at the terminal where npm start is running');
console.log('   - Look for error messages when clicking "Inactive Divisions"');
console.log('   - Check for SQL errors or connection issues');

console.log('\n**Step 2: Check Database Connection**');
console.log('   - Verify PostgreSQL is running');
console.log('   - Check if .env file has correct database credentials');
console.log('   - Test connection in DBeaver');

console.log('\n**Step 3: Check Database Schema**');
console.log('   - In DBeaver, run:');
console.log('     SELECT column_name, data_type FROM information_schema.columns');
console.log('     WHERE table_name = \'divisions\';');
console.log('   - Verify these columns exist:');
console.log('     - is_active (boolean)');
console.log('     - deleted_at (timestamp)');
console.log('     - deleted_by (integer)');

console.log('\n**Step 4: Check for Soft-Deleted Divisions**');
console.log('   - In DBeaver, run:');
console.log('     SELECT * FROM divisions WHERE is_active = false;');
console.log('   - Should show your soft-deleted divisions');

console.log('\n**Step 5: Test Simple Query**');
console.log('   - In DBeaver, run:');
console.log('     SELECT id, name, is_active FROM divisions LIMIT 5;');
console.log('   - Should work without errors');

console.log('\n**Step 6: Check Backend Logs**');
console.log('   - Look for: "Error fetching inactive divisions:"');
console.log('   - Look for: "Found X inactive divisions"');
console.log('   - Look for any SQL syntax errors');

console.log('\n🔧 Common Issues:');
console.log('   - Database connection failed');
console.log('   - Missing columns in divisions table');
console.log('   - SQL syntax error in query');
console.log('   - Authentication middleware error');
console.log('   - Pool connection exhausted');

console.log('\n🎯 What to look for:');
console.log('   - Backend console should show the error details');
console.log('   - Database should have the soft delete columns');
console.log('   - At least one division should be soft-deleted');

console.log('\n✅ Run these checks to identify the specific error!'); 
 
 
 
 
 
 
 
 
 