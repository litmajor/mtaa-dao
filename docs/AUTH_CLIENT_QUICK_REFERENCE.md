# Frontend Auth - Quick Reference Guide

## ✨ What's New

Frontend authentication now uses **secure httpOnly cookies** instead of localStorage/sessionStorage tokens. All API calls go through the centralized `authClient` wrapper.

---

## 🚀 Quick Start - Using authClient

### Import
```typescript
import { authClient } from '@/utils/authClient';
```

### GET Requests
```typescript
// Fetch data - no auth header needed (automatic)
const user = await authClient.get<User>('/api/user/profile');

// In React Query
const { data: user } = useQuery({
  queryKey: ['user'],
  queryFn: () => authClient.get<User>('/api/user/profile'),
});
```

### POST Requests
```typescript
// Create/update - with body
const result = await authClient.post('/api/deposits', {
  amount: 1000,
  method: 'bank'
});

// In React Query mutation
const mutation = useMutation({
  mutationFn: (data) => authClient.post('/api/deposits', data),
  onSuccess: () => {
    queryClient.refetchQueries({ queryKey: ['deposits'] });
  }
});
```

### PUT Requests
```typescript
const updated = await authClient.put('/api/profile', {
  firstName: 'John',
  lastName: 'Doe'
});
```

### PATCH Requests
```typescript
const patched = await authClient.patch('/api/settings/notifications', {
  emailNotifications: false
});
```

### DELETE Requests
```typescript
const result = await authClient.delete('/api/sessions/all');
```

---

## 🔧 Advanced Usage

### Type Safety
```typescript
interface UserProfile {
  id: string;
  email: string;
  firstName: string;
}

// Typed response
const profile = await authClient.get<UserProfile>('/api/user/profile');
// profile is typed as UserProfile, TypeScript knows the properties
```

### Error Handling
```typescript
try {
  const data = await authClient.post('/api/deposit', { amount: 100 });
  console.log('Success:', data);
} catch (err) {
  // authClient throws on non-2xx responses
  console.error('Error:', err.message); // Automatically handled
  // No need to check response.ok
}
```

### React Query Integration
```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['wallet', 'balance'],
  queryFn: async () => {
    return authClient.get<Balance>('/api/wallet/balance');
  },
  staleTime: 1000 * 60 * 5, // 5 minutes
  refetchInterval: 1000 * 60, // Refresh every min
});
```

### Mutations with Side Effects
```typescript
const claimRewardsMutation = useMutation({
  mutationFn: (rewardId: string) => 
    authClient.post('/api/rewards/claim', { rewardId }),
  
  onSuccess: (data) => {
    // Update cache
    queryClient.setQueryData(['balance'], (old) => ({
      ...old,
      amount: old.amount + data.rewardAmount
    }));
    
    // Refetch related data
    queryClient.refetchQueries(['rewards']);
    
    // Show success message
    toast.success('Reward claimed!');
  },
  
  onError: (error) => {
    toast.error(error.message);
  }
});
```

---

## ❌ What NOT to Do (Old Pattern - Deprecated)

### ❌ DON'T: Manual localStorage tokens
```typescript
// ❌ WRONG - Don't do this anymore
const token = localStorage.getItem('accessToken');
const res = await fetch('/api/endpoint', {
  headers: {
    'Authorization': `Bearer ${token}` // ❌ XSS vulnerable!
  }
});
```

### ❌ DON'T: Manual fetch with Authorization headers
```typescript
// ❌ WRONG - Use authClient instead
const response = await fetch('/api/data', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}` // ❌ Insecure
  },
  body: JSON.stringify(data)
});
```

### ❌ DON'T: Use old lib/api.ts (Deprecated)
```typescript
// ❌ DEPRECATED - This still works but uses authClient internally
import { apiGet, apiPost } from '@/lib/api';
// Use authClient directly instead!
```

---

## 🔐 Automatic Features

You don't need to do anything - authClient handles this automatically:

### ✅ Automatic Cookie Transmission
```typescript
// Cookies are automatically sent with every request
// (You don't need credentials: 'include')
const data = await authClient.get('/api/user/profile');
```

### ✅ Automatic Token Refresh
```typescript
// If the server returns 401 Unauthorized:
// 1. authClient automatically calls /api/auth/refresh-token
// 2. Gets new token (in cookie)
// 3. Retries original request
// 4. Returns response to you
// (All transparent to your code!)
```

### ✅ Automatic CSRF Protection
```typescript
// authClient automatically:
// 1. Reads CSRF token from cookie
// 2. Injects it into request headers
// 3. Server validates it
// (Nothing for you to do!)
```

### ✅ Automatic Error Propagation
```typescript
// All non-2xx responses are thrown as errors
try {
  await authClient.post('/api/deposit', { amount: 0 }); // 400 Bad Request
} catch (err) {
  // err.message contains the error from server
  console.error(err.message);
}
```

---

## 📋 Migration Checklist

If you're adding a new API integration:

- [ ] Import authClient: `import { authClient } from '@/utils/authClient'`
- [ ] Replace fetch() with authClient.get/post/put/patch/delete()
- [ ] Remove Authorization headers (authClient adds them automatically)
- [ ] Remove credentials: 'include' (authClient adds it automatically)
- [ ] Add type constraints: `authClient.get<TypeName>()`
- [ ] Test error handling (authClient throws on errors)
- [ ] Verify React Query patterns work
- [ ] Test in browser DevTools (no tokens stored locally)

---

## 🐛 Debugging Tips

### Check Network Requests
```
1. Open DevTools (F12)
2. Go to Network tab
3. Look for requests with "Cookie" header (automatic)
4. NO "Authorization: Bearer xyz" headers (authClient uses cookies)
5. No tokens in request body or localStorage
```

### Check Cookies
```
1. DevTools → Application → Cookies
2. Look for access_token, refresh_token cookies
3. They should be marked as "HttpOnly" (immune to XSS)
```

### Check for Auto-Refresh
```
1. Go to /api/auth/login with wrong password
2. Leave browser open and wait
3. Log in correctly in another tab
4. Original fetch should auto-refresh and work
```

### Enable Logging (Development)
```typescript
// In authClient.ts (dev only)
console.log('[authClient] Refreshing token...');
console.log('[authClient] Request to:', url);
```

---

## 🎯 Common Patterns

### Query with Conditional Fetch
```typescript
const { data: settings } = useQuery({
  queryKey: ['settings', userId],
  queryFn: () => authClient.get(`/api/users/${userId}/settings`),
  enabled: !!userId, // Only fetch if userId exists
});
```

### Paginated Query
```typescript
const { data: items } = useQuery({
  queryKey: ['items', page, limit],
  queryFn: () => authClient.get(
    `/api/items?page=${page}&limit=${limit}`
  ),
});
```

### Mutation with Optimistic Update
```typescript
const updateProfile = useMutation({
  mutationFn: (profile) => authClient.put('/api/profile', profile),
  
  onMutate: async (newProfile) => {
    // Cancel any pending queries
    await queryClient.cancelQueries({ queryKey: ['profile'] });
    
    // Optimistically update
    const previousProfile = queryClient.getQueryData(['profile']);
    queryClient.setQueryData(['profile'], newProfile);
    
    return { previousProfile };
  },
  
  onError: (err, newProfile, context) => {
    // Rollback on error
    if (context?.previousProfile) {
      queryClient.setQueryData(['profile'], context.previousProfile);
    }
  }
});
```

### Dependent Queries
```typescript
const { data: user } = useQuery({
  queryKey: ['user'],
  queryFn: () => authClient.get('/api/user/profile'),
});

const { data: wallet } = useQuery({
  queryKey: ['wallet', user?.id],
  queryFn: () => authClient.get(`/api/wallets/${user!.id}`),
  enabled: !!user?.id, // Only fetch when user exists
});
```

---

## ⚙️ Configuration

### Changing Auth Endpoints
Edit `client/src/utils/authClient.ts`:
```typescript
const REFRESH_TOKEN_ENDPOINT = '/api/auth/refresh-token'; // Change this
const API_BASE = process.env.VITE_API_URL || 'http://localhost:3000'; // Change this
```

### Adding Custom Headers
```typescript
// If you need to add extra headers (rare)
const options: RequestInit = {
  headers: {
    'X-Custom-Header': 'value'
  }
};
// Pass to authClient.fetch() for raw control
```

---

## 📚 Resources

- **authClient Source**: `client/src/utils/authClient.ts`
- **Migration Guide**: `AUTH_SECURITY_MIGRATION_COMPLETE.md`
- **Example Implementations**: See any migrated file for patterns

---

## ❓ FAQ

### Q: Why can't I see the token in DevTools?
**A**: It's in an httpOnly cookie. That's the security improvement! DevTools can't see it (but JavaScript can't either - that's the point).

### Q: What if I need to send a custom header?
**A**: Use `authClient.fetch()` for raw control over options. Or contact the team.

### Q: How do I log out?
**A**: Call `authClient.post('/api/auth/logout')`. authClient clears everything.

### Q: What if the token expires?
**A**: authClient automatically refreshes it. Transparent to your code.

### Q: Can I use the old lib/api.ts?
**A**: It still works (internally uses authClient) but it's deprecated. Use authClient directly.

### Q: Does this work with OAuth/Google login?
**A**: Yes! OAuth still works. It returns cookies just like regular login.

### Q: What about logout across multiple tabs?
**A**: Each tab manages its own session. Cookie sync handles it across tabs.

---

**Happy coding! 🎉**

For questions or issues, see the migration guide or check existing implementations.
