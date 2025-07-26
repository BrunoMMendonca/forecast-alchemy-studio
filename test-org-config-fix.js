const fetch = require('node-fetch');

// Test the fix for organization structure config
async function testOrgConfigFix() {
  console.log('🧪 Testing Organization Structure Config Fix\n');

  const BASE_URL = 'http://localhost:3000/api';
  const SESSION_TOKEN = 'your-session-token-here'; // Replace with actual token

  try {
    // Test 1: Try to load configuration (should work now)
    console.log('1. Testing load configuration...');
    const loadResponse = await fetch(`${BASE_URL}/organization-structure-config`, {
      headers: {
        'Authorization': `Bearer ${SESSION_TOKEN}`
      }
    });

    if (loadResponse.ok) {
      const loadResult = await loadResponse.json();
      console.log('   ✅ Configuration loaded successfully');
      console.log('   📝 Status:', loadResult.status);
      console.log('   📝 Config type:', typeof loadResult.config);
      console.log('   📝 Has multiple divisions:', loadResult.config?.hasMultipleDivisions);
    } else {
      const error = await loadResponse.json();
      console.log('   ❌ Failed to load configuration:', error);
    }

    // Test 2: Save a test configuration
    console.log('\n2. Testing save configuration...');
    const testConfig = {
      hasMultipleDivisions: true,
      hasMultipleClusters: false,
      importLevel: 'company',
      csvUploadType: null,
      divisionCsvType: null,
      setupFlow: {
        skipDivisionStep: false,
        skipClusterStep: false,
        divisionValue: null,
        clusterValue: null,
        requiresCsvUpload: false,
        csvStructure: {
          hasDivisionColumn: false,
          hasClusterColumn: false,
        },
      }
    };

    const saveResponse = await fetch(`${BASE_URL}/organization-structure-config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SESSION_TOKEN}`
      },
      body: JSON.stringify({ config: testConfig })
    });

    if (saveResponse.ok) {
      const saveResult = await saveResponse.json();
      console.log('   ✅ Configuration saved successfully');
      console.log('   📝 Response:', saveResult);
    } else {
      const error = await saveResponse.json();
      console.log('   ❌ Failed to save configuration:', error);
    }

    // Test 3: Load the configuration again to verify it was saved
    console.log('\n3. Testing load saved configuration...');
    const loadAgainResponse = await fetch(`${BASE_URL}/organization-structure-config`, {
      headers: {
        'Authorization': `Bearer ${SESSION_TOKEN}`
      }
    });

    if (loadAgainResponse.ok) {
      const loadAgainResult = await loadAgainResponse.json();
      console.log('   ✅ Saved configuration loaded successfully');
      console.log('   📝 Has multiple divisions:', loadAgainResult.config?.hasMultipleDivisions);
      console.log('   📝 Has multiple clusters:', loadAgainResult.config?.hasMultipleClusters);
      console.log('   📝 Import level:', loadAgainResult.config?.importLevel);
    } else {
      const error = await loadAgainResponse.json();
      console.log('   ❌ Failed to load saved configuration:', error);
    }

    console.log('\n🎉 All tests completed!');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
testOrgConfigFix(); 
 
 
 
 
 
 
 
 
 