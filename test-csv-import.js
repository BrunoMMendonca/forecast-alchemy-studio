import fs from 'fs';
import fetch from 'node-fetch';

const BACKEND_URL = 'http://localhost:3001';

async function testCsvImport() {
  console.log('🧪 Testing CSV Import with Different Separators\n');

  const testFiles = [
    { name: 'test-comma.csv', expected: ',' },
    { name: 'test-semicolon.csv', expected: ';' },
    { name: 'test-tab.csv', expected: '\t' },
    { name: 'test-pipe.csv', expected: '|' }
  ];

  for (const testFile of testFiles) {
    try {
      console.log(`📁 Testing ${testFile.name}...`);
      
      // Read the test file
      const csvData = fs.readFileSync(testFile.name, 'utf-8');
      
      // Send to backend
      const response = await fetch(`${BACKEND_URL}/api/generate-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      console.log(`   Expected separator: "${testFile.expected}"`);
      console.log(`   Detected separator: "${result.separator}"`);
      console.log(`   Headers found: ${result.headers.length}`);
      console.log(`   Preview rows: ${result.previewRows.length}`);
      
      if (result.separator === testFile.expected) {
        console.log(`   ✅ Separator detection: PASSED`);
      } else {
        console.log(`   ❌ Separator detection: FAILED`);
      }
      
      console.log('');
      
    } catch (error) {
      console.error(`   ❌ Error testing ${testFile.name}:`, error.message);
      console.log('');
    }
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
    await testCsvImport();
  }
}

main().catch(console.error); 