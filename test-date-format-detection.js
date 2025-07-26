// Test script for date format detection and validation
import { autoDetectDateFormat, parseDateWithFormat } from './src/utils/dateUtils.ts';

// Test data with various date formats
const testSamples = [
  // Daily formats
  ['2023-12-31', '31/12/2023', '12/31/2023', '31-12-2023', '2023/12/31'],
  // Yearly format
  ['2023', '2024', '2025'],
  // Weekly formats
  ['2023-W05', 'W05-2023', '2023/W05', 'W05/2023', '2023-W01-W05', 'W01-W05'],
  // Mixed with non-dates
  ['2023-12-31', 'Marca', 'Product A', '2024-W01', 'SKU123']
];

console.log('Testing date format detection...\n');

testSamples.forEach((samples, index) => {
  console.log(`Test ${index + 1}:`);
  console.log('Samples:', samples);
  
  const detection = autoDetectDateFormat(samples);
  console.log('Best guess:', detection.bestGuess);
  console.log('Candidates:', detection.candidates);
  console.log('');
});

console.log('Testing date parsing...\n');

const parseTests = [
  { format: 'yyyy-mm-dd', value: '2023-12-31' },
  { format: 'dd/mm/yyyy', value: '31/12/2023' },
  { format: 'yyyy-ww', value: '2023-W05' },
  { format: 'ww-yyyy', value: 'W05-2023' },
  { format: 'yyyy', value: '2023' },
  { format: 'yyyy-wwrange', value: '2023-W01-W05' },
  { format: 'weekrange', value: 'W01-W05' }
];

parseTests.forEach(test => {
  const result = parseDateWithFormat(test.value, test.format);
  console.log(`${test.format}: "${test.value}" -> ${result ? result.toISOString().split('T')[0] : 'null'}`);
});

console.log('\nTesting validation logic...\n');

// Test column validation
const testColumns = [
  { name: 'Date Column', values: ['2023-12-31', '2024-01-01', '2024-01-02'] },
  { name: 'Mixed Column', values: ['2023-12-31', 'Product A', '2024-01-01'] },
  { name: 'Non-Date Column', values: ['Product A', 'Product B', 'Product C'] }
];

testColumns.forEach(column => {
  const validDates = column.values.filter(val => {
    if (!val || typeof val !== 'string') return false;
    return parseDateWithFormat(val, 'yyyy-mm-dd') !== null;
  });
  
  const isValidDateColumn = validDates.length >= column.values.length * 0.5;
  
  console.log(`${column.name}:`);
  console.log(`  Values: ${column.values.join(', ')}`);
  console.log(`  Valid dates: ${validDates.length}/${column.values.length}`);
  console.log(`  Is date column: ${isValidDateColumn}`);
  console.log('');
}); 