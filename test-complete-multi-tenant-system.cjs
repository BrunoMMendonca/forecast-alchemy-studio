const https = require('https');
const http = require('http');

// Simple fetch implementation for Node.js
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const response = {
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers,
          json: () => {
            try { return Promise.resolve(JSON.parse(data)); }
            catch (error) { return Promise.reject(error); }
          },
          text: () => Promise.resolve(data)
        };
        resolve(response);
      });
    });

    req.on('error', (error) => { reject(error); });
    if (options.body) { req.write(options.body); }
    req.end();
  });
}

const BASE_URL = 'http://localhost:3001';

// Test data
const testUser = {
  email: `testuser_${Date.now()}@example.com`,
  username: `testuser_${Date.now()}`,
  password: 'TestPassword123!',
  first_name: 'Test',
  last_name: 'User'
};

const testCompany = {
  name: 'Test Company Inc.',
  description: 'A test company for multi-tenant system validation',
  country: 'United States',
  website: 'https://testcompany.com',
  phone: '+1-555-123-4567',
  company_size: 'medium',
  currency: 'USD'
};

let sessionToken = null;
let refreshToken = null;
let userId = null;
let companyId = null;

async function testEndpoint(endpoint, options = {}, description) {
  console.log(`\n🧪 Testing: ${description}`);
  console.log(`   Endpoint: ${endpoint}`);
  
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken && { 'Authorization': `Bearer ${sessionToken}` }),
        ...options.headers
      },
      ...options
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log(`   ✅ Success: ${response.status}`);
      if (data.success) {
        console.log(`   📊 Response: ${JSON.stringify(data, null, 2)}`);
      }
      return { success: true, data };
    } else {
      console.log(`   ❌ Failed: ${response.status} - ${data.error || 'Unknown error'}`);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.log(`   💥 Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Starting Multi-Tenant System Test Suite');
  console.log('=' .repeat(60));

  // Test 1: User Registration
  console.log('\n📝 Test 1: User Registration');
  const registrationResult = await testEndpoint('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(testUser)
  }, 'User Registration');

  if (!registrationResult.success) {
    console.log('❌ Registration failed, stopping tests');
    return;
  }

  // Test 2: Email Verification
  console.log('\n📧 Test 2: Email Verification');
  const verificationToken = registrationResult.data.registration.verification_token;
  const verificationResult = await testEndpoint('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ token: verificationToken })
  }, 'Email Verification');

  if (!verificationResult.success) {
    console.log('❌ Verification failed, stopping tests');
    return;
  }

  // Test 3: User Login
  console.log('\n🔐 Test 3: User Login');
  const loginResult = await testEndpoint('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: testUser.email,
      password: testUser.password
    })
  }, 'User Login');

  if (!loginResult.success) {
    console.log('❌ Login failed, stopping tests');
    return;
  }

  sessionToken = loginResult.data.sessionToken;
  refreshToken = loginResult.data.refreshToken;
  userId = loginResult.data.user.id;

  console.log(`   🔑 Session Token: ${sessionToken.substring(0, 20)}...`);
  console.log(`   👤 User ID: ${userId}`);

  // Test 4: Get Current User
  console.log('\n👤 Test 4: Get Current User');
  const meResult = await testEndpoint('/api/auth/me', {}, 'Get Current User');

  if (!meResult.success) {
    console.log('❌ Get current user failed');
    return;
  }

  // Test 5: Create Company
  console.log('\n🏢 Test 5: Create Company');
  const companyResult = await testEndpoint('/api/auth/company', {
    method: 'POST',
    body: JSON.stringify(testCompany)
  }, 'Create Company');

  if (!companyResult.success) {
    console.log('❌ Company creation failed');
    return;
  }

  companyId = companyResult.data.company.id;
  console.log(`   🏢 Company ID: ${companyId}`);

  // Test 6: Get User's Company
  console.log('\n🏢 Test 6: Get User\'s Company');
  const getCompanyResult = await testEndpoint('/api/auth/company', {}, 'Get User\'s Company');

  if (!getCompanyResult.success) {
    console.log('❌ Get company failed');
    return;
  }

  // Test 7: Check Setup Status
  console.log('\n⚙️ Test 7: Check Setup Status');
  const setupStatusResult = await testEndpoint(`/api/auth/setup/status`, {}, 'Check Setup Status');

  if (!setupStatusResult.success) {
    console.log('❌ Setup status check failed');
    return;
  }

  // Test 8: Create Division
  console.log('\n🏭 Test 8: Create Division');
  const divisionResult = await testEndpoint('/api/setup/divisions', {
    method: 'POST',
    body: JSON.stringify({
      companyId: companyId,
      name: 'Consumer Products Division',
      description: 'Handles consumer-facing products',
      industry: 'Manufacturing'
    })
  }, 'Create Division');

  if (!divisionResult.success) {
    console.log('❌ Division creation failed');
    return;
  }

  const divisionId = divisionResult.data.division.id;
  console.log(`   🏭 Division ID: ${divisionId}`);

  // Test 9: Create Cluster
  console.log('\n🌍 Test 9: Create Cluster');
  const clusterResult = await testEndpoint('/api/setup/clusters', {
    method: 'POST',
    body: JSON.stringify({
      companyId: companyId,
      divisionId: divisionId,
      name: 'North America Cluster',
      description: 'North American operations',
      countryCode: 'US',
      region: 'North America'
    })
  }, 'Create Cluster');

  if (!clusterResult.success) {
    console.log('❌ Cluster creation failed');
    return;
  }

  const clusterId = clusterResult.data.cluster.id;
  console.log(`   🌍 Cluster ID: ${clusterId}`);

  // Test 10: Create S&OP Cycle
  console.log('\n📅 Test 10: Create S&OP Cycle');
  const sopCycleResult = await testEndpoint('/api/setup/sop-cycles', {
    method: 'POST',
    body: JSON.stringify({
      companyId: companyId,
      divisionId: divisionId,
      name: 'Q1 2024 Planning Cycle',
      description: 'First quarter 2024 planning cycle',
      startDate: '2024-01-01',
      endDate: '2024-03-31'
    })
  }, 'Create S&OP Cycle');

  if (!sopCycleResult.success) {
    console.log('❌ S&OP cycle creation failed');
    return;
  }

  const sopCycleId = sopCycleResult.data.sopCycle.id;
  console.log(`   📅 S&OP Cycle ID: ${sopCycleId}`);

  // Test 11: Get Divisions
  console.log('\n🏭 Test 11: Get Divisions');
  const getDivisionsResult = await testEndpoint(`/api/divisions?companyId=${companyId}`, {}, 'Get Divisions');

  if (!getDivisionsResult.success) {
    console.log('❌ Get divisions failed');
    return;
  }

  // Test 12: Get Clusters
  console.log('\n🌍 Test 12: Get Clusters');
  const getClustersResult = await testEndpoint(`/api/clusters?companyId=${companyId}`, {}, 'Get Clusters');

  if (!getClustersResult.success) {
    console.log('❌ Get clusters failed');
    return;
  }

  // Test 13: Get S&OP Cycles
  console.log('\n📅 Test 13: Get S&OP Cycles');
  const getSopCyclesResult = await testEndpoint(`/api/sop-cycles?companyId=${companyId}`, {}, 'Get S&OP Cycles');

  if (!getSopCyclesResult.success) {
    console.log('❌ Get S&OP cycles failed');
    return;
  }

  // Test 14: Complete Setup
  console.log('\n✅ Test 14: Complete Setup');
  const completeSetupResult = await testEndpoint('/api/setup/complete', {
    method: 'POST',
    body: JSON.stringify({ companyId: companyId })
  }, 'Complete Setup');

  if (!completeSetupResult.success) {
    console.log('❌ Complete setup failed');
    return;
  }

  // Test 15: Refresh Token
  console.log('\n🔄 Test 15: Refresh Token');
  const refreshResult = await testEndpoint('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: refreshToken })
  }, 'Refresh Token');

  if (!refreshResult.success) {
    console.log('❌ Token refresh failed');
    return;
  }

  // Test 16: Logout
  console.log('\n🚪 Test 16: Logout');
  const logoutResult = await testEndpoint('/api/auth/logout', {
    method: 'POST'
  }, 'Logout');

  if (!logoutResult.success) {
    console.log('❌ Logout failed');
    return;
  }

  console.log('\n🎉 All Tests Completed Successfully!');
  console.log('=' .repeat(60));
  console.log('📊 Test Summary:');
  console.log(`   👤 User ID: ${userId}`);
  console.log(`   🏢 Company ID: ${companyId}`);
  console.log(`   🏭 Division ID: ${divisionId}`);
  console.log(`   🌍 Cluster ID: ${clusterId}`);
  console.log(`   📅 S&OP Cycle ID: ${sopCycleId}`);
  console.log('\n✅ Multi-tenant system is working correctly!');
}

// Run the tests
runTests().catch(error => {
  console.error('💥 Test suite failed:', error);
  process.exit(1);
}); 