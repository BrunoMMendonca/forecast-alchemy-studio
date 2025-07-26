// Test script for forecast integration
const testForecastIntegration = async () => {
  console.log('🧪 Testing Forecast Integration...\n');

  // Test data
  const testData = [
    { 'Material Code': 'SKU001', 'Date': '2023-01-01', 'Sales': 100 },
    { 'Material Code': 'SKU001', 'Date': '2023-02-01', 'Sales': 120 },
    { 'Material Code': 'SKU001', 'Date': '2023-03-01', 'Sales': 110 },
    { 'Material Code': 'SKU001', 'Date': '2023-04-01', 'Sales': 130 },
    { 'Material Code': 'SKU001', 'Date': '2023-05-01', 'Sales': 125 },
    { 'Material Code': 'SKU001', 'Date': '2023-06-01', 'Sales': 140 },
    { 'Material Code': 'SKU001', 'Date': '2023-07-01', 'Sales': 135 },
    { 'Material Code': 'SKU001', 'Date': '2023-08-01', 'Sales': 150 },
    { 'Material Code': 'SKU001', 'Date': '2023-09-01', 'Sales': 145 },
    { 'Material Code': 'SKU001', 'Date': '2023-10-01', 'Sales': 160 },
    { 'Material Code': 'SKU001', 'Date': '2023-11-01', 'Sales': 155 },
    { 'Material Code': 'SKU001', 'Date': '2023-12-01', 'Sales': 170 }
  ];

  const testModels = [
    {
      id: 'moving_average',
      enabled: true,
      parameters: { window: 3 }
    },
    {
      id: 'simple_exponential_smoothing',
      enabled: true,
      parameters: { alpha: 0.3 }
    }
  ];

  const requestBody = {
    sku: 'SKU001',
    data: testData,
    models: testModels,
    forecastPeriods: 6
  };

  try {
    console.log('📡 Sending request to /api/forecast/generate...');
    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch('http://localhost:3001/api/forecast/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    
    console.log('\n✅ Forecast generation successful!');
    console.log('Results:', JSON.stringify(result, null, 2));
    
    // Validate results
    if (result.results && Array.isArray(result.results)) {
      console.log(`\n📊 Generated ${result.results.length} forecast results`);
      
      result.results.forEach((forecast, index) => {
        console.log(`\n${index + 1}. Model: ${forecast.model}`);
        if (forecast.error) {
          console.log(`   ❌ Error: ${forecast.error}`);
        } else {
          console.log(`   ✅ Predictions: ${forecast.predictions.length} periods`);
          console.log(`   📅 First prediction: ${forecast.predictions[0]?.date} = ${forecast.predictions[0]?.value}`);
          console.log(`   📅 Last prediction: ${forecast.predictions[forecast.predictions.length - 1]?.date} = ${forecast.predictions[forecast.predictions.length - 1]?.value}`);
        }
      });
    } else {
      console.log('❌ Unexpected response format');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
};

// Run the test
testForecastIntegration(); 
 
 
 