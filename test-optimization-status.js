const BACKEND_URL = 'http://localhost:3001';

async function testOptimizationStatus() {
  try {
    console.log('🧪 Testing optimization status endpoint...\n');

    // Test GET /api/optimizations/status
    console.log('1. Testing GET /api/optimizations/status...');
    const response = await fetch(`${BACKEND_URL}/api/optimizations/status`);
    
    if (!response.ok) {
      throw new Error(`GET /api/optimizations/status failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('✅ GET /api/optimizations/status successful');
    console.log('Response structure:');
    console.log(JSON.stringify(data, null, 2));

    // Verify the response structure
    if (!data.status || data.status !== 'ok') {
      console.log('❌ Response missing or invalid status field');
    } else {
      console.log('✅ Response status is correct');
    }

    if (!Array.isArray(data.optimizations)) {
      console.log('❌ Optimizations field is not an array');
    } else {
      console.log('✅ Optimizations field is an array');
      console.log(`📊 Found ${data.optimizations.length} SKU groups`);
    }

    // Check structure of first SKU group if available
    if (data.optimizations.length > 0) {
      const firstGroup = data.optimizations[0];
      console.log('\n2. Checking first SKU group structure...');
      
      const requiredFields = [
        'sku', 'skuDescription', 'datasetIdentifier', 'batches',
        'totalJobs', 'pendingJobs', 'runningJobs', 'completedJobs',
        'failedJobs', 'cancelledJobs', 'skippedJobs', 'progress',
        'isOptimizing', 'methods', 'models'
      ];

      const missingFields = requiredFields.filter(field => !(field in firstGroup));
      if (missingFields.length > 0) {
        console.log('❌ Missing required fields in SKU group:', missingFields);
      } else {
        console.log('✅ All required fields present in SKU group');
      }

      // Check batches structure
      if (firstGroup.batches && typeof firstGroup.batches === 'object') {
        console.log('✅ Batches field is an object');
        const batchKeys = Object.keys(firstGroup.batches);
        console.log(`📦 Found ${batchKeys.length} batches`);
        
        if (batchKeys.length > 0) {
          const firstBatchKey = batchKeys[0];
          const firstBatch = firstGroup.batches[firstBatchKey];
          console.log('\n3. Checking first batch structure...');
          
          const batchRequiredFields = [
            'batchId', 'sku', 'skuDescription', 'datasetIdentifier',
            'reason', 'priority', 'createdAt', 'optimizations',
            'totalJobs', 'pendingJobs', 'runningJobs', 'completedJobs',
            'failedJobs', 'cancelledJobs', 'skippedJobs', 'progress',
            'isOptimizing', 'methods', 'models'
          ];

          const missingBatchFields = batchRequiredFields.filter(field => !(field in firstBatch));
          if (missingBatchFields.length > 0) {
            console.log('❌ Missing required fields in batch:', missingBatchFields);
          } else {
            console.log('✅ All required fields present in batch');
          }

          // Check optimizations structure
          if (firstBatch.optimizations && typeof firstBatch.optimizations === 'object') {
            console.log('✅ Optimizations field is an object');
            const optimizationKeys = Object.keys(firstBatch.optimizations);
            console.log(`🔧 Found ${optimizationKeys.length} optimizations`);
            
            if (optimizationKeys.length > 0) {
              const firstOptimizationKey = optimizationKeys[0];
              const firstOptimization = firstBatch.optimizations[firstOptimizationKey];
              console.log('\n4. Checking first optimization structure...');
              
              const optimizationRequiredFields = [
                'optimizationId', 'modelId', 'modelDisplayName', 'modelShortName',
                'method', 'methodDisplayName', 'methodShortName', 'reason',
                'status', 'createdAt', 'progress', 'jobs'
              ];

              const missingOptimizationFields = optimizationRequiredFields.filter(field => !(field in firstOptimization));
              if (missingOptimizationFields.length > 0) {
                console.log('❌ Missing required fields in optimization:', missingOptimizationFields);
              } else {
                console.log('✅ All required fields present in optimization');
              }
            }
          } else {
            console.log('❌ Optimizations field is not an object');
          }
        }
      } else {
        console.log('❌ Batches field is not an object or is missing');
      }
    } else {
      console.log('📝 No SKU groups found (this is normal if no optimizations exist)');
    }

    console.log('\n🎉 Optimization status endpoint test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testOptimizationStatus(); 