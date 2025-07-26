import fetch from 'node-fetch';

async function testAPIEndpoint() {
  try {
    console.log('🔍 Testing /api/load-processed-data endpoint...');
    
    const response = await fetch('http://localhost:3001/api/load-processed-data?datasetId=6');
    
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Success! Data loaded:');
      console.log('Data length:', data.data?.length);
      console.log('Sample data:', data.data?.slice(0, 2));
      console.log('Columns:', data.columns);
      console.log('Column roles:', data.columnRoles);
    } else {
      const errorText = await response.text();
      console.log('❌ Error response:', errorText);
      try {
        const errorJson = JSON.parse(errorText);
        console.log('❌ Error JSON:', errorJson);
      } catch (e) {
        console.log('❌ Error is not JSON');
      }
    }
    
  } catch (error) {
    console.error('❌ Network error:', error);
  }
}

testAPIEndpoint(); 