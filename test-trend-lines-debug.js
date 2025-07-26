// Test script to debug trend lines loading
import fetch from 'node-fetch';

async function testTrendLines() {
  try {
    console.log('Testing trend lines API...');
    
    // Test 1: Get all trend lines
    console.log('\n1. Getting all trend lines:');
    const allResponse = await fetch('http://localhost:3001/api/trend-lines');
    const allTrendLines = await allResponse.json();
    console.log('All trend lines:', allTrendLines);
    console.log('Count:', allTrendLines.length);
    
    if (allTrendLines.length > 0) {
      const firstTrendLine = allTrendLines[0];
      console.log('\nFirst trend line sample:', {
        id: firstTrendLine.id,
        filePath: firstTrendLine.file_path,
        sku: firstTrendLine.sku,
        startDate: firstTrendLine.start_date,
        endDate: firstTrendLine.end_date
      });
      
      // Test 2: Get trend lines with specific filePath and SKU
      console.log('\n2. Getting trend lines with specific filePath and SKU:');
      const params = new URLSearchParams({
        filePath: firstTrendLine.file_path,
        sku: firstTrendLine.sku
      });
      
      const filteredResponse = await fetch(`http://localhost:3001/api/trend-lines?${params.toString()}`);
      const filteredTrendLines = await filteredResponse.json();
      console.log('Filtered trend lines:', filteredTrendLines);
      console.log('Filtered count:', filteredTrendLines.length);
    }
    
  } catch (error) {
    console.error('Error testing trend lines:', error);
  }
}

testTrendLines(); 
import fetch from 'node-fetch';

async function testTrendLines() {
  try {
    console.log('Testing trend lines API...');
    
    // Test 1: Get all trend lines
    console.log('\n1. Getting all trend lines:');
    const allResponse = await fetch('http://localhost:3001/api/trend-lines');
    const allTrendLines = await allResponse.json();
    console.log('All trend lines:', allTrendLines);
    console.log('Count:', allTrendLines.length);
    
    if (allTrendLines.length > 0) {
      const firstTrendLine = allTrendLines[0];
      console.log('\nFirst trend line sample:', {
        id: firstTrendLine.id,
        filePath: firstTrendLine.file_path,
        sku: firstTrendLine.sku,
        startDate: firstTrendLine.start_date,
        endDate: firstTrendLine.end_date
      });
      
      // Test 2: Get trend lines with specific filePath and SKU
      console.log('\n2. Getting trend lines with specific filePath and SKU:');
      const params = new URLSearchParams({
        filePath: firstTrendLine.file_path,
        sku: firstTrendLine.sku
      });
      
      const filteredResponse = await fetch(`http://localhost:3001/api/trend-lines?${params.toString()}`);
      const filteredTrendLines = await filteredResponse.json();
      console.log('Filtered trend lines:', filteredTrendLines);
      console.log('Filtered count:', filteredTrendLines.length);
    }
    
  } catch (error) {
    console.error('Error testing trend lines:', error);
  }
}

testTrendLines(); 