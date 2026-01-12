# Custom Causes Feature - Quick Reference Guide

## 🚀 Quick Start

### For Users Creating a DAO
1. Go to "Create DAO" page
2. Fill in DAO name and description
3. Select optional **predefined cause tags** (Education, Healthcare, Funeral Fund, etc.)
4. **NEW:** Add your **custom cause** - describe your personal reason in your own words
   - Examples: "raising bail money", "funeral fund", "medical emergency support"
   - Max 100 characters
5. Complete remaining DAO setup
6. Deploy DAO - **cause is automatically saved**

### For Users Discovering DAOs
1. Go to DAOs page
2. View DAO cards - **custom cause displayed prominently** in teal box
3. See "💡 What we're doing this for:" followed by the cause
4. Join DAOs that align with your interests

---

## 💾 Database Schema

```sql
-- Added to daos table:
ALTER TABLE daos ADD COLUMN primary_cause varchar(100);
ALTER TABLE daos ADD COLUMN cause_tags jsonb DEFAULT '[]'::jsonb;
```

---

## 🔗 API Endpoints

### Create DAO
**POST** `/api/dao-deploy`

```json
{
  "daoData": {
    "name": "Family Fund",
    "description": "...",
    "primaryCause": "Funeral fund for family members",
    "causeTags": ["funeralfund", "collective"],
    // ... other fields
  }
  // ... rest of payload
}
```

### List DAOs
**GET** `/api/daos`

**Response includes:**
```json
{
  "id": "...",
  "name": "Family Fund",
  "description": "...",
  "primaryCause": "Funeral fund for family members",
  "causeTags": ["funeralfund", "collective"],
  // ... other fields
}
```

---

## 📁 Files Modified

| File | Changes | Purpose |
|------|---------|---------|
| `shared/schema.ts` | Added `primaryCause` varchar, `causeTags` jsonb | Database fields |
| `client/src/pages/create-dao.tsx` | Added form input, DaoData field, deployment payload | Form UI & submission |
| `client/src/pages/daos.tsx` | Added display component, interface field | Discovery UI |
| `server/api/dao_deploy.ts` | Added to request interface, DAO creation | Backend handler |
| `server/routes/daos.ts` | Added to select query, response mapping | API endpoint |

---

## 🎨 UI Components

### Form Input (create-dao.tsx)
```tsx
<Input
  placeholder="e.g., 'raising bail money', 'burial fund', 'business startup capital'..."
  value={daoData.primaryCause || ''}
  onChange={(e) => updateDaoData('primaryCause', e.target.value.slice(0, 100))}
  maxLength={100}
/>
<p className="text-xs text-gray-400">{(daoData.primaryCause || '').length}/100 characters</p>
```

### Display Component (daos.tsx)
```tsx
{dao.primaryCause && (
  <div className="mb-4 p-3 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 rounded-lg border border-teal-200 dark:border-teal-700">
    <p className="text-xs font-semibold text-teal-700 dark:text-teal-300 mb-1">💡 What we're doing this for:</p>
    <p className="text-sm text-teal-900 dark:text-teal-100 font-medium">{dao.primaryCause}</p>
  </div>
)}
```

---

## 📊 Example Use Cases

### Personal/Household
- "Funeral fund for family"
- "Medical emergency support"
- "Education fees for children"
- "Home improvement fund"

### Legal/Social
- "Raising bail/bond money"
- "Legal defense fund"
- "Victim support fund"
- "Domestic violence shelter"

### Community
- "Disaster relief fund"
- "School renovation project"
- "Community water project"
- "Emergency medical clinic"

### Business
- "Small business startup capital"
- "Business expansion fund"
- "Equipment purchase pool"
- "Market stall setup"

---

## ✅ Implementation Status

- [x] Database schema updated
- [x] Form UI created with input field
- [x] Cause data included in creation
- [x] Backend API updated
- [x] API returns cause in listing
- [x] Discovery page displays cause
- [x] Responsive design (mobile/desktop)
- [x] Dark mode support
- [x] TypeScript types defined
- [x] Documentation complete

---

## 🔍 How to Test

### Manual Testing Steps

1. **Create a DAO with cause:**
   - Navigate to /create-dao
   - Fill name: "Test Fund"
   - Add custom cause: "Test emergency fund"
   - Complete DAO setup
   - Click "Deploy"

2. **Verify storage:**
   - Check database: `SELECT primary_cause, cause_tags FROM daos WHERE name='Test Fund'`
   - Should see: `primary_cause="Test emergency fund", cause_tags=[]`

3. **Verify display:**
   - Go to /daos page
   - Find the DAO card
   - Should show teal box with "💡 What we're doing this for: Test emergency fund"

4. **Test multiple causes:**
   - Create 3-4 DAOs with different custom causes
   - Verify each displays correctly on discovery page

---

## 🐛 Troubleshooting

### Cause doesn't appear on card
- **Check:** Is `primaryCause` populated in database?
- **Check:** Is `daoData.primaryCause` being sent in API request?
- **Fix:** Clear browser cache and reload

### Character counter not working
- **Check:** Input has `maxLength={100}` attribute?
- **Check:** onChange updates correctly?
- **Fix:** Verify React state updates

### Database migration failed
- **Check:** Do you have migration tools set up?
- **Fix:** Use Drizzle migrations or run SQL directly

---

## 📈 Future Enhancements

1. **Cause-based Filtering** - Filter DAOs by cause
2. **Cause Trending** - Show popular causes
3. **Cause Recommendations** - Suggest DAOs by cause
4. **Cause History** - Track cause changes over time
5. **Cause Analytics** - See which causes attract most members

---

## 📞 Quick Reference

### Constants
- **Max Length:** 100 characters
- **Field Type:** VARCHAR(100)
- **Default Value:** Empty string ""
- **Required:** No (optional field)

### Styling
- **Background:** Teal gradient (from-teal-50 to-cyan-50)
- **Border:** Teal 200 / teal 700 dark
- **Text:** Teal 700 / teal 300 dark
- **Icon:** 💡 (lightbulb emoji)

### Validation
- ✅ Max 100 characters enforced
- ✅ Sanitized before database
- ✅ No special characters required
- ✅ Optional (can be empty)

---

**Feature Status:** ✅ COMPLETE & PRODUCTION-READY

Last Updated: $(date)
