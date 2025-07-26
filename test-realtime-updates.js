const fetch = require('node-fetch');

// Test real-time updates for divisions and clusters
async function testRealtimeUpdates() {
  const sessionToken = 'your-session-token-here'; // Replace with actual token
  
  console.log('🧪 Testing Real-Time Updates...\n');
  
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
          console.log(`✅ Soft delete result:`, deleteResult);
          
          // 3. Verify division is now inactive
          console.log('\n3. Checking inactive divisions...');
          const inactiveResponse = await fetch('http://localhost:3000/api/divisions/inactive', {
            headers: {
              'Authorization': `Bearer ${sessionToken}`
            }
          });
          
          if (inactiveResponse.ok) {
            const inactiveDivisions = await inactiveResponse.json();
            const foundInactive = inactiveDivisions.divisions.find(d => d.id === testDivision.id);
            console.log(`✅ Found division in inactive list: ${foundInactive ? 'YES' : 'NO'}`);
            
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
                
                // 5. Verify division is back in active list
                console.log('\n5. Verifying division is back in active list...');
                const finalResponse = await fetch('http://localhost:3000/api/divisions', {
                  headers: {
                    'Authorization': `Bearer ${sessionToken}`
                  }
                });
                
                if (finalResponse.ok) {
                  const finalDivisions = await finalResponse.json();
                  const foundActive = finalDivisions.find(d => d.id === testDivision.id);
                  console.log(`✅ Found division back in active list: ${foundActive ? 'YES' : 'NO'}`);
                }
              }
            }
          }
        }
      }
    }
    
    // 6. Test clusters (similar flow)
    console.log('\n6. Testing clusters...');
    const clustersResponse = await fetch('http://localhost:3000/api/clusters', {
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      }
    });
    
    if (clustersResponse.ok) {
      const clusters = await clustersResponse.json();
      console.log(`✅ Found ${clusters.length} clusters`);
      
      if (clusters.length > 0) {
        const testCluster = clusters[0];
        console.log(`   Testing with cluster: ${testCluster.name} (ID: ${testCluster.id})`);
        
        // Test soft delete for cluster
        const clusterDeleteResponse = await fetch(`http://localhost:3000/api/clusters/${testCluster.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
        
        if (clusterDeleteResponse.ok) {
          const clusterDeleteResult = await clusterDeleteResponse.json();
          console.log(`✅ Cluster soft delete result:`, clusterDeleteResult);
          
          // Test restore for cluster
          const clusterRestoreResponse = await fetch(`http://localhost:3000/api/clusters/${testCluster.id}/restore`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${sessionToken}`
            }
          });
          
          if (clusterRestoreResponse.ok) {
            const clusterRestoreResult = await clusterRestoreResponse.json();
            console.log(`✅ Cluster restore result:`, clusterRestoreResult);
          }
        }
      }
    }
    
    console.log('\n🎉 Real-time updates test completed!');
    
  } catch (error) {
    console.error('❌ Error testing real-time updates:', error);
  }
}

// Run the test
testRealtimeUpdates(); 