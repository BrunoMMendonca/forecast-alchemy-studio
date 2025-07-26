import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001/api/auth';

// Test users with their new roles
const testUsers = [
  {
    username: 'acme_owner',
    email: 'owner@acme.com',
    password: 'password123',
    expectedRole: 'company_admin',
    company: 'ACME CORPORATION'
  },
  {
    username: 'acme_admin',
    email: 'admin@acme.com',
    password: 'password123',
    expectedRole: 'company_admin',
    company: 'ACME CORPORATION'
  },
  {
    username: 'acme_manager',
    email: 'manager@acme.com',
    password: 'password123',
    expectedRole: 'division_admin',
    company: 'ACME CORPORATION'
  },
  {
    username: 'acme_analyst',
    email: 'analyst@acme.com',
    password: 'password123',
    expectedRole: 'analyst',
    company: 'ACME CORPORATION'
  },
  {
    username: 'acme_viewer',
    email: 'viewer@acme.com',
    password: 'password123',
    expectedRole: 'viewer',
    company: 'ACME CORPORATION'
  },
  {
    username: 'techstart_admin',
    email: 'admin@techstart.com',
    password: 'password123',
    expectedRole: 'company_admin',
    company: 'TECHSTART INC'
  },
  {
    username: 'techstart_analyst',
    email: 'analyst@techstart.com',
    password: 'password123',
    expectedRole: 'analyst',
    company: 'TECHSTART INC'
  }
];

async function testLogin(user) {
  console.log(`\n🔐 Testing login for ${user.username} (${user.email})`);
  
  try {
    const response = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        password: user.password
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ Login successful for ${user.username}`);
      return data.sessionToken;
    } else {
      console.log(`❌ Login failed for ${user.username}: ${data.error}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ Login error for ${user.username}: ${error.message}`);
    return null;
  }
}

async function testUserInvitation(token, user) {
  console.log(`\n📧 Testing user invitation creation by ${user.username}`);
  
  try {
    const response = await fetch(`${BASE_URL}/invite`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        email: 'newuser@test.com',
        username: 'newuser',
        first_name: 'New',
        last_name: 'User',
        assigned_roles: [
          {
            role_type: 'analyst',
            division_id: null,
            cluster_id: null
          }
        ]
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ User invitation created successfully by ${user.username}`);
      return data.invitation;
    } else {
      console.log(`❌ User invitation failed for ${user.username}: ${data.error}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ User invitation error for ${user.username}: ${error.message}`);
    return null;
  }
}

async function testCompanyCreation(token, user) {
  console.log(`\n🏢 Testing company creation by ${user.username}`);
  
  try {
    const response = await fetch(`${BASE_URL}/company`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'Test Company',
        description: 'Test company for role testing',
        country: 'US',
        company_size: 'startup'
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ Company creation successful by ${user.username}`);
      return true;
    } else {
      console.log(`❌ Company creation failed for ${user.username}: ${data.error}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Company creation error for ${user.username}: ${error.message}`);
    return false;
  }
}

async function testGetInvitations(token, user) {
  console.log(`\n📋 Testing get invitations by ${user.username}`);
  
  try {
    const response = await fetch(`${BASE_URL}/invitations`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ Get invitations successful by ${user.username}`);
      return true;
    } else {
      console.log(`❌ Get invitations failed for ${user.username}: ${data.error}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Get invitations error for ${user.username}: ${error.message}`);
    return false;
  }
}

async function testRolePermissions() {
  console.log('🚀 Testing New Role-Based Access Control System');
  console.log('================================================');
  
  const results = [];
  
  for (const user of testUsers) {
    console.log(`\n👤 Testing user: ${user.username} (${user.expectedRole})`);
    
    // Test login
    const token = await testLogin(user);
    if (!token) {
      results.push({
        user: user.username,
        role: user.expectedRole,
        login: false,
        invitation: false,
        companyCreation: false,
        getInvitations: false
      });
      continue;
    }
    
    // Test permissions based on role
    let invitationSuccess = false;
    let companyCreationSuccess = false;
    let getInvitationsSuccess = false;
    
    if (user.expectedRole === 'company_admin') {
      // Company admins should be able to do everything
      invitationSuccess = await testUserInvitation(token, user);
      companyCreationSuccess = await testCompanyCreation(token, user);
      getInvitationsSuccess = await testGetInvitations(token, user);
    } else if (user.expectedRole === 'division_admin') {
      // Division admins should be able to invite users but not create companies
      invitationSuccess = await testUserInvitation(token, user);
      companyCreationSuccess = await testCompanyCreation(token, user);
      getInvitationsSuccess = await testGetInvitations(token, user);
    } else {
      // Analysts and viewers should not be able to do admin tasks
      invitationSuccess = await testUserInvitation(token, user);
      companyCreationSuccess = await testCompanyCreation(token, user);
      getInvitationsSuccess = await testGetInvitations(token, user);
    }
    
    results.push({
      user: user.username,
      role: user.expectedRole,
      login: true,
      invitation: !!invitationSuccess,
      companyCreation: companyCreationSuccess,
      getInvitations: getInvitationsSuccess
    });
  }
  
  // Print summary
  console.log('\n📊 ROLE PERMISSION TEST RESULTS');
  console.log('================================');
  console.log('User\t\t\tRole\t\t\tLogin\tInvite\tCompany\tInvitations');
  console.log('----\t\t\t----\t\t\t-----\t------\t-------\t----------');
  
  for (const result of results) {
    const loginStatus = result.login ? '✅' : '❌';
    const inviteStatus = result.invitation ? '✅' : '❌';
    const companyStatus = result.companyCreation ? '✅' : '❌';
    const invitationsStatus = result.getInvitations ? '✅' : '❌';
    
    console.log(`${result.user.padEnd(20)}\t${result.role.padEnd(20)}\t${loginStatus}\t${inviteStatus}\t${companyStatus}\t${invitationsStatus}`);
  }
  
  // Expected behavior summary
  console.log('\n🎯 EXPECTED BEHAVIOR:');
  console.log('=====================');
  console.log('• company_admin: Can do everything (login, invite, create company, view invitations)');
  console.log('• division_admin: Can invite users and view invitations, but company creation may be restricted');
  console.log('• analyst: Should NOT be able to invite users, create companies, or view invitations');
  console.log('• viewer: Should NOT be able to invite users, create companies, or view invitations');
  
  return results;
}

// Run the tests
testRolePermissions().catch(console.error); 