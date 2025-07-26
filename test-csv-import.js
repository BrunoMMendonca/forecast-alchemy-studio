import fetch from 'node-fetch';

async function testCsvImport() {
  const csvData = `Código Material;Nome;Marca;Categoria;01/01/2022;01/02/2022
95000000;SKU Name 1;Brand 1;Cat 1;90;963
95000001;SKU Name 2;Brand 1;Cat 1;910;359`;

  try {
    const response = await fetch('http://localhost:3001/api/generate-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csvData: csvData,
        separator: ';',
        dateFormat: 'dd/mm/yyyy',
        numberFormat: '1,234.56'
      })
      });

      if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Error:', errorData);
      return;
      }

      const result = await response.json();
    console.log('✅ Success!');
    console.log('Headers:', result.headers);
    console.log('Column Roles:', result.columnRoles);
    console.log('First row:', result.previewRows[0]);
    console.log('Separator detected:', result.separator);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testCsvImport(); 