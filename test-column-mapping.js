const fs = require('fs');
const path = require('path');

// Test the column mapping system
async function testColumnMapping() {
  console.log('🧪 Testing Column Mapping System...\n');

  // 1. Check if processed data files exist
  const uploadsDir = path.join(__dirname, 'uploads');
  const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('-processed.json'));
  
  if (files.length === 0) {
    console.log('❌ No processed data files found. Please upload a CSV file first.');
    return;
  }

  console.log(`📁 Found ${files.length} processed data file(s):`);
  files.forEach(f => console.log(`   - ${f}`));
  console.log();

  // 2. Test each file for column mapping
  for (const file of files) {
    console.log(`🔍 Testing file: ${file}`);
    
    try {
      const filePath = path.join(uploadsDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Check if column mapping exists
      if (data.columnRoles && data.columns) {
        console.log(`   ✅ Column mapping found:`);
        console.log(`      Column Roles: ${data.columnRoles.join(', ')}`);
        console.log(`      Original Columns: ${data.columns.join(', ')}`);
        
        // Create mapping object
        const columnMapping = {};
        data.columnRoles.forEach((role, index) => {
          columnMapping[role] = data.columns[index];
        });
        
        console.log(`   📋 Column Mapping:`);
        Object.entries(columnMapping).forEach(([role, originalName]) => {
          console.log(`      ${role} → ${originalName}`);
        });
        
        // Test data access
        if (data.data && data.data.length > 0) {
          const firstRow = data.data[0];
          console.log(`   📊 Sample data access:`);
          
          // Test SKU access
          const skuColumn = columnMapping['Material Code'] || 'Material Code';
          const skuValue = firstRow[skuColumn];
          console.log(`      SKU (${skuColumn}): ${skuValue}`);
          
          // Test Sales access
          const salesColumn = columnMapping['Sales'] || 'Sales';
          const salesValue = firstRow[salesColumn];
          console.log(`      Sales (${salesColumn}): ${salesValue}`);
          
          // Test Date access
          const dateColumn = columnMapping['Date'] || 'Date';
          const dateValue = firstRow[dateColumn];
          console.log(`      Date (${dateColumn}): ${dateValue}`);
          
          // Count unique SKUs
          const uniqueSKUs = new Set(data.data.map(row => row[skuColumn]));
          console.log(`   📈 Data summary:`);
          console.log(`      Total rows: ${data.data.length}`);
          console.log(`      Unique SKUs: ${uniqueSKUs.size}`);
          console.log(`      Sample SKUs: ${Array.from(uniqueSKUs).slice(0, 5).join(', ')}`);
        }
        
      } else {
        console.log(`   ⚠️  No column mapping found - using legacy hardcoded names`);
        console.log(`      Available columns: ${Object.keys(data.data[0] || {}).join(', ')}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error reading file: ${error.message}`);
    }
    
    console.log();
  }

  console.log('✅ Column mapping test completed!');
}

// Run the test
testColumnMapping().catch(console.error); 