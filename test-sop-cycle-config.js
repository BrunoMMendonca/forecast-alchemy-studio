const fetch = require('node-fetch');

// Test configuration
const BASE_URL = 'http://localhost:3001/api';
const TEST_USER = {
  username: 'admin@test.com',
  password: 'admin123'
};

let sessionToken = null;

// Helper function to make authenticated requests
async function makeRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(sessionToken && { 'Authorization': `Bearer ${sessionToken}` }),
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json();
  return { response, data };
}

// Test functions
async function testLogin() {
  console.log('🔐 Testing login...');
  
  const { response, data } = await makeRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(TEST_USER)
  });

  if (response.ok && data.token) {
    sessionToken = data.token;
    console.log('✅ Login successful');
    return true;
  } else {
    console.log('❌ Login failed:', data.error);
    return false;
  }
}

async function testCreateSopCycleConfig() {
  console.log('\n📋 Testing S&OP cycle configuration creation...');
  
  const config = {
    divisionId: null, // Company-wide
    frequency: 'monthly',
    startDay: 1,
    cutOffDays: 3,
    description: 'Monthly S&OP cycles starting on the 1st',
    autoGenerate: true,
    generateFromDate: '2024-01-01',
    generateCount: 12
  };

  const { response, data } = await makeRequest('/sop-cycle-configs', {
    method: 'POST',
    body: JSON.stringify(config)
  });

  if (response.ok && data.status === 'ok') {
    console.log('✅ S&OP cycle configuration created successfully');
    console.log('   Config ID:', data.config.id);
    return data.config.id;
  } else {
    console.log('❌ Failed to create S&OP cycle configuration:', data.error);
    return null;
  }
}

async function testGetSopCycleConfigs() {
  console.log('\n📋 Testing S&OP cycle configuration retrieval...');
  
  const { response, data } = await makeRequest('/sop-cycle-configs');

  if (response.ok && data.status === 'ok') {
    console.log('✅ S&OP cycle configurations retrieved successfully');
    console.log(`   Found ${data.configs.length} configurations`);
    data.configs.forEach(config => {
      console.log(`   - ${config.frequency} cycles for ${config.division_id ? 'division' : 'company'}`);
    });
    return data.configs;
  } else {
    console.log('❌ Failed to retrieve S&OP cycle configurations:', data.error);
    return [];
  }
}

async function testGenerateSopCycles(configId) {
  console.log('\n🔄 Testing S&OP cycle generation...');
  
  const { response, data } = await makeRequest(`/sop-cycle-configs/${configId}/generate`, {
    method: 'POST'
  });

  if (response.ok && data.status === 'ok') {
    console.log('✅ S&OP cycles generated successfully');
    console.log(`   Generated ${data.cyclesCreated} cycles`);
    return data.cyclesCreated;
  } else {
    console.log('❌ Failed to generate S&OP cycles:', data.error);
    return 0;
  }
}

async function testGetSopCycles() {
  console.log('\n📅 Testing S&OP cycles retrieval...');
  
  const { response, data } = await makeRequest('/sop-cycles');

  if (response.ok && data.status === 'ok') {
    console.log('✅ S&OP cycles retrieved successfully');
    console.log(`   Found ${data.cycles.length} cycles`);
    
    // Show first few cycles
    data.cycles.slice(0, 3).forEach(cycle => {
      console.log(`   - ${cycle.name}: ${cycle.start_date} to ${cycle.end_date} (cut-off: ${cycle.cut_off_date})`);
      console.log(`     Status: ${cycle.cycle_status}, Current: ${cycle.is_current}`);
    });
    
    return data.cycles;
  } else {
    console.log('❌ Failed to retrieve S&OP cycles:', data.error);
    return [];
  }
}

async function testCreateDivisionSpecificConfig() {
  console.log('\n🏢 Testing division-specific S&OP cycle configuration...');
  
  // First, get divisions
  const { response: divResponse, data: divData } = await makeRequest('/divisions');
  
  if (!divResponse.ok || !divData.divisions || divData.divisions.length === 0) {
    console.log('❌ No divisions found, skipping division-specific test');
    return null;
  }
  
  const divisionId = divData.divisions[0].id;
  
  const config = {
    divisionId: divisionId,
    frequency: 'weekly',
    startDay: 1, // Monday
    cutOffDays: 2,
    description: 'Weekly S&OP cycles for division',
    autoGenerate: true,
    generateFromDate: '2024-01-01',
    generateCount: 8
  };

  const { response, data } = await makeRequest('/sop-cycle-configs', {
    method: 'POST',
    body: JSON.stringify(config)
  });

  if (response.ok && data.status === 'ok') {
    console.log('✅ Division-specific S&OP cycle configuration created successfully');
    console.log('   Config ID:', data.config.id);
    return data.config.id;
  } else {
    console.log('❌ Failed to create division-specific configuration:', data.error);
    return null;
  }
}

async function testQuarterlyConfig() {
  console.log('\n📊 Testing quarterly S&OP cycle configuration...');
  
  const config = {
    divisionId: null, // Company-wide
    frequency: 'quarterly',
    startDay: 1,
    startMonth: 1, // January
    cutOffDays: 5,
    description: 'Quarterly S&OP cycles starting in January',
    autoGenerate: true,
    generateFromDate: '2024-01-01',
    generateCount: 4
  };

  const { response, data } = await makeRequest('/sop-cycle-configs', {
    method: 'POST',
    body: JSON.stringify(config)
  });

  if (response.ok && data.status === 'ok') {
    console.log('✅ Quarterly S&OP cycle configuration created successfully');
    console.log('   Config ID:', data.config.id);
    return data.config.id;
  } else {
    console.log('❌ Failed to create quarterly configuration:', data.error);
    return null;
  }
}

async function testCycleStatusUpdate() {
  console.log('\n🔄 Testing S&OP cycle status update...');
  
  // Get cycles first
  const { response: getResponse, data: getData } = await makeRequest('/sop-cycles');
  
  if (!getResponse.ok || !getData.cycles || getData.cycles.length === 0) {
    console.log('❌ No cycles found, skipping status update test');
    return false;
  }
  
  const cycleId = getData.cycles[0].id;
  
  const { response, data } = await makeRequest(`/sop-cycles/${cycleId}/status`, {
    method: 'PUT',
    body: JSON.stringify({
      status: 'active',
      isCurrent: true
    })
  });

  if (response.ok && data.status === 'ok') {
    console.log('✅ S&OP cycle status updated successfully');
    console.log('   Cycle ID:', data.cycle.id);
    console.log('   Status:', data.cycle.status);
    console.log('   Is Current:', data.cycle.is_current);
    return true;
  } else {
    console.log('❌ Failed to update S&OP cycle status:', data.error);
    return false;
  }
}

async function testPermissions() {
  console.log('\n🔐 Testing S&OP cycle permissions...');
  
  // Get cycles first
  const { response: getResponse, data: getData } = await makeRequest('/sop-cycles');
  
  if (!getResponse.ok || !getData.cycles || getData.cycles.length === 0) {
    console.log('❌ No cycles found, skipping permissions test');
    return false;
  }
  
  const cycleId = getData.cycles[0].id;
  
  // Grant permission
  const { response, data } = await makeRequest(`/sop-cycles/${cycleId}/permissions`, {
    method: 'POST',
    body: JSON.stringify({
      userId: 1, // Assuming user ID 1 exists
      permissionType: 'edit',
      expiresAt: '2024-12-31'
    })
  });

  if (response.ok && data.status === 'ok') {
    console.log('✅ S&OP cycle permission granted successfully');
    console.log('   Permission ID:', data.permission.id);
    console.log('   Type:', data.permission.permission_type);
    return true;
  } else {
    console.log('❌ Failed to grant S&OP cycle permission:', data.error);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting S&OP Cycle Configuration System Tests\n');
  
  // Test login
  const loginSuccess = await testLogin();
  if (!loginSuccess) {
    console.log('❌ Cannot proceed without login');
    return;
  }
  
  // Test basic configuration creation
  const configId = await testCreateSopCycleConfig();
  if (configId) {
    await testGenerateSopCycles(configId);
  }
  
  // Test configuration retrieval
  await testGetSopCycleConfigs();
  
  // Test cycle retrieval
  await testGetSopCycles();
  
  // Test division-specific configuration
  const divConfigId = await testCreateDivisionSpecificConfig();
  if (divConfigId) {
    await testGenerateSopCycles(divConfigId);
  }
  
  // Test quarterly configuration
  const quarterlyConfigId = await testQuarterlyConfig();
  if (quarterlyConfigId) {
    await testGenerateSopCycles(quarterlyConfigId);
  }
  
  // Test status updates
  await testCycleStatusUpdate();
  
  // Test permissions
  await testPermissions();
  
  console.log('\n✅ All tests completed!');
}

// Run tests
runTests().catch(console.error); 
 
 
 
 
 
 
 
 
 