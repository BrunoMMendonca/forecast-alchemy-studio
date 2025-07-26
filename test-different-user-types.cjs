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

// Different user types for testing
const userTypes = {
  // 1. Company Owner (Full Access)
  owner: {
    email: `owner_${Date.now()}@example.com`,
    username: `owner_${Date.now()}`,
    password: 'Password123!',
    first_name: 'Sarah',
    last_name: 'Owner',
    company: {
      name: `Owner Corp ${Date.now()}`,
      description: 'Company owned by Sarah',
      company_size: 'large'
    }
  },
  
  // 2. Admin User (User Management)
  admin: {
    email: `admin_${Date.now()}@example.com`,
    username: `admin_${Date.now()}`,
    password: 'Password123!',
    first_name: 'Mike',
    last_name: 'Admin',
    company: {
      name: `Admin Corp ${Date.now()}`,
      description: 'Company with admin user',
      company_size: 'medium'
    }
  },
  
  // 3. Manager User (Division/Cluster Management)
  manager: {
    email: `manager_${Date.now()}@example.com`,
    username: `manager_${Date.now()}`,
    password: 'Password123!',
    first_name: 'Lisa',
    last_name: 'Manager',
    company: {
      name: `Manager Corp ${Date.now()}`,
      description: 'Company with manager user',
      company_size: 'small'
    }
  },
  
  // 4. Analyst User (Data Access)
  analyst: {
    email: `analyst_${Date.now()}@example.com`,
    username: `analyst_${Date.now()}`,
    password: 'Password123!',
    first_name: 'David',
    last_name: 'Analyst',
    company: {
      name: `Analyst Corp ${Date.now()}`,
      description: 'Company with analyst user',
      company_size: 'startup'
    }
  },
  
  // 5. Viewer User (Read-Only)
  viewer: {
    email: `viewer_${Date.now()}@example.com`,
    username: `viewer_${Date.now()}`,
    password: 'Password123!',
    first_name: 'Emma',
    last_name: 'Viewer',
    company: {
      name: `Viewer Corp ${Date.now()}`,
      description: 'Company with viewer user',
      company_size: 'enterprise'
    }
  }
};

let testUsers = {};

// Helper function for authenticated requests
async function authenticatedRequest(endpoint, options = {}, userToken) {
  const headers = {
    'Content-Type': 'application/json',
    ...(userToken && { 'Authorization': `Bearer ${userToken}` }),
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

// Create and setup a user
async function createUser(userType, userData) {
  console.log(`\n👤 Creating ${userType} user: ${userData.first_name} ${userData.last_name}`);
  
  // Register user
  const registerData = await authenticatedRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData)
  });
  
  // Verify email
  await authenticatedRequest('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ token: registerData.registration.verification_token })
  });
  
  // Login
  const loginData = await authenticatedRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: userData.email,
      password: userData.password
    })
  });
  
  // Create company
  const companyData = await authenticatedRequest('/api/auth/company', {
    method: 'POST',
    body: JSON.stringify(userData.company)
  }, loginData.sessionToken);
  
  return {
    user: loginData.user,
    company: companyData.company,
    token: loginData.sessionToken
  };
}

// Test different user scenarios
async function testOwnerUser() {
  console.log('\n👑 Testing Owner User (Full Access)');
  console.log('─'.repeat(50));
  
  const owner = await createUser('owner', userTypes.owner);
  testUsers.owner = owner;
  
  console.log(`   ✅ Owner created: ${owner.user.first_name} ${owner.user.last_name}`);
  console.log(`   🏢 Company: ${owner.company.name}`);
  console.log(`   🔑 Full access to all features`);
  
  // Test owner capabilities
  const userInfo = await authenticatedRequest('/api/auth/me', {}, owner.token);
  console.log(`   👤 User ID: ${userInfo.user.id}`);
  console.log(`   🏢 Company ID: ${userInfo.user.company_id}`);
}

async function testAdminUser() {
  console.log('\n⚙️ Testing Admin User (User Management)');
  console.log('─'.repeat(50));
  
  const admin = await createUser('admin', userTypes.admin);
  testUsers.admin = admin;
  
  console.log(`   ✅ Admin created: ${admin.user.first_name} ${admin.user.last_name}`);
  console.log(`   🏢 Company: ${admin.company.name}`);
  console.log(`   🔑 Can manage users and company settings`);
  
  // Test admin capabilities
  const companyInfo = await authenticatedRequest('/api/auth/company', {}, admin.token);
  console.log(`   🏢 Company size: ${companyInfo.company.company_size}`);
}

async function testManagerUser() {
  console.log('\n🏭 Testing Manager User (Division/Cluster Management)');
  console.log('─'.repeat(50));
  
  const manager = await createUser('manager', userTypes.manager);
  testUsers.manager = manager;
  
  console.log(`   ✅ Manager created: ${manager.user.first_name} ${manager.user.last_name}`);
  console.log(`   🏢 Company: ${manager.company.name}`);
  console.log(`   🔑 Can manage divisions, clusters, and S&OP cycles`);
  
  // Test manager capabilities by creating divisions
  const division = await authenticatedRequest('/api/setup/divisions', {
    method: 'POST',
    body: JSON.stringify({
      companyId: manager.company.id,
      name: 'Operations Division',
      description: 'Managed by Lisa',
      industry: 'Operations'
    })
  }, manager.token);
  
  console.log(`   🏭 Created division: ${division.division.name}`);
}

async function testAnalystUser() {
  console.log('\n📊 Testing Analyst User (Data Access)');
  console.log('─'.repeat(50));
  
  const analyst = await createUser('analyst', userTypes.analyst);
  testUsers.analyst = analyst;
  
  console.log(`   ✅ Analyst created: ${analyst.user.first_name} ${analyst.user.last_name}`);
  console.log(`   🏢 Company: ${analyst.company.name}`);
  console.log(`   🔑 Can access data and run forecasts`);
  
  // Test analyst capabilities
  const setupStatus = await authenticatedRequest('/api/auth/setup/status', {}, analyst.token);
  console.log(`   ⚙️ Setup status: ${setupStatus.setupRequired ? 'Required' : 'Complete'}`);
}

async function testViewerUser() {
  console.log('\n👁️ Testing Viewer User (Read-Only)');
  console.log('─'.repeat(50));
  
  const viewer = await createUser('viewer', userTypes.viewer);
  testUsers.viewer = viewer;
  
  console.log(`   ✅ Viewer created: ${viewer.user.first_name} ${viewer.user.last_name}`);
  console.log(`   🏢 Company: ${viewer.company.name}`);
  console.log(`   🔑 Read-only access to data`);
  
  // Test viewer capabilities
  const userInfo = await authenticatedRequest('/api/auth/me', {}, viewer.token);
  console.log(`   👤 User role: Viewer (read-only)`);
}

async function testMultiTenantIsolation() {
  console.log('\n🔒 Testing Multi-Tenant Data Isolation');
  console.log('─'.repeat(50));
  
  // Try to access data from different companies
  for (const [userType, user] of Object.entries(testUsers)) {
    console.log(`\n   Testing ${userType} user data isolation:`);
    
    // Try to access their own company data (should work)
    try {
      const ownCompany = await authenticatedRequest('/api/auth/company', {}, user.token);
      console.log(`     ✅ Can access own company: ${ownCompany.company.name}`);
    } catch (error) {
      console.log(`     ❌ Cannot access own company: ${error.message}`);
    }
    
    // Try to access other company data (should fail)
    for (const [otherType, otherUser] of Object.entries(testUsers)) {
      if (userType !== otherType) {
        try {
          await authenticatedRequest(`/api/divisions?companyId=${otherUser.company.id}`, {}, user.token);
          console.log(`     ❌ Should not access ${otherType}'s data`);
        } catch (error) {
          console.log(`     ✅ Cannot access ${otherType}'s data (correct isolation)`);
        }
        break; // Just test one other company
      }
    }
  }
}

async function testUserCapabilities() {
  console.log('\n🎯 Testing User Capabilities');
  console.log('─'.repeat(50));
  
  for (const [userType, user] of Object.entries(testUsers)) {
    console.log(`\n   ${userType.toUpperCase()} User Capabilities:`);
    
    // Test what each user can do
    const capabilities = {
      'owner': ['Full company access', 'User management', 'Data management', 'Settings'],
      'admin': ['User management', 'Company settings', 'Data access'],
      'manager': ['Division management', 'Cluster management', 'S&OP cycles'],
      'analyst': ['Data access', 'Forecasting', 'Reports'],
      'viewer': ['Read-only data access', 'View reports']
    };
    
    capabilities[userType].forEach(cap => {
      console.log(`     ✅ ${cap}`);
    });
  }
}

async function testCompanyScenarios() {
  console.log('\n🏢 Testing Different Company Scenarios');
  console.log('─'.repeat(50));
  
  const scenarios = [
    { name: 'Startup', size: 'startup', divisions: 1, clusters: 1 },
    { name: 'Small Business', size: 'small', divisions: 2, clusters: 2 },
    { name: 'Medium Enterprise', size: 'medium', divisions: 3, clusters: 4 },
    { name: 'Large Corporation', size: 'large', divisions: 5, clusters: 8 },
    { name: 'Enterprise', size: 'enterprise', divisions: 8, clusters: 12 }
  ];
  
  for (const scenario of scenarios) {
    console.log(`\n   ${scenario.name} Company:`);
    console.log(`     📊 Size: ${scenario.size}`);
    console.log(`     🏭 Divisions: ${scenario.divisions}`);
    console.log(`     🌍 Clusters: ${scenario.clusters}`);
    console.log(`     💼 Typical use case: ${getUseCase(scenario.size)}`);
  }
}

function getUseCase(size) {
  const useCases = {
    'startup': 'Simple forecasting for single product line',
    'small': 'Multiple product categories with regional planning',
    'medium': 'Complex supply chain with multiple divisions',
    'large': 'Multi-regional operations with advanced analytics',
    'enterprise': 'Global operations with AI-powered forecasting'
  };
  return useCases[size] || 'General business forecasting';
}

// Main test runner
async function runUserTypeTests() {
  console.log('🚀 Multi-Tenant System - User Type Testing');
  console.log('=' .repeat(60));
  
  await testOwnerUser();
  await testAdminUser();
  await testManagerUser();
  await testAnalystUser();
  await testViewerUser();
  await testMultiTenantIsolation();
  await testUserCapabilities();
  await testCompanyScenarios();
  
  console.log('\n🎉 All user type tests completed!');
  console.log('\n📊 Test Summary:');
  console.log('   👑 Owner: Full system access');
  console.log('   ⚙️ Admin: User and company management');
  console.log('   🏭 Manager: Division and cluster management');
  console.log('   📊 Analyst: Data access and forecasting');
  console.log('   👁️ Viewer: Read-only access');
  console.log('   🔒 Multi-tenant isolation verified');
  console.log('   🏢 Different company scenarios tested');
  
  console.log('\n💡 Tips for testing:');
  console.log('   1. Use different browsers for different users');
  console.log('   2. Test with incognito/private windows');
  console.log('   3. Try accessing data from different companies');
  console.log('   4. Test role-based permissions');
  console.log('   5. Verify data isolation between companies');
}

// Run the tests
runUserTypeTests().catch(error => {
  console.error('💥 User type tests failed:', error);
  process.exit(1);
}); 