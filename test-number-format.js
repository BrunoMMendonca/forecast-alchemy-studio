// Test number format validation
function parseNumberWithFormat(value, format) {
  if (typeof value !== 'string') return NaN;
  const trimmed = value.trim();
  
  console.log(`Testing: "${trimmed}" with format "${format}"`);
  
  // Define regex patterns for each format
  let pattern;
  switch (format) {
    case '1,234.56': // comma thousands, dot decimal
      // Must have commas for thousands when number is >= 1000
      if (trimmed.length >= 4 && !trimmed.includes(',')) {
        console.log('❌ No comma found for thousands format');
        return NaN;
      }
      pattern = /^(\d{1,3}(,\d{3})*|\d{1,3})(\.\d+)?$/;
      console.log(`Pattern: ${pattern}`);
      console.log(`Match: ${pattern.test(trimmed)}`);
      if (!pattern.test(trimmed)) return NaN;
      return parseFloat(trimmed.replace(/,/g, ''));
      
    case '1.234,56': // dot thousands, comma decimal
      // Must have dots for thousands when number is >= 1000
      if (trimmed.length >= 4 && !trimmed.includes('.')) {
        console.log('❌ No dot found for thousands format');
        return NaN;
      }
      pattern = /^(\d{1,3}(\.\d{3})*|\d{1,3})(,\d+)?$/;
      console.log(`Pattern: ${pattern}`);
      console.log(`Match: ${pattern.test(trimmed)}`);
      if (!pattern.test(trimmed)) return NaN;
      return parseFloat(trimmed.replace(/\./g, '').replace(/,/g, '.'));
      
    case '1234.56': // no thousands, dot decimal
      // Must NOT have thousands separators
      if (trimmed.includes(',') || trimmed.includes(' ')) {
        console.log('❌ Thousands separators found in no-thousands format');
        return NaN;
      }
      pattern = /^\d+(\.\d+)?$/;
      console.log(`Pattern: ${pattern}`);
      console.log(`Match: ${pattern.test(trimmed)}`);
      if (!pattern.test(trimmed)) return NaN;
      return parseFloat(trimmed);
      
    case '1234,56': // no thousands, comma decimal
      // Must NOT have thousands separators
      if (trimmed.includes('.') || trimmed.includes(' ')) {
        console.log('❌ Thousands separators found in no-thousands format');
        return NaN;
      }
      pattern = /^\d+(,\d+)?$/;
      console.log(`Pattern: ${pattern}`);
      console.log(`Match: ${pattern.test(trimmed)}`);
      if (!pattern.test(trimmed)) return NaN;
      return parseFloat(trimmed.replace(/,/g, '.'));
      
    case '1 234,56': // space thousands, comma decimal
      // Must have spaces for thousands when number is >= 1000
      if (trimmed.length >= 4 && !trimmed.includes(' ')) {
        console.log('❌ No space found for thousands format');
        return NaN;
      }
      pattern = /^(\d{1,3}( \d{3})*|\d{1,3})(,\d+)?$/;
      console.log(`Pattern: ${pattern}`);
      console.log(`Match: ${pattern.test(trimmed)}`);
      if (!pattern.test(trimmed)) return NaN;
      return parseFloat(trimmed.replace(/ /g, '').replace(/,/g, '.'));
      
    case '1 234.56': // space thousands, dot decimal
      // Must have spaces for thousands when number is >= 1000
      if (trimmed.length >= 4 && !trimmed.includes(' ')) {
        console.log('❌ No space found for thousands format');
        return NaN;
      }
      pattern = /^(\d{1,3}( \d{3})*|\d{1,3})(\.\d+)?$/;
      console.log(`Pattern: ${pattern}`);
      console.log(`Match: ${pattern.test(trimmed)}`);
      if (!pattern.test(trimmed)) return NaN;
      return parseFloat(trimmed.replace(/ /g, ''));
      
    case '1234': // integer
      // Must NOT have any separators
      if (trimmed.includes(',') || trimmed.includes('.') || trimmed.includes(' ')) {
        console.log('❌ Separators found in integer format');
        return NaN;
      }
      pattern = /^\d+$/;
      console.log(`Pattern: ${pattern}`);
      console.log(`Match: ${pattern.test(trimmed)}`);
      if (!pattern.test(trimmed)) return NaN;
      return parseFloat(trimmed);
      
    default:
      // fallback: try to parse as float
      return parseFloat(trimmed);
  }
}

// Test cases
console.log('=== Testing "1234" with different formats ===');
console.log('1234 with 1,234.56:', parseNumberWithFormat('1234', '1,234.56'));
console.log('1234 with 1.234,56:', parseNumberWithFormat('1234', '1.234,56'));
console.log('1234 with 1234.56:', parseNumberWithFormat('1234', '1234.56'));
console.log('1234 with 1234,56:', parseNumberWithFormat('1234', '1234,56'));
console.log('1234 with 1 234,56:', parseNumberWithFormat('1234', '1 234,56'));
console.log('1234 with 1 234.56:', parseNumberWithFormat('1234', '1 234.56'));
console.log('1234 with 1234:', parseNumberWithFormat('1234', '1234'));

console.log('\n=== Testing "1,234" with different formats ===');
console.log('1,234 with 1,234.56:', parseNumberWithFormat('1,234', '1,234.56'));
console.log('1,234 with 1234.56:', parseNumberWithFormat('1,234', '1234.56')); 