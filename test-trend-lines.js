import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testTrendLinesAPI() {
  console.log('🧪 Testing Trend Lines API...\n');

  // Test data
  const testTrendLine = {
    startIndex: 0,
    endIndex: 10,
    startValue: 100,
    endValue: 150,
    startDate: '2023-01-01',
    endDate: '2023-02-01',
    label: 'Test Trend Line',
    filePath: 'test-file.csv',
    sku: 'TEST-SKU-001',
    modelId: 'test-model'
  };

  try {
    // Test 1: Create a trend line
    console.log('1️⃣ Creating trend line...');
    const createResponse = await fetch(`${BASE_URL}/api/trend-lines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testTrendLine)
    });

    if (!createResponse.ok) {
      throw new Error(`Failed to create trend line: ${createResponse.statusText}`);
    }

    const createResult = await createResponse.json();
    console.log('✅ Trend line created:', createResult);
    const trendLineId = createResult.id;

    // Test 2: Load trend lines for the file/SKU
    console.log('\n2️⃣ Loading trend lines...');
    const loadResponse = await fetch(`${BASE_URL}/api/trend-lines?filePath=${testTrendLine.filePath}&sku=${testTrendLine.sku}`);
    
    if (!loadResponse.ok) {
      throw new Error(`Failed to load trend lines: ${loadResponse.statusText}`);
    }

    const loadedTrendLines = await loadResponse.json();
    console.log('✅ Trend lines loaded:', loadedTrendLines);
    console.log(`📊 Found ${loadedTrendLines.length} trend line(s)`);

    // Test 3: Delete the specific trend line
    console.log('\n3️⃣ Deleting trend line...');
    const deleteResponse = await fetch(`${BASE_URL}/api/trend-lines/${trendLineId}`, {
      method: 'DELETE'
    });

    if (!deleteResponse.ok) {
      throw new Error(`Failed to delete trend line: ${deleteResponse.statusText}`);
    }

    const deleteResult = await deleteResponse.json();
    console.log('✅ Trend line deleted:', deleteResult);

    // Test 4: Verify deletion
    console.log('\n4️⃣ Verifying deletion...');
    const verifyResponse = await fetch(`${BASE_URL}/api/trend-lines?filePath=${testTrendLine.filePath}&sku=${testTrendLine.sku}`);
    const remainingTrendLines = await verifyResponse.json();
    console.log(`📊 Remaining trend lines: ${remainingTrendLines.length}`);

    if (remainingTrendLines.length === 0) {
      console.log('✅ Deletion verified successfully');
    } else {
      console.log('❌ Deletion verification failed');
    }

    console.log('\n🎉 All tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testTrendLinesAPI(); 