import { pgPool, getDatasetMetadata, getTimeSeriesData } from './src/backend/db.js';

async function testDataset6() {
  try {
    console.log('🔍 Testing dataset ID 6...');
    
    // Test metadata
    const metadata = await getDatasetMetadata(6);
    console.log('Metadata:', metadata);
    
    if (metadata) {
      // Test time series data
      const timeSeriesData = await getTimeSeriesData(6);
      console.log('Time series data count:', timeSeriesData.length);
      console.log('Sample data:', timeSeriesData.slice(0, 3));
    } else {
      console.log('❌ Dataset 6 not found in metadata');
    }
    
    // Check all datasets
    const allDatasets = await pgPool.query('SELECT id, name, file_path FROM datasets ORDER BY id');
    console.log('All datasets:', allDatasets.rows);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pgPool.end();
  }
}

testDataset6(); 