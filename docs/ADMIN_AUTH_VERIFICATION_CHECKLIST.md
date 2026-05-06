# Admin Login/Register Flow - Verification Checklist

## 📋 Pre-Flight Checks

Before testing, verify these components exist:

### ✅ Backend Files
- [ ] `server/routes/admin/admin-auth.ts` - Login/register endpoints
- [ ] `server/middleware/adminAuth.ts` - Admin authentication middleware  
- [ ] `server/auth.ts` - Core authentication logic
- [ ] `server/routes/admin.ts` - Admin router setup

### ✅ Database
- [ ] PostgreSQL is running
- [ ] Database has `users` table
- [ ] Table has columns: `id`, `email`, `passwordHash`, `roles`
- [ ] Can connect to database

### ✅ Environment
- [ ] `JWT_SECRET` is set
- [ ] `DATABASE_URL` is correct
- [ ] Server can start without errors

### ✅ Dependencies
- [ ] `bcryptjs` is installed
- [ ] `jsonwebtoken` is installed
- [ ] `express` is installed

---

## 🔍 Endpoint Verification

### 1. POST `/api/admin/auth/superuser-register`

**What it does**: Creates a new superuser account

**Test Command**:
```bash
curl -X POST http://localhost:3001/api/admin/auth/superuser-register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "verify-admin@example.com",
    "password": "VerifyPass123!",
    "firstName": "Verify",
    "lastName": "Admin"
  }'
```

**Verify These Points**:
- [ ] Status code is 200 or 201
- [ ] Response includes `success: true`
- [ ] Response includes `data.user` object
- [ ] User has `roles: "super_admin"`
- [ ] Response includes `data.accessToken`
- [ ] Token is a valid JWT (starts with `eyJ`)

**Expected Response Structure**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "string",
      "email": "verify-admin@example.com",
      "roles": "super_admin",
      "firstName": "Verify",
      "lastName": "Admin",
      "createdAt": "ISO date"
    },
    "accessToken": "jwt token string"
  }
}
```

**Common Issues**:
| Issue | Solution |
|-------|----------|
| 400 "Email required" | Make sure `email` field is in request |
| 400 "Password required" | Make sure `password` field is in request |
| 409 "Email already exists" | Use different email for test |
| 500 Database error | Check database connection in logs |

---

### 2. POST `/api/admin/auth/admin-login`

**What it does**: Authenticates an admin user and returns a token

**Test Command**:
```bash
curl -X POST http://localhost:3001/api/admin/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "verify-admin@example.com",
    "password": "VerifyPass123!"
  }'
```

**Verify These Points**:
- [ ] Status code is 200
- [ ] Response includes `success: true`
- [ ] Response includes `data.user` object
- [ ] User has `role: "super_admin"` (note: singular, not plural)
- [ ] User has `isSuperUser: true` flag
- [ ] User has `isAdmin: true` flag
- [ ] Response includes `data.accessToken`
- [ ] Token can be decoded (valid JWT)

**Expected Response Structure**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "string",
      "email": "verify-admin@example.com",
      "firstName": "Verify",
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
    "accessToken": "jwt token string"
  }
}
```

**Common Issues**:
| Issue | Solution |
|-------|----------|
| 400 "Email required" | Make sure `email` field is in request |
| 400 "Password required" | Make sure `password` field is in request |
| 401 "Invalid credentials" | Check email/password combination |
| 401 "not an admin" | User is not admin role in database |
| 500 Database error | Check database connection |

---

## 🔐 User Role Verification

### Verify User Roles

```bash
# Superuser Role
curl -X POST http://localhost:3001/api/admin/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{"email": "superuser@example.com", "password": "pass123"}' \
  | jq '.data.user | {role, isSuperUser, isAdmin}'
```

**Expected for Superuser**:
```json
{
  "role": "super_admin",
  "isSuperUser": true,
  "isAdmin": true
}
```

**Expected for Admin**:
```json
{
  "role": "admin",
  "isSuperUser": false,
  "isAdmin": true
}
```

**Expected for Non-Admin**:
```json
{
  "role": "user",
  "isSuperUser": false,
  "isAdmin": false
}
```

---

## 🔑 Token Verification

### 1. Verify Token is Valid JWT

```bash
# After login, copy the accessToken value and paste it here:
# https://jwt.io/

# Or use this bash command:
TOKEN="your_token_here"
echo $TOKEN | cut -d'.' -f2 | base64 -d | jq .
```

**Should see**:
```json
{
  "id": "user-uuid",
  "role": "super_admin",
  "iat": 1234567890,
  "exp": 1234654290
}
```

### 2. Verify Token Works on Protected Routes

```bash
TOKEN="your_token_here"

curl -X GET http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Should get**:
- [ ] Status code 200
- [ ] Returns admin data
- [ ] No 401 "Unauthorized" error

---

## 🧪 Error Handling Verification

### Test 1: Wrong Password
```bash
curl -X POST http://localhost:3001/api/admin/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{"email": "verify-admin@example.com", "password": "WrongPassword"}'
```

**Should return**:
- [ ] Status: 401
- [ ] Message: "Invalid credentials"
- [ ] No token provided

### Test 2: Non-existent User
```bash
curl -X POST http://localhost:3001/api/admin/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{"email": "nonexistent@example.com", "password": "anypass"}'
```

**Should return**:
- [ ] Status: 401
- [ ] Message: "Invalid credentials or not an admin/superuser"
- [ ] No token provided

### Test 3: Missing Fields
```bash
curl -X POST http://localhost:3001/api/admin/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{"email": "verify-admin@example.com"}'
```

**Should return**:
- [ ] Status: 400
- [ ] Message: "Email and password required"
- [ ] No token provided

### Test 4: Duplicate Registration
```bash
# Try to register same email twice
curl -X POST http://localhost:3001/api/admin/auth/superuser-register \
  -H "Content-Type: application/json" \
  -d '{"email": "verify-admin@example.com", "password": "pass123"}'
```

**Should return** (on second attempt):
- [ ] Status: 409
- [ ] Message: "Email already registered"
- [ ] No user/token provided

---

## 🔄 Complete Flow Verification

Run this step-by-step:

### Step 1: Register
```bash
RESPONSE=$(curl -s -X POST http://localhost:3001/api/admin/auth/superuser-register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "flow-test@example.com",
    "password": "FlowTest123!",
    "firstName": "Flow",
    "lastName": "Test"
  }')

echo "Register Response:"
echo $RESPONSE | jq .

# Verify response
echo $RESPONSE | jq -e '.success == true' && echo "✅ Register success" || echo "❌ Register failed"
echo $RESPONSE | jq -e '.data.user.roles == "super_admin"' && echo "✅ Correct role" || echo "❌ Wrong role"
```

### Step 2: Login
```bash
RESPONSE=$(curl -s -X POST http://localhost:3001/api/admin/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "flow-test@example.com",
    "password": "FlowTest123!"
  }')

echo "Login Response:"
echo $RESPONSE | jq .

# Extract token
TOKEN=$(echo $RESPONSE | jq -r '.data.accessToken')
echo "Token: $TOKEN"

# Verify response
echo $RESPONSE | jq -e '.success == true' && echo "✅ Login success" || echo "❌ Login failed"
echo $RESPONSE | jq -e '.data.user.isSuperUser == true' && echo "✅ isSuperUser flag" || echo "❌ Missing isSuperUser"
echo $RESPONSE | jq -e '.data.user.isAdmin == true' && echo "✅ isAdmin flag" || echo "❌ Missing isAdmin"
```

### Step 3: Use Token
```bash
RESPONSE=$(curl -s -X GET http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "Protected Route Response:"
echo $RESPONSE | jq . | head -20

# Verify access
if [ $? -eq 0 ]; then
  echo "✅ Token works for protected routes"
else
  echo "❌ Token rejected"
fi
```

---

## 📊 Test Summary Checklist

### Register Endpoint
- [ ] Creates new superuser
- [ ] Returns correct user object
- [ ] Returns valid JWT token
- [ ] Rejects missing fields
- [ ] Rejects duplicate emails
- [ ] Sets user role to "super_admin"

### Login Endpoint
- [ ] Accepts valid credentials
- [ ] Returns correct user object
- [ ] Returns `isSuperUser: true` for superusers
- [ ] Returns `isAdmin: true` for admins
- [ ] Returns valid JWT token
- [ ] Rejects wrong passwords
- [ ] Rejects non-existent users
- [ ] Rejects non-admin users
- [ ] Rejects missing fields

### Token Validation
- [ ] Token is valid JWT format
- [ ] Token contains user ID
- [ ] Token contains user role
- [ ] Token has expiration
- [ ] Token works on protected routes
- [ ] Invalid token is rejected
- [ ] Expired token is rejected

### Error Handling
- [ ] Returns 400 for bad requests
- [ ] Returns 401 for auth failures
- [ ] Returns 409 for conflicts
- [ ] Returns 500 for server errors
- [ ] Error messages are helpful

---

## ✅ Success Criteria

**The admin login/register flow is working if**:

✅ Can register a new superuser
✅ Can login with registered credentials  
✅ Get valid JWT token on login
✅ Token has `isSuperUser` and `isAdmin` flags
✅ Token works on protected routes
✅ Cannot login with wrong password
✅ Cannot login with non-existent email
✅ Cannot register duplicate email
✅ Error messages are appropriate

---

## 🎉 Final Verification

Run this final command to verify everything:

```bash
#!/bin/bash

echo "🧪 FINAL VERIFICATION TEST"
echo "=========================="
echo ""

# 1. Register
echo "1️⃣  Registering test user..."
REG=$(curl -s -X POST http://localhost:3001/api/admin/auth/superuser-register \
  -H "Content-Type: application/json" \
  -d '{"email":"final-test@example.com","password":"FinalTest123!","firstName":"Final","lastName":"Test"}')

if echo $REG | jq -e '.success == true' > /dev/null; then
  echo "✅ Registration successful"
else
  echo "❌ Registration failed"
  exit 1
fi

# 2. Login
echo "2️⃣  Logging in..."
LOGIN=$(curl -s -X POST http://localhost:3001/api/admin/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{"email":"final-test@example.com","password":"FinalTest123!"}')

if echo $LOGIN | jq -e '.success == true' > /dev/null; then
  echo "✅ Login successful"
else
  echo "❌ Login failed"
  exit 1
fi

# 3. Extract token
TOKEN=$(echo $LOGIN | jq -r '.data.accessToken')
echo "✅ Token obtained: ${TOKEN:0:20}..."

# 4. Check flags
if echo $LOGIN | jq -e '.data.user.isSuperUser == true' > /dev/null; then
  echo "✅ isSuperUser flag present"
else
  echo "❌ isSuperUser flag missing"
fi

if echo $LOGIN | jq -e '.data.user.isAdmin == true' > /dev/null; then
  echo "✅ isAdmin flag present"
else
  echo "❌ isAdmin flag missing"
fi

# 5. Test protected route
echo "3️⃣  Testing protected route..."
PROTECTED=$(curl -s -X GET http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

if [ ! -z "$PROTECTED" ]; then
  echo "✅ Protected route accessible"
else
  echo "❌ Protected route failed"
fi

echo ""
echo "🎉 ALL CHECKS PASSED!"
echo "Admin login/register flow is working correctly."
```

Save as `verify-auth.sh` and run:
```bash
chmod +x verify-auth.sh
./verify-auth.sh
```

---

## 📞 Troubleshooting

If verification fails, check:

1. **Server is running**: `npm run dev`
2. **Database connection**: Check logs for DB errors
3. **JWT_SECRET is set**: `echo $JWT_SECRET`
4. **Port 3001 is available**: `netstat -ano | findstr :3001`
5. **bcryptjs is installed**: `npm list bcryptjs`
6. **jsonwebtoken is installed**: `npm list jsonwebtoken`

---

**Status**: Ready for verification ✅
**Last Updated**: 2024-01-21
**Created By**: GitHub Copilot
