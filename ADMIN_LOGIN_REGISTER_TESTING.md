# Admin Login/Register Flow - Testing Guide

## 🎯 Quick Test (5 minutes)

### Step 1: Register a Test Admin User

```bash
curl -X POST http://localhost:3001/api/admin/auth/superuser-register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-admin@example.com",
    "password": "TestAdmin123!",
    "firstName": "Test",
    "lastName": "Admin"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "some-uuid",
      "email": "test-admin@example.com",
      "roles": "super_admin",
      "firstName": "Test",
      "lastName": "Admin"
    },
    "accessToken": "eyJhbGc..."
  }
}
```

**What to check:**
- ✅ Status code: 200
- ✅ `success: true`
- ✅ User has `roles: "super_admin"`
- ✅ `accessToken` is provided

---

### Step 2: Login with Admin Credentials

```bash
curl -X POST http://localhost:3001/api/admin/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-admin@example.com",
    "password": "TestAdmin123!"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "some-uuid",
      "email": "test-admin@example.com",
      "firstName": "Test",
      "lastName": "Admin",
      "phone": null,
      "role": "super_admin",
      "isSuperUser": true,
      "isAdmin": true,
      "walletAddress": null,
      "isEmailVerified": false,
      "isPhoneVerified": false,
      "profilePicture": null
    },
    "accessToken": "eyJhbGc..."
  }
}
```

**What to check:**
- ✅ Status code: 200
- ✅ `success: true`
- ✅ User has `isSuperUser: true`
- ✅ User has `isAdmin: true`
- ✅ User `role: "super_admin"`
- ✅ `accessToken` is provided

---

### Step 3: Save Token and Test Protected Endpoint

```bash
# Save the token from login response
TOKEN="eyJhbGc..."

# Use token to access protected admin endpoint
curl -X GET http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
- ✅ Status code: 200
- ✅ Returns user list or admin data
- ✅ No 401 "Unauthorized" error

---

## 🧪 Complete Test Suite

### Test 1: Valid Superuser Registration

**Test**: Create a new superuser account

```bash
curl -X POST http://localhost:3001/api/admin/auth/superuser-register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin1@example.com",
    "password": "SecurePass123!",
    "firstName": "Admin",
    "lastName": "One"
  }'
```

**Success Criteria**:
- Status: 200
- `success: true`
- User returned with `roles: "super_admin"`
- Token provided

**If Fails**: Check server logs for database errors

---

### Test 2: Valid Login

**Test**: Login with correct credentials

```bash
curl -X POST http://localhost:3001/api/admin/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin1@example.com",
    "password": "SecurePass123!"
  }'
```

**Success Criteria**:
- Status: 200
- `success: true`
- `user.isSuperUser: true`
- `user.isAdmin: true`
- Token provided

**If Fails**: 
- Check email exists in database
- Check password is correct
- Check database connection

---

### Test 3: Invalid Password

**Test**: Login with wrong password

```bash
curl -X POST http://localhost:3001/api/admin/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin1@example.com",
    "password": "WrongPassword123!"
  }'
```

**Success Criteria**:
- Status: 401
- Error message: "Invalid credentials"
- No token provided

**If Fails**:
- Password validation might be broken
- Check bcrypt comparison in code

---

### Test 4: Non-existent User

**Test**: Try to login with non-existent email

```bash
curl -X POST http://localhost:3001/api/admin/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nonexistent@example.com",
    "password": "AnyPassword123!"
  }'
```

**Success Criteria**:
- Status: 401
- Error message: "Invalid credentials or not an admin/superuser"
- No token provided

---

### Test 5: Missing Email Field

**Test**: Register without email

```bash
curl -X POST http://localhost:3001/api/admin/auth/superuser-register \
  -H "Content-Type: application/json" \
  -d '{
    "password": "TestPass123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Success Criteria**:
- Status: 400
- Error message: "Email and password required"

---

### Test 6: Missing Password Field

**Test**: Register without password

```bash
curl -X POST http://localhost:3001/api/admin/auth/superuser-register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Success Criteria**:
- Status: 400
- Error message: "Email and password required"

---

### Test 7: Duplicate Email Registration

**Test**: Try to register with same email twice

```bash
# First registration (succeeds)
curl -X POST http://localhost:3001/api/admin/auth/superuser-register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "duplicate@example.com",
    "password": "Pass123!",
    "firstName": "First",
    "lastName": "User"
  }'

# Second registration with same email (should fail)
curl -X POST http://localhost:3001/api/admin/auth/superuser-register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "duplicate@example.com",
    "password": "DifferentPass123!",
    "firstName": "Second",
    "lastName": "User"
  }'
```

**Success Criteria** (for second attempt):
- Status: 409
- Error message: "Email already registered"

---

### Test 8: Token Validation

**Test**: Use token to access protected endpoint

```bash
# Login first
TOKEN=$(curl -s -X POST http://localhost:3001/api/admin/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin1@example.com", "password": "SecurePass123!"}' \
  | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

echo "Token: $TOKEN"

# Use token to access protected route
curl -X GET http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Success Criteria**:
- Status: 200
- Returns user list or admin data
- No 401 errors

---

### Test 9: Expired/Invalid Token

**Test**: Use invalid token

```bash
curl -X GET http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer invalid.token.here" \
  -H "Content-Type: application/json"
```

**Success Criteria**:
- Status: 401
- Error indicates invalid/expired token

---

### Test 10: Non-Admin User Cannot Login via Admin Endpoint

**Test**: Create a regular user and try admin login

```bash
# First create a regular user (not superuser)
# This depends on how your user registration works
# For now, we'll just test with the endpoint

curl -X POST http://localhost:3001/api/admin/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "regularuser@example.com",
    "password": "UserPass123!"
  }'
```

**Success Criteria**:
- Status: 401
- Error message: "Invalid credentials or not an admin/superuser"

---

## 🔍 Debugging Checklist

If tests are failing, check:

### Server is Running
```bash
# Check if server is listening on port 3001
netstat -ano | findstr :3001

# Or test connectivity
curl http://localhost:3001/health
```

### Database is Connected
- Check server logs for connection errors
- Verify database is running
- Check `.env` has correct DATABASE_URL

### User Table Schema
- Verify `users` table exists
- Check columns: `id`, `email`, `passwordHash`, `roles`
- Ensure `passwordHash` column exists (not `password`)

### Password Hashing
- Check bcrypt is being used
- Verify passwords are being hashed before storage
- Test bcrypt compare function

### JWT Configuration
- Check JWT_SECRET is set in environment
- Verify token is signed correctly
- Check token expiration time

### CORS/Headers
- Verify `Content-Type: application/json` header
- Check CORS is configured correctly
- Verify Authorization header format

---

## 📊 Expected Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/admin/auth/superuser-register` | POST | ❌ No | Register new superuser |
| `/api/admin/auth/admin-login` | POST | ❌ No | Login as admin |
| `/api/admin/users` | GET | ✅ Yes | Get list of users |
| `/api/admin/settings` | GET | ✅ Yes | Get admin settings |

---

## 🎯 Expected Flow

```
User Visits Admin
   ↓
Sees Login Form
   ↓
Enters Email & Password
   ↓
POST /api/admin/auth/admin-login
   ↓
Server Checks Credentials
   ↓
Validates Password (bcrypt.compare)
   ↓
Checks User Role (super_admin or admin)
   ↓
Generates JWT Token
   ↓
Returns User Object + Token
   ↓
Client Stores Token in localStorage
   ↓
Redirect to Dashboard
   ↓
Dashboard Adds Authorization Header
   ↓
Access Protected Routes
```

---

## ✅ Success Criteria Summary

All tests should pass if:

- [ ] Register endpoint creates new users
- [ ] Login endpoint accepts valid credentials
- [ ] Login rejects invalid passwords
- [ ] Login rejects non-existent users
- [ ] Password fields are validated
- [ ] Duplicate emails are rejected
- [ ] Tokens are returned on success
- [ ] Tokens work for protected endpoints
- [ ] Invalid tokens are rejected
- [ ] User role is validated

---

## 🚀 Quick Manual Test

1. **Start Server**
   ```bash
   npm run dev
   ```

2. **Register Admin**
   ```bash
   curl -X POST http://localhost:3001/api/admin/auth/superuser-register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"Test123!"}'
   ```

3. **Login**
   ```bash
   curl -X POST http://localhost:3001/api/admin/auth/admin-login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"Test123!"}'
   ```

4. **Check Response**
   - Should get `accessToken` in response
   - User should have `isSuperUser: true`

5. **Test Protected Route**
   ```bash
   curl -X GET http://localhost:3001/api/admin/users \
     -H "Authorization: Bearer YOUR_TOKEN_HERE"
   ```

---

**If everything passes, the admin login/register flow is working correctly!** ✅

Good luck! 🚀
