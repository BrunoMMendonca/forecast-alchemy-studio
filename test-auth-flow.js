import fetch from 'node-fetch';

async function testAuthFlow() {
  try {
    console.log('🧪 Testing Authentication Flow...\n');

    // Step 1: Register a new user
    console.log('1️⃣ Registering new user...');
    const timestamp = Date.now();
    const testEmail = `test${timestamp}@example.com`;
    const testUsername = `testuser${timestamp}`;
    
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
    console.log('Register response:', registerResult);

    if (!registerResult.success) {
      throw new Error(`Registration failed: ${registerResult.error}`);
    }

    const verificationToken = registerResult.registration.verification_token;
    console.log('✅ Registration successful\n');

    // Step 2: Verify the user
    console.log('2️⃣ Verifying user account...');
    const verifyResponse = await fetch('http://localhost:3001/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: verificationToken })
    });

    const verifyResult = await verifyResponse.json();
    console.log('Verify response:', verifyResult);

    if (!verifyResult.success) {
      throw new Error(`Verification failed: ${verifyResult.error}`);
    }

    console.log('✅ Verification successful\n');

    // Step 3: Login the user
    console.log('3️⃣ Logging in user...');
    const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'password123'
      })
    });

    const loginResult = await loginResponse.json();
    console.log('Login response:', loginResult);

    if (!loginResult.success) {
      throw new Error(`Login failed: ${loginResult.error}`);
    }

    const sessionToken = loginResult.sessionToken;
    console.log('✅ Login successful\n');

    // Step 4: Create a company
    console.log('4️⃣ Creating company...');
    const companyResponse = await fetch('http://localhost:3001/api/auth/company', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        name: 'Test Company',
        description: 'A test company for authentication flow',
        country: 'United States',
        website: 'https://testcompany.com',
        company_size: 'medium',
        currency: 'USD'
      })
    });

    const companyResult = await companyResponse.json();
    console.log('Company creation response:', companyResult);

    if (!companyResult.success) {
      throw new Error(`Company creation failed: ${companyResult.error}`);
    }

    console.log('✅ Company creation successful\n');

    // Step 5: Get user info
    console.log('5️⃣ Getting user info...');
    const userResponse = await fetch('http://localhost:3001/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      }
    });

    const userResult = await userResponse.json();
    console.log('User info response:', userResult);

    if (!userResult.success) {
      throw new Error(`Get user info failed: ${userResult.error}`);
    }

    console.log('✅ Get user info successful\n');

    // Step 6: Get company info
    console.log('6️⃣ Getting company info...');
    const getCompanyResponse = await fetch('http://localhost:3001/api/auth/company', {
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      }
    });

    const getCompanyResult = await getCompanyResponse.json();
    console.log('Get company response:', getCompanyResult);

    if (!getCompanyResult.success) {
      throw new Error(`Get company info failed: ${getCompanyResult.error}`);
    }

    console.log('✅ Get company info successful\n');

    // Step 7: Check setup status
    console.log('7️⃣ Checking setup status...');
    const setupResponse = await fetch('http://localhost:3001/api/auth/setup/status', {
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      }
    });

    const setupResult = await setupResponse.json();
    console.log('Setup status response:', setupResult);

    console.log('✅ Setup status check successful\n');

    // Step 8: Logout
    console.log('8️⃣ Logging out...');
    const logoutResponse = await fetch('http://localhost:3001/api/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      }
    });

    const logoutResult = await logoutResponse.json();
    console.log('Logout response:', logoutResult);

    if (!logoutResult.success) {
      throw new Error(`Logout failed: ${logoutResult.error}`);
    }

    console.log('✅ Logout successful\n');

    console.log('🎉 All authentication flow tests passed!');
    console.log('\n📋 Summary:');
    console.log('- User registration: ✅');
    console.log('- Email verification: ✅');
    console.log('- User login: ✅');
    console.log('- Company creation: ✅');
    console.log('- User info retrieval: ✅');
    console.log('- Company info retrieval: ✅');
    console.log('- Setup status check: ✅');
    console.log('- User logout: ✅');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testAuthFlow(); 