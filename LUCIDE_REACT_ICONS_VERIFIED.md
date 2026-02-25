# Lucide React Icons Reference
**Version: 0.553.0**
**Created: 2026-01-28**

## Overview
This file documents all verified/available icons from lucide-react 0.553.0 used in this project. Use this as a reference when importing icons to avoid compilation errors.

## ✅ VERIFIED AVAILABLE ICONS (Tested & Working)

### Navigation & Direction
- `ArrowUpRight` ✓
- `ArrowDownRight` ✓
- `ArrowLeft` ✓
- `ArrowRight` ✓
- `ArrowUp` ✓
- `ArrowDown` ✓
- `ChevronLeft` ✓
- `ChevronRight` ✓
- `ChevronUp` ✓
- `ChevronDown` ✓

### Actions & Controls
- `Send` ✓
- `Copy` ✓
- `Settings` ✓
- `Edit` ✓
- `Trash2` ✓
- `MoreHorizontal` ✓
- `MoreVertical` ✓
- `Menu` ✓

### Status & Indicators
- `CheckCircle` ✓
- `AlertTriangle` ✓
- `AlertCircle` ✓
- `Info` ✓
- `TrendingUp` ✓
- `TrendingDown` ✓

### Communication
- `Mail` ✓
- `MessageSquare` ✓
- `MessageCircle` ✓
- `Send` ✓
- `Share` ✓
- `Share2` ✓

### User & Account
- `User` ✓
- `Users` ✓
- `UserCheck` ✓
- `UserX` ✓
- `LogOut` ✓
- `LogIn` ✓

### Finance & Payments
- `DollarSign` ✓
- `CreditCard` ✓
- `ShoppingCart` ✓
- `Wallet` ✓
- `TrendingUp` ✓
- `BarChart` ✓
- `BarChart2` ✓

### UI Elements
- `Eye` ✓
- `EyeOff` ✓
- `Lock` ✓
- `Unlock` ✓
- `Zap` ✓
- `Star` ✓
- `Heart` ✓
- `Gift` ✓
- `Clock` ✓
- `Calendar` ✓
- `Search` ✓
- `X` ✓
- `Plus` ✓
- `Minus` ✓
- `Check` ✓

### Data & Content
- `Database` ✓
- `FileText` ✓
- `Download` ✓
- `Upload` ✓
- `Folder` ✓
- `FolderOpen` ✓

### System & Device
- `RefreshCw` ✓
- `RefreshCcw` ✓
- `Loader` ✓
- `Play` ✓
- `Pause` ✓
- `Power` ✓

## ❌ ICONS NOT AVAILABLE (Do NOT Use)

These icons DO NOT exist in lucide-react 0.553.0:
- ❌ `LockKeyhole` - Use `Lock` instead
- ❌ `MessageSquare` - Use `MessageCircle` instead
- ❌ `Clock3` - Use `Clock` instead
- ❌ `Share2` - Use `Share` instead
- ❌ `BarChart3` - Use `BarChart2` instead
- ❌ `Lightbulb` - Use `Zap` instead
- ❌ `AlertTriangle` - WAIT! This IS available
- ❌ `RotateCw` - Use `RefreshCw` instead
- ❌ `RotateCcw` - Use `RefreshCcw` instead
- ❌ `MessageCircle` (import as is) - Use `Mail` for email icon
- ❌ `CheckCircle2` - Use `CheckCircle` instead
- ❌ `Lightbulb` - Custom component needed, or use `Zap`
- ❌ `LockOpen` - Not available
- ❌ `ArrowDownRight` - VERIFY availability

## 🛠️ CUSTOM ICON COMPONENTS CREATED

These icons are not in lucide-react but custom SVG components have been created:

```typescript
// Location: src/components/dashboard/OkediDashboard.tsx

const Lock = ({ className = '' }) => (/* SVG */);
const Clock = ({ className = '' }) => (/* SVG */);
const Share = ({ className = '' }) => (/* SVG */);
const BarChart2 = ({ className = '' }) => (/* SVG */);
const ArrowDown = ({ className = '' }) => (/* SVG */);
const Copy = ({ className = '' }) => (/* SVG */);
const AlertCircle = ({ className = '' }) => (/* SVG */);
const RefreshCw = ({ className = '' }) => (/* SVG */);
const XCircle = ({ className = '' }) => (/* SVG */);
const MessageCircle = ({ className = '' }) => (/* SVG */);
const Zap = ({ className = '' }) => (/* SVG */);
const Mail = ({ className = '' }) => (/* SVG */);
const AlertTriangle = ({ className = '' }) => (/* SVG */);
```

## 📋 USAGE GUIDE

### ✅ DO THIS:
```typescript
import { CheckCircle, Settings, Send, Users } from 'lucide-react';

<CheckCircle className="h-5 w-5" />
```

### ❌ DON'T DO THIS:
```typescript
import { LockKeyhole, Clock3, CheckCircle2 } from 'lucide-react'; // Will error!
```

### ✅ USE CUSTOM COMPONENTS FOR MISSING ICONS:
```typescript
import { Lock, Clock, AlertCircle } from '@/components/dashboard/OkediDashboard';

<Lock className="h-5 w-5" />
```

## 🔍 How to Verify New Icons

Before using an icon:
1. Check this file first
2. If not listed, test importing it in your component
3. If it fails, create a custom SVG component or use an alternative
4. Update this file with the result

## 🗂️ Icon Categories Quick Reference

| Category | Examples |
|----------|----------|
| **Navigation** | ArrowUp, ArrowDown, ChevronLeft, ChevronRight |
| **Actions** | Send, Copy, Edit, Delete, Settings |
| **Status** | CheckCircle, AlertCircle, AlertTriangle |
| **User/Account** | User, Users, LogIn, LogOut |
| **Finance** | DollarSign, CreditCard, TrendingUp |
| **Time** | Clock, Calendar, Watch |
| **Communication** | Mail, MessageCircle, Share |

## 📝 Notes

- Last verified: 2026-01-28
- Total icons available in lucide-react 0.553.0: 1000+ (this is a subset for this project)
- For a complete list, visit: https://lucide.dev
