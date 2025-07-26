// Test script to check inactive divisions functionality
console.log('🔍 Testing Inactive Divisions API\n');

console.log('📋 What to check:');
console.log('   - Backend API endpoint: GET /api/divisions/inactive');
console.log('   - Frontend component: InactiveEntitiesPanel');
console.log('   - Data flow from backend to frontend');

console.log('\n🔍 Debugging Steps:');

console.log('\n**Step 1: Check Backend API**');
console.log('   - Open browser developer tools');
console.log('   - Go to Network tab');
console.log('   - Click "Inactive Divisions" button');
console.log('   - Look for request to /api/divisions/inactive');
console.log('   - Check response status and data');

console.log('\n**Step 2: Check Browser Console**');
console.log('   - Look for any error messages');
console.log('   - Check if data is being received');
console.log('   - Verify the response format');

console.log('\n**Step 3: Check Database**');
console.log('   - In DBeaver, run:');
console.log('     SELECT * FROM divisions WHERE is_active = false;');
console.log('   - Should show the soft-deleted divisions');

console.log('\n**Step 4: Manual API Test**');
console.log('   - In browser console, run:');
console.log('     fetch(\'/api/divisions/inactive\', {');
console.log('       headers: { \'Authorization\': \'Bearer \' + localStorage.getItem(\'sessionToken\') }');
console.log('     }).then(r => r.json()).then(console.log)');

console.log('\n🎯 Expected Behavior:');
console.log('   - API should return JSON with divisions array');
console.log('   - Each division should have: id, name, deleted_at, deleted_by');
console.log('   - Frontend should display the inactive divisions');
console.log('   - Restore button should work');

console.log('\n🔧 Common Issues:');
console.log('   - Authentication token missing');
console.log('   - API endpoint not responding');
console.log('   - Data format mismatch');
console.log('   - Component not re-rendering');

console.log('\n✅ Run these steps to identify the issue!'); 
 
 
 
 
 
 
 
 
 