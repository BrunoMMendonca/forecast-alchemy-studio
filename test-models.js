import { modelFactory } from './src/backend/models/index.js';
import { GridOptimizer } from './src/backend/optimization/GridOptimizer.js';

// Test data - monthly sales for 24 months
const testData = [
  { sales: 100 }, { sales: 120 }, { sales: 110 }, { sales: 130 },
  { sales: 125 }, { sales: 140 }, { sales: 135 }, { sales: 150 },
  { sales: 145 }, { sales: 160 }, { sales: 155 }, { sales: 170 },
  { sales: 165 }, { sales: 180 }, { sales: 175 }, { sales: 190 },
  { sales: 185 }, { sales: 200 }, { sales: 195 }, { sales: 210 },
  { sales: 205 }, { sales: 220 }, { sales: 215 }, { sales: 230 }
];

async function testModels() {
  console.log('🧪 Testing Real Forecasting Models\n');
  
  // Test individual models
  console.log('1. Testing Individual Models:');
  
  const models = [
    { type: 'simple-exponential-smoothing', params: { alpha: 0.3 } },
    { type: 'holt-linear-trend', params: { alpha: 0.3, beta: 0.1 } },
    { type: 'moving-average', params: { window: 3 } }
  ];
  
  for (const modelConfig of models) {
    try {
      const model = modelFactory.createModel(modelConfig.type, modelConfig.params);
      console.log(`\n📊 Testing ${model.getName()}:`);
      
      // Train on first 20 months
      const trainingData = testData.slice(0, 20);
      model.train(trainingData);
      console.log(`   ✅ Trained on ${trainingData.length} data points`);
      
      // Validate on last 4 months
      const validationData = testData.slice(20);
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
  
  // Test grid optimization
  console.log('\n2. Testing Grid Optimization:');
  
  try {
    const optimizer = new GridOptimizer();
    
    console.log('   🔍 Running grid search...');
    const results = await optimizer.runGridSearch(testData);
    
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