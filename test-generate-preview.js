import fetch from 'node-fetch';

const testGeneratePreview = async () => {
  const testData = {
    csvData: `Material Code,Description,2024-01,2024-02,2024-03
SKU001,Product A,100,150,200
SKU002,Product B,75,125,175
SKU003,Product C,50,100,150`,
    transposed: false,
    separator: ',',
    dateFormat: 'YYYY-MM',
    numberFormat: 'standard'
  };

  try {
    console.log('Testing /generate-preview endpoint...');
    console.log('Request data:', JSON.stringify(testData, null, 2));

    const response = await fetch('http://localhost:3001/generate-preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('\n✅ /generate-preview endpoint is working!');
    console.log('Response:', JSON.stringify(result, null, 2));
    
    // Verify expected response structure
    if (result.headers && result.previewRows && result.columnRoles) {
      console.log('\n✅ Response structure is correct');
      console.log(`- Headers: ${result.headers.length} columns`);
      console.log(`- Preview rows: ${result.previewRows.length} rows`);
      console.log(`- Column roles: ${result.columnRoles.join(', ')}`);
    } else {
      console.log('\n❌ Response structure is missing expected fields');
    }

  } catch (error) {
    console.error('❌ Error testing /generate-preview:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure the backend server is running on port 3001');
      console.log('   Run: npm run start:api');
    }
  }
};

// Run the test
testGeneratePreview(); 