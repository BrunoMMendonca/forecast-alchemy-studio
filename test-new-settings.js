const BACKEND_URL = 'http://localhost:3001';

async function testSettingsEndpoint() {
  try {
    console.log('🧪 Testing new settings endpoint...\n');

    // Test GET /api/settings
    console.log('1. Testing GET /api/settings...');
    const getResponse = await fetch(`${BACKEND_URL}/api/settings`);
    
    if (!getResponse.ok) {
      throw new Error(`GET /api/settings failed: ${getResponse.status} ${getResponse.statusText}`);
    }
    
    const getData = await getResponse.json();
    console.log('✅ GET /api/settings successful');
    console.log('Response structure:');
    console.log(JSON.stringify(getData, null, 2));

    // Verify required fields are present
    const requiredFields = [
      'forecastPeriods',
      'businessContext',
      'aiForecastModelOptimizationEnabled',
      'aiCsvImportEnabled',
      'aiFailureThreshold',
      'largeFileProcessingEnabled',
      'largeFileThreshold',
      'aiReasoningEnabled',
      'mapeWeight',
      'rmseWeight',
      'maeWeight',
      'accuracyWeight',
      'csvSeparator',
      'autoDetectFrequency'
    ];

    const missingFields = requiredFields.filter(field => !(field in getData.settings));
    if (missingFields.length > 0) {
      console.log('❌ Missing required fields:', missingFields);
    } else {
      console.log('✅ All required fields present');
    }

    // Verify business context structure
    const businessContextFields = ['costOfError', 'planningPurpose', 'updateFrequency', 'interpretabilityNeeds'];
    const missingBusinessFields = businessContextFields.filter(field => !(field in getData.settings.businessContext));
    if (missingBusinessFields.length > 0) {
      console.log('❌ Missing business context fields:', missingBusinessFields);
    } else {
      console.log('✅ Business context structure correct');
    }

    // Verify frequency is NOT present (should be dataset-specific)
    if ('frequency' in getData.settings) {
      console.log('❌ Frequency should not be in global settings (it\'s dataset-specific)');
    } else {
      console.log('✅ Frequency correctly excluded from global settings');
    }

    // Test POST /api/settings with partial update
    console.log('\n2. Testing POST /api/settings with partial update...');
    const testSettings = {
      forecastPeriods: 24,
      businessContext: {
        costOfError: 'high',
        planningPurpose: 'strategic'
      },
      aiForecastModelOptimizationEnabled: true,
      mapeWeight: 50,
      rmseWeight: 30,
      maeWeight: 20,
      accuracyWeight: 0
    };

    const updateResponse = await fetch(`${BACKEND_URL}/api/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ settings: testSettings })
    });

    if (!updateResponse.ok) {
      throw new Error(`POST /api/settings failed: ${updateResponse.status} ${updateResponse.statusText}`);
    }

    const updateData = await updateResponse.json();
    console.log('✅ POST /api/settings successful');
    console.log('Update response:', updateData);

    // Verify the update worked by fetching again
    console.log('\n3. Verifying update by fetching settings again...');
    const verifyResponse = await fetch(`${BACKEND_URL}/api/settings`);
    const verifyData = await verifyResponse.json();
    
    console.log('Updated settings:');
    console.log(JSON.stringify(verifyData, null, 2));

    // Check if our updates were applied
    const updatesApplied = [
      verifyData.settings.forecastPeriods === 24,
      verifyData.settings.businessContext.costOfError === 'high',
      verifyData.settings.businessContext.planningPurpose === 'strategic',
      verifyData.settings.aiForecastModelOptimizationEnabled === true,
      verifyData.settings.mapeWeight === 50,
      verifyData.settings.rmseWeight === 30,
      verifyData.settings.maeWeight === 20,
      verifyData.settings.accuracyWeight === 0
    ];

    if (updatesApplied.every(applied => applied)) {
      console.log('✅ All updates applied correctly');
    } else {
      console.log('❌ Some updates were not applied correctly');
    }

    console.log('\n🎉 Settings endpoint test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testSettingsEndpoint(); 