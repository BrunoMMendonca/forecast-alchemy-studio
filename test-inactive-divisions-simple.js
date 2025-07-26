// Simple test for inactive divisions API
console.log('🔧 Testing Inactive Divisions API After Fix\n');

console.log('📋 What to do:');

console.log('\n**Step 1: Test in Browser Console**');
console.log('   - Open browser (F12) → Console tab');
console.log('   - Run this command:');
console.log(`
fetch('/api/divisions/inactive', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('sessionToken')
  }
})
.then(response => {
  console.log('Status:', response.status);
  console.log('OK:', response.ok);
  return response.json();
})
.then(data => {
  console.log('Data:', data);
  console.log('Divisions count:', data.divisions?.length || 0);
})
.catch(error => {
  console.error('Error:', error);
});
`);

console.log('\n**Step 2: Check Backend Console**');
console.log('   - Look at the terminal where npm start is running');
console.log('   - Should see: "Found X inactive divisions"');
console.log('   - Should NOT see any SQL errors');

console.log('\n**Step 3: Test UI**');
console.log('   - Go to Setup Wizard → Divisions');
console.log('   - Click "Inactive Divisions" button');
console.log('   - Should work without 500 error');

console.log('\n🎯 Expected Results:');
console.log('   - Status: 200 (not 500)');
console.log('   - Response: {divisions: [...]}');
console.log('   - Backend logs: "Found X inactive divisions"');
console.log('   - UI shows inactive divisions panel');

console.log('\n🔧 If Still Getting 500:');
console.log('   - Check backend console for specific error message');
console.log('   - The error should be more specific now');
console.log('   - Might be a different issue (database connection, etc.)');

console.log('\n✅ Try the browser console test first!'); 
 
 
 
 
 
 
 
 
 