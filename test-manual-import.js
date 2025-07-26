// Test CSV data

// Test CSV data
const testCsvData = `Código Material,Nome,Marca,Categoria,01/01/2022,01/02/2022
95000000,SKU Name 1,Brand 1,Cat 1,90,963
95000001,SKU Name 2,Brand 2,Cat 2,120,150`;

async function testManualImport() {
  try {
    console.log('🧪 Testing manual CSV import...');
    
    const response = await fetch('http://localhost:3001/api/manual-csv-import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        csvData: testCsvData,
        columnMapping: {
          'Código Material': 'Material Code',
          'Nome': 'Description',
          'Marca': 'Brand',
          'Categoria': 'Category',
          '01/01/2022': 'Date',
          '01/02/2022': 'Date'
        },
        dateFormat: 'dd/mm/yyyy',
        separator: ',',
        transposed: false
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Manual import successful!');
      console.log('Dataset ID:', result.datasetId);
      console.log('Dataset Identifier:', result.datasetIdentifier);
      console.log('Summary:', result.summary);
    } else {
      console.log('❌ Manual import failed:');
      console.log('Error:', result.error);
      console.log('Details:', result.details);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testManualImport(); 