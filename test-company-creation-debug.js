import fetch from 'node-fetch';

async function testCompanyCreation() {
  try {
    console.log('🔍 Testing Company Creation with Debug Info...\n');

    // First, let's register and login a user
    const timestamp = Date.now();
    const testEmail = `test${timestamp}@example.com`;
    const testUsername = `testuser${timestamp}`;

    console.log('1️⃣ Registering user...');
    const registerResponse = await fetch('http://localhost:3001/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        username: testUsername,
        password: 'password123',
        first_name: 'Test',
        last_name: 'User'
      })
    });

    const registerResult = await registerResponse.json();
    console.log('Register status:', registerResponse.status);
    console.log('Register result:', registerResult);

    if (!registerResult.success) {
      throw new Error(`Registration failed: ${registerResult.error}`);
    }

    // Verify the user
    console.log('\n2️⃣ Verifying user...');
    const verifyResponse = await fetch('http://localhost:3001/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: registerResult.registration.verification_token })
    });

    const verifyResult = await verifyResponse.json();
    console.log('Verify status:', verifyResponse.status);
    console.log('Verify result:', verifyResult);

    if (!verifyResult.success) {
      throw new Error(`Verification failed: ${verifyResult.error}`);
    }

    // Login the user
    console.log('\n3️⃣ Logging in user...');
    const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'password123'
      })
    });

    const loginResult = await loginResponse.json();
    console.log('Login status:', loginResponse.status);
    console.log('Login result:', loginResult);

    if (!loginResult.success) {
      throw new Error(`Login failed: ${loginResult.error}`);
    }

    const sessionToken = loginResult.sessionToken;
    console.log('Session token:', sessionToken.substring(0, 50) + '...');

    // Test company creation with detailed error info
    console.log('\n4️⃣ Creating company...');
    const companyData = {
      name: 'Test Company',
      description: 'A test company for debugging',
      country: 'United States',
      website: 'https://testcompany.com',
      company_size: 'medium',
      currency: 'USD'
    };

    console.log('Company data being sent:', companyData);

    const companyResponse = await fetch('http://localhost:3001/api/auth/company', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify(companyData)
    });

    console.log('Company creation status:', companyResponse.status);
    console.log('Company creation headers:', Object.fromEntries(companyResponse.headers.entries()));

    const companyResult = await companyResponse.json();
    console.log('Company creation result:', companyResult);

    if (!companyResult.success) {
      console.error('❌ Company creation failed with error:', companyResult.error);
      
      // Let's also check if the user has a company_id now
      console.log('\n5️⃣ Checking user info after failed company creation...');
      const userResponse = await fetch('http://localhost:3001/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      const userResult = await userResponse.json();
      console.log('User info after company creation attempt:', userResult);
      
      throw new Error(`Company creation failed: ${companyResult.error}`);
    }

    console.log('✅ Company creation successful!');
    console.log('Company details:', companyResult.company);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testCompanyCreation(); 