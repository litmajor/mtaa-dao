# Import Path Reference for MTAA DAO

## ⚠️ CRITICAL: ESM Module Imports

This project uses **ES Modules (`"type": "module"`)**. Path aliases like `@shared/schema` **DO NOT WORK** at runtime in server-side code.

---

## ✅ Correct Import Patterns

### **Server-Side Code** (anything in `/server`)

Always use **relative paths with `.js` extension**:

```typescript
// ❌ WRONG - Will cause ERR_MODULE_NOT_FOUND
import { users } from '@shared/schema';
import { env } from '@shared/config';

// ✅ CORRECT - Use relative paths
import { users } from '../shared/schema.js';
import { env } from '../../shared/config.js';
```

**Why `.js` extension?**
- TypeScript files (`.ts`) are transpiled to JavaScript at runtime
- Node.js ESM requires explicit file extensions
- Use `.js` even when importing from `.ts` files

---

### **Client-Side Code** (anything in `/client`)

Path aliases work fine in client code (Vite handles them):

```typescript
// ✅ Works in client code
import { Button } from '@/components/ui/button';
import { users } from '@shared/schema';
```

---

## 📂 Common Import Patterns

### From `/server/index.ts`:
```typescript
import { env } from '../shared/config.js';
import * as schema from '../shared/schema.js';
```

### From `/server/api/`:
```typescript
import { users } from '../../shared/schema.js';
import { env } from '../../shared/config.js';
```

### From `/server/middleware/`:
```typescript
import { env } from '../../shared/config.js';
```

### From `/server/routes/`:
```typescript
import { users } from '../../shared/schema.js';
```

---

## 🔧 Files Already Fixed

✅ `server/index.ts` → `"../shared/config.js"`
✅ `server/db.ts` → `"../shared/schema.js"`
✅ `server/vite.ts` → `"../vite.config.js"`
✅ `server/middleware/errorHandler.ts` → `"../../shared/config.js"`
✅ `server/utils/logger.ts` → `"../../shared/config.js"`
✅ `server/routes/health.ts` → `"../../shared/config.js"`
✅ `server/api/dashboard.ts` → `"../../shared/schema.js"`

---

## 🚨 If You See This Error

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@shared/...'
```

**Solution:**
1. Find the file mentioned in the error
2. Replace `'@shared/schema'` with relative path + `.js`
3. Count `../ ` based on directory depth:
   - `/server/file.ts` → `'../shared/schema.js'`
   - `/server/api/file.ts` → `'../../shared/schema.js'`
   - `/server/api/subdir/file.ts` → `'../../../shared/schema.js'`

---

## 📝 Quick Reference Table

| From Directory | To `shared/schema.js` | To `shared/config.js` |
|----------------|------------------------|------------------------|
| `/server/` | `'../shared/schema.js'` | `'../shared/config.js'` |
| `/server/api/` | `'../../shared/schema.js'` | `'../../shared/config.js'` |
| `/server/routes/` | `'../../shared/schema.js'` | `'../../shared/config.js'` |
| `/server/middleware/` | `'../../shared/schema.js'` | `'../../shared/config.js'` |
| `/server/services/` | `'../../shared/schema.js'` | `'../../shared/config.js'` |
| `/server/utils/` | `'../../shared/schema.js'` | `'../../shared/config.js'` |

---

## 🎯 Best Practice

**When creating new server files:**
1. ❌ Never use `@shared/...` imports
2. ✅ Always use relative paths with `.js` extension
3. ✅ Test the import path immediately after creating the file

---

**Last Updated:** $(Get-Date -Format "yyyy-MM-dd HH:mm")
**Status:** ✅ All known imports fixed



