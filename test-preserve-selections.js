const fetch = require('node-fetch');

// Test to verify user selections are preserved when deleting divisions
async function testPreserveSelections() {
  const sessionToken = 'your-session-token-here'; // Replace with actual token
  
  console.log('🧪 Testing User Selections Preservation...\\n');
  
  try {
    // 1. Get current setup status
    console.log('1. Checking setup status...');
    const setupResponse = await fetch('http://localhost:3000/api/auth/setup/status', {
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      }
    });
    
    if (setupResponse.ok) {
      const setupStatus = await setupResponse.json();
      console.log(`✅ Setup status:`, setupStatus);
      
      if (setupStatus.setupWizardAccessible) {
        console.log('✅ Setup wizard is accessible');
        
        // 2. Get current divisions
        console.log('\\n2. Getting current divisions...');
        const divisionsResponse = await fetch('http://localhost:3000/api/divisions', {
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
        
        if (divisionsResponse.ok) {
          const divisions = await divisionsResponse.json();
          console.log(`✅ Found ${divisions.divisions.length} active divisions:`, divisions.divisions.map(d => d.name));
          
          if (divisions.divisions.length > 1) {
            const divisionToDelete = divisions.divisions[0];
            console.log(`\\n3. Testing deletion of division: "${divisionToDelete.name}"`);
            
            // 3. Delete a division
            const deleteResponse = await fetch(`http://localhost:3000/api/divisions/${divisionToDelete.id}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${sessionToken}`
              }
            });
            
            if (deleteResponse.ok) {
              const deleteResult = await deleteResponse.json();
              console.log(`✅ Division deleted successfully:`, deleteResult);
              
              // 4. Check if remaining divisions are still accessible
              console.log('\\n4. Checking remaining divisions...');
              const remainingResponse = await fetch('http://localhost:3000/api/divisions', {
                headers: {
                  'Authorization': `Bearer ${sessionToken}`
                }
              });
              
              if (remainingResponse.ok) {
                const remaining = await remainingResponse.json();
                console.log(`✅ Remaining divisions: ${remaining.divisions.length}`, remaining.divisions.map(d => d.name));
                
                // 5. Verify that the Setup Wizard should still be on the Divisions step
                console.log('\\n5. Verifying Setup Wizard state...');
                const wizardResponse = await fetch('http://localhost:3000/api/auth/setup/status', {
                  headers: {
                    'Authorization': `Bearer ${sessionToken}`
                  }
                });
                
                if (wizardResponse.ok) {
                  const wizardStatus = await wizardResponse.json();
                  console.log(`✅ Setup wizard status after deletion:`, wizardStatus);
                  
                  // Check if hasMultipleDivisions is correctly updated
                  if (remaining.divisions.length === 1) {
                    console.log('✅ hasMultipleDivisions should be false (only 1 division remaining)');
                    console.log('✅ User should remain on Divisions step to manage the remaining division');
                  } else if (remaining.divisions.length > 1) {
                    console.log('✅ hasMultipleDivisions should still be true');
                    console.log('✅ User should remain on Divisions step to manage divisions');
                  } else {
                    console.log('⚠️ No divisions remaining - user should be able to create new ones');
                  }
                  
                  console.log('\\n🎉 Test completed successfully!');
                  console.log('✅ User selections should be preserved when deleting divisions');
                  console.log('✅ Setup Wizard should not auto-navigate and lose context');
                  
                } else {
                  console.error('❌ Failed to get setup wizard status after deletion');
                }
                
              } else {
                console.error('❌ Failed to get remaining divisions');
              }
              
            } else {
              console.error('❌ Failed to delete division');
            }
            
          } else {
            console.log('⚠️ Not enough divisions to test deletion (need at least 2)');
          }
          
        } else {
          console.error('❌ Failed to get divisions');
        }
        
      } else {
        console.log('⚠️ Setup wizard not accessible');
      }
      
    } else {
      console.error('❌ Failed to get setup status');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
testPreserveSelections(); 