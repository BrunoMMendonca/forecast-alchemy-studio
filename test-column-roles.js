// Test column role detection
const fs = require('fs');
const path = require('path');

// Read the utils.js file and extract the functions
const utilsPath = path.join(__dirname, 'src', 'backend', 'utils.js');
const utilsContent = fs.readFileSync(utilsPath, 'utf8');

// Create a simple test environment
function isDateString(str) {
  if (!str || typeof str !== 'string') return false;
  const normalizedStr = str.trim();
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/, /^\d{2}\/\d{2}\/\d{4}$/, /^\d{2}-\d{2}-\d{4}$/,
    /^\d{4}\/\d{2}\/\d{2}$/, /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, /^\d{1,2}-\d{1,2}-\d{2,4}$/,
    /^\d{8}$/, /^jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i,
  ];
  return datePatterns.some(pattern => pattern.test(normalizedStr));
}

function isLikelyDateColumn(header, allHeaders) {
  const normalizedHeader = header.toLowerCase().trim();
  const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/, /^\d{2}\/\d{2}\/\d{4}$/, /^\d{2}-\d{2}-\d{4}$/,
      /^\d{4}\/\d{2}\/\d{2}$/, /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, /^\d{1,2}-\d{1,2}-\d{2,4}$/,
      /^jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i, /^q[1-4]|quarter/i,
      /^week|wk/i, /^month|mon/i, /^year|yr/i,
  ];
  if (datePatterns.some(pattern => pattern.test(normalizedHeader))) return true;
  if (/^\d{8}$/.test(normalizedHeader) && parseInt(normalizedHeader.substring(4, 6)) <= 12 && parseInt(normalizedHeader.substring(6, 8)) <= 31) return true;
  if (/^\d{4}$/.test(normalizedHeader) && parseInt(normalizedHeader) >= 1900 && parseInt(normalizedHeader) <= 2100) return true;
  return false;
}

function detectColumnRole(header, index, allHeaders) {
  const normalizedHeader = header.toLowerCase().trim();
  
  // More specific Material Code detection
  if (/material|sku|product.?code|item.?code|part.?number|product.?id|item.?id|part.?id/i.test(normalizedHeader)) {
      return 'Material Code';
  }
  
  // More restrictive pattern for alphanumeric codes that look like SKUs
  // Only match if it's a short code (2-6 chars) followed by numbers, or specific patterns
  if (/^[a-z]{2,6}\d{2,}$/i.test(normalizedHeader) && 
      !/date|year|month|day|week|quarter|period|time/i.test(normalizedHeader)) {
      return 'Material Code';
  }
  
  // Description detection
  if (/description|name|product.?name|item.?name|title|product.?title/i.test(normalizedHeader) || /^desc/i.test(normalizedHeader)) {
      return 'Description';
  }
  
  // Date detection
  if (isDateString(header) || isLikelyDateColumn(header, allHeaders)) {
      return 'Date';
  }
  
  return header; // Default to header name
}

function detectColumnRoles(headers) {
  return headers.map((header, index) => ({
    originalName: header,
    role: detectColumnRole(header, index, headers)
  }));
}

// Test headers that should be detected correctly
const testHeaders = [
  'Material Code',
  'SKU',
  'Product Code',
  'Item Code',
  'Description',
  'Product Name',
  'Item Description',
  '2024-01-01',
  '01/01/2024',
  'Jan 2024',
  'Sales',
  'Revenue',
  'Quantity',
  'ABC123',
  'XYZ456',
  'Date',
  'Month',
  'Year',
  'Week',
  'Quarter'
];

console.log('Testing column role detection...');
console.log('Headers:', testHeaders);

const columnRoles = detectColumnRoles(testHeaders);
console.log('\nDetected roles:');
columnRoles.forEach((item, index) => {
  console.log(`${index + 1}. "${item.originalName}" -> "${item.role}"`);
});

// Count how many are detected as Material Code
const materialCodeCount = columnRoles.filter(item => item.role === 'Material Code').length;
const dateCount = columnRoles.filter(item => item.role === 'Date').length;
const descriptionCount = columnRoles.filter(item => item.role === 'Description').length;

console.log(`\nSummary:`);
console.log(`- Material Code: ${materialCodeCount}`);
console.log(`- Date: ${dateCount}`);
console.log(`- Description: ${descriptionCount}`);
console.log(`- Other: ${columnRoles.length - materialCodeCount - dateCount - descriptionCount}`); 