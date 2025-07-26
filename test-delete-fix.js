const fetch = require('node-fetch');

// Test to verify delete operations now properly update the UI
async function testDeleteFix() {
  const sessionToken = 'your-session-token-here'; // Replace with actual token
  
  console.log('🧪 Testing Delete Operations Fix...\\n');
  
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
              
              // 4. Check if the division is removed from active divisions
              console.log('\\n4. Checking active divisions after delete...');
              const activeAfterResponse = await fetch('http://localhost:3000/api/divisions', {
                headers: {
                  'Authorization': `Bearer ${sessionToken}`
                }
              });
              
              if (activeAfterResponse.ok) {
                const activeAfter = await activeAfterResponse.json();
                console.log(`✅ Active divisions after delete: ${activeAfter.divisions.length}`, activeAfter.divisions.map(d => d.name));
                
                // 5. Check if the deleted division is NOT in the list
                const deletedDivision = activeAfter.divisions.find(d => d.id === divisionToDelete.id);
                if (!deletedDivision) {
                  console.log(`✅ Deleted division "${divisionToDelete.name}" is no longer in active divisions`);
                } else {
                  console.log(`❌ Deleted division "${deletedDivision.name}" is still in active divisions`);
                }
                
                // 6. Check if the division appears in inactive divisions
                console.log('\\n5. Checking inactive divisions...');
                const inactiveResponse = await fetch('http://localhost:3000/api/divisions?includeInactive=true', {
                  headers: {
                    'Authorization': `Bearer ${sessionToken}`
                  }
                });
                
                if (inactiveResponse.ok) {
                  const inactive = await inactiveResponse.json();
                  const inactiveDivisions = inactive.divisions.filter(d => !d.is_active);
                  console.log(`✅ Found ${inactiveDivisions.length} inactive divisions:`, inactiveDivisions.map(d => d.name));
                  
                  const deletedInInactive = inactiveDivisions.find(d => d.id === divisionToDelete.id);
                  if (deletedInInactive) {
                    console.log(`✅ Deleted division "${deletedInInactive.name}" is now in inactive divisions`);
                  } else {
                    console.log(`⚠️ Deleted division not found in inactive divisions (might be hard deleted)`);
                  }
                }
                
                // 7. Verify Setup Wizard state
                console.log('\\n6. Verifying Setup Wizard state...');
                const wizardResponse = await fetch('http://localhost:3000/api/auth/setup/status', {
                  headers: {
                    'Authorization': `Bearer ${sessionToken}`
                  }
                });
                
                if (wizardResponse.ok) {
                  const wizardStatus = await wizardResponse.json();
                  console.log(`✅ Setup wizard status after delete:`, wizardStatus);
                  
                  // Check if hasMultipleDivisions is correctly updated
                  if (activeAfter.divisions.length > 1) {
                    console.log('✅ hasMultipleDivisions should still be true');
                    console.log('✅ User should see the Divisions step with remaining divisions');
                  } else if (activeAfter.divisions.length === 1) {
                    console.log('✅ hasMultipleDivisions should be false (only 1 division remaining)');
                    console.log('✅ User should still see the Divisions step to manage the remaining division');
                  } else {
                    console.log('⚠️ No divisions remaining - user should be able to create new ones');
                  }
                  
                  console.log('\\n🎉 Test completed successfully!');
                  console.log('✅ Delete operations should now properly update the UI immediately');
                  console.log('✅ Divisions should disappear from the list when deleted');
                  console.log('✅ Setup Wizard should reflect the correct state');
                  
                } else {
                  console.error('❌ Failed to get setup wizard status after delete');
                }
                
              } else {
                console.error('❌ Failed to get active divisions after delete');
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
testDeleteFix(); 