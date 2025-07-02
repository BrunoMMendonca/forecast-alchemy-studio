import { modelFactory } from './src/backend/models/index.js';
import { GridOptimizer } from './src/backend/optimization/GridOptimizer.js';

// Test data - monthly sales for 36 months (3 years) to ensure enough data for seasonal models
const testData = [
  // Year 1
  { sales: 100 }, { sales: 120 }, { sales: 110 }, { sales: 130 },
  { sales: 125 }, { sales: 140 }, { sales: 135 }, { sales: 150 },
  { sales: 145 }, { sales: 160 }, { sales: 155 }, { sales: 170 },
  // Year 2
  { sales: 165 }, { sales: 180 }, { sales: 175 }, { sales: 190 },
  { sales: 185 }, { sales: 200 }, { sales: 195 }, { sales: 210 },
  { sales: 205 }, { sales: 220 }, { sales: 215 }, { sales: 230 },
  // Year 3
  { sales: 225 }, { sales: 240 }, { sales: 235 }, { sales: 250 },
  { sales: 245 }, { sales: 260 }, { sales: 255 }, { sales: 270 },
  { sales: 265 }, { sales: 280 }, { sales: 275 }, { sales: 290 }
];

async function testModels() {
  console.log('🧪 Testing Real Forecasting Models\n');
  
  // Test individual models
  console.log('1. Testing Individual Models:');
  
  const models = [
    { type: 'simple-exponential-smoothing', params: { alpha: 0.3 } },
    { type: 'holt-linear-trend', params: { alpha: 0.3, beta: 0.1 } },
    { type: 'moving-average', params: { window: 3 } },
    { type: 'holt-winters', params: { alpha: 0.3, beta: 0.1, gamma: 0.1 } },
    { type: 'seasonal-naive', params: {} },
    { type: 'seasonal-moving-average', params: { window: 3 } },
    { type: 'sarima', params: { p: 1, d: 1, q: 1, P: 1, D: 0, Q: 0 } }
  ];
  
  for (const modelConfig of models) {
    try {
      const model = await modelFactory.createModel(modelConfig.type, modelConfig.params);
      console.log(`\n📊 Testing ${model.getName()}:`);
      
      // Train on first 30 months (2.5 years) to ensure enough data for seasonal models
      const trainingData = testData.slice(0, 30);
      await model.train(trainingData);
      console.log(`   ✅ Trained on ${trainingData.length} data points`);
      
      // Validate on last 6 months
      const validationData = testData.slice(30);
      const validation = model.validate(validationData);
      console.log(`   📈 Accuracy: ${validation.accuracy.toFixed(2)}%`);
      console.log(`   📊 MAPE: ${validation.mape.toFixed(2)}%`);
      console.log(`   📊 RMSE: ${validation.rmse.toFixed(2)}`);
      
      // Make future predictions
      const predictions = model.predict(6);
      console.log(`   🔮 Next 6 months: [${predictions.map(p => p.toFixed(1)).join(', ')}]`);
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  // Test grid optimization with a subset of models to avoid timeouts
  console.log('\n2. Testing Grid Optimization (subset of models):');
  
  try {
    const optimizer = new GridOptimizer();
    
    // Use a subset of models for faster testing
    const testModelTypes = ['simple-exponential-smoothing', 'holt-linear-trend', 'moving-average', 'seasonal-naive'];
    
    console.log('   🔍 Running grid search...');
    const results = await optimizer.runGridSearch(testData, testModelTypes);
    
    console.log(`   ✅ Completed! Tested ${results.summary.totalModels} combinations`);
    console.log(`   📊 Best accuracy: ${results.bestResult.accuracy.toFixed(2)}%`);
    console.log(`   📊 Best model: ${results.bestResult.modelType}`);
    console.log(`   📊 Best parameters:`, results.bestResult.parameters);
    
    console.log('\n   🏆 Top 3 Results:');
    const topResults = optimizer.getTopResults(results.results, 3);
    topResults.forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.modelType} (${result.accuracy.toFixed(2)}%) - ${JSON.stringify(result.parameters)}`);
    });
    
  } catch (error) {
    console.log(`   ❌ Grid optimization error: ${error.message}`);
  }
  
  console.log('\n✅ Model testing completed!');
}

// Run the test
testModels().catch(console.error); 