// Manual test script for inactive divisions API
console.log('🔍 Manual Test for Inactive Divisions\n');

console.log('📋 Test Steps:');

console.log('\n**Step 1: Check Database**');
console.log('   - Open DBeaver');
console.log('   - Run: SELECT * FROM divisions WHERE is_active = false;');
console.log('   - Should show your soft-deleted divisions');

console.log('\n**Step 2: Test API in Browser Console**');
console.log('   - Open browser developer tools (F12)');
console.log('   - Go to Console tab');
console.log('   - Run this command:');
console.log(`
fetch('/api/divisions/inactive', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('sessionToken')
  }
})
.then(response => {
  console.log('Response status:', response.status);
  return response.json();
})
.then(data => {
  console.log('Response data:', data);
  console.log('Number of inactive divisions:', data.divisions?.length || 0);
})
.catch(error => {
  console.error('Error:', error);
});
`);

console.log('\n**Step 3: Check Network Tab**');
console.log('   - Go to Network tab in dev tools');
console.log('   - Click "Inactive Divisions" button');
console.log('   - Look for request to /api/divisions/inactive');
console.log('   - Check if request is made and response received');

console.log('\n**Step 4: Check Component State**');
console.log('   - In Console, check if component is loading data:');
console.log('   - Look for console.log messages from InactiveEntitiesPanel');

console.log('\n🎯 Expected Results:');
console.log('   - Database should show soft-deleted divisions');
console.log('   - API should return JSON with divisions array');
console.log('   - Frontend should display the divisions');
console.log('   - No errors in console');

console.log('\n🔧 If API Returns Empty Array:');
console.log('   - Check if divisions were actually soft-deleted');
console.log('   - Verify is_active = false in database');
console.log('   - Check if deleted_at is set');

console.log('\n🔧 If API Returns Error:');
console.log('   - Check authentication token');
console.log('   - Verify backend server is running');
console.log('   - Check backend logs for errors');

console.log('\n✅ Run these tests to identify where the issue is!'); 
 
 
 
 
 
 
 
 
 