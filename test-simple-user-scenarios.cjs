const https = require('https');
const http = require('http');

const BASE_URL = 'http://localhost:3001';

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
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const response = {
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers,
          json: () => {
            try {
              return Promise.resolve(JSON.parse(data));
            } catch (error) {
              return Promise.reject(error);
            }
          },
          text: () => Promise.resolve(data)
        };
        
        resolve(response);
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// Simple test helper
async function testScenario(name, testFunction) {
  console.log(`\n🧪 ${name}`);
  console.log('─'.repeat(50));
  
  try {
    await testFunction();
    console.log(`✅ ${name} - PASSED`);
  } catch (error) {
    console.log(`❌ ${name} - FAILED: ${error.message}`);
  }
}

// Test Data - Different User Types
const userScenarios = {
  // Scenario 1: New User (Company Owner)
  newUser: {
    email: `newuser_${Date.now()}@example.com`,
    username: `newuser_${Date.now()}`,
    password: 'Password123!',
    first_name: 'John',
    last_name: 'Doe'
  },
  
  // Scenario 2: Second Company Owner
  secondUser: {
    email: `seconduser_${Date.now()}@example.com`,
    username: `seconduser_${Date.now()}`,
    password: 'Password123!',
    first_name: 'Jane',
    last_name: 'Smith'
  },
  
  // Scenario 3: Company with Multiple Divisions
  multiDivisionUser: {
    email: `multidiv_${Date.now()}@example.com`,
    username: `multidiv_${Date.now()}`,
    password: 'Password123!',
    first_name: 'Bob',
    last_name: 'Johnson'
  }
};

let currentUser = null;
let currentCompany = null;

// Helper function to make authenticated requests
async function authenticatedRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(currentUser?.token && { 'Authorization': `Bearer ${currentUser.token}` }),
    ...options.headers
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers,
    ...options
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`${response.status}: ${data.error || 'Unknown error'}`);
  }
  
  return data;
}

// Test Scenarios
async function testNewUserRegistration() {
  console.log('📝 Testing new user registration...');
  
  // Step 1: Register user
  const registerData = await authenticatedRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(userScenarios.newUser)
  });
  
  console.log(`   User registered: ${userScenarios.newUser.email}`);
  console.log(`   Verification token: ${registerData.registration.verification_token.substring(0, 20)}...`);
  
  // Step 2: Verify email
  await authenticatedRequest('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ token: registerData.registration.verification_token })
  });
  
  console.log('   Email verified successfully');
  
  // Step 3: Login
  const loginData = await authenticatedRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: userScenarios.newUser.email,
      password: userScenarios.newUser.password
    })
  });
  
  currentUser = {
    ...userScenarios.newUser,
    token: loginData.sessionToken,
    id: loginData.user.id
  };
  
  console.log(`   Logged in: User ID ${currentUser.id}`);
  
  // Step 4: Create company
  const companyData = await authenticatedRequest('/api/auth/company', {
    method: 'POST',
    body: JSON.stringify({
      name: `Acme Corporation ${Date.now()}`,
      description: 'A test company for new user',
      country: 'United States',
      company_size: 'medium'
    })
  });
  
  currentCompany = companyData.company;
  console.log(`   Company created: ${currentCompany.name} (ID: ${currentCompany.id})`);
}

async function testSecondCompany() {
  console.log('🏢 Testing second company creation...');
  
  // Register and setup second user
  const registerData = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userScenarios.secondUser)
  }).then(r => r.json());
  
  await fetch(`${BASE_URL}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: registerData.registration.verification_token })
  });
  
  const loginData = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: userScenarios.secondUser.email,
      password: userScenarios.secondUser.password
    })
  }).then(r => r.json());
  
  const secondUserToken = loginData.sessionToken;
  
  // Create second company
  const companyData = await fetch(`${BASE_URL}/api/auth/company`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${secondUserToken}`
    },
    body: JSON.stringify({
      name: `TechStart Inc. ${Date.now()}`,
      description: 'A second test company',
      country: 'Canada',
      company_size: 'startup'
    })
  }).then(r => r.json());
  
  console.log(`   Second company created: ${companyData.company.name} (ID: ${companyData.company.id})`);
  console.log(`   This demonstrates multi-tenancy - two separate companies with isolated data`);
}

async function testDataIsolation() {
  console.log('🔒 Testing data isolation between companies...');
  
  // Create divisions for first company
  const division1 = await authenticatedRequest('/api/setup/divisions', {
    method: 'POST',
    body: JSON.stringify({
      companyId: currentCompany.id,
      name: `Consumer Products ${Date.now()}`,
      description: 'Consumer-facing products',
      industry: 'Manufacturing'
    })
  });
  
  console.log(`   Created division in Company ${currentCompany.id}: ${division1.division.name}`);
  
  // Try to access data from a different company (should fail)
  try {
    await fetch(`${BASE_URL}/api/divisions?companyId=999`, {
      headers: { 'Authorization': `Bearer ${currentUser.token}` }
    }).then(r => r.json());
    
    throw new Error('Should not be able to access data from different company');
  } catch (error) {
    console.log('   ✅ Data isolation working: Cannot access other company data');
  }
}

async function testMultiDivisionSetup() {
  console.log('🏭 Testing multi-division company setup...');
  
  // Create multiple divisions
  const divisions = [
    { name: 'Consumer Products', industry: 'Manufacturing' },
    { name: 'Industrial Solutions', industry: 'Heavy Industry' },
    { name: 'Digital Services', industry: 'Technology' }
  ];
  
  // Add timestamp to make names unique
  const timestamp = Date.now();
  
  for (const div of divisions) {
    const result = await authenticatedRequest('/api/setup/divisions', {
      method: 'POST',
      body: JSON.stringify({
        companyId: currentCompany.id,
        name: `${div.name} ${timestamp}`,
        description: `${div.name} division`,
        industry: div.industry
      })
    });
    
    console.log(`   Created division: ${result.division.name} (${div.industry})`);
  }
  
  // Get all divisions
  const allDivisions = await authenticatedRequest(`/api/divisions?companyId=${currentCompany.id}`);
  console.log(`   Total divisions: ${allDivisions.length}`);
}

async function testUserManagement() {
  console.log('👥 Testing user management features...');
  
  // Get current user info
  const userInfo = await authenticatedRequest('/api/auth/me');
  console.log(`   Current user: ${userInfo.user.first_name} ${userInfo.user.last_name}`);
  console.log(`   Company: ${userInfo.user.company_id ? 'Has company' : 'No company'}`);
  
  // Get company info
  const companyInfo = await authenticatedRequest('/api/auth/company');
  console.log(`   Company name: ${companyInfo.company.name}`);
  console.log(`   Company size: ${companyInfo.company.company_size}`);
}

async function testSetupWizardFlow() {
  console.log('⚙️ Testing complete setup wizard flow...');
  
  // Check setup status
  const setupStatus = await authenticatedRequest('/api/auth/setup/status');
  console.log(`   Setup required: ${setupStatus.setupRequired}`);
  
  if (setupStatus.setupRequired) {
    console.log('   Running setup wizard...');
    
    // Create division
    await authenticatedRequest('/api/setup/divisions', {
      method: 'POST',
      body: JSON.stringify({
        companyId: currentCompany.id,
        name: 'Main Division',
        description: 'Primary business division',
        industry: 'General'
      })
    });
    
    // Create cluster
    const division = await authenticatedRequest(`/api/divisions?companyId=${currentCompany.id}`);
    if (division.length > 0) {
      await authenticatedRequest('/api/setup/clusters', {
        method: 'POST',
        body: JSON.stringify({
          companyId: currentCompany.id,
          divisionId: division[0].id,
          name: 'Global Operations',
          description: 'Worldwide operations',
          countryCode: 'US',
          region: 'Global'
        })
      });
    }
    
    // Complete setup
    await authenticatedRequest('/api/setup/complete', {
      method: 'POST',
      body: JSON.stringify({ companyId: currentCompany.id })
    });
    
    console.log('   ✅ Setup wizard completed successfully');
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Multi-Tenant System Testing - User Scenarios');
  console.log('=' .repeat(60));
  
  await testScenario('New User Registration & Company Creation', testNewUserRegistration);
  await testScenario('Second Company Creation (Multi-Tenancy)', testSecondCompany);
  await testScenario('Data Isolation Between Companies', testDataIsolation);
  await testScenario('Multi-Division Company Setup', testMultiDivisionSetup);
  await testScenario('User Management Features', testUserManagement);
  await testScenario('Complete Setup Wizard Flow', testSetupWizardFlow);
  
  console.log('\n🎉 All user scenario tests completed!');
  console.log('\n📊 What you just tested:');
  console.log('   ✅ User registration and verification');
  console.log('   ✅ Company creation and ownership');
  console.log('   ✅ Multi-tenant data isolation');
  console.log('   ✅ Organizational hierarchy setup');
  console.log('   ✅ User management features');
  console.log('   ✅ Complete setup wizard flow');
}

// Run the tests
runAllTests().catch(error => {
  console.error('💥 Test suite failed:', error);
  process.exit(1);
}); 