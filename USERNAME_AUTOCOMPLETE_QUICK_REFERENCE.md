# Username Autocomplete Pattern - Developer Quick Reference

## One-Page Implementation Guide

Use this guide to add username autocomplete to any new component in 30 minutes.

---

## Step 1: Add Imports

```typescript
import { useQuery } from '@tanstack/react-query';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface UserSuggestion {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string;
}
```

---

## Step 2: Add State Variables

```typescript
const [inputValue, setInputValue] = useState('');
const [searchQuery, setSearchQuery] = useState('');
const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
const [selectedUser, setSelectedUser] = useState<UserSuggestion | null>(null);
const [showSuggestions, setShowSuggestions] = useState(false);
const [selectedIndex, setSelectedIndex] = useState(-1);
```

---

## Step 3: Add React Query Hook

```typescript
const { data: suggestionData } = useQuery({
  queryKey: ['your-component-suggestions', searchQuery],
  queryFn: async () => {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) return [];
    return res.json();
  },
  enabled: showSuggestions && searchQuery.length >= 2,
});

// Update suggestions when data arrives
React.useEffect(() => {
  if (suggestionData?.data) {
    setSuggestions(suggestionData.data);
    setSelectedIndex(-1);
  }
}, [suggestionData]);
```

---

## Step 4: Add Handler Functions

```typescript
// Handle input change
const handleInputChange = (value: string) => {
  setInputValue(value);
  
  // Only search if value starts with @ or is 2+ chars
  if (value.startsWith('@') || (value.length >= 2 && !value.startsWith('0x'))) {
    setSearchQuery(value.replace('@', ''));
    setShowSuggestions(true);
  } else {
    setShowSuggestions(false);
  }
};

// Handle user selection
const handleSelectUser = (user: UserSuggestion) => {
  setSelectedUser(user);
  setInputValue(`@${user.username}`);
  setShowSuggestions(false);
  setSuggestions([]);
};

// Handle keyboard navigation
const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (!showSuggestions) return;
  
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
      break;
    case 'ArrowUp':
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
      break;
    case 'Enter':
      e.preventDefault();
      if (selectedIndex >= 0) {
        handleSelectUser(suggestions[selectedIndex]);
      }
      break;
    case 'Escape':
      e.preventDefault();
      setShowSuggestions(false);
      break;
  }
};
```

---

## Step 5: Add UI - Input Field

```tsx
<div className="relative">
  <Input
    placeholder="@username or address"
    value={inputValue}
    onChange={(e) => handleInputChange(e.target.value)}
    onFocus={() => setShowSuggestions(true)}
    onKeyDown={handleKeyDown}
  />
```

---

## Step 6: Add UI - Suggestions Dropdown

```tsx
  {showSuggestions && suggestions.length > 0 && (
    <div className="absolute top-full mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
      {suggestions.map((user, index) => (
        <div
          key={user.id}
          onClick={() => handleSelectUser(user)}
          className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
            index === selectedIndex
              ? 'bg-blue-50 border-l-2 border-blue-500'
              : 'hover:bg-gray-50'
          }`}
        >
          <Avatar className="h-8 w-8">
            <img src={user.profileImageUrl} alt={user.username} />
            <AvatarFallback className="bg-blue-500 text-white text-xs">
              {user.firstName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="font-medium text-sm">@{user.username}</div>
            <div className="text-xs text-gray-500">
              {user.firstName} {user.lastName}
            </div>
          </div>
        </div>
      ))}
    </div>
  )}
```

---

## Step 7: Add UI - Selected User Display

```tsx
  {selectedUser && (
    <div className="mt-2 p-3 bg-green-50 border border-green-300 rounded-md flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8">
          <img src={selectedUser.profileImageUrl} alt={selectedUser.username} />
          <AvatarFallback className="bg-green-500 text-white text-xs">
            {selectedUser.firstName?.[0]}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="font-medium text-sm">@{selectedUser.username}</div>
          <div className="text-xs text-gray-600">
            {selectedUser.firstName} {selectedUser.lastName}
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setSelectedUser(null);
          setInputValue('');
          setShowSuggestions(false);
        }}
      >
        ✕
      </Button>
    </div>
  )}
</div>
```

---

## Step 8: Use Selected User

```typescript
// In your API call:
const handleSubmit = async () => {
  if (!selectedUser) {
    // Handle error - no user selected
    return;
  }
  
  const response = await fetch('/your/api/endpoint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipientUsername: selectedUser.username,  // OR
      recipientUserId: selectedUser.id,          // OR
      recipientAddress: selectedUser.id,         // depending on API
    })
  });
};
```

---

## Customization Examples

### Example 1: Different API Endpoint

```typescript
// Instead of /api/users/search, use custom endpoint:
const { data: suggestionData } = useQuery({
  queryKey: ['contacts-suggestions', searchQuery],
  queryFn: async () => {
    return await fetch(`/api/contacts/search?q=${encodeURIComponent(searchQuery)}`);
  },
});
```

### Example 2: Add Email to Display

```typescript
interface UserSuggestion {
  // ... existing fields
  email: string;  // NEW
}

// In dropdown:
<div className="flex-1">
  <div className="font-medium text-sm">@{user.username}</div>
  <div className="text-xs text-gray-500">{user.email}</div>
</div>
```

### Example 3: Filter Suggestions

```typescript
// Only show online users:
const filteredSuggestions = suggestions.filter(u => u.isOnline);

// Use filteredSuggestions in dropdown instead
```

### Example 4: Add Verification Badge

```typescript
{selectedUser && (
  <div className="mt-2 p-3 bg-green-50 border border-green-300 rounded-md">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8" />
        <div>
          <div className="font-medium text-sm">@{selectedUser.username}</div>
          {selectedUser.isVerified && (
            <div className="text-xs text-green-600">✓ Verified</div>
          )}
        </div>
      </div>
    </div>
  </div>
)}
```

---

## Common Patterns

### Pattern 1: Allow Fallback to Address

```typescript
const handleChange = (value: string) => {
  setInputValue(value);
  
  // If starts with @ or 2+ chars (not address), search
  if (value.startsWith('@') || (value.length >= 2 && !value.startsWith('0x'))) {
    setSearchQuery(value.replace('@', ''));
    setShowSuggestions(true);
  } else {
    // User entered address directly, allow submission
    setShowSuggestions(false);
  }
};
```

### Pattern 2: Resolve Username to Address

```typescript
const handleSubmit = async () => {
  let recipientAddress = '';
  
  if (selectedUser) {
    // Use selected user's address
    recipientAddress = selectedUser.id;
  } else if (inputValue.startsWith('0x')) {
    // Direct address input
    recipientAddress = inputValue;
  } else if (inputValue.startsWith('@')) {
    // Lookup username via API
    const res = await fetch(`/api/users/by-username/${inputValue.slice(1)}`);
    const data = await res.json();
    recipientAddress = data.walletAddress;
  }
  
  // Now use recipientAddress
};
```

### Pattern 3: Show User Profile on Click

```typescript
<div
  key={user.id}
  onClick={() => {
    handleSelectUser(user);
    // Also navigate to profile:
    navigate(`/profile/${user.username}`);
  }}
  className="cursor-pointer"
>
  {/* ... */}
</div>
```

---

## Testing Checklist

- [ ] Type `@j` and see suggestions appear
- [ ] Arrow down/up navigates list
- [ ] Enter key selects highlighted suggestion
- [ ] Escape key closes dropdown
- [ ] Selected user shows in green box
- [ ] Can clear selection with button
- [ ] Keyboard shortcuts work on mobile
- [ ] Avatar fallbacks show when image fails
- [ ] No console errors
- [ ] API calls are cached (React Query)
- [ ] Empty state shows when no matches
- [ ] Works with slow network (show loading)

---

## TypeScript Tips

```typescript
// ✅ Good - explicit types
const handleSelect = (user: UserSuggestion) => {
  setSelectedUser(user);
};

// ❌ Avoid - implicit any
const handleSelect = (user: any) => {
  setSelectedUser(user);
};

// ✅ Good - optional chaining
<div>{selectedUser?.firstName}</div>

// ❌ Avoid - risky
<div>{selectedUser.firstName}</div>
```

---

## Performance Tips

1. **Min 2 characters before search**: `enabled: searchQuery.length >= 2`
2. **Debounce API calls**: Built-in with `enabled` condition
3. **Cache with React Query**: Automatic
4. **Lazy load suggestions**: Show dropdown only on focus
5. **Limit dropdown height**: `max-h-48 overflow-y-auto`
6. **Uncontrolled input**: Use `value` prop for display only

---

## Accessibility Tips

1. **Keyboard navigation**: Arrow keys, Enter, Escape
2. **Avatar fallbacks**: Show initials if image fails
3. **Color + text**: Don't rely on color alone for info
4. **ARIA labels**: Add to input field
5. **Mobile support**: Touch-friendly dropdown size
6. **Semantic HTML**: Use proper input/button elements

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Dropdown not showing | Check `showSuggestions` state and `suggestions.length > 0` |
| Suggestions not fetching | Verify API endpoint, check token, check console errors |
| Selection not working | Ensure `handleSelectUser` is called and state updates |
| Keyboard nav not working | Check `handleKeyDown` is attached to input |
| Avatar not showing | Ensure `profileImageUrl` is valid, add fallback |
| Dropdown behind other elements | Add `z-50` to dropdown CSS |
| Performance lag | Reduce suggestion list size, add debouncing |

---

## Time Estimates

| Task | Time |
|------|------|
| Copy template code | 5 min |
| Adjust API endpoint | 5 min |
| Add custom fields | 5 min |
| Test basic functionality | 10 min |
| Handle edge cases | 5 min |
| Polish UI | 5 min |
| **Total** | **35 min** |

---

## Related Files

- Component examples: `client/src/components/sendTransactionModal.tsx`
- Component examples: `client/src/pages/referrals.tsx`
- Component examples: `client/src/components/wallet/PaymentLinkModal.tsx`
- UI components: `client/src/components/ui/`
- API docs: `/api/users/search` endpoint

---

**Created**: Today
**Version**: 1.0
**Last Updated**: Today
**Status**: ✅ Production Ready
