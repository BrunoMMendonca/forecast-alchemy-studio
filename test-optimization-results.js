import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api';

async function testOptimizationResults() {
  console.log('🧪 Testing Optimization Results Table and Caching\n');

  try {
    // Test 1: Check cache statistics
    console.log('1. Testing cache statistics...');
    const statsResponse = await fetch(`${API_BASE}/jobs/cache-stats`);
    const stats = await statsResponse.json();
    
    if (stats.success) {
      console.log('✅ Cache stats retrieved successfully');
      console.log('   - Total jobs:', stats.stats.total_jobs);
      console.log('   - Unique optimizations:', stats.stats.unique_optimizations);
      console.log('   - Cache hits:', stats.stats.cache_hits);
      console.log('   - Cache hit percentage:', stats.stats.cache_hit_percentage + '%');
      console.log('   - Total results:', stats.stats.total_results);
      console.log('   - Unique result hashes:', stats.stats.unique_result_hashes);
    } else {
      console.log('❌ Failed to get cache stats:', stats.error);
    }

    // Test 2: Create a test optimization job with caching
    console.log('\n2. Testing job creation with caching...');
    const testJobData = {
      sku: '95000000',
      modelId: 'ARIMA',
      method: 'grid',
      datasetId: 1,
      parameters: { p: 1, d: 1, q: 1 },
      metricWeights: { mape: 0.4, rmse: 0.3, mae: 0.2, accuracy: 0.1 },
      payload: { test: true },
      reason: 'test_optimization'
    };

    const createResponse = await fetch(`${API_BASE}/jobs/create-with-cache`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testJobData)
    });

    const createResult = await createResponse.json();
    
    if (createResult.success) {
      console.log('✅ Job created successfully');
      console.log('   - Job ID:', createResult.jobId);
      console.log('   - Cached:', createResult.cached);
      console.log('   - Message:', createResult.message);
    } else {
      console.log('❌ Failed to create job:', createResult.error);
    }

    // Test 3: Get job results
    if (createResult.success) {
      console.log('\n3. Testing job results retrieval...');
      const resultsResponse = await fetch(`${API_BASE}/jobs/${createResult.jobId}/results`);
      const results = await resultsResponse.json();
      
      if (results.success) {
        console.log('✅ Job results retrieved successfully');
        console.log('   - Number of results:', results.results.length);
        if (results.results.length > 0) {
          console.log('   - First result ID:', results.results[0].id);
          console.log('   - Model ID:', results.results[0].model_id);
          console.log('   - Method:', results.results[0].method);
        }
      } else {
        console.log('❌ Failed to get job results:', results.error);
      }
    }

    // Test 4: Test optimization results by hash (if we have results)
    console.log('\n4. Testing optimization results by hash...');
    const hashResponse = await fetch(`${API_BASE}/optimization-results/test-hash-123`);
    const hashResult = await hashResponse.json();
    
    if (hashResult.success) {
      console.log('✅ Optimization results by hash retrieved successfully');
      console.log('   - Result ID:', hashResult.result.id);
      console.log('   - Model ID:', hashResult.result.model_id);
    } else if (hashResponse.status === 404) {
      console.log('ℹ️  No results found for test hash (expected for non-existent hash)');
    } else {
      console.log('❌ Failed to get results by hash:', hashResult.error);
    }

    // Test 5: Store optimization results (simulate worker)
    console.log('\n5. Testing result storage...');
    const storeData = {
      jobId: createResult.success ? createResult.jobId : 1,
      optimizationHash: 'test-hash-' + Date.now(),
      modelId: 'SARIMA',
      method: 'grid',
      parameters: { p: 2, d: 1, q: 2, P: 1, D: 1, Q: 1, s: 12 },
      scores: { mape: 0.15, rmse: 0.25, mae: 0.20, accuracy: 0.85 },
      forecasts: { predictions: [100, 105, 110], periods: 3 },
      companyId: 1
    };

    const storeResponse = await fetch(`${API_BASE}/optimization-results/store`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(storeData)
    });

    const storeResult = await storeResponse.json();
    
    if (storeResult.success) {
      console.log('✅ Optimization results stored successfully');
      console.log('   - Result ID:', storeResult.resultId);
      console.log('   - Message:', storeResult.message);
    } else {
      console.log('❌ Failed to store results:', storeResult.error);
    }

    console.log('\n🎉 All tests completed!');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the tests
testOptimizationResults(); 