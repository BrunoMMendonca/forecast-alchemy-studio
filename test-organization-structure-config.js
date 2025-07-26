const fetch = require('node-fetch');

// Test configuration
const BASE_URL = 'http://localhost:3000/api';
const TEST_CONFIG = {
  hasMultipleDivisions: true,
  hasMultipleClusters: true,
  importLevel: 'division',
  csvUploadType: 'perDivision',
  divisionCsvType: 'withDivisionColumn',
  setupFlow: {
    skipDivisionStep: false,
    skipClusterStep: false,
    divisionValue: null,
    clusterValue: null,
    requiresCsvUpload: true,
    csvStructure: {
      hasDivisionColumn: true,
      hasClusterColumn: true,
    },
  }
};

// Mock session token (you'll need to replace this with a real one)
const SESSION_TOKEN = 'your-session-token-here';

async function testOrganizationStructureConfig() {
  console.log('🧪 Testing Organization Structure Configuration Storage\n');

  try {
    // Test 1: Save configuration
    console.log('1. Testing save configuration...');
    const saveResponse = await fetch(`${BASE_URL}/organization-structure-config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SESSION_TOKEN}`
      },
      body: JSON.stringify({ config: TEST_CONFIG })
    });

    if (saveResponse.ok) {
      const saveResult = await saveResponse.json();
      console.log('   ✅ Configuration saved successfully');
      console.log('   📝 Response:', saveResult);
    } else {
      const error = await saveResponse.json();
      console.log('   ❌ Failed to save configuration:', error);
      return;
    }

    // Test 2: Load configuration
    console.log('\n2. Testing load configuration...');
    const loadResponse = await fetch(`${BASE_URL}/organization-structure-config`, {
      headers: {
        'Authorization': `Bearer ${SESSION_TOKEN}`
      }
    });

    if (loadResponse.ok) {
      const loadResult = await loadResponse.json();
      console.log('   ✅ Configuration loaded successfully');
      console.log('   📝 Response:', loadResult);
      
      // Verify the loaded config matches what we saved
      const configMatches = JSON.stringify(loadResult.config) === JSON.stringify(TEST_CONFIG);
      console.log('   🔍 Config matches saved data:', configMatches);
    } else {
      const error = await loadResponse.json();
      console.log('   ❌ Failed to load configuration:', error);
    }

    // Test 3: Test with invalid data
    console.log('\n3. Testing invalid data validation...');
    const invalidResponse = await fetch(`${BASE_URL}/organization-structure-config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SESSION_TOKEN}`
      },
      body: JSON.stringify({ config: { invalidField: 'test' } })
    });

    if (!invalidResponse.ok) {
      const error = await invalidResponse.json();
      console.log('   ✅ Invalid data properly rejected:', error);
    } else {
      console.log('   ❌ Invalid data was accepted (should have been rejected)');
    }

    // Test 4: Test default configuration for new company
    console.log('\n4. Testing default configuration...');
    const defaultResponse = await fetch(`${BASE_URL}/organization-structure-config`, {
      headers: {
        'Authorization': `Bearer ${SESSION_TOKEN}`
      }
    });

    if (defaultResponse.ok) {
      const defaultResult = await defaultResponse.json();
      console.log('   ✅ Default configuration loaded');
      console.log('   📝 Default config:', defaultResult.config);
    } else {
      const error = await defaultResponse.json();
      console.log('   ❌ Failed to load default configuration:', error);
    }

    console.log('\n🎉 All tests completed!');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
testOrganizationStructureConfig(); 
 
 
 
 
 
 
 
 
 