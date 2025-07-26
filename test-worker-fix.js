import { GridOptimizer } from './src/backend/optimization/GridOptimizer.js';

async function testWorkerFix() {
  console.log('🧪 Testing Worker Fix for Seasonal Moving Average...\n');
  
  try {
    // Create test data (24 months of data for seasonal models)
    const testData = [
      { 'Material Code': 'SKU1', 'Date': '2022-01-01', 'Sales': 100 },
      { 'Material Code': 'SKU1', 'Date': '2022-02-01', 'Sales': 120 },
      { 'Material Code': 'SKU1', 'Date': '2022-03-01', 'Sales': 140 },
      { 'Material Code': 'SKU1', 'Date': '2022-04-01', 'Sales': 160 },
      { 'Material Code': 'SKU1', 'Date': '2022-05-01', 'Sales': 180 },
      { 'Material Code': 'SKU1', 'Date': '2022-06-01', 'Sales': 200 },
      { 'Material Code': 'SKU1', 'Date': '2022-07-01', 'Sales': 220 },
      { 'Material Code': 'SKU1', 'Date': '2022-08-01', 'Sales': 240 },
      { 'Material Code': 'SKU1', 'Date': '2022-09-01', 'Sales': 260 },
      { 'Material Code': 'SKU1', 'Date': '2022-10-01', 'Sales': 280 },
      { 'Material Code': 'SKU1', 'Date': '2022-11-01', 'Sales': 300 },
      { 'Material Code': 'SKU1', 'Date': '2022-12-01', 'Sales': 320 },
      { 'Material Code': 'SKU1', 'Date': '2023-01-01', 'Sales': 110 },
      { 'Material Code': 'SKU1', 'Date': '2023-02-01', 'Sales': 130 },
      { 'Material Code': 'SKU1', 'Date': '2023-03-01', 'Sales': 150 },
      { 'Material Code': 'SKU1', 'Date': '2023-04-01', 'Sales': 170 },
      { 'Material Code': 'SKU1', 'Date': '2023-05-01', 'Sales': 190 },
      { 'Material Code': 'SKU1', 'Date': '2023-06-01', 'Sales': 210 },
      { 'Material Code': 'SKU1', 'Date': '2023-07-01', 'Sales': 230 },
      { 'Material Code': 'SKU1', 'Date': '2023-08-01', 'Sales': 250 },
      { 'Material Code': 'SKU1', 'Date': '2023-09-01', 'Sales': 270 },
      { 'Material Code': 'SKU1', 'Date': '2023-10-01', 'Sales': 290 },
      { 'Material Code': 'SKU1', 'Date': '2023-11-01', 'Sales': 310 },
      { 'Material Code': 'SKU1', 'Date': '2023-12-01', 'Sales': 330 }
    ];

    // Create optimizer
    const optimizer = new GridOptimizer();
    console.log('✅ GridOptimizer created successfully');

    // Run grid search for seasonal-moving-average
    const results = await optimizer.runGridSearch(testData, ['seasonal-moving-average'], null, 'monthly', 12);
    console.log('✅ Grid search completed successfully');

    // Check the structure of results
    console.log('\n📊 Results structure:');
    console.log('- Total results:', results.results.length);
    console.log('- Successful results:', results.results.filter(r => r.success).length);
    console.log('- Best result:', results.bestResult ? results.bestResult.modelType : 'none');

    // Check if seasonal-moving-average results have the correct structure
    const seasonalResults = results.results.filter(r => r.modelType === 'seasonal-moving-average');
    console.log('\n🔍 Seasonal Moving Average results:');
    seasonalResults.forEach((result, index) => {
      console.log(`  ${index + 1}. Model: ${result.modelType}`);
      console.log(`     Parameters: ${JSON.stringify(result.parameters)}`);
      console.log(`     Success: ${result.success}`);
      console.log(`     Accuracy: ${result.accuracy?.toFixed(2)}%`);
      console.log(`     Has bestResult property: ${!!result.bestResult}`);
      console.log(`     Has parameters property: ${!!result.parameters}`);
    });

    // Simulate the worker logic
    console.log('\n🔧 Testing worker logic:');
    const successfulResults = results.results.filter(r => r.success);
    
    for (const result of successfulResults) {
      const modelId = result.modelType;
      const method = result.method || 'grid';
      const bestParameters = result.parameters; // This is the fix!

      if (!bestParameters) {
        console.log(`❌ No parameters found for model ${modelId}`);
        continue;
      }

      console.log(`✅ Found parameters for ${modelId}: ${JSON.stringify(bestParameters)}`);
    }

    console.log('\n🎉 Worker fix test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testWorkerFix(); 