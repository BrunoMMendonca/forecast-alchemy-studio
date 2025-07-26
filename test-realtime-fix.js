const fetch = require('node-fetch');

// Test real-time updates for divisions and clusters
async function testRealtimeUpdates() {
  const sessionToken = 'your-session-token-here'; // Replace with actual token
  
  console.log('🧪 Testing Real-Time Updates Fix...\n');
  
  try {
    // 1. Test fetching divisions
    console.log('1. Fetching divisions...');
    const divisionsResponse = await fetch('http://localhost:3000/api/divisions', {
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      }
    });
    
    if (divisionsResponse.ok) {
      const divisions = await divisionsResponse.json();
      console.log(`✅ Found ${divisions.length} divisions`);
      
      if (divisions.length > 0) {
        const testDivision = divisions[0];
        console.log(`   Testing with division: ${testDivision.name} (ID: ${testDivision.id})`);
        
        // 2. Test soft delete
        console.log('\n2. Testing soft delete...');
        const deleteResponse = await fetch(`http://localhost:3000/api/divisions/${testDivision.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
        
        if (deleteResponse.ok) {
          const deleteResult = await deleteResponse.json();
          console.log(`✅ Delete result:`, deleteResult);
          
          // 3. Verify division is inactive
          console.log('\n3. Verifying division is inactive...');
          const inactiveResponse = await fetch('http://localhost:3000/api/divisions/inactive', {
            headers: {
              'Authorization': `Bearer ${sessionToken}`
            }
          });
          
          if (inactiveResponse.ok) {
            const inactiveDivisions = await inactiveResponse.json();
            const foundInactive = inactiveDivisions.divisions.find(d => d.id === testDivision.id);
            console.log(`✅ Found inactive division: ${foundInactive ? 'YES' : 'NO'}`);
            
            if (foundInactive) {
              // 4. Test restore
              console.log('\n4. Testing restore...');
              const restoreResponse = await fetch(`http://localhost:3000/api/divisions/${testDivision.id}/restore`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${sessionToken}`
                }
              });
              
              if (restoreResponse.ok) {
                const restoreResult = await restoreResponse.json();
                console.log(`✅ Restore result:`, restoreResult);
                
                // 5. Verify division is active again
                console.log('\n5. Verifying division is active again...');
                const activeResponse = await fetch('http://localhost:3000/api/divisions', {
                  headers: {
                    'Authorization': `Bearer ${sessionToken}`
                  }
                });
                
                if (activeResponse.ok) {
                  const activeDivisions = await activeResponse.json();
                  const foundActive = activeDivisions.find(d => d.id === testDivision.id);
                  console.log(`✅ Found active division: ${foundActive ? 'YES' : 'NO'}`);
                }
              }
            }
          }
        }
      }
    }
    
    console.log('\n🎉 Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testRealtimeUpdates(); 