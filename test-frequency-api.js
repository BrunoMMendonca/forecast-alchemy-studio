// Test script for the new frequency API endpoints
const baseUrl = 'http://localhost:3001/api';

async function testFrequencyAPI() {
  console.log('🧪 Testing Frequency API Endpoints...\n');

  try {
    // Test 1: Initialize settings
    console.log('1. Testing settings initialization...');
    const initResponse = await fetch(`${baseUrl}/settings/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (initResponse.ok) {
      const initResult = await initResponse.json();
      console.log('✅ Settings initialized:', initResult.message);
    } else {
      console.log('⚠️ Settings initialization failed (might already exist)');
    }

    // Test 2: Get dataset frequency (assuming dataset 24 exists)
    console.log('\n2. Testing get dataset frequency...');
    const getResponse = await fetch(`${baseUrl}/dataset/24/frequency`);
    
    if (getResponse.ok) {
      const frequencyData = await getResponse.json();
      console.log('✅ Dataset frequency retrieved:', frequencyData);
    } else {
      console.log('⚠️ Could not get dataset frequency (dataset might not exist)');
    }

    // Test 3: Auto-detect frequency
    console.log('\n3. Testing auto-detect frequency...');
    const autoDetectResponse = await fetch(`${baseUrl}/dataset/24/auto-detect-frequency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (autoDetectResponse.ok) {
      const autoDetectResult = await autoDetectResponse.json();
      console.log('✅ Auto-detected frequency:', autoDetectResult);
    } else {
      console.log('⚠️ Could not auto-detect frequency (dataset might not exist)');
    }

    // Test 4: Update frequency manually
    console.log('\n4. Testing manual frequency update...');
    const updateResponse = await fetch(`${baseUrl}/dataset/24/frequency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frequency: 'monthly' })
    });
    
    if (updateResponse.ok) {
      const updateResult = await updateResponse.json();
      console.log('✅ Frequency updated:', updateResult);
    } else {
      console.log('⚠️ Could not update frequency (dataset might not exist)');
    }

    console.log('\n🎉 Frequency API tests completed!');
    console.log('\n📋 Available endpoints:');
    console.log('  POST /api/settings/initialize - Initialize default settings');
    console.log('  GET  /api/dataset/:id/frequency - Get dataset frequency');
    console.log('  POST /api/dataset/:id/frequency - Update dataset frequency');
    console.log('  POST /api/dataset/:id/auto-detect-frequency - Auto-detect frequency');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFrequencyAPI(); 