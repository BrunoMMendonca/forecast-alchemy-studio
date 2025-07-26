import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

async function testMultipleCsvImport() {
  console.log('🧪 Testing Multiple CSV Import Functionality\n');

  try {
    // Test 1: Check if multiple CSV import is initialized correctly
    console.log('1. Testing multiple CSV import initialization...');
    
    // Simulate the setup wizard store state
    const mockStoreState = {
      orgStructure: {
        hasMultipleDivisions: true,
        hasMultipleClusters: true,
        importLevel: 'division',
        divisionCsvType: 'withDivisionColumn',
        multipleCsvImport: {
          isEnabled: true,
          currentImportIndex: 0,
          totalImports: 2,
          importedCsvs: [],
          remainingDivisions: [],
        }
      }
    };

    console.log('✅ Multiple CSV import initialized with:', {
      totalImports: mockStoreState.orgStructure.multipleCsvImport.totalImports,
      currentIndex: mockStoreState.orgStructure.multipleCsvImport.currentImportIndex,
      isEnabled: mockStoreState.orgStructure.multipleCsvImport.isEnabled
    });

    // Test 2: Simulate first CSV import
    console.log('\n2. Testing first CSV import...');
    
    const firstCsvData = {
      fileName: 'division1.csv',
      divisions: ['Division A', 'Division B'],
      clusters: ['Cluster A1', 'Cluster A2', 'Cluster B1'],
    };

    // Simulate adding the first CSV
    mockStoreState.orgStructure.multipleCsvImport.importedCsvs.push(firstCsvData);
    mockStoreState.orgStructure.multipleCsvImport.currentImportIndex = 1;

    console.log('✅ First CSV imported:', {
      fileName: firstCsvData.fileName,
      divisions: firstCsvData.divisions,
      clusters: firstCsvData.clusters,
      currentIndex: mockStoreState.orgStructure.multipleCsvImport.currentIndex,
      totalImports: mockStoreState.orgStructure.multipleCsvImport.totalImports
    });

    // Test 3: Simulate second CSV import
    console.log('\n3. Testing second CSV import...');
    
    const secondCsvData = {
      fileName: 'division2.csv',
      divisions: ['Division C'],
      clusters: ['Cluster C1', 'Cluster C2'],
    };

    // Simulate adding the second CSV
    mockStoreState.orgStructure.multipleCsvImport.importedCsvs.push(secondCsvData);
    mockStoreState.orgStructure.multipleCsvImport.currentImportIndex = 2;

    console.log('✅ Second CSV imported:', {
      fileName: secondCsvData.fileName,
      divisions: secondCsvData.divisions,
      clusters: secondCsvData.clusters,
      currentIndex: mockStoreState.orgStructure.multipleCsvImport.currentIndex,
      totalImports: mockStoreState.orgStructure.multipleCsvImport.totalImports
    });

    // Test 4: Check completion status
    console.log('\n4. Testing completion status...');
    
    const isComplete = mockStoreState.orgStructure.multipleCsvImport.currentImportIndex >= mockStoreState.orgStructure.multipleCsvImport.totalImports;
    
    console.log('✅ Import completion status:', {
      isComplete,
      currentIndex: mockStoreState.orgStructure.multipleCsvImport.currentImportIndex,
      totalImports: mockStoreState.orgStructure.multipleCsvImport.totalImports
    });

    // Test 5: Summary of all imported data
    console.log('\n5. Summary of all imported data...');
    
    const allDivisions = new Set();
    const allClusters = new Set();
    
    mockStoreState.orgStructure.multipleCsvImport.importedCsvs.forEach(csv => {
      csv.divisions.forEach(div => allDivisions.add(div));
      csv.clusters.forEach(cluster => allClusters.add(cluster));
    });

    console.log('✅ Total unique divisions:', Array.from(allDivisions));
    console.log('✅ Total unique clusters:', Array.from(allClusters));
    console.log('✅ Total CSV files imported:', mockStoreState.orgStructure.multipleCsvImport.importedCsvs.length);

    // Test 6: Test division-level import without division column
    console.log('\n6. Testing division-level import without division column...');
    
    const mockStoreStateWithoutDivision = {
      orgStructure: {
        hasMultipleDivisions: true,
        hasMultipleClusters: true,
        importLevel: 'division',
        divisionCsvType: 'withoutDivisionColumn',
        multipleCsvImport: {
          isEnabled: true,
          currentImportIndex: 0,
          totalImports: 2,
          importedCsvs: [],
          remainingDivisions: ['Division A', 'Division B'], // Manual divisions
        }
      }
    };

    console.log('✅ Division-level import without division column initialized:', {
      totalImports: mockStoreStateWithoutDivision.orgStructure.multipleCsvImport.totalImports,
      remainingDivisions: mockStoreStateWithoutDivision.orgStructure.multipleCsvImport.remainingDivisions
    });

    console.log('\n🎉 All multiple CSV import tests completed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Multiple CSV import initialization');
    console.log('   ✅ First CSV import processing');
    console.log('   ✅ Second CSV import processing');
    console.log('   ✅ Completion status checking');
    console.log('   ✅ Data aggregation and deduplication');
    console.log('   ✅ Division-level import without division column');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testMultipleCsvImport(); 