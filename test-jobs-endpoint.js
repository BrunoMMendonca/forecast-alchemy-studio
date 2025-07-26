import fetch from 'node-fetch';

async function testJobsEndpoint() {
  const testData = {
    skus: ["95000000"],
    models: ["simple-exponential-smoothing"],
    method: "grid",
    datasetId: 60,  // Using dataset 60 which we know exists
    batchId: "1752282220634",
    batchTimestamp: 1752282220634,
    data: [{"Material Code": "95000000", "Date": "2022-01-01T00:00:00.000Z", "Sales": "90"}],
    metricWeights: {mape: 0.4, rmse: 0.3, mae: 0.2, accuracy: 0.1},
    optimizationHash: "71f7c8456a6f9891358aa0a19efbed28c51679c46fcd838d84048ad1ffa5e669",
    reason: "dataset_upload"
  };

  try {
    console.log('Testing /jobs endpoint with data:', JSON.stringify(testData, null, 2));
    
    const response = await fetch('http://192.168.1.66:8080/api/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    console.log('Response status:', response.status);
    const responseText = await response.text();
    console.log('Response body:', responseText);
    
    if (response.ok) {
      console.log('✅ Job creation successful');
      const responseData = JSON.parse(responseText);
      console.log('Response data:', JSON.stringify(responseData, null, 2));
    } else {
      console.log('❌ Job creation failed');
      try {
        const errorData = JSON.parse(responseText);
        console.log('Error details:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.log('Error response (not JSON):', responseText);
      }
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testJobsEndpoint(); 