import fetch from 'node-fetch';

async function testAPI() {
  try {
    const url = 'http://localhost:3001/api/jobs/best-results-per-model?sku=95000000&filePath=uploads/Original_CSV_Upload-1751378378803-e6e71ef3-processed.json';
    console.log('Testing API:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAPI(); 