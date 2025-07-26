import fetch from 'node-fetch';

async function testCsvEndpoints() {
  console.log('🧪 Testing CSV division and cluster creation endpoints...');
  
  try {
    // First, login to get a session token
    const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'company_admin@acme.com',
        password: 'password123'
      })
    });
    
    if (!loginResponse.ok) {
      const error = await loginResponse.json();
      throw new Error(`Login failed: ${error.error}`);
    }
    
    const loginData = await loginResponse.json();
    const sessionToken = loginData.sessionToken;
    console.log('✅ Login successful');
    console.log('User ID:', loginData.user.id);
    console.log('Company ID:', loginData.user.company_id);
    
    // Test creating divisions from CSV
    console.log('\n🔄 Testing division creation...');
    const divisionResponse = await fetch('http://localhost:3001/api/setup/csv/create-divisions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        companyId: loginData.user.company_id,
        divisionNames: ['Test Division 1', 'Test Division 2', 'Test Division 3']
      })
    });
    
    if (divisionResponse.ok) {
      const divisionResult = await divisionResponse.json();
      console.log('✅ Divisions created:', divisionResult);
    } else {
      const error = await divisionResponse.json();
      console.error('❌ Division creation failed:', error);
    }
    
    // Test creating clusters from CSV
    console.log('\n🔄 Testing cluster creation...');
    const clusterResponse = await fetch('http://localhost:3001/api/setup/csv/create-clusters', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        companyId: loginData.user.company_id,
        divisionNames: ['Test Division 1', 'Test Division 2', 'Test Division 3'],
        clusterNames: ['Test Cluster 1', 'Test Cluster 2']
      })
    });
    
    if (clusterResponse.ok) {
      const clusterResult = await clusterResponse.json();
      console.log('✅ Clusters created:', clusterResult);
    } else {
      const error = await clusterResponse.json();
      console.error('❌ Cluster creation failed:', error);
    }
    
    // Check what divisions and clusters exist now
    console.log('\n🔄 Checking existing divisions and clusters...');
    const divisionsResponse = await fetch(`http://localhost:3001/api/setup/divisions?companyId=${loginData.user.company_id}`, {
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      }
    });
    
    if (divisionsResponse.ok) {
      const divisions = await divisionsResponse.json();
      console.log('📋 Existing divisions:', divisions);
    } else {
      console.error('❌ Failed to fetch divisions');
    }
    
    const clustersResponse = await fetch(`http://localhost:3001/api/setup/clusters?companyId=${loginData.user.company_id}`, {
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      }
    });
    
    if (clustersResponse.ok) {
      const clusters = await clustersResponse.json();
      console.log('📋 Existing clusters:', clusters);
    } else {
      console.error('❌ Failed to fetch clusters');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testCsvEndpoints(); 