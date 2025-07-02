import fs from 'fs';
import fetch from 'node-fetch';

const BACKEND_URL = 'http://localhost:3001';

async function testTranspose() {
  console.log('🧪 Testing CSV Transpose Functionality\n');

  try {
    console.log('📁 Testing test-comma.csv with transpose...');
    
    // Read the test file
    const csvData = fs.readFileSync('test-comma.csv', 'utf-8');
    console.log('Original CSV:');
    console.log(csvData);
    
    // Test without transpose first
    console.log('\n--- WITHOUT TRANSPOSE ---');
    const response1 = await fetch(`${BACKEND_URL}/api/generate-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvData })
    });

    if (!response1.ok) {
      throw new Error(`HTTP ${response1.status}: ${response1.statusText}`);
    }

    const result1 = await response1.json();
    console.log('Headers:', result1.headers);
    console.log('Preview rows:', result1.previewRows.length);
    console.log('Transposed:', result1.transposed);
    console.log('Sample row:', result1.previewRows[0]);

    // Test with transpose
    console.log('\n--- WITH TRANSPOSE ---');
    const response2 = await fetch(`${BACKEND_URL}/api/generate-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvData, transposed: true })
    });

    if (!response2.ok) {
      throw new Error(`HTTP ${response2.status}: ${response2.statusText}`);
    }

    const result2 = await response2.json();
    console.log('Headers:', result2.headers);
    console.log('Preview rows:', result2.previewRows.length);
    console.log('Transposed:', result2.transposed);
    console.log('Sample row:', result2.previewRows[0]);
    
  } catch (error) {
    console.error('❌ Error testing transpose:', error.message);
  }
}

// Check if backend is running
async function checkBackend() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/settings`);
    if (response.ok) {
      console.log('✅ Backend server is running\n');
      return true;
    }
  } catch (error) {
    console.log('❌ Backend server is not running or not accessible');
    console.log('   Please start the backend server with: node server.js\n');
    return false;
  }
}

async function main() {
  const backendRunning = await checkBackend();
  if (backendRunning) {
    await testTranspose();
  }
}

main().catch(console.error); 