const BACKEND_URL = 'http://localhost:3001';

async function testSetupStatus() {
  try {
    console.log('🔍 Testing setup status via API...\n');

    // Test setup status endpoint
    console.log('1. Checking setup status...');
    const response = await fetch(`${BACKEND_URL}/api/setup/status?companyId=49`);
    
    if (!response.ok) {
      throw new Error(`Setup status failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('✅ Setup status response:');
    console.log(JSON.stringify(data, null, 2));

    // Analyze the response
    console.log('\n📊 Analysis:');
    console.log(`  - setupRequired: ${data.setupRequired}`);
    console.log(`  - setupWizardAccessible: ${data.setupWizardAccessible}`);
    console.log(`  - divisionCount: ${data.divisionCount}`);
    console.log(`  - clusterCount: ${data.clusterCount}`);
    console.log(`  - datasetCount: ${data.datasetCount}`);

    // Determine what should happen
    if (data.setupRequired && data.setupWizardAccessible) {
      console.log('\n✅ User should be able to access setup wizard (setup required)');
    } else if (!data.setupRequired && data.setupWizardAccessible) {
      console.log('\n✅ User should be able to access setup wizard (for modifications)');
    } else if (!data.setupRequired && !data.setupWizardAccessible) {
      console.log('\n❌ User cannot access setup wizard (setup complete, access disabled)');
    } else {
      console.log('\n❌ User cannot access setup wizard (setup required, access disabled)');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSetupStatus(); 