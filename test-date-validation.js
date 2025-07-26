// Test script to validate date handling logic
console.log('Testing date validation logic...\n');

// Test cases
const testCases = [
  { date: '2024-01-15', expected: true, description: 'Valid ISO date' },
  { date: '2024/01/15', expected: true, description: 'Valid slash date' },
  { date: '01/15/2024', expected: true, description: 'Valid US date' },
  { date: null, expected: false, description: 'Null date' },
  { date: undefined, expected: false, description: 'Undefined date' },
  { date: '', expected: false, description: 'Empty string' },
  { date: 'invalid-date', expected: false, description: 'Invalid date string' },
  { date: '1970-01-01', expected: true, description: 'Unix epoch' },
  { date: '2024-13-45', expected: false, description: 'Invalid month/day' }
];

testCases.forEach(testCase => {
  const isValid = testCase.date && !isNaN(new Date(testCase.date).getTime());
  const passed = isValid === testCase.expected;
  
  console.log(`${passed ? '✅' : '❌'} ${testCase.description}:`);
  console.log(`  Input: "${testCase.date}"`);
  console.log(`  Expected: ${testCase.expected}, Got: ${isValid}`);
  console.log(`  Date object: ${new Date(testCase.date)}`);
  console.log(`  Timestamp: ${new Date(testCase.date).getTime()}`);
  console.log('');
});

// Test trend line date validation
console.log('Testing trend line date validation...\n');

const trendLineTestCases = [
  {
    name: 'Valid trend line',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    shouldPass: true
  },
  {
    name: 'Invalid start date',
    startDate: null,
    endDate: '2024-12-31',
    shouldPass: false
  },
  {
    name: 'Invalid end date',
    startDate: '2024-01-01',
    endDate: undefined,
    shouldPass: false
  },
  {
    name: 'Both dates invalid',
    startDate: 'invalid',
    endDate: 'also-invalid',
    shouldPass: false
  }
];

trendLineTestCases.forEach(testCase => {
  const startDate = new Date(testCase.startDate);
  const endDate = new Date(testCase.endDate);
  
  const hasValidDates = testCase.startDate && testCase.endDate;
  const datesNotNaN = !isNaN(startDate.getTime()) && !isNaN(endDate.getTime());
  const isValid = hasValidDates && datesNotNaN;
  
  const passed = isValid === testCase.shouldPass;
  
  console.log(`${passed ? '✅' : '❌'} ${testCase.name}:`);
  console.log(`  Start date: "${testCase.startDate}" -> ${startDate} (${startDate.getTime()})`);
  console.log(`  End date: "${testCase.endDate}" -> ${endDate} (${endDate.getTime()})`);
  console.log(`  Has valid dates: ${hasValidDates}`);
  console.log(`  Dates not NaN: ${datesNotNaN}`);
  console.log(`  Final result: ${isValid}`);
  console.log('');
});

console.log('Date validation tests complete!'); 