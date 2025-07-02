import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001/api';

async function testEndpoint(endpoint, description) {
  try {
    console.log(`\n🧪 Testing: ${description}`);
    console.log(`   URL: ${BASE_URL}${endpoint}`);
    
    const response = await fetch(`${BASE_URL}${endpoint}`);
    const data = await response.json();
    
    console.log(`   ✅ Status: ${response.status}`);
    console.log(`   📊 Response keys: ${Object.keys(data).join(', ')}`);
    
    if (data.bestResultsPerModelMethod) {
      console.log(`   📈 Models with best results: ${data.bestResultsPerModelMethod.length}`);
      if (data.bestResultsPerModelMethod.length > 0) {
        const firstModel = data.bestResultsPerModelMethod[0];
        console.log(`   🔍 First model: ${firstModel.modelType} (${firstModel.displayName})`);
        console.log(`   🎯 Methods: ${firstModel.methods.map(m => m.method).join(', ')}`);
      }
    }
    
    if (data.totalJobs !== undefined) {
      console.log(`   📋 Total jobs: ${data.totalJobs}`);
    }
    
    return true;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting Backend API Tests...\n');
  
  const tests = [
    { endpoint: '/models', description: 'Get available models' },
    { endpoint: '/jobs/status', description: 'Get job status' },
    { endpoint: '/jobs/results-summary', description: 'Get results summary' },
    { endpoint: '/jobs/best-results-per-model', description: 'Get best results per model/method' },
    { endpoint: '/jobs/best-results-per-model?method=grid', description: 'Get best results (grid only)' },
    { endpoint: '/jobs/best-results-per-model?method=ai', description: 'Get best results (AI only)' }
  ];
  
  let passed = 0;
  let total = tests.length;
  
  for (const test of tests) {
    const success = await testEndpoint(test.endpoint, test.description);
    if (success) passed++;
  }
  
  console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Backend is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the errors above.');
  }
}

runTests().catch(console.error); 