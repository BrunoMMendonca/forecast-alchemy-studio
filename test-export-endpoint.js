import fetch from 'node-fetch';

console.log('Testing export endpoint...\n');

async function testExport() {
  try {
    const params = new URLSearchParams({
      method: 'all',
      mapeWeight: '0.4',
      rmseWeight: '0.3',
      maeWeight: '0.2',
      accuracyWeight: '0.1',
    });

    const response = await fetch(`http://localhost:3001/api/jobs/export-results?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`Response status: ${response.status}`);
    console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Error response:', errorText);
    } else {
      const content = await response.text();
      console.log(`Success! Content length: ${content.length} characters`);
      console.log('First 500 characters:');
      console.log(content.substring(0, 500));
    }
  } catch (error) {
    console.error('Fetch error:', error.message);
  }
}

testExport(); 