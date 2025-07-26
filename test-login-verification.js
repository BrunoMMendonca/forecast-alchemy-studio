import bcrypt from 'bcrypt';

async function testLoginVerification() {
  const password = 'password123';
  
  console.log('Testing bcrypt password verification:');
  console.log('=====================================');
  console.log(`Password: ${password}`);
  console.log('');
  
  // Test 1: Generate a new hash and verify it
  console.log('Test 1: New hash generation');
  const newHash = await bcrypt.hash(password, 12);
  const newHashValid = await bcrypt.compare(password, newHash);
  console.log(`Generated hash: ${newHash}`);
  console.log(`Hash length: ${newHash.length}`);
  console.log(`Verification: ${newHashValid ? 'PASSED' : 'FAILED'}`);
  console.log('');
  
  // Test 2: Test the old hash from test users script
  console.log('Test 2: Old test users hash');
  const oldHash = '$2b$10$lDPE6fe5iYlBJc1lG9vcN..TKu1BzPPJL/FLY/o/Up3oufJWtqRyO';
  const oldHashValid = await bcrypt.compare(password, oldHash);
  console.log(`Old hash: ${oldHash}`);
  console.log(`Hash length: ${oldHash.length}`);
  console.log(`Verification: ${oldHashValid ? 'PASSED' : 'FAILED'}`);
  console.log('');
  
  // Test 3: Test wrong password
  console.log('Test 3: Wrong password');
  const wrongPassword = 'wrongpassword';
  const wrongPasswordValid = await bcrypt.compare(wrongPassword, newHash);
  console.log(`Wrong password: ${wrongPassword}`);
  console.log(`Verification: ${wrongPasswordValid ? 'PASSED' : 'FAILED'}`);
  console.log('');
  
  // Test 4: Generate multiple hashes to show they're different
  console.log('Test 4: Multiple hash generation (showing unique salts)');
  const hash1 = await bcrypt.hash(password, 12);
  const hash2 = await bcrypt.hash(password, 12);
  const hash3 = await bcrypt.hash(password, 12);
  
  console.log(`Hash 1: ${hash1}`);
  console.log(`Hash 2: ${hash2}`);
  console.log(`Hash 3: ${hash3}`);
  console.log('');
  console.log('All hashes are different due to unique salts, but all verify correctly:');
  console.log(`Hash 1 verification: ${await bcrypt.compare(password, hash1) ? 'PASSED' : 'FAILED'}`);
  console.log(`Hash 2 verification: ${await bcrypt.compare(password, hash2) ? 'PASSED' : 'FAILED'}`);
  console.log(`Hash 3 verification: ${await bcrypt.compare(password, hash3) ? 'PASSED' : 'FAILED'}`);
}

testLoginVerification().catch(console.error); 