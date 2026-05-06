/**
 * Admin Login/Register Flow Testing Guide
 * 
 * This guide walks you through testing the complete admin authentication flow
 */

// ============================================
// TEST SETUP
// ============================================

// Ensure these are running before testing:
// 1. npm run dev (main server on port 3001)
// 2. Database is seeded with test data
// 3. You have the admin API endpoints available

const API_URL = 'http://localhost:3001';

// ============================================
// TEST 1: Create Test Admin User
// ============================================

// POST /api/admin/auth/superuser-register
// Create a test superuser account

async function testSuperuserRegister() {
  console.log('🧪 TEST 1: Superuser Register');
  console.log('================================\n');

  const payload = {
    email: 'test-admin@example.com',
    password: 'TestAdmin123!',
    firstName: 'Test',
    lastName: 'Admin'
  };

  console.log('📤 Request:', {
    method: 'POST',
    url: `${API_URL}/api/admin/auth/superuser-register`,
    body: payload
  });

  try {
    const response = await fetch(`${API_URL}/api/admin/auth/superuser-register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    console.log('📥 Response Status:', response.status);
    console.log('📥 Response:', JSON.stringify(data, null, 2));

    if (response.ok && data.success) {
      console.log('✅ PASS: Superuser registered successfully');
      console.log('   - User ID:', data.data.user.id);
      console.log('   - Email:', data.data.user.email);
      console.log('   - Role:', data.data.user.roles);
      console.log('   - Token:', data.data.accessToken ? '✓ received' : '✗ missing');
      return {
        success: true,
        user: data.data.user,
        token: data.data.accessToken
      };
    } else {
      console.log('❌ FAIL:', data.message || 'Unknown error');
      return { success: false };
    }
  } catch (error) {
    console.log('❌ ERROR:', (error as Error).message);
    return { success: false };
  }
}

// ============================================
// TEST 2: Admin Login
// ============================================

// POST /api/admin/auth/admin-login
// Login with admin credentials

async function testAdminLogin() {
  console.log('\n\n🧪 TEST 2: Admin Login');
  console.log('================================\n');

  const payload = {
    email: 'test-admin@example.com',
    password: 'TestAdmin123!'
  };

  console.log('📤 Request:', {
    method: 'POST',
    url: `${API_URL}/api/admin/auth/admin-login`,
    body: payload
  });

  try {
    const response = await fetch(`${API_URL}/api/admin/auth/admin-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    console.log('📥 Response Status:', response.status);
    console.log('📥 Response:', JSON.stringify(data, null, 2));

    if (response.ok && data.success) {
      const user = data.data.user;
      console.log('✅ PASS: Login successful');
      console.log('   - User ID:', user.id);
      console.log('   - Email:', user.email);
      console.log('   - Role:', user.role);
      console.log('   - isSuperUser:', user.isSuperUser);
      console.log('   - isAdmin:', user.isAdmin);
      console.log('   - Token:', data.data.accessToken ? '✓ received' : '✗ missing');
      return {
        success: true,
        user: user,
        token: data.data.accessToken
      };
    } else {
      console.log('❌ FAIL:', data.message || 'Unknown error');
      return { success: false };
    }
  } catch (error) {
    console.log('❌ ERROR:', (error as Error).message);
    return { success: false };
  }
}

// ============================================
// TEST 3: Invalid Login (Wrong Password)
// ============================================

async function testInvalidPassword() {
  console.log('\n\n🧪 TEST 3: Invalid Login (Wrong Password)');
  console.log('================================\n');

  const payload = {
    email: 'test-admin@example.com',
    password: 'WrongPassword123!'
  };

  console.log('📤 Request with wrong password...');

  try {
    const response = await fetch(`${API_URL}/api/admin/auth/admin-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    console.log('📥 Response Status:', response.status);
    console.log('📥 Response:', JSON.stringify(data, null, 2));

    if (response.status === 401) {
      console.log('✅ PASS: Login correctly rejected');
      console.log('   - Error message:', data.message);
    } else {
      console.log('❌ FAIL: Should return 401 status');
    }
  } catch (error) {
    console.log('❌ ERROR:', (error as Error).message);
  }
}

// ============================================
// TEST 4: Invalid Login (Non-existent User)
// ============================================

async function testNonexistentUser() {
  console.log('\n\n🧪 TEST 4: Invalid Login (Non-existent User)');
  console.log('================================\n');

  const payload = {
    email: 'nonexistent@example.com',
    password: 'SomePassword123!'
  };

  console.log('📤 Request with non-existent user...');

  try {
    const response = await fetch(`${API_URL}/api/admin/auth/admin-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    console.log('📥 Response Status:', response.status);
    console.log('📥 Response:', JSON.stringify(data, null, 2));

    if (response.status === 401) {
      console.log('✅ PASS: Login correctly rejected');
      console.log('   - Error message:', data.message);
    } else {
      console.log('❌ FAIL: Should return 401 status');
    }
  } catch (error) {
    console.log('❌ ERROR:', (error as Error).message);
  }
}

// ============================================
// TEST 5: Missing Required Fields
// ============================================

async function testMissingFields() {
  console.log('\n\n🧪 TEST 5: Missing Required Fields');
  console.log('================================\n');

  const payload = {
    email: 'test-admin@example.com'
    // password is missing
  };

  console.log('📤 Request with missing password...');

  try {
    const response = await fetch(`${API_URL}/api/admin/auth/admin-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    console.log('📥 Response Status:', response.status);
    console.log('📥 Response:', JSON.stringify(data, null, 2));

    if (response.status === 400) {
      console.log('✅ PASS: Request correctly rejected');
      console.log('   - Error message:', data.message);
    } else {
      console.log('❌ FAIL: Should return 400 status');
    }
  } catch (error) {
    console.log('❌ ERROR:', (error as Error).message);
  }
}

// ============================================
// TEST 6: Duplicate Email Registration
// ============================================

async function testDuplicateEmail() {
  console.log('\n\n🧪 TEST 6: Duplicate Email Registration');
  console.log('================================\n');

  const payload = {
    email: 'test-admin@example.com',
    password: 'AnotherPassword123!',
    firstName: 'Another',
    lastName: 'Admin'
  };

  console.log('📤 Request to register duplicate email...');

  try {
    const response = await fetch(`${API_URL}/api/admin/auth/superuser-register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    console.log('📥 Response Status:', response.status);
    console.log('📥 Response:', JSON.stringify(data, null, 2));

    if (response.status === 409) {
      console.log('✅ PASS: Duplicate registration correctly rejected');
      console.log('   - Error message:', data.message);
    } else {
      console.log('❌ FAIL: Should return 409 status');
    }
  } catch (error) {
    console.log('❌ ERROR:', (error as Error).message);
  }
}

// ============================================
// TEST 7: Token Validation
// ============================================

async function testTokenValidation(token: string) {
  console.log('\n\n🧪 TEST 7: Token Validation');
  console.log('================================\n');

  // Try to access a protected endpoint with the token
  console.log('📤 Request to protected endpoint with token...');

  try {
    const response = await fetch(`${API_URL}/api/admin/users`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('📥 Response Status:', response.status);

    if (response.ok) {
      console.log('✅ PASS: Token is valid');
      console.log('   - Can access protected endpoint');
    } else if (response.status === 401) {
      console.log('❌ FAIL: Token validation failed');
    } else {
      console.log('⚠️ Unexpected status code:', response.status);
    }
  } catch (error) {
    console.log('❌ ERROR:', (error as Error).message);
  }
}

// ============================================
// RUN ALL TESTS
// ============================================

async function runAllTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════╗');
  console.log('║  ADMIN LOGIN/REGISTER FLOW TEST SUITE  ║');
  console.log('║  Starting tests...                     ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`\n⏱️  Timestamp: ${new Date().toISOString()}`);
  console.log(`🌐 API URL: ${API_URL}\n`);

  // Run tests sequentially so we can use results from previous tests
  const registerResult = await testSuperuserRegister();
  await testAdminLogin();
  await testInvalidPassword();
  await testNonexistentUser();
  await testMissingFields();
  await testDuplicateEmail();

  if (registerResult.success && registerResult.token) {
    await testTokenValidation(registerResult.token);
  }

  console.log('\n\n╔════════════════════════════════════════╗');
  console.log('║  TEST SUITE COMPLETE                   ║');
  console.log('╚════════════════════════════════════════╝\n');
}

// Export for use in other files
export { testSuperuserRegister, testAdminLogin, testInvalidPassword, testNonexistentUser, testMissingFields, testDuplicateEmail, testTokenValidation, runAllTests };

// Run tests if this file is executed directly
if (require.main === module || typeof window === 'undefined') {
  runAllTests().catch(console.error);
}
