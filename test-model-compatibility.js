import { modelFactory } from './src/backend/models/ModelFactory.js';

console.log('🧪 Testing Model Compatibility Validation\n');

// Test data requirements
console.log('1. Testing Model Data Requirements:');
const requirements = modelFactory.getModelDataRequirements(12);
for (const [modelType, req] of Object.entries(requirements)) {
  console.log(`   ${modelType}: ${req.minObservations} observations - ${req.description}`);
}

console.log('\n2. Testing Model Compatibility:');
const testCases = [
  { dataLength: 5, seasonalPeriod: 12, description: 'Very small dataset' },
  { dataLength: 10, seasonalPeriod: 12, description: 'Small dataset (ARIMA minimum)' },
  { dataLength: 12, seasonalPeriod: 12, description: 'One season' },
  { dataLength: 24, seasonalPeriod: 12, description: 'Two seasons' },
  { dataLength: 50, seasonalPeriod: 12, description: 'Large dataset' }
];

for (const testCase of testCases) {
  console.log(`\n   Testing with ${testCase.dataLength} observations (${testCase.description}):`);
  
  const allModels = modelFactory.getAvailableModels();
  const compatible = [];
  const incompatible = [];
  
  for (const modelType of allModels) {
    const isCompatible = modelFactory.isModelCompatible(modelType, testCase.dataLength, testCase.seasonalPeriod);
    if (isCompatible) {
      compatible.push(modelType);
    } else {
      const req = requirements[modelType];
      const reason = req ? 
        `requires ${req.minObservations} observations` : 
        'requires at least 5 observations';
      incompatible.push(`${modelType} (${reason})`);
    }
  }
  
  console.log(`     ✅ Compatible (${compatible.length}): ${compatible.join(', ')}`);
  console.log(`     ❌ Incompatible (${incompatible.length}): ${incompatible.join(', ')}`);
}

console.log('\n3. Testing Edge Cases:');
console.log('   ARIMA with 9 observations:', modelFactory.isModelCompatible('arima', 9, 12) ? '✅ Compatible' : '❌ Incompatible');
console.log('   SARIMA with 19 observations:', modelFactory.isModelCompatible('sarima', 19, 12) ? '✅ Compatible' : '❌ Incompatible');
console.log('   SARIMA with 20 observations:', modelFactory.isModelCompatible('sarima', 20, 12) ? '✅ Compatible' : '❌ Incompatible');
console.log('   Seasonal Naive with 11 observations:', modelFactory.isModelCompatible('seasonal-naive', 11, 12) ? '✅ Compatible' : '❌ Incompatible');
console.log('   Seasonal Naive with 12 observations:', modelFactory.isModelCompatible('seasonal-naive', 12, 12) ? '✅ Compatible' : '❌ Incompatible');

console.log('\n✅ Model compatibility validation tests completed!'); 