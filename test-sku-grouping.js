import fetch from 'node-fetch';

async function testSKUGrouping() {
  try {
    console.log('Testing SKU-based grouping API...');
    
    const response = await fetch('http://localhost:3001/api/optimizations/status');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('\n✅ API Response Structure:');
    console.log('Type:', Array.isArray(data) ? 'Array' : typeof data);
    console.log('Length:', data.length);
    
    if (data.length > 0) {
      const firstSkuGroup = data[0];
      console.log('\n📊 First SKU Group Structure:');
      console.log('SKU:', firstSkuGroup.sku);
      console.log('File Path:', firstSkuGroup.filePath);
      console.log('Total Jobs:', firstSkuGroup.totalJobs);
      console.log('Progress:', firstSkuGroup.progress + '%');
      console.log('Is Optimizing:', firstSkuGroup.isOptimizing);
      console.log('Methods:', firstSkuGroup.methods);
      console.log('Models:', firstSkuGroup.models);
      
      console.log('\n📦 Batches:');
      const batchKeys = Object.keys(firstSkuGroup.batches);
      console.log('Number of batches:', batchKeys.length);
      
      if (batchKeys.length > 0) {
        const firstBatch = firstSkuGroup.batches[batchKeys[0]];
        console.log('\n🔧 First Batch Structure:');
        console.log('Batch ID:', firstBatch.batchId);
        console.log('Reason:', firstBatch.reason);
        console.log('Priority:', firstBatch.priority);
        console.log('Created At:', firstBatch.createdAt);
        console.log('Total Jobs:', firstBatch.totalJobs);
        console.log('Progress:', firstBatch.progress + '%');
        console.log('Is Optimizing:', firstBatch.isOptimizing);
        
        console.log('\n📋 Optimizations in first batch:');
        const optimizationKeys = Object.keys(firstBatch.optimizations || {});
        console.log('Number of optimizations:', optimizationKeys.length);
        
        if (optimizationKeys.length > 0) {
          const firstOptimization = firstBatch.optimizations[optimizationKeys[0]];
          console.log('\n🎯 First Optimization Structure:');
          console.log('Optimization ID:', firstOptimization.optimizationId);
          console.log('Model:', firstOptimization.modelDisplayName);
          console.log('Method:', firstOptimization.methodDisplayName);
          console.log('Reason:', firstOptimization.reason);
          console.log('Status:', firstOptimization.status);
          console.log('Progress:', firstOptimization.progress + '%');
          console.log('Jobs count:', firstOptimization.jobs.length);
        }
      }
    }
    
    console.log('\n✅ SKU-based grouping API test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing SKU grouping:', error.message);
  }
}

// Run the test
testSKUGrouping(); 

async function testSKUGrouping() {
  try {
    console.log('Testing SKU-based grouping API...');
    
    const response = await fetch('http://localhost:3001/api/optimizations/status');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('\n✅ API Response Structure:');
    console.log('Type:', Array.isArray(data) ? 'Array' : typeof data);
    console.log('Length:', data.length);
    
    if (data.length > 0) {
      const firstSkuGroup = data[0];
      console.log('\n📊 First SKU Group Structure:');
      console.log('SKU:', firstSkuGroup.sku);
      console.log('File Path:', firstSkuGroup.filePath);
      console.log('Total Jobs:', firstSkuGroup.totalJobs);
      console.log('Progress:', firstSkuGroup.progress + '%');
      console.log('Is Optimizing:', firstSkuGroup.isOptimizing);
      console.log('Methods:', firstSkuGroup.methods);
      console.log('Models:', firstSkuGroup.models);
      
      console.log('\n📦 Batches:');
      const batchKeys = Object.keys(firstSkuGroup.batches);
      console.log('Number of batches:', batchKeys.length);
      
      if (batchKeys.length > 0) {
        const firstBatch = firstSkuGroup.batches[batchKeys[0]];
        console.log('\n🔧 First Batch Structure:');
        console.log('Batch ID:', firstBatch.batchId);
        console.log('Reason:', firstBatch.reason);
        console.log('Priority:', firstBatch.priority);
        console.log('Created At:', firstBatch.createdAt);
        console.log('Total Jobs:', firstBatch.totalJobs);
        console.log('Progress:', firstBatch.progress + '%');
        console.log('Is Optimizing:', firstBatch.isOptimizing);
        
        console.log('\n📋 Optimizations in first batch:');
        const optimizationKeys = Object.keys(firstBatch.optimizations || {});
        console.log('Number of optimizations:', optimizationKeys.length);
        
        if (optimizationKeys.length > 0) {
          const firstOptimization = firstBatch.optimizations[optimizationKeys[0]];
          console.log('\n🎯 First Optimization Structure:');
          console.log('Optimization ID:', firstOptimization.optimizationId);
          console.log('Model:', firstOptimization.modelDisplayName);
          console.log('Method:', firstOptimization.methodDisplayName);
          console.log('Reason:', firstOptimization.reason);
          console.log('Status:', firstOptimization.status);
          console.log('Progress:', firstOptimization.progress + '%');
          console.log('Jobs count:', firstOptimization.jobs.length);
        }
      }
    }
    
    console.log('\n✅ SKU-based grouping API test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing SKU grouping:', error.message);
  }
}

// Run the test
testSKUGrouping(); 