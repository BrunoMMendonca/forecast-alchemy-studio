import bcrypt from 'bcrypt';

async function generateHash() {
  const password = 'password123';
  const saltRounds = 12;
  
  console.log('Generating bcrypt hash for password:', password);
  console.log('Salt rounds:', saltRounds);
  console.log('');
  
  const hash = await bcrypt.hash(password, saltRounds);
  console.log('Generated hash:', hash);
  console.log('Hash length:', hash.length);
  console.log('');
  
  // Test that the hash works
  const isValid = await bcrypt.compare(password, hash);
  console.log('Hash verification test:', isValid ? 'PASSED' : 'FAILED');
  
  // Also test the old hash from the test users script
  const oldHash = '$2b$10$lDPE6fe5iYlBJc1lG9vcN..TKu1BzPPJL/FLY/o/Up3oufJWtqRyO';
  const oldHashValid = await bcrypt.compare(password, oldHash);
  console.log('Old hash verification test:', oldHashValid ? 'PASSED' : 'FAILED');
}

generateHash().catch(console.error); 