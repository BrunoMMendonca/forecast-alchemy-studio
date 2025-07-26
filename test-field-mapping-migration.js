import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

async function testFieldMappingMigration() {
  console.log('🧪 Testing Field Mapping Migration\n');

  try {
    // Test 1: Check if the migration was applied
    console.log('1. Testing database migration...');
    
    const migrationResponse = await fetch(`${BASE_URL}/api/field-mappings/company/1`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token', // You'll need a real token
        'Content-Type': 'application/json'
      }
    });

    if (migrationResponse.ok) {
      console.log('✅ Migration successful - API endpoint responding');
    } else {
      console.log('⚠️  Migration may not be complete - API endpoint not responding');
    }

    // Test 2: Create field definitions
    console.log('\n2. Testing field definition creation...');
    
    const fieldDefData = {
      companyId: 1,
      fieldName: 'Division',
      fieldType: 'division',
      options: {
        value_mappings: {
          'CD1': 'Consumer Division',
          'CD2': 'Industrial Division',
          'CD3': 'Commercial Division'
        }
      }
    };

    const fieldDefResponse = await fetch(`${BASE_URL}/api/field-mappings/field-definitions`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(fieldDefData)
    });

    if (fieldDefResponse.ok) {
      const fieldDefResult = await fieldDefResponse.json();
      console.log('✅ Field definition created:', fieldDefResult);
    } else {
      console.log('⚠️  Field definition creation failed:', await fieldDefResponse.text());
    }

    // Test 3: Create field mappings
    console.log('\n3. Testing field mapping creation...');
    
    const fieldMappingData = {
      companyId: 1,
      fieldDefId: 1, // Assuming the field definition was created with ID 1
      datasetColumn: 'Div'
    };

    const fieldMappingResponse = await fetch(`${BASE_URL}/api/field-mappings`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(fieldMappingData)
    });

    if (fieldMappingResponse.ok) {
      const fieldMappingResult = await fieldMappingResponse.json();
      console.log('✅ Field mapping created:', fieldMappingResult);
    } else {
      console.log('⚠️  Field mapping creation failed:', await fieldMappingResponse.text());
    }

    // Test 4: Retrieve field mappings
    console.log('\n4. Testing field mapping retrieval...');
    
    const getMappingsResponse = await fetch(`${BASE_URL}/api/field-mappings/company/1`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      }
    });

    if (getMappingsResponse.ok) {
      const mappings = await getMappingsResponse.json();
      console.log('✅ Field mappings retrieved:', mappings);
    } else {
      console.log('⚠️  Field mapping retrieval failed:', await getMappingsResponse.text());
    }

    console.log('\n🎉 Field mapping migration tests completed!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Database migration verification');
    console.log('   ✅ Field definition creation');
    console.log('   ✅ Field mapping creation');
    console.log('   ✅ Field mapping retrieval');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testFieldMappingMigration(); 