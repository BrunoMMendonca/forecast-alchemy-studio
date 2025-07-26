// Test script to verify inactive divisions fix
console.log('🔧 Testing Inactive Divisions Fix\n');

console.log('📋 What was fixed:');
console.log('   - Backend API was failing due to missing users table');
console.log('   - Added table existence check before JOIN');
console.log('   - Added fallback for when users table doesn\'t exist');
console.log('   - Added COALESCE to handle null usernames');

console.log('\n🎯 Test Steps:');

console.log('\n**Step 1: Restart Backend Server**');
console.log('   - Stop the backend server (Ctrl+C)');
console.log('   - Start it again: npm start');
console.log('   - This ensures the updated routes are loaded');

console.log('\n**Step 2: Test API Endpoint**');
console.log('   - Open browser console (F12)');
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
  if (data.divisions && data.divisions.length > 0) {
    console.log('First division:', data.divisions[0]);
  }
})
.catch(error => {
  console.error('Error:', error);
});
`);

console.log('\n**Step 3: Test UI**');
console.log('   - Go to Setup Wizard → Divisions step');
console.log('   - Click "Inactive Divisions" button');
console.log('   - Should now show the soft-deleted divisions');
console.log('   - Check browser console for success messages');

console.log('\n**Step 4: Check Backend Logs**');
console.log('   - Look for: "Found X inactive divisions"');
console.log('   - Should see no more 500 errors');

console.log('\n🎯 Expected Results:');
console.log('   - API returns 200 status');
console.log('   - Response contains divisions array');
console.log('   - Each division has: id, name, deleted_at, deleted_by_username');
console.log('   - deleted_by_username shows "Unknown User" if users table missing');
console.log('   - Frontend displays inactive divisions');

console.log('\n🔧 If Still Failing:');
console.log('   - Check backend console for specific SQL errors');
console.log('   - Verify divisions table has soft delete columns');
console.log('   - Check if any divisions are actually soft-deleted');

console.log('\n✅ The fix should resolve the 500 error!'); 
 
 
 
 
 
 
 
 
 