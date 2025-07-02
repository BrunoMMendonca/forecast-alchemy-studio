import fetch from 'node-fetch';

console.log('Testing backend settings endpoint...\n');

async function testSettings() {
  try {
    // First, get current settings
    console.log('1. Getting current settings...');
    const getResponse = await fetch('http://localhost:3001/api/settings');
    console.log(`   Status: ${getResponse.status}`);
    
    if (getResponse.ok) {
      const settings = await getResponse.json();
      console.log('   Current settings:', settings);
    } else {
      const errorText = await getResponse.text();
      console.log('   Error:', errorText);
    }

    // Then, try to update the CSV separator
    console.log('\n2. Updating CSV separator to semicolon...');
    const updateResponse = await fetch('http://localhost:3001/api/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        frequency: 'monthly',
        seasonalPeriods: 12,
        autoDetectFrequency: true,
        csvSeparator: ';'
      }),
    });

    console.log(`   Status: ${updateResponse.status}`);
    
    if (updateResponse.ok) {
      const result = await updateResponse.json();
      console.log('   Response:', result);
    } else {
      const errorText = await updateResponse.text();
      console.log('   Error:', errorText);
    }

    // Finally, get settings again to confirm the update
    console.log('\n3. Getting updated settings...');
    const getResponse2 = await fetch('http://localhost:3001/api/settings');
    console.log(`   Status: ${getResponse2.status}`);
    
    if (getResponse2.ok) {
      const settings2 = await getResponse2.json();
      console.log('   Updated settings:', settings2);
    } else {
      const errorText = await getResponse2.text();
      console.log('   Error:', errorText);
    }

  } catch (error) {
    console.error('Fetch error:', error.message);
  }
}

testSettings(); 