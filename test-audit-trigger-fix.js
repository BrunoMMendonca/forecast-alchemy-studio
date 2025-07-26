const axios = require('axios');

async function testManualImport() {
  try {
    console.log('Testing manual import after audit trigger fix...');
    
    // Test data
    const testData = {
      csvFileName: 'test-data.csv',
      columnMapping: {
        'Material Code': 'sku',
        'Date': 'date',
        'Sales': 'value'
      },
      transformedData: [
        { 'Material Code': 'SKU001', 'Date': '2024-01-01', 'Sales': '100' },
        { 'Material Code': 'SKU001', 'Date': '2024-01-02', 'Sales': '150' },
        { 'Material Code': 'SKU002', 'Date': '2024-01-01', 'Sales': '200' }
      ],
      columnRoles: {
        'Material Code': 'sku',
        'Date': 'date', 
        'Sales': 'value'
      },
      datasetName: 'Test Dataset',
      csvHash: 'test-hash-123'
    };

    const response = await axios.post('http://192.168.1.66:8080/api/process-manual-import', testData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      }
    });

    console.log('✅ Manual import successful!');
    console.log('Response:', response.data);
    
  } catch (error) {
    console.error('❌ Manual import failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testManualImport(); 