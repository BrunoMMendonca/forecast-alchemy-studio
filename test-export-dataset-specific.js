import fetch from 'node-fetch';

const BACKEND_URL = 'http://localhost:3001';

async function testDatasetSpecificExport() {
  console.log('🧪 Testing Dataset-Specific Export Functionality\\n');

  try {
    // Test 1: Export all results (no filePath filter)
    console.log('📊 Test 1: Export all results (no filePath filter)');
    const response1 = await fetch(`${BACKEND_URL}/api/jobs/export-results?method=all&mapeWeight=0.4&rmseWeight=0.3&maeWeight=0.2&accuracyWeight=0.1`);
    
    if (response1.ok) {
      const csv1 = await response1.text();
      const lines1 = csv1.split('\\n').filter(line => line.trim());
      console.log(`✅ All results export: ${lines1.length - 1} data rows (excluding header)`);
    } else {
      const error1 = await response1.json();
      console.log(`❌ All results export failed: ${error1.error}`);
    }

    // Test 2: Export with specific filePath filter
    console.log('\\n📊 Test 2: Export with specific filePath filter');
    const testFilePath = 'uploads/test-comma.csv';
    const response2 = await fetch(`${BACKEND_URL}/api/jobs/export-results?method=all&mapeWeight=0.4&rmseWeight=0.3&maeWeight=0.2&accuracyWeight=0.1&filePath=${encodeURIComponent(testFilePath)}`);
    
    if (response2.ok) {
      const csv2 = await response2.text();
      const lines2 = csv2.split('\\n').filter(line => line.trim());
      console.log(`✅ Dataset-specific export: ${lines2.length - 1} data rows (excluding header)`);
      
      // Check if the CSV contains the expected filePath
      if (csv2.includes(testFilePath)) {
        console.log(`✅ CSV contains the expected filePath: ${testFilePath}`);
      } else {
        console.log(`⚠️ CSV does not contain the expected filePath: ${testFilePath}`);
      }
    } else {
      const error2 = await response2.json();
      console.log(`❌ Dataset-specific export failed: ${error2.error}`);
    }

    // Test 3: Export with non-existent filePath
    console.log('\\n📊 Test 3: Export with non-existent filePath');
    const nonExistentPath = 'uploads/non-existent-file.csv';
    const response3 = await fetch(`${BACKEND_URL}/api/jobs/export-results?method=all&mapeWeight=0.4&rmseWeight=0.3&maeWeight=0.2&accuracyWeight=0.1&filePath=${encodeURIComponent(nonExistentPath)}`);
    
    if (response3.ok) {
      const csv3 = await response3.text();
      const lines3 = csv3.split('\\n').filter(line => line.trim());
      console.log(`✅ Non-existent filePath export: ${lines3.length - 1} data rows (should be 0)`);
    } else {
      const error3 = await response3.json();
      console.log(`✅ Non-existent filePath correctly returned error: ${error3.error}`);
    }

    console.log('\\n🎉 Dataset-specific export testing completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testDatasetSpecificExport(); 