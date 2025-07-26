const fetch = require('node-fetch');

// Test configuration
const BASE_URL = 'http://localhost:3001';
const TEST_TOKEN = 'your-test-token-here'; // Replace with actual test token

async function testSoftDelete() {
  console.log('🧪 Testing Soft Delete Functionality\n');

  try {
    // Test 1: Get active divisions
    console.log('1. Fetching active divisions...');
    const activeDivisionsResponse = await fetch(`${BASE_URL}/api/divisions`, {
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });
    
    if (!activeDivisionsResponse.ok) {
      throw new Error(`Failed to fetch active divisions: ${activeDivisionsResponse.status}`);
    }
    
    const activeDivisions = await activeDivisionsResponse.json();
    console.log(`✅ Found ${activeDivisions.divisions.length} active divisions`);
    
    if (activeDivisions.divisions.length === 0) {
      console.log('⚠️  No active divisions found. Please create some divisions first.');
      return;
    }

    // Test 2: Check division usage
    const testDivision = activeDivisions.divisions[0];
    console.log(`\n2. Checking usage for division: ${testDivision.name} (ID: ${testDivision.id})`);
    
    const usageResponse = await fetch(`${BASE_URL}/api/divisions/${testDivision.id}/usage`, {
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });
    
    if (!usageResponse.ok) {
      throw new Error(`Failed to check division usage: ${usageResponse.status}`);
    }
    
    const usage = await usageResponse.json();
    console.log(`✅ Usage data:`, usage.usage);

    // Test 3: Attempt soft delete
    console.log(`\n3. Attempting to soft delete division: ${testDivision.name}`);
    
    const deleteResponse = await fetch(`${BASE_URL}/api/divisions/${testDivision.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });
    
    const deleteResult = await deleteResponse.json();
    
    if (deleteResponse.ok && deleteResult.success) {
      console.log(`✅ Division soft deleted successfully (${deleteResult.method} delete)`);
      console.log(`📝 Message: ${deleteResult.message}`);
    } else {
      console.log(`⚠️  Delete response:`, deleteResult);
      
      if (deleteResult.error === 'Division is in use') {
        console.log('📊 Associated data found:');
        console.log(`   - Datasets: ${deleteResult.details.datasetCount}`);
        console.log(`   - Clusters: ${deleteResult.details.clusterCount}`);
        console.log(`   - S&OP Cycles: ${deleteResult.details.sopCount}`);
        console.log(`   - Total: ${deleteResult.details.totalCount}`);
        
        // Test 4: Force hard delete
        console.log(`\n4. Attempting force hard delete...`);
        const hardDeleteResponse = await fetch(`${BASE_URL}/api/divisions/${testDivision.id}`, {
          method: 'DELETE',
          headers: { 
            'Authorization': `Bearer ${TEST_TOKEN}`,
            'X-Force-Hard-Delete': 'true'
          }
        });
        
        const hardDeleteResult = await hardDeleteResponse.json();
        
        if (hardDeleteResponse.ok && hardDeleteResult.success) {
          console.log(`✅ Division hard deleted successfully`);
          console.log(`📝 Message: ${hardDeleteResult.message}`);
        } else {
          console.log(`❌ Hard delete failed:`, hardDeleteResult);
        }
      }
    }

    // Test 5: Get inactive divisions
    console.log('\n5. Fetching inactive divisions...');
    const inactiveDivisionsResponse = await fetch(`${BASE_URL}/api/divisions/inactive`, {
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });
    
    if (inactiveDivisionsResponse.ok) {
      const inactiveDivisions = await inactiveDivisionsResponse.json();
      console.log(`✅ Found ${inactiveDivisions.divisions.length} inactive divisions`);
      
      if (inactiveDivisions.divisions.length > 0) {
        const inactiveDivision = inactiveDivisions.divisions[0];
        console.log(`📋 Sample inactive division: ${inactiveDivision.name}`);
        console.log(`   Deleted at: ${inactiveDivision.deleted_at}`);
        console.log(`   Deleted by: ${inactiveDivision.deleted_by_username || 'Unknown'}`);
        
        // Test 6: Restore division
        console.log(`\n6. Attempting to restore division: ${inactiveDivision.name}`);
        const restoreResponse = await fetch(`${BASE_URL}/api/divisions/${inactiveDivision.id}/restore`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
        });
        
        const restoreResult = await restoreResponse.json();
        
        if (restoreResponse.ok && restoreResult.success) {
          console.log(`✅ Division restored successfully`);
          console.log(`📝 Message: ${restoreResult.message}`);
        } else {
          console.log(`❌ Restore failed:`, restoreResult);
        }
      }
    }

    // Test 7: Test clusters (similar flow)
    console.log('\n7. Testing cluster soft delete...');
    const activeClustersResponse = await fetch(`${BASE_URL}/api/clusters`, {
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });
    
    if (activeClustersResponse.ok) {
      const activeClusters = await activeClustersResponse.json();
      console.log(`✅ Found ${activeClusters.clusters.length} active clusters`);
      
      if (activeClusters.clusters.length > 0) {
        const testCluster = activeClusters.clusters[0];
        console.log(`📋 Testing with cluster: ${testCluster.name} (ID: ${testCluster.id})`);
        
        // Check cluster usage
        const clusterUsageResponse = await fetch(`${BASE_URL}/api/clusters/${testCluster.id}/usage`, {
          headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
        });
        
        if (clusterUsageResponse.ok) {
          const clusterUsage = await clusterUsageResponse.json();
          console.log(`✅ Cluster usage:`, clusterUsage.usage);
        }
      }
    }

    console.log('\n🎉 Soft delete functionality test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Helper function to create test data
async function createTestData() {
  console.log('🔧 Creating test data...');
  
  try {
    // Create a test division
    const createDivisionResponse = await fetch(`${BASE_URL}/api/divisions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Test Division - Soft Delete',
        description: 'Test division for soft delete functionality',
        industry: 'Technology',
        fieldMapping: 'test_division'
      })
    });
    
    if (createDivisionResponse.ok) {
      const division = await createDivisionResponse.json();
      console.log(`✅ Created test division: ${division.name}`);
      return division.id;
    }
  } catch (error) {
    console.error('❌ Failed to create test data:', error.message);
  }
  
  return null;
}

// Run the test
if (require.main === module) {
  console.log('🚀 Starting Soft Delete Test Suite\n');
  
  // Uncomment the line below to create test data first
  // createTestData().then(() => testSoftDelete());
  
  // Or run the test directly
  testSoftDelete();
}

module.exports = { testSoftDelete, createTestData }; 
 
 
 
 
 
 
 
 
 