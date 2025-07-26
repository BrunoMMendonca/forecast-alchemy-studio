import { SeasonalNaive } from './src/backend/models/SeasonalNaive.js';

async function testSeasonalNaive() {
  console.log('🧪 Testing SeasonalNaive model fix...\n');
  
  try {
    // Create test data (12 months of data for seasonal naive)
    const testData = [
      { 'Material Code': 'SKU1', 'Date': '2023-01-01', 'Sales': 100 },
      { 'Material Code': 'SKU1', 'Date': '2023-02-01', 'Sales': 120 },
      { 'Material Code': 'SKU1', 'Date': '2023-03-01', 'Sales': 140 },
      { 'Material Code': 'SKU1', 'Date': '2023-04-01', 'Sales': 160 },
      { 'Material Code': 'SKU1', 'Date': '2023-05-01', 'Sales': 180 },
      { 'Material Code': 'SKU1', 'Date': '2023-06-01', 'Sales': 200 },
      { 'Material Code': 'SKU1', 'Date': '2023-07-01', 'Sales': 220 },
      { 'Material Code': 'SKU1', 'Date': '2023-08-01', 'Sales': 240 },
      { 'Material Code': 'SKU1', 'Date': '2023-09-01', 'Sales': 260 },
      { 'Material Code': 'SKU1', 'Date': '2023-10-01', 'Sales': 280 },
      { 'Material Code': 'SKU1', 'Date': '2023-11-01', 'Sales': 300 },
      { 'Material Code': 'SKU1', 'Date': '2023-12-01', 'Sales': 320 }
    ];

    // Create model instance
    const model = new SeasonalNaive({}, 12);
    console.log('✅ Model created successfully');

    // Train the model
    model.train(testData);
    console.log('✅ Model trained successfully');

    // Make predictions
    const predictions = model.predict(3);
    console.log('✅ Predictions generated:', predictions);

    // Validate the model
    const validation = model.validate(testData.slice(0, 3));
    console.log('✅ Validation completed:', {
      mape: validation.mape.toFixed(2),
      rmse: validation.rmse.toFixed(2),
      mae: validation.mae.toFixed(2)
    });

    console.log('\n🎉 SeasonalNaive model is working correctly!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testSeasonalNaive(); 