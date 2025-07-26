// Test script to debug SKU mismatch
import fs from 'fs';

async function testSKUMismatch() {
  try {
    console.log('Testing SKU mismatch...');
    
    // Read the processed dataset file
    const filePath = 'uploads/Original_CSV_Upload-1751839040944-dba0eecb-processed.json';
    console.log('Reading dataset file:', filePath);
    
    if (!fs.existsSync(filePath)) {
      console.log('Dataset file not found!');
      return;
    }
    
    const datasetContent = fs.readFileSync(filePath, 'utf8');
    const dataset = JSON.parse(datasetContent);
    
    console.log('Dataset keys:', Object.keys(dataset));
    
    if (dataset.summary) {
      console.log('Dataset summary:', dataset.summary);
    }
    
    if (dataset.data) {
      console.log('Dataset data keys:', Object.keys(dataset.data));
      console.log('Available SKUs:', Object.keys(dataset.data));
      
      // Check if 95000001 exists
      if (dataset.data['95000001']) {
        console.log('SKU 95000001 exists in dataset');
        console.log('Sample data for 95000001:', dataset.data['95000001'].slice(0, 3));
      } else {
        console.log('SKU 95000001 does NOT exist in dataset');
      }
      
      // Check if 95000000 exists
      if (dataset.data['95000000']) {
        console.log('SKU 95000000 exists in dataset');
        console.log('Sample data for 95000000:', dataset.data['95000000'].slice(0, 3));
      } else {
        console.log('SKU 95000000 does NOT exist in dataset');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testSKUMismatch(); 
import fs from 'fs';

async function testSKUMismatch() {
  try {
    console.log('Testing SKU mismatch...');
    
    // Read the processed dataset file
    const filePath = 'uploads/Original_CSV_Upload-1751839040944-dba0eecb-processed.json';
    console.log('Reading dataset file:', filePath);
    
    if (!fs.existsSync(filePath)) {
      console.log('Dataset file not found!');
      return;
    }
    
    const datasetContent = fs.readFileSync(filePath, 'utf8');
    const dataset = JSON.parse(datasetContent);
    
    console.log('Dataset keys:', Object.keys(dataset));
    
    if (dataset.summary) {
      console.log('Dataset summary:', dataset.summary);
    }
    
    if (dataset.data) {
      console.log('Dataset data keys:', Object.keys(dataset.data));
      console.log('Available SKUs:', Object.keys(dataset.data));
      
      // Check if 95000001 exists
      if (dataset.data['95000001']) {
        console.log('SKU 95000001 exists in dataset');
        console.log('Sample data for 95000001:', dataset.data['95000001'].slice(0, 3));
      } else {
        console.log('SKU 95000001 does NOT exist in dataset');
      }
      
      // Check if 95000000 exists
      if (dataset.data['95000000']) {
        console.log('SKU 95000000 exists in dataset');
        console.log('Sample data for 95000000:', dataset.data['95000000'].slice(0, 3));
      } else {
        console.log('SKU 95000000 does NOT exist in dataset');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testSKUMismatch(); 