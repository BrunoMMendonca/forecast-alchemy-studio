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

async function testRegularDaysConfig() {
  console.log('\n📅 Testing regular days S&OP cycle configuration...');
  
  const config = {
    divisionId: null, // Company-wide
    frequency: 'monthly',
    dayType: 'regular',
    startDay: 1,
    cutOffDays: 3,
    description: 'Monthly S&OP cycles starting on the 1st (regular days)',
    autoGenerate: true,
    generateFromDate: '2024-01-01',
    generateCount: 3
  };

  const { response, data } = await makeRequest('/sop-cycle-configs', {
    method: 'POST',
    body: JSON.stringify(config)
  });

  if (response.ok && data.status === 'ok') {
    console.log('✅ Regular days configuration created successfully');
    console.log('   Config ID:', data.config.id);
    return data.config.id;
  } else {
    console.log('❌ Failed to create regular days configuration:', data.error);
    return null;
  }
}

async function testWorkingDaysConfig() {
  console.log('\n🏢 Testing working days S&OP cycle configuration...');
  
  const config = {
    divisionId: null, // Company-wide
    frequency: 'monthly',
    dayType: 'working',
    startDay: 1, // 1st working day
    cutOffDays: 3,
    description: 'Monthly S&OP cycles starting on the 1st working day',
    autoGenerate: true,
    generateFromDate: '2024-01-01',
    generateCount: 3,
    workingDaysConfig: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
      holidays: [
        '2024-01-01', // New Year's Day
        '2024-01-15', // Martin Luther King Jr. Day
        '2024-02-19', // Presidents' Day
        '2024-05-27', // Memorial Day
        '2024-07-04', // Independence Day
        '2024-09-02', // Labor Day
        '2024-10-14', // Columbus Day
        '2024-11-11', // Veterans Day
        '2024-11-28', // Thanksgiving
        '2024-12-25'  // Christmas
      ]
    }
  };

  const { response, data } = await makeRequest('/sop-cycle-configs', {
    method: 'POST',
    body: JSON.stringify(config)
  });

  if (response.ok && data.status === 'ok') {
    console.log('✅ Working days configuration created successfully');
    console.log('   Config ID:', data.config.id);
    return data.config.id;
  } else {
    console.log('❌ Failed to create working days configuration:', data.error);
    return null;
  }
}

async function testWeeklyWorkingDaysConfig() {
  console.log('\n📅 Testing weekly working days configuration...');
  
  const config = {
    divisionId: null, // Company-wide
    frequency: 'weekly',
    dayType: 'working',
    startDay: 1, // 1st working day of week
    cutOffDays: 2,
    description: 'Weekly S&OP cycles starting on the 1st working day of week',
    autoGenerate: true,
    generateFromDate: '2024-01-01',
    generateCount: 4,
    workingDaysConfig: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
      holidays: [
        '2024-01-01', // New Year's Day
        '2024-01-15'  // Martin Luther King Jr. Day
      ]
    }
  };

  const { response, data } = await makeRequest('/sop-cycle-configs', {
    method: 'POST',
    body: JSON.stringify(config)
  });

  if (response.ok && data.status === 'ok') {
    console.log('✅ Weekly working days configuration created successfully');
    console.log('   Config ID:', data.config.id);
    return data.config.id;
  } else {
    console.log('❌ Failed to create weekly working days configuration:', data.error);
    return null;
  }
}

async function testQuarterlyWorkingDaysConfig() {
  console.log('\n📊 Testing quarterly working days configuration...');
  
  const config = {
    divisionId: null, // Company-wide
    frequency: 'quarterly',
    dayType: 'working',
    startDay: 1, // 1st working day of quarter
    startMonth: 1, // Starting in January
    cutOffDays: 5,
    description: 'Quarterly S&OP cycles starting on the 1st working day of quarter',
    autoGenerate: true,
    generateFromDate: '2024-01-01',
    generateCount: 2,
    workingDaysConfig: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
      holidays: [
        '2024-01-01', // New Year's Day
        '2024-01-15', // Martin Luther King Jr. Day
        '2024-02-19', // Presidents' Day
        '2024-05-27', // Memorial Day
        '2024-07-04', // Independence Day
        '2024-09-02'  // Labor Day
      ]
    }
  };

  const { response, data } = await makeRequest('/sop-cycle-configs', {
    method: 'POST',
    body: JSON.stringify(config)
  });

  if (response.ok && data.status === 'ok') {
    console.log('✅ Quarterly working days configuration created successfully');
    console.log('   Config ID:', data.config.id);
    return data.config.id;
  } else {
    console.log('❌ Failed to create quarterly working days configuration:', data.error);
    return null;
  }
}

async function testGenerateCycles(configId) {
  console.log(`\n🔄 Testing cycle generation for config ${configId}...`);
  
  const { response, data } = await makeRequest(`/sop-cycle-configs/${configId}/generate`, {
    method: 'POST'
  });

  if (response.ok && data.status === 'ok') {
    console.log('✅ Cycles generated successfully');
    console.log(`   Generated ${data.cyclesCreated} cycles`);
    return data.cyclesCreated;
  } else {
    console.log('❌ Failed to generate cycles:', data.error);
    return 0;
  }
}

async function testGetSopCycles() {
  console.log('\n📅 Testing S&OP cycles retrieval...');
  
  const { response, data } = await makeRequest('/sop-cycles');

  if (response.ok && data.status === 'ok') {
    console.log('✅ S&OP cycles retrieved successfully');
    console.log(`   Found ${data.cycles.length} cycles`);
    
    // Show cycles with day type information
    data.cycles.slice(0, 5).forEach(cycle => {
      console.log(`   - ${cycle.name}: ${cycle.start_date} to ${cycle.end_date}`);
      console.log(`     Cut-off: ${cycle.cut_off_date}, Status: ${cycle.cycle_status}`);
    });
    
    return data.cycles;
  } else {
    console.log('❌ Failed to retrieve S&OP cycles:', data.error);
    return [];
  }
}

async function testGetSopCycleConfigs() {
  console.log('\n📋 Testing S&OP cycle configuration retrieval...');
  
  const { response, data } = await makeRequest('/sop-cycle-configs');

  if (response.ok && data.status === 'ok') {
    console.log('✅ S&OP cycle configurations retrieved successfully');
    console.log(`   Found ${data.configs.length} configurations`);
    data.configs.forEach(config => {
      console.log(`   - ${config.frequency} ${config.day_type} cycles for ${config.division_id ? 'division' : 'company'}`);
      if (config.day_type === 'working' && config.working_days_config) {
        const workingDays = Object.entries(config.working_days_config)
          .filter(([key, value]) => key !== 'holidays' && value)
          .map(([key]) => key.charAt(0).toUpperCase() + key.slice(1))
          .join(', ');
        console.log(`     Working days: ${workingDays}`);
      }
    });
    return data.configs;
  } else {
    console.log('❌ Failed to retrieve S&OP cycle configurations:', data.error);
    return [];
  }
}

async function testWorkingDaysValidation() {
  console.log('\n⚠️ Testing working days validation...');
  
  // Test with missing working days config
  const invalidConfig = {
    divisionId: null,
    frequency: 'monthly',
    dayType: 'working',
    startDay: 1,
    cutOffDays: 3,
    description: 'Invalid config - missing working days config',
    autoGenerate: true,
    generateFromDate: '2024-01-01',
    generateCount: 3
    // Missing workingDaysConfig
  };

  const { response, data } = await makeRequest('/sop-cycle-configs', {
    method: 'POST',
    body: JSON.stringify(invalidConfig)
  });

  if (!response.ok) {
    console.log('✅ Validation working correctly - rejected invalid config');
    console.log('   Error:', data.error);
    return true;
  } else {
    console.log('❌ Validation failed - accepted invalid config');
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Working Days S&OP Cycle System Tests\n');
  
  // Test login
  const loginSuccess = await testLogin();
  if (!loginSuccess) {
    console.log('❌ Cannot proceed without login');
    return;
  }
  
  // Test validation
  await testWorkingDaysValidation();
  
  // Test regular days configuration
  const regularConfigId = await testRegularDaysConfig();
  if (regularConfigId) {
    await testGenerateCycles(regularConfigId);
  }
  
  // Test working days configuration
  const workingConfigId = await testWorkingDaysConfig();
  if (workingConfigId) {
    await testGenerateCycles(workingConfigId);
  }
  
  // Test weekly working days configuration
  const weeklyConfigId = await testWeeklyWorkingDaysConfig();
  if (weeklyConfigId) {
    await testGenerateCycles(weeklyConfigId);
  }
  
  // Test quarterly working days configuration
  const quarterlyConfigId = await testQuarterlyWorkingDaysConfig();
  if (quarterlyConfigId) {
    await testGenerateCycles(quarterlyConfigId);
  }
  
  // Test configuration retrieval
  await testGetSopCycleConfigs();
  
  // Test cycle retrieval
  await testGetSopCycles();
  
  console.log('\n✅ All working days tests completed!');
}

// Run tests
runTests().catch(console.error); 
 
 
 
 
 
 
 
 
 