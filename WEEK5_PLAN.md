# Week 5 Plan: Page Integration & Application Assembly

**Duration**: 5 days (Mon-Fri)  
**Focus**: Integrate layout + navigation components into 10+ production pages  
**Expected Output**: Complete working application with full page system  
**Target**: 2,000+ lines of production code + 1,000+ lines of tests  

---

## 📋 Overview

Week 5 transforms the design system foundation (Weeks 1-3) and layout architecture (Week 4) into a complete, functional application. Each page leverages the appropriate layout component and integrates with navigation, RBAC, and routing systems.

### Architecture Pattern

Every page follows this structure:
```
Page Component
├── HeaderNav (sticky header with search, notifications, user menu)
├── SidebarNav (collapsible navigation with RBAC filtering)
├── BreadcrumbNav (location awareness)
└── Layout Component (Dashboard/Form/List/Detail)
    └── Atomic + Compound Components
```

---

## 🗓️ Daily Breakdown

### Monday: Planning & Dashboard
**Tasks**:
1. ✅ Create WEEK5_PLAN.md (this document)
2. Create Dashboard page (main hub)
3. Create NavProvider context for RBAC
4. Setup page routing structure

**Deliverables**:
- Dashboard with 6+ metric cards
- Recent activity list
- Quick action buttons
- Responsive grid layout

**Time**: 1 planning + 3 implementation

---

### Tuesday: User Management System
**Tasks**:
1. Create Users list page (ListLayout)
2. Create User detail page (DetailLayout)
3. Create CreateUser modal form
4. Create EditUser form

**Deliverables**:
- Users list with 3 view modes (table/grid/list)
- Search, filter, pagination
- CRUD operations
- User profile detail view

**Time**: 4 hours implementation

---

### Wednesday: Settings & Forms
**Tasks**:
1. Create Account Settings page (FormLayout)
2. Create Security Settings page
3. Create Notification Preferences page
4. Add form validation & error handling

**Deliverables**:
- 3 settings pages with proper sections
- Form validation with error messages
- Success/error state handling
- Auto-save support

**Time**: 4 hours implementation

---

### Thursday: Additional Pages & RBAC
**Tasks**:
1. Create Products management system
2. Create Orders management system
3. Implement RBAC navigation filtering
4. Test role-based access control

**Deliverables**:
- Products list + detail
- Orders list + detail
- RBAC-filtered navigation
- Role-based menu visibility

**Time**: 4 hours implementation

---

### Friday: Integration & Testing
**Tasks**:
1. Write integration tests for all pages
2. Create end-to-end test scenarios
3. Verify page navigation flows
4. Create usage documentation

**Deliverables**:
- 50+ integration tests
- Complete working application
- Navigation flow verification
- Developer documentation

**Time**: 4 hours testing + docs

---

## 📄 Pages to Implement (10+)

### 1. Dashboard Page
**Path**: `/`  
**Layout**: `DashboardLayout`  
**Navigation**: HeaderNav + SidebarNav + BreadcrumbNav  

**Components**:
```typescript
interface DashboardPage {
  metrics: MetricCard[];        // 6 cards: Revenue, Users, Orders, etc.
  recentActivity: Activity[];   // Last 10 activities
  quickActions: QuickAction[];  // 4 buttons: Create User, New Order, etc.
  charts: ChartData[];          // Sales, Users trend
}
```

**Features**:
- ✅ 6 metric cards with KPIs
- ✅ Responsive 1-3 column grid
- ✅ Recent activity timeline
- ✅ Quick action buttons
- ✅ Charts (mock data)
- ✅ Loading states
- ✅ Empty states

**Integration**:
```typescript
<HeaderNav title="Dashboard" notifications={notifications} />
<SidebarNav activePath="/" />
<DashboardLayout columns={3}>
  {metrics.map(m => <DashboardCard {...m} />)}
  <RecentActivity />
  <QuickActions />
</DashboardLayout>
```

**Data**:
```typescript
const mockMetrics = [
  { title: 'Total Revenue', value: '$45,231.89', trend: '+20.1%', icon: 'trending-up' },
  { title: 'Active Users', value: '2,543', trend: '+5.2%', icon: 'users' },
  { title: 'Orders Today', value: '142', trend: '-3.1%', icon: 'shopping-cart' },
  { title: 'Conversion Rate', value: '3.24%', trend: '+0.8%', icon: 'percent' },
  { title: 'Avg Order Value', value: '$234.56', trend: '+12.5%', icon: 'dollar-sign' },
  { title: 'Customer Satisfaction', value: '4.8/5.0', trend: '+0.2', icon: 'star' },
];
```

**Tests**: 15+ tests covering
- Metric card rendering
- Recent activity display
- Quick action functionality
- Responsive grid behavior
- Loading/empty states
- Data updates

---

### 2. Users List Page
**Path**: `/users`  
**Layout**: `ListLayout`  
**Navigation**: HeaderNav + SidebarNav + BreadcrumbNav  

**Features**:
- ✅ Table view with sortable columns
- ✅ Grid view with user cards
- ✅ List view with compact display
- ✅ Search functionality
- ✅ Filters: Role, Status, Date Joined
- ✅ Pagination (10, 25, 50 per page)
- ✅ Bulk actions: Delete, Export
- ✅ Row actions: View, Edit, Delete
- ✅ Create new user button

**Columns**:
```typescript
const userColumns = [
  { key: 'name', label: 'Name', sortable: true, width: '200px' },
  { key: 'email', label: 'Email', sortable: true, width: '250px' },
  { key: 'role', label: 'Role', sortable: true, width: '150px', render: (v) => <Badge>{v}</Badge> },
  { key: 'status', label: 'Status', sortable: true, width: '120px', render: (v) => <Badge variant={v === 'Active' ? 'success' : 'warning'}>{v}</Badge> },
  { key: 'joinDate', label: 'Joined', sortable: true, width: '150px', render: (v) => formatDate(v) },
];
```

**Filters**:
```typescript
const userFilters = [
  { id: 'role', label: 'Role', type: 'select', options: [
    { label: 'Admin', value: 'admin' },
    { label: 'User', value: 'user' },
    { label: 'Manager', value: 'manager' },
  ] },
  { id: 'status', label: 'Status', type: 'select', options: [
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
  ] },
];
```

**Actions**:
```typescript
const userActions = [
  { id: 'view', label: 'View', variant: 'secondary' },
  { id: 'edit', label: 'Edit', variant: 'primary' },
  { id: 'delete', label: 'Delete', variant: 'danger' },
];
```

**Integration**:
```typescript
<HeaderNav 
  items={navItems}
  onSearch={handleSearch}
/>
<SidebarNav activePath="/users" />
<ListLayout
  title="Users"
  items={users}
  columns={userColumns}
  viewMode={viewMode}
  onSearch={handleSearch}
  filters={userFilters}
  actions={userActions}
  page={page}
  total={totalUsers}
/>
```

**Tests**: 15+ tests covering
- List rendering in all 3 view modes
- Search functionality
- Filter application
- Pagination
- Row action handling
- Bulk actions
- Column customization

---

### 3. User Detail Page
**Path**: `/users/:id`  
**Layout**: `DetailLayout`  
**Navigation**: BreadcrumbNav  

**Tabs**:
1. **Overview** - User info, contact, address
2. **Activity** - Login history, actions log
3. **Settings** - User preferences
4. **Roles** - Assigned roles and permissions

**Features**:
- ✅ Header with user name, status badge, action buttons
- ✅ Tab navigation with activity badge
- ✅ Sidebar with user avatar, role, contact
- ✅ Back button navigation
- ✅ Edit mode support
- ✅ Breadcrumb: Dashboard > Users > [User Name]

**Sidebar Content**:
```typescript
interface UserDetailSidebar {
  avatar: string;
  name: string;
  email: string;
  role: string;
  status: 'Active' | 'Inactive';
  joinDate: string;
  lastActive: string;
}
```

**Overview Tab**:
```typescript
<DetailSection title="Personal Information">
  <DetailRow>
    <DetailField label="First Name" value={user.firstName} />
    <DetailField label="Last Name" value={user.lastName} />
  </DetailRow>
  <DetailRow>
    <DetailField label="Email" value={user.email} />
    <DetailField label="Phone" value={user.phone} />
  </DetailRow>
  <DetailRow>
    <DetailField label="Address" value={user.address} />
    <DetailField label="City" value={user.city} />
  </DetailRow>
</DetailSection>
```

**Activity Tab**:
```typescript
<ActivityTimeline items={loginHistory} />
<ActivityLog items={actionLog} />
```

**Integration**:
```typescript
<BreadcrumbNav items={breadcrumbs} />
<DetailLayout
  title={user.name}
  status={user.status}
  actions={[
    { id: 'edit', label: 'Edit', variant: 'primary' },
    { id: 'delete', label: 'Delete', variant: 'danger' },
  ]}
  tabs={[
    { id: 'overview', label: 'Overview' },
    { id: 'activity', label: 'Activity', badge: 12 },
    { id: 'settings', label: 'Settings' },
    { id: 'roles', label: 'Roles' },
  ]}
  activeTab={activeTab}
  sidebar={<UserSidebar user={user} />}
>
  {renderTabContent()}
</DetailLayout>
```

**Tests**: 15+ tests covering
- Tab switching
- Content rendering per tab
- Sidebar display
- Action button handling
- Breadcrumb navigation
- Edit mode support
- Data loading

---

### 4. Settings Pages (Account, Security, Notifications)

**Path**: `/settings/account`, `/settings/security`, `/settings/notifications`  
**Layout**: `FormLayout`  

#### 4a. Account Settings
**Features**:
- Personal information form (name, email, phone)
- Avatar upload
- Password change
- Two-factor authentication setup
- Save/Cancel buttons with auto-save

**Form Sections**:
```typescript
<FormLayout title="Account Settings" columns={1}>
  <FormSection title="Personal Information">
    <FormField label="First Name" required>
      <Input value={firstName} onChange={setFirstName} />
    </FormField>
    <FormField label="Email" required>
      <Input type="email" value={email} onChange={setEmail} />
    </FormField>
  </FormSection>

  <FormSection title="Avatar">
    <AvatarUpload />
  </FormSection>

  <FormSection title="Password">
    <PasswordChangeForm />
  </FormSection>

  <FormActions />
</FormLayout>
```

#### 4b. Security Settings
**Features**:
- Two-factor authentication
- Active sessions management
- Login history
- Security notifications
- Trusted devices

#### 4c. Notification Preferences
**Features**:
- Email preferences checkboxes
- Notification frequency selection
- Alert types (email, SMS, in-app)
- Quiet hours settings

**Integration**:
```typescript
<HeaderNav title="Settings" />
<SidebarNav activePath="/settings/account" items={settingsMenu} />
<FormLayout title="Account Settings">
  {/* Form content */}
</FormLayout>
```

**Tests**: 10+ tests per settings page covering
- Form rendering
- Input validation
- Submit handling
- Error display
- Success notification
- Auto-save functionality

---

### 5. Products Management
**Path**: `/products`  
**Layout**: `ListLayout` + `DetailLayout`  

**List Page Features**:
- Product listing with image, name, price, stock, category
- Search by product name/SKU
- Filters: Category, Price range, In stock
- Pagination
- View modes: Table (default), Grid, List
- Actions: View, Edit, Delete

**Detail Page**:
- Product image gallery
- Product info (name, SKU, price, stock)
- Tabs: Overview, Inventory, Pricing, Images
- Edit button
- Delete button

**Mock Data**:
```typescript
const mockProducts = [
  { id: 1, name: 'Wireless Headphones', sku: 'WH-001', price: 79.99, stock: 45, category: 'Electronics' },
  { id: 2, name: 'USB-C Cable', sku: 'UC-001', price: 12.99, stock: 234, category: 'Accessories' },
  // ... more products
];
```

---

### 6. Orders Management
**Path**: `/orders`  
**Layout**: `ListLayout` + `DetailLayout`  

**List Page Features**:
- Order listing with ID, customer, amount, status, date
- Search by order ID or customer name
- Filters: Status (Pending, Processing, Shipped, Delivered), Date range
- Pagination
- Quick actions: View, Ship, Cancel

**Detail Page**:
- Order header with ID, status, customer info
- Items table with product, quantity, price
- Shipping information
- Payment method
- Timeline of order events

**Status Badges**:
- Pending: Yellow
- Processing: Blue
- Shipped: Cyan
- Delivered: Green
- Cancelled: Red

---

### 7. Reports Page
**Path**: `/reports`  
**Layout**: `ListLayout`  

**Features**:
- Pre-built reports list
- Custom report builder
- Export functionality (CSV, PDF)
- Scheduling reports for email
- Report templates

---

### 8. Analytics Dashboard
**Path**: `/analytics`  
**Layout**: `DashboardLayout`  

**Features**:
- Revenue chart (line)
- User growth chart (area)
- Traffic sources (pie)
- Conversion funnel
- Device breakdown
- Geographic heatmap

---

### 9. Admin Panel
**Path**: `/admin` (RBAC: admin only)  
**Layout**: `DashboardLayout`  

**Features**:
- System health metrics
- User growth statistics
- Revenue analytics
- Server status
- Recent system logs
- Database backup status

---

### 10. Help & Documentation
**Path**: `/help`  
**Layout**: Custom  

**Features**:
- FAQ list with search
- Documentation pages
- Contact support form
- Knowledge base articles

---

## 🔐 RBAC Implementation

### Navigation Filtering

**SidebarNav Enhancement**:
```typescript
const sidebarItems: SidebarNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/', visible: true },
  { id: 'users', label: 'Users', path: '/users', visible: userRole !== 'viewer' },
  { id: 'products', label: 'Products', path: '/products', visible: userRole !== 'viewer' },
  { id: 'admin', label: 'Admin', path: '/admin', visible: userRole === 'admin' },
  { id: 'settings', label: 'Settings', path: '/settings', visible: true },
];
```

**HeaderNav Enhancement**:
```typescript
const headerItems: HeaderNavItem[] = [
  { id: 'home', label: 'Home', path: '/', visible: true },
  {
    id: 'management',
    label: 'Management',
    visible: userRole === 'admin' || userRole === 'manager',
    children: [
      { id: 'users', label: 'Users', path: '/users' },
      { id: 'products', label: 'Products', path: '/products' },
      { id: 'orders', label: 'Orders', path: '/orders' },
    ],
  },
];
```

### User Roles

```typescript
type UserRole = 'admin' | 'manager' | 'user' | 'viewer';

const rolePermissions: Record<UserRole, string[]> = {
  admin: ['*'],  // All permissions
  manager: ['view_users', 'view_products', 'view_orders', 'manage_users'],
  user: ['view_own_profile', 'view_products', 'view_own_orders'],
  viewer: ['view_products'],
};
```

---

## 🏗️ Architecture & Patterns

### Context Setup

**AuthContext** (User + RBAC):
```typescript
interface AuthContextType {
  user: User;
  role: UserRole;
  isAuthenticated: boolean;
  permissions: string[];
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType>(undefined!);
```

**NavigationContext** (Menu structure):
```typescript
interface NavigationContextType {
  sidebarItems: SidebarNavItem[];
  headerItems: HeaderNavItem[];
  filteredSidebarItems: SidebarNavItem[];
  filteredHeaderItems: HeaderNavItem[];
}
```

### Page Template Pattern

**Base Page Component**:
```typescript
interface PageProps {
  title?: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
}

const BasePage: React.FC<PageProps> = ({ title, subtitle, breadcrumbs }) => {
  const { user } = useAuth();

  return (
    <div className="flex h-screen">
      <SidebarNav items={filteredSidebarItems} />
      <div className="flex-1 flex flex-col">
        <HeaderNav userInfo={user} />
        <main className="flex-1 overflow-auto">
          {breadcrumbs && <BreadcrumbNav items={breadcrumbs} />}
          <div className="p-6">
            {title && <h1 className="text-3xl font-bold">{title}</h1>}
            {subtitle && <p className="text-neutral-600">{subtitle}</p>}
            {/* Page content */}
          </div>
        </main>
      </div>
    </div>
  );
};
```

### Form Pattern

**FormPage Component**:
```typescript
interface FormPageProps {
  title: string;
  onSubmit: (data: any) => Promise<void>;
  initialValues?: any;
  fields: FormFieldConfig[];
}

const FormPage: React.FC<FormPageProps> = ({ title, onSubmit, fields }) => {
  const [formData, setFormData] = useState(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      setIsLoading(true);
      await onSubmit(formData);
      // Success toast
    } catch (error) {
      setErrors(error.response?.data?.errors || {});
      // Error toast
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FormLayout
      title={title}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      errors={errors}
    >
      {fields.map(field => (
        <FormField key={field.id} label={field.label} error={errors[field.id]}>
          <Input {...field} value={formData[field.id]} onChange={(e) => setFormData({...formData, [field.id]: e.target.value})} />
        </FormField>
      ))}
    </FormLayout>
  );
};
```

### List Page Pattern

**ListPage Component**:
```typescript
interface ListPageProps {
  title: string;
  columns: ColumnDefinition[];
  filters: FilterDefinition[];
  actions: ActionDefinition[];
  fetchItems: (search, filters, page) => Promise<{items: any[], total: number}>;
}

const ListPage: React.FC<ListPageProps> = ({ title, columns, filters, actions, fetchItems }) => {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadItems = async () => {
      setIsLoading(true);
      const { items, total } = await fetchItems(search, activeFilters, page);
      setItems(items);
      setTotal(total);
      setIsLoading(false);
    };
    loadItems();
  }, [search, activeFilters, page]);

  return (
    <ListLayout
      title={title}
      items={items}
      columns={columns}
      filters={filters}
      actions={actions}
      onSearch={setSearch}
      onFilterChange={setActiveFilters}
      page={page}
      onPageChange={setPage}
      total={total}
      isLoading={isLoading}
      onAction={(action, item) => {
        if (action === 'view') navigate(`/users/${item.id}`);
        if (action === 'edit') navigate(`/users/${item.id}/edit`);
        if (action === 'delete') handleDelete(item.id);
      }}
    />
  );
};
```

---

## 🧪 Integration Testing

### Test Scenarios

**1. Navigation Flow**:
```typescript
describe('Application Navigation', () => {
  it('navigates from Dashboard to Users and back', () => {
    // 1. Start at Dashboard
    // 2. Click Users in sidebar
    // 3. Verify Users page loaded
    // 4. Click back button
    // 5. Verify Dashboard loaded
  });

  it('filters navigation items by user role', () => {
    // 1. Login as viewer
    // 2. Verify only Dashboard and Products visible
    // 3. Logout
    // 4. Login as admin
    // 5. Verify all items visible
  });
});
```

**2. User CRUD Flow**:
```typescript
describe('User Management Flow', () => {
  it('creates new user', () => {
    // 1. Navigate to Users
    // 2. Click Create button
    // 3. Fill form
    // 4. Submit
    // 5. Verify new user in list
  });

  it('edits existing user', () => {
    // 1. Navigate to Users
    // 2. Click Edit on user
    // 3. Change data
    // 4. Submit
    // 5. Verify changes in detail view
  });

  it('deletes user', () => {
    // 1. Navigate to Users
    // 2. Click Delete
    // 3. Confirm deletion
    // 4. Verify user removed from list
  });
});
```

**3. Form Validation**:
```typescript
describe('Form Validation', () => {
  it('shows validation errors', () => {
    // 1. Navigate to settings
    // 2. Clear required field
    // 3. Submit
    // 4. Verify error message shown
  });

  it('disables submit with invalid data', () => {
    // 1. Navigate to form
    // 2. Enter invalid email
    // 3. Verify submit button disabled
  });
});
```

---

## 📊 Expected Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Pages Implemented | 10+ | ⏳ |
| Integration Tests | 50+ | ⏳ |
| Total LOC (impl) | 2,000+ | ⏳ |
| Total LOC (tests) | 1,000+ | ⏳ |
| Build Time | <3s | ⏳ |
| Pages Responsive | 100% | ⏳ |
| Type Coverage | 100% | ⏳ |
| Test Coverage | 90%+ | ⏳ |

---

## ✅ Success Criteria

- ✅ All 10+ pages implemented with proper layouts
- ✅ Navigation integration (HeaderNav + SidebarNav + BreadcrumbNav)
- ✅ RBAC filtering on menu items
- ✅ Form validation and error handling
- ✅ Search, filter, and pagination on lists
- ✅ CRUD operations working
- ✅ 50+ integration tests passing
- ✅ 100% responsive design (mobile, tablet, desktop)
- ✅ Loading and empty states on all pages
- ✅ Error boundaries and error handling
- ✅ Complete type safety (TypeScript strict)
- ✅ Full documentation and usage examples

---

## 🔄 Dependencies

**Depends On**:
- Week 1: Design tokens ✅
- Week 2: Atomic components ✅
- Week 3: Compound components ✅
- Week 4: Layout + navigation components ✅

**Used By**:
- Production deployment
- User applications
- Admin dashboards

---

## 📝 Next Steps (Post-Week 5)

After Week 5 completion:

1. **Week 6**: Performance optimization, state management (Redux/Zustand)
2. **Week 7**: API integration with backend
3. **Week 8**: Authentication implementation
4. **Week 9**: Deployment & DevOps
5. **Week 10**: Final testing, bug fixes, launch prep

---

**Plan Status**: Ready for implementation  
**Start Date**: Monday, [Date]  
**Target Completion**: Friday, [Date]  
**Next Review**: End of day Friday
