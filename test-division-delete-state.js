const fetch = require('node-fetch');

// Test to verify division delete state issue
async function testDivisionDeleteState() {
  const sessionToken = 'your-session-token-here'; // Replace with actual token
  
  console.log('🧪 Testing Division Delete State Issue...\n');
  
  try {
    // 1. Get current divisions
    console.log('1. Getting current divisions...');
    const divisionsResponse = await fetch('http://localhost:3000/api/divisions', {
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      }
    });
    
    if (divisionsResponse.ok) {
      const divisions = await divisionsResponse.json();
      console.log(`✅ Found ${divisions.divisions.length} active divisions:`, divisions.divisions.map(d => d.name));
      
      if (divisions.divisions.length > 0) {
        const divisionToDelete = divisions.divisions[0];
        console.log(`\n2. Testing delete for division: ${divisionToDelete.name} (ID: ${divisionToDelete.id})`);
        
        // 2. Delete the division
        const deleteResponse = await fetch(`http://localhost:3000/api/divisions/${divisionToDelete.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
        
        if (deleteResponse.ok) {
          const deleteResult = await deleteResponse.json();
          console.log(`✅ Delete result:`, deleteResult);
          
          // 3. Wait a moment for the operation to complete
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // 4. Get divisions again to check state
          console.log('\n3. Getting divisions after delete...');
          const divisionsAfterResponse = await fetch('http://localhost:3000/api/divisions', {
            headers: {
              'Authorization': `Bearer ${sessionToken}`
            }
          });
          
          if (divisionsAfterResponse.ok) {
            const divisionsAfter = await divisionsAfterResponse.json();
            console.log(`✅ Found ${divisionsAfter.divisions.length} active divisions after delete`);
            
            const deletedDivisionStillActive = divisionsAfter.divisions.find(d => d.id === divisionToDelete.id);
            if (deletedDivisionStillActive) {
              console.log('❌ ISSUE FOUND: Deleted division still appears as active!');
              console.log('   Division details:', deletedDivisionStillActive);
            } else {
              console.log('✅ SUCCESS: Deleted division no longer appears as active');
            }
            
            // 5. Check inactive divisions
            console.log('\n4. Checking inactive divisions...');
            const inactiveResponse = await fetch('http://localhost:3000/api/divisions/inactive', {
              headers: {
                'Authorization': `Bearer ${sessionToken}`
              }
            });
            
            if (inactiveResponse.ok) {
              const inactiveDivisions = await inactiveResponse.json();
              console.log(`✅ Found ${inactiveDivisions.divisions.length} inactive divisions`);
              
              const deletedDivisionInactive = inactiveDivisions.divisions.find(d => d.id === divisionToDelete.id);
              if (deletedDivisionInactive) {
                console.log('✅ SUCCESS: Deleted division appears in inactive list');
                console.log('   Inactive division details:', deletedDivisionInactive);
              } else {
                console.log('❌ ISSUE: Deleted division not found in inactive list');
              }
            } else {
              console.log('❌ Failed to fetch inactive divisions:', await inactiveResponse.text());
            }
            
          } else {
            console.log('❌ Failed to fetch divisions after delete:', await divisionsAfterResponse.text());
          }
          
        } else {
          console.log('❌ Failed to delete division:', await deleteResponse.text());
        }
        
      } else {
        console.log('⚠️  No divisions available for testing');
      }
    } else {
      console.log('❌ Failed to fetch divisions:', await divisionsResponse.text());
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testDivisionDeleteState(); 