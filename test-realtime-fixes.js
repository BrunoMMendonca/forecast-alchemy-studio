const fetch = require('node-fetch');

// Test real-time updates for divisions and clusters
async function testRealtimeFixes() {
  const sessionToken = 'your-session-token-here'; // Replace with actual token
  
  console.log('🧪 Testing Real-Time Update Fixes...\n');
  
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
          console.log(`✅ Division soft deleted: ${deleteResult.message}`);
          
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
            if (foundInactive) {
              console.log(`✅ Division found in inactive list: ${foundInactive.name}`);
            } else {
              console.log('❌ Division not found in inactive list');
            }
          }
          
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
            console.log(`✅ Division restored: ${restoreResult.message}`);
            
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
              if (foundActive) {
                console.log(`✅ Division found in active list: ${foundActive.name}`);
              } else {
                console.log('❌ Division not found in active list');
              }
            }
          } else {
            console.log('❌ Restore failed:', await restoreResponse.text());
          }
        } else {
          console.log('❌ Delete failed:', await deleteResponse.text());
        }
      } else {
        console.log('⚠️  No divisions found to test with');
      }
    } else {
      console.log('❌ Failed to fetch divisions:', await divisionsResponse.text());
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
        
        // Test soft delete and restore for clusters
        console.log('\n7. Testing cluster soft delete and restore...');
        
        // Delete
        const clusterDeleteResponse = await fetch(`http://localhost:3000/api/clusters/${testCluster.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
        
        if (clusterDeleteResponse.ok) {
          console.log('✅ Cluster soft deleted');
          
          // Restore
          const clusterRestoreResponse = await fetch(`http://localhost:3000/api/clusters/${testCluster.id}/restore`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${sessionToken}`
            }
          });
          
          if (clusterRestoreResponse.ok) {
            console.log('✅ Cluster restored');
          } else {
            console.log('❌ Cluster restore failed:', await clusterRestoreResponse.text());
          }
        } else {
          console.log('❌ Cluster delete failed:', await clusterDeleteResponse.text());
        }
      } else {
        console.log('⚠️  No clusters found to test with');
      }
    } else {
      console.log('❌ Failed to fetch clusters:', await clustersResponse.text());
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
  
  console.log('\n🎉 Real-time update fixes test completed!');
}

// Run the test
testRealtimeFixes(); 