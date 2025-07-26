const fetch = require('node-fetch');

// Test to verify selections being lost after restore operations
async function testRestoreSelectionsIssue() {
  const sessionToken = 'your-session-token-here'; // Replace with actual token
  
  console.log('🧪 Testing Restore Selections Issue...\\n');
  
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
          
          // 3. Get inactive divisions
          console.log('\\n3. Getting inactive divisions...');
          const inactiveResponse = await fetch('http://localhost:3000/api/divisions?includeInactive=true', {
            headers: {
              'Authorization': `Bearer ${sessionToken}`
            }
          });
          
          if (inactiveResponse.ok) {
            const inactive = await inactiveResponse.json();
            const inactiveDivisions = inactive.divisions.filter(d => !d.is_active);
            console.log(`✅ Found ${inactiveDivisions.length} inactive divisions:`, inactiveDivisions.map(d => d.name));
            
            if (inactiveDivisions.length > 0) {
              const divisionToRestore = inactiveDivisions[0];
              console.log(`\\n4. Testing restore of division: "${divisionToRestore.name}"`);
              
              // 4. Restore a division
              const restoreResponse = await fetch(`http://localhost:3000/api/divisions/${divisionToRestore.id}/restore`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${sessionToken}`
                }
              });
              
              if (restoreResponse.ok) {
                const restoreResult = await restoreResponse.json();
                console.log(`✅ Division restored successfully:`, restoreResult);
                
                // 5. Check if the division appears in active divisions
                console.log('\\n5. Checking active divisions after restore...');
                const activeAfterResponse = await fetch('http://localhost:3000/api/divisions', {
                  headers: {
                    'Authorization': `Bearer ${sessionToken}`
                  }
                });
                
                if (activeAfterResponse.ok) {
                  const activeAfter = await activeAfterResponse.json();
                  console.log(`✅ Active divisions after restore: ${activeAfter.divisions.length}`, activeAfter.divisions.map(d => d.name));
                  
                  // 6. Check if the restored division is in the list
                  const restoredDivision = activeAfter.divisions.find(d => d.id === divisionToRestore.id);
                  if (restoredDivision) {
                    console.log(`✅ Restored division "${restoredDivision.name}" is now active`);
                  } else {
                    console.log(`❌ Restored division not found in active divisions`);
                  }
                  
                  // 7. Verify Setup Wizard state
                  console.log('\\n7. Verifying Setup Wizard state...');
                  const wizardResponse = await fetch('http://localhost:3000/api/auth/setup/status', {
                    headers: {
                      'Authorization': `Bearer ${sessionToken}`
                    }
                  });
                  
                  if (wizardResponse.ok) {
                    const wizardStatus = await wizardResponse.json();
                    console.log(`✅ Setup wizard status after restore:`, wizardStatus);
                    
                    // Check if hasMultipleDivisions is correctly updated
                    if (activeAfter.divisions.length > 1) {
                      console.log('✅ hasMultipleDivisions should be true (multiple divisions)');
                      console.log('✅ User should see the Divisions step with all divisions listed');
                    } else {
                      console.log('⚠️ Only 1 division - hasMultipleDivisions should be false');
                      console.log('⚠️ User should still see the Divisions step to manage the single division');
                    }
                    
                    console.log('\\n🎯 Expected Behavior:');
                    console.log('- Divisions step should be visible (not blank)');
                    console.log('- Restored division should appear in the list');
                    console.log('- User should remain on the same step');
                    console.log('- Previous selections in Organization Structure should be preserved');
                    
                    console.log('\\n🔍 If the screen is blank, the issue is:');
                    console.log('- The component is returning null due to hasMultipleDivisions being false');
                    console.log('- The restore operation is not properly updating the state');
                    console.log('- The loadAllData function is overwriting user selections');
                    
                  } else {
                    console.error('❌ Failed to get setup wizard status after restore');
                  }
                  
                } else {
                  console.error('❌ Failed to get active divisions after restore');
                }
                
              } else {
                console.error('❌ Failed to restore division');
              }
              
            } else {
              console.log('⚠️ No inactive divisions to restore');
            }
            
          } else {
            console.error('❌ Failed to get inactive divisions');
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
testRestoreSelectionsIssue(); 