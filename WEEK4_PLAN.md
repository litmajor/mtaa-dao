# Week 4 - Layout Templates & Page Integration Plan

**Phase**: Week 4 - Layout Templates & Navigation Architecture  
**Duration**: Monday-Friday (December 1-5, 2025)  
**Status**: 🚀 IN PROGRESS

---

## 🎯 Week 4 Objectives

Build complete layout system and navigation architecture that wraps all 50+ pages with:
- 4 reusable layout templates (Dashboard, Form, List, Detail)
- 3 navigation components (Sidebar, Header, Breadcrumb)
- RBAC (Role-Based Access Control) integration
- Responsive design for mobile/tablet/desktop
- Full TypeScript support with 100+ tests

**Total Deliverables**: 7 components + 100+ tests + page integration examples

---

## 📋 Daily Breakdown

### Monday: Planning & Dashboard Layout
**Focus**: Architecture foundation and main dashboard layout

#### Architecture Overview
```
App Layout Structure:
├── AppLayout (main container with theme provider)
│   ├── ToastProvider (from Week 3)
│   ├── SidebarNav (role-based navigation)
│   ├── HeaderNav (top bar with user menu)
│   └── MainContent (page content container)
│       ├── BreadcrumbNav (current location)
│       └── SpecializedLayout
│           ├── DashboardLayout (grid-based)
│           ├── FormLayout (2-column form)
│           ├── ListLayout (table + filters)
│           └── DetailLayout (header + sidebar + content)

Page Structure:
├── /dashboard → DashboardLayout
├── /settings/* → FormLayout
├── /users, /customers, /reports → ListLayout
├── /users/:id, /products/:id → DetailLayout
└── Custom pages use AppLayout + children
```

#### Dashboard Layout Component
```typescript
interface DashboardLayoutProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  
  // Grid customization
  columns?: 'auto' | 1 | 2 | 3 | 4 | 6;
  gap?: 'sm' | 'md' | 'lg';
  
  // Header section
  headerContent?: React.ReactNode;
  headerAction?: React.ReactNode;
  
  // Sidebar
  showSidebar?: boolean;
  sidebarContent?: React.ReactNode;
  
  // Responsive
  responsiveColumns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
}

Subcomponents:
- <DashboardHeader /> - Title, subtitle, actions
- <DashboardGrid /> - Responsive grid container
- <DashboardCard /> - Individual dashboard card
- <DashboardSidebar /> - Sidebar content area
```

**Features**:
- Responsive grid (1-6 columns)
- Auto-sizing cards with aspect ratio
- Sidebar support
- Header with title, subtitle, action buttons
- Customizable gaps and spacing
- Mobile-first responsive design
- Built on Week 1 grid/spacing tokens

**Use Cases**: Analytics dashboard, admin overview, KPI display

**Testing**: 25+ tests covering grid, responsiveness, props

---

### Tuesday: Form & List Layouts
**Focus**: Form and list data display patterns

#### Form Layout Component
```typescript
interface FormLayoutProps {
  title?: string;
  subtitle?: string;
  onSubmit?: (data: any) => void;
  isLoading?: boolean;
  children: React.ReactNode;
  
  // Layout
  columns?: 1 | 2;
  gap?: 'sm' | 'md' | 'lg';
  
  // Actions
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  
  // Validation
  errors?: Record<string, string>;
  touched?: Record<string, boolean>;
  
  // Styling
  className?: string;
}

Subcomponents:
- <FormSection /> - Grouped fields
- <FormField /> - Wrapper with label, error, helper
- <FormActions /> - Submit, cancel buttons
- <FormGrid /> - Field layout grid
```

**Features**:
- 1-2 column layout
- Field-level validation display
- Helper text support
- Error message display
- Submit/cancel actions
- Loading state
- Mobile responsive (1 col)
- Desktop 2 col

**Use Cases**: Settings, user profiles, data entry

**Testing**: 25+ tests covering layout, validation, actions

#### List Layout Component
```typescript
interface ListLayoutProps {
  title?: string;
  subtitle?: string;
  
  // Data
  items: any[];
  isLoading?: boolean;
  total?: number;
  
  // Display
  viewMode?: 'table' | 'grid' | 'list';
  
  // Search & Filter
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  filters?: FilterDefinition[];
  onFilterChange?: (filters: any) => void;
  
  // Pagination
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  
  // Columns (for table view)
  columns?: ColumnDefinition[];
  
  // Actions
  actions?: ActionDefinition[];
  onAction?: (action: string, item: any) => void;
  
  // Empty state
  emptyMessage?: string;
}

Subcomponents:
- <ListHeader /> - Title, search, view toggle
- <ListFilters /> - Filter bar
- <ListTable /> - Table view
- <ListGrid /> - Grid view
- <ListPagination /> - Page navigation
```

**Features**:
- Multiple view modes (table, grid, list)
- Search with debounce
- Filter system with multiple filters
- Pagination
- Column customization
- Row actions (edit, delete, view)
- Sorting
- Loading states
- Empty state message
- Responsive

**Use Cases**: User lists, product catalogs, reports

**Testing**: 25+ tests covering views, filters, pagination

---

### Wednesday: Detail & Navigation
**Focus**: Detail layout and navigation components

#### Detail Layout Component
```typescript
interface DetailLayoutProps {
  // Header
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  
  // Navigation
  tabs?: TabDefinition[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  
  // Content
  children: React.ReactNode;
  
  // Sidebar
  sidebar?: React.ReactNode;
  sidebarWidth?: 'sm' | 'md' | 'lg';
  
  // Actions
  actions?: ActionDefinition[];
  onAction?: (action: string) => void;
  
  // States
  isLoading?: boolean;
  status?: 'active' | 'inactive' | 'draft' | 'archived';
  
  // Responsive
  sidebarPosition?: 'right' | 'left';
  stackOnMobile?: boolean;
}

Subcomponents:
- <DetailHeader /> - Title, status, actions
- <DetailContent /> - Main content area
- <DetailSidebar /> - Side information
- <DetailTabs /> - Tab navigation
- <DetailActions /> - Action buttons
```

**Features**:
- Two-column layout (content + sidebar)
- Tab navigation within content
- Status indicator
- Breadcrumb navigation
- Action button bar
- Sidebar customizable width
- Mobile stack on small screens
- Responsive design

**Use Cases**: User profile, product detail, customer view

**Testing**: 25+ tests covering layout, tabs, sidebar

#### Navigation Components

**SidebarNav Component**
```typescript
interface SidebarNavProps {
  // Structure
  items: NavItem[];
  
  // State
  activeItem?: string;
  onItemClick?: (item: string) => void;
  
  // RBAC
  role?: UserRole;
  permissions?: Permission[];
  
  // Customization
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  
  // Header
  headerContent?: React.ReactNode;
  logo?: React.ReactNode;
  
  // Footer
  footerContent?: React.ReactNode;
  
  // Styling
  variant?: 'light' | 'dark';
  width?: 'sm' | 'md' | 'lg';
}

Features:
- Nested menu structure
- RBAC filtering (show/hide based on role)
- Collapsible sections
- Collapse/expand toggle
- Active item highlighting
- Icons and badges
- Smooth transitions
- Mobile responsive (collapses to icon-only)
- Sticky positioning
```

**HeaderNav Component**
```typescript
interface HeaderNavProps {
  // Structure
  title?: string;
  logo?: React.ReactNode;
  
  // Content
  menuItems?: NavItem[];
  searchEnabled?: boolean;
  
  // User
  user?: {
    name: string;
    avatar?: string;
    role?: string;
  };
  
  // Actions
  onSearch?: (query: string) => void;
  onLogout?: () => void;
  
  // Notifications
  notificationCount?: number;
  onNotifications?: () => void;
  
  // Sidebar toggle
  onSidebarToggle?: () => void;
  
  // RBAC
  role?: UserRole;
  permissions?: Permission[];
}

Features:
- Logo/branding area
- Navigation menu
- Search bar (optional)
- Notification bell (with badge)
- User dropdown menu
- Theme toggle
- Sidebar toggle button
- Sticky/fixed positioning
- Responsive (hamburger menu on mobile)
```

**BreadcrumbNav Component**
```typescript
interface BreadcrumbNavProps {
  // Items
  items: {
    label: string;
    href?: string;
    active?: boolean;
  }[];
  
  // Behavior
  onNavigate?: (href: string) => void;
  
  // Customization
  separator?: string | React.ReactNode;
  maxItems?: number;
  
  // Styling
  className?: string;
}

Features:
- Auto-collapse on mobile
- Ellipsis for long paths
- Customizable separator
- Click navigation
- Screen reader support
- Current page indicator
```

**Testing**: 25+ tests for all navigation components

---

### Thursday: Integration & Testing
**Focus**: Full integration, tests, and documentation

#### Page Integration Examples

**Dashboard Page**
```typescript
// /app/dashboard/page.tsx
export default function DashboardPage() {
  return (
    <AppLayout title="Dashboard">
      <DashboardLayout columns={3} gap="md">
        <DashboardCard title="Total Users" value="12,543" trend="+5.2%" />
        <DashboardCard title="Revenue" value="$45,231" trend="+12.5%" />
        <DashboardCard title="Growth" value="8.2%" trend="+2.1%" />
        <DashboardCard colspan={3} title="Chart">
          <Chart data={data} />
        </DashboardCard>
      </DashboardLayout>
    </AppLayout>
  );
}
```

**Settings Page**
```typescript
// /app/settings/page.tsx
export default function SettingsPage() {
  const [formData, setFormData] = useState({});
  
  return (
    <AppLayout title="Settings">
      <FormLayout
        title="Account Settings"
        onSubmit={handleSubmit}
        columns={2}
      >
        <FormField label="Email" name="email" />
        <FormField label="Username" name="username" />
        <FormField label="Full Name" colspan={2} />
        <FormActions />
      </FormLayout>
    </AppLayout>
  );
}
```

**Users Page**
```typescript
// /app/users/page.tsx
export default function UsersPage() {
  const [filters, setFilters] = useState({});
  
  return (
    <AppLayout title="Users">
      <ListLayout
        title="All Users"
        items={users}
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'role', label: 'Role' },
          { key: 'status', label: 'Status' },
        ]}
        onSearch={handleSearch}
        onFilterChange={setFilters}
        viewMode="table"
      />
    </AppLayout>
  );
}
```

**User Detail Page**
```typescript
// /app/users/[id]/page.tsx
export default function UserDetailPage({ params }) {
  const user = useUser(params.id);
  
  return (
    <AppLayout title={user?.name}>
      <DetailLayout
        title={user?.name}
        status={user?.status}
        tabs={[
          { value: 'info', label: 'Information' },
          { value: 'activity', label: 'Activity' },
        ]}
        sidebar={<UserSidebar user={user} />}
      >
        <UserInfo user={user} />
      </DetailLayout>
    </AppLayout>
  );
}
```

#### Testing Strategy (100+ tests)

**Dashboard Layout**: 25 tests
- Grid rendering (1-6 columns)
- Responsive behavior (mobile, tablet, desktop)
- Card wrapping
- Spacing and gaps
- Header section
- Sidebar display
- Empty state

**Form Layout**: 25 tests
- 1-2 column layout
- Field rendering
- Error display
- Validation state
- Submit/cancel buttons
- Loading state
- Form actions
- Mobile responsive

**List Layout**: 25 tests
- Table view rendering
- Grid view rendering
- List view rendering
- Search functionality
- Filter application
- Pagination
- Sorting
- Empty state
- Loading state

**Detail Layout**: 15 tests
- Header rendering
- Content display
- Sidebar positioning
- Tab navigation
- Action buttons
- Status indicator
- Mobile stack

**Navigation**: 15 tests
- Sidebar rendering
- Menu items
- RBAC filtering
- Collapse/expand
- Header nav rendering
- User dropdown
- Breadcrumb rendering
- Active states

---

### Friday: Documentation & Finalization
**Focus**: Complete documentation, finalize, and prepare for Week 5

#### Deliverables

1. **Updated Barrel Exports** (index.ts)
   - All 7 layout components
   - All navigation components
   - Complete type exports

2. **WEEK4_PLAN.md**
   - Detailed architecture
   - Component specifications
   - Integration examples
   - Testing strategy

3. **Layout Guide Documentation**
   - When to use each layout
   - Props reference
   - Responsive behavior
   - Mobile optimization
   - Accessibility features

4. **Page Integration Examples**
   - Dashboard page
   - Settings page
   - List page
   - Detail page
   - Custom layout combinations

5. **WEEK4_COMPLETE.md**
   - Achievements summary
   - Metrics and statistics
   - Test results
   - Quality assessment
   - Preparation for Week 5

---

## 🏗️ Component Architecture

### Layout System Hierarchy

```
AppLayout (wrapper)
├── Theme Provider
├── Toast Provider
├── SidebarNav
├── HeaderNav
├── BreadcrumbNav
└── Outlet (child layout)
    ├── DashboardLayout
    ├── FormLayout
    ├── ListLayout
    ├── DetailLayout
    └── Custom Layout
```

### Navigation System

```
Navigation Structure:
SidebarNav (primary navigation)
├── Dashboard
├── Manage
│   ├── Users
│   ├── Customers
│   └── Products
├── Reports
├── Settings
└── Help

HeaderNav (secondary actions)
├── Search
├── Notifications
├── Theme Toggle
└── User Menu
    ├── Profile
    ├── Settings
    └── Logout

BreadcrumbNav (location indicator)
App > Section > Page > Detail
```

### RBAC Integration

```typescript
// Example: Role-based access
const navItems = [
  { label: 'Dashboard', href: '/dashboard', roles: ['admin', 'user'] },
  { label: 'Users', href: '/users', roles: ['admin'] },
  { label: 'Reports', href: '/reports', roles: ['admin', 'manager'] },
  { label: 'Settings', href: '/settings', roles: ['admin', 'user'] },
];

// Component automatically filters based on user role
<SidebarNav items={navItems} role={user.role} />
```

---

## 📐 Responsive Breakpoints

All layouts use consistent responsive design:

```
Mobile-First Approach:
- Mobile (< 640px): Single column, full width
- Tablet (640px - 1024px): 2 columns, sidebar on bottom
- Desktop (> 1024px): Multiple columns, sidebar on side
```

---

## 🎯 Success Criteria

### Code Quality
- [ ] 0 TypeScript errors
- [ ] 0 ESLint errors
- [ ] All components fully typed
- [ ] All props have JSDoc comments

### Testing
- [ ] 100+ tests across all layouts
- [ ] >90% coverage per layout
- [ ] All responsive behavior tested
- [ ] Accessibility tests included

### Accessibility
- [ ] WCAG 2.1 AA compliant
- [ ] Keyboard navigation working
- [ ] Screen reader compatible
- [ ] Focus management proper

### Documentation
- [ ] Architecture documented
- [ ] Component APIs documented
- [ ] Page integration examples provided
- [ ] Migration guide for existing pages

### Integration
- [ ] All layouts use atomic/compound components
- [ ] Consistent styling with design tokens
- [ ] RBAC filtering working
- [ ] Responsive design verified

---

## 📊 Expected Metrics

**Code**:
- Layout components: ~800 lines
- Navigation components: ~600 lines
- Total: ~1,400 lines

**Tests**:
- Total test cases: 100+
- Coverage: >90% per component

**Components**:
- Layouts: 4
- Navigation: 3
- Built-in subcomponents: 15+

---

## 🚀 Week 5 Preparation

After Week 4, Week 5 will:
- Migrate all 50+ pages to new layout system
- Implement RBAC navigation filtering
- Mobile optimization
- Performance tuning
- Production deployment

---

## 📈 Project Progress

| Week | Focus | Status |
|------|-------|--------|
| 1 | Design System (Tokens, Colors, Typography) | ✅ Complete |
| 2 | Atomic Components (Button, Card, Input, etc.) | ✅ Complete |
| 3 | Compound Components (Select, Modal, Tabs, etc.) | ✅ Complete |
| 4 | Layout Templates (Dashboard, Form, List, Detail) | 🚀 In Progress |
| 5 | Page Integration & Mobile Optimization | 📋 Planned |

**Total Components**: 12 (atomic) + 6 (compound) + 7 (layouts) = **25 components**  
**Total Tests**: 250 + 250 + 100+ = **600+ tests**  
**TypeScript**: 100% coverage  
**Accessibility**: WCAG 2.1 AA  

---

**Start Date**: Monday, December 1, 2025  
**Target Completion**: Friday, December 5, 2025  
**Status**: 🚀 Ready to begin

