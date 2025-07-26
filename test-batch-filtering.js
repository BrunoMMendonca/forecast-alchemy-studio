import fetch from 'node-fetch';

async function testBatchFiltering() {
  try {
    console.log('Testing batch-level filtering...');
    
    const response = await fetch('http://localhost:3001/api/optimizations/status');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Simulate the filtering logic from useOptimizationStatus
    const activeBatches = [];
    const completedBatches = [];
    const failedBatches = [];
    const skippedBatches = [];
    
    data.forEach(skuGroup => {
      Object.values(skuGroup.batches).forEach(batch => {
        if (batch.isOptimizing) {
          activeBatches.push(batch);
        } else if (batch.completedJobs > 0) {
          completedBatches.push(batch);
        }
        if (batch.failedJobs > 0) {
          failedBatches.push(batch);
        }
        if (batch.skippedJobs > 0) {
          skippedBatches.push(batch);
        }
      });
    });
    
    console.log('\n📊 Filtering Results:');
    console.log('Active batches:', activeBatches.length);
    console.log('Completed batches:', completedBatches.length);
    console.log('Failed batches:', failedBatches.length);
    console.log('Skipped batches:', skippedBatches.length);
    
    if (activeBatches.length > 0) {
      console.log('\n🟢 Active Batches:');
      activeBatches.forEach(batch => {
        console.log(`  - SKU: ${batch.sku}, Batch: ${batch.batchId}, Progress: ${batch.progress}%`);
      });
    }
    
    if (completedBatches.length > 0) {
      console.log('\n✅ Completed Batches:');
      completedBatches.forEach(batch => {
        console.log(`  - SKU: ${batch.sku}, Batch: ${batch.batchId}, Progress: ${batch.progress}%`);
      });
    }
    
    if (failedBatches.length > 0) {
      console.log('\n❌ Failed Batches:');
      failedBatches.forEach(batch => {
        console.log(`  - SKU: ${batch.sku}, Batch: ${batch.batchId}, Failed: ${batch.failedJobs}`);
      });
    }
    
    if (skippedBatches.length > 0) {
      console.log('\n⏭️ Skipped Batches:');
      skippedBatches.forEach(batch => {
        console.log(`  - SKU: ${batch.sku}, Batch: ${batch.batchId}, Skipped: ${batch.skippedJobs}`);
      });
    } else {
      console.log('\n🔍 Checking for skipped jobs in all batches...');
      data.forEach(skuGroup => {
        Object.values(skuGroup.batches).forEach(batch => {
          if (batch.skippedJobs > 0) {
            console.log(`  Found skipped jobs in SKU: ${batch.sku}, Batch: ${batch.batchId}, Skipped: ${batch.skippedJobs}`);
          }
        });
      });
    }
    
    console.log('\n✅ Batch filtering test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing batch filtering:', error.message);
  }
}

// Run the test
testBatchFiltering(); 

async function testBatchFiltering() {
  try {
    console.log('Testing batch-level filtering...');
    
    const response = await fetch('http://localhost:3001/api/optimizations/status');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Simulate the filtering logic from useOptimizationStatus
    const activeBatches = [];
    const completedBatches = [];
    const failedBatches = [];
    const skippedBatches = [];
    
    data.forEach(skuGroup => {
      Object.values(skuGroup.batches).forEach(batch => {
        if (batch.isOptimizing) {
          activeBatches.push(batch);
        } else if (batch.completedJobs > 0) {
          completedBatches.push(batch);
        }
        if (batch.failedJobs > 0) {
          failedBatches.push(batch);
        }
        if (batch.skippedJobs > 0) {
          skippedBatches.push(batch);
        }
      });
    });
    
    console.log('\n📊 Filtering Results:');
    console.log('Active batches:', activeBatches.length);
    console.log('Completed batches:', completedBatches.length);
    console.log('Failed batches:', failedBatches.length);
    console.log('Skipped batches:', skippedBatches.length);
    
    if (activeBatches.length > 0) {
      console.log('\n🟢 Active Batches:');
      activeBatches.forEach(batch => {
        console.log(`  - SKU: ${batch.sku}, Batch: ${batch.batchId}, Progress: ${batch.progress}%`);
      });
    }
    
    if (completedBatches.length > 0) {
      console.log('\n✅ Completed Batches:');
      completedBatches.forEach(batch => {
        console.log(`  - SKU: ${batch.sku}, Batch: ${batch.batchId}, Progress: ${batch.progress}%`);
      });
    }
    
    if (failedBatches.length > 0) {
      console.log('\n❌ Failed Batches:');
      failedBatches.forEach(batch => {
        console.log(`  - SKU: ${batch.sku}, Batch: ${batch.batchId}, Failed: ${batch.failedJobs}`);
      });
    }
    
    if (skippedBatches.length > 0) {
      console.log('\n⏭️ Skipped Batches:');
      skippedBatches.forEach(batch => {
        console.log(`  - SKU: ${batch.sku}, Batch: ${batch.batchId}, Skipped: ${batch.skippedJobs}`);
      });
    } else {
      console.log('\n🔍 Checking for skipped jobs in all batches...');
      data.forEach(skuGroup => {
        Object.values(skuGroup.batches).forEach(batch => {
          if (batch.skippedJobs > 0) {
            console.log(`  Found skipped jobs in SKU: ${batch.sku}, Batch: ${batch.batchId}, Skipped: ${batch.skippedJobs}`);
          }
        });
      });
    }
    
    console.log('\n✅ Batch filtering test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing batch filtering:', error.message);
  }
}

// Run the test
testBatchFiltering(); 