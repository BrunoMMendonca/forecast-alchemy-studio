import fetch from 'node-fetch';

// Test the API endpoints that the setup wizard calls
async function testAPIEndpoints() {
  const baseUrl = 'http://localhost:3001';
  
  try {
    console.log('Testing API endpoints...\n');
    
    // Test 1: Get company info (this is what the setup wizard calls first)
    console.log('1. Testing /api/auth/company...');
    const companyResponse = await fetch(`${baseUrl}/api/auth/company`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Note: This will fail without a valid token, but let's see the error
      }
    });
    
    console.log('Company response status:', companyResponse.status);
    const companyData = await companyResponse.text();
    console.log('Company response:', companyData);
    
    // Test 2: Get divisions for company 49
    console.log('\n2. Testing /api/divisions?companyId=49...');
    const divisionsResponse = await fetch(`${baseUrl}/api/divisions?companyId=49`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Divisions response status:', divisionsResponse.status);
    const divisionsData = await divisionsResponse.text();
    console.log('Divisions response:', divisionsData);
    
    // Test 3: Get clusters for company 49
    console.log('\n3. Testing /api/clusters?companyId=49...');
    const clustersResponse = await fetch(`${baseUrl}/api/clusters?companyId=49`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Clusters response status:', clustersResponse.status);
    const clustersData = await clustersResponse.text();
    console.log('Clusters response:', clustersData);
    
    // Test 4: Get setup status
    console.log('\n4. Testing /api/setup/status?companyId=49...');
    const setupStatusResponse = await fetch(`${baseUrl}/api/setup/status?companyId=49`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Setup status response status:', setupStatusResponse.status);
    const setupStatusData = await setupStatusResponse.text();
    console.log('Setup status response:', setupStatusData);
    
  } catch (error) {
    console.error('Error testing API endpoints:', error);
  }
}

testAPIEndpoints(); 