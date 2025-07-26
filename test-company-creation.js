import fetch from 'node-fetch';

async function testCompanyCreation() {
  try {
    console.log('Testing company creation endpoint...');
    
    const response = await fetch('http://localhost:3001/api/setup/companies', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Test Company',
        description: 'Test Description',
        country: 'Test Country'
      })
    });

    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', data);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testCompanyCreation(); 