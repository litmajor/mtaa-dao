# Week 3 - Compound Components Plan

**Phase**: Week 3 - Compound Components & Advanced Patterns  
**Duration**: Monday-Friday (November 24-28, 2025)  
**Status**: 🚀 IN PROGRESS

---

## 🎯 Week 3 Objectives

Build 6 compound components that combine atomic components for complex UI patterns:
- **Select**: Searchable dropdown with keyboard navigation
- **Modal**: Dialog with animations and focus management
- **Tabs**: Tabbed content with active state management
- **Dropdown**: Positioned menu with alignment options
- **Popover**: Floating UI with arrow and positioning
- **Toast**: Non-dismissal notification system with queue

**Total Deliverables**: 6 components + 250+ tests + full documentation

---

## 📋 Daily Breakdown

### Monday: Select & Modal
**Components**: 2
**Tests**: 80+
**Time**: Full day

#### Select Component
```typescript
interface SelectProps {
  // Structure
  trigger: React.ReactNode;
  children: React.ReactNode;
  
  // State
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  
  // Behavior
  disabled?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  multiple?: boolean;
  
  // Styling
  placeholder?: string;
  className?: string;
}
```

**Features**:
- Multiple selection modes (single, multi)
- Built-in search/filter
- Keyboard navigation (arrow keys, enter, escape)
- Value display with clear button
- Custom trigger render
- Accessibility (ARIA combobox, listbox)
- Portal rendering for z-index

**Test Coverage** (40+ tests):
- Render (open/closed states, trigger, options)
- Selection (single, multiple, toggle)
- Search (filter, highlight, no results)
- Keyboard (arrow up/down, enter, escape, tab)
- State (controlled, uncontrolled, callbacks)
- Accessibility (roles, labels, keyboard)
- Edge cases (empty list, disabled items, groups)

#### Modal Component
```typescript
interface ModalProps {
  // Structure
  children: React.ReactNode;
  title?: string;
  description?: string;
  
  // State
  open: boolean;
  onOpenChange: (open: boolean) => void;
  
  // Behavior
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
  closeButton?: boolean;
  
  // Styling
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  overlayClassName?: string;
  
  // Advanced
  portal?: boolean;
  trapFocus?: boolean;
}
```

**Features**:
- Animated entrance/exit
- Focus trap
- Scroll lock
- Portal rendering
- Customizable close behavior
- Header/footer sections
- Responsive sizing
- Backdrop interaction control

**Test Coverage** (40+ tests):
- Render (open/closed, title, description)
- Animation (entrance, exit, timing)
- Interaction (close button, backdrop, escape)
- Focus (trap, return focus, initial focus)
- Scroll (lock when open, unlock on close)
- Accessibility (dialog role, aria-modal, label)
- Responsive (sizes, mobile adaptation)
- Nested modals

---

### Tuesday: Tabs & Dropdown
**Components**: 2
**Tests**: 75+
**Time**: Full day

#### Tabs Component
```typescript
interface TabsProps {
  // Structure
  children: React.ReactNode;
  
  // State
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  
  // Behavior
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
  
  // Styling
  variant?: 'underline' | 'pill' | 'card';
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
}

interface TabProps {
  value: string;
  trigger: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
}
```

**Features**:
- 3 visual variants (underline, pill, card)
- Horizontal & vertical orientation
- Keyboard navigation (arrow keys, tab, home, end)
- Lazy content rendering
- Active indicator animation
- Disabled tab support
- Controlled & uncontrolled modes

**Test Coverage** (35+ tests):
- Render (all variants, orientations)
- Tabs (switch, default, disabled)
- Keyboard (arrows, home, end, tab)
- Animation (indicator movement, smooth)
- State (controlled, uncontrolled, callbacks)
- Accessibility (tablist role, tab role, aria-selected)
- Performance (lazy rendering)

#### Dropdown Component
```typescript
interface DropdownProps {
  // Structure
  trigger: React.ReactNode;
  children: React.ReactNode;
  
  // State
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  
  // Positioning
  placement?: 'top' | 'bottom' | 'left' | 'right';
  offset?: number;
  align?: 'start' | 'center' | 'end';
  
  // Behavior
  closeOnItemClick?: boolean;
  closeOnEscape?: boolean;
  
  // Styling
  className?: string;
}
```

**Features**:
- 4 placement options (top, bottom, left, right)
- 3 alignment options (start, center, end)
- Auto-flip on viewport edge
- Keyboard navigation
- Portal rendering
- Click-outside detection
- Dividers and headers

**Test Coverage** (40+ tests):
- Render (placement, alignment, items)
- Positioning (viewport detection, flip)
- Interaction (open, close, item click)
- Keyboard (escape, arrow, enter)
- Focus (initial, cycling)
- Accessibility (menu role, menuitem role)
- Edge cases (viewport edges, overflow)

---

### Wednesday: Popover & Toast
**Components**: 2
**Tests**: 75+
**Time**: Full day

#### Popover Component
```typescript
interface PopoverProps {
  // Structure
  trigger: React.ReactNode;
  children: React.ReactNode;
  
  // State
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  
  // Positioning
  placement?: 'top' | 'bottom' | 'left' | 'right';
  offset?: number;
  showArrow?: boolean;
  
  // Behavior
  closeOnEscape?: boolean;
  closeOnClickOutside?: boolean;
  
  // Styling
  className?: string;
  arrowClassName?: string;
}
```

**Features**:
- Arrow pointing to trigger
- 4 placement options
- Auto-positioning
- Content scrolling
- Animation (fade, slide)
- Close on click-outside
- Keyboard support

**Test Coverage** (35+ tests):
- Render (open/closed, arrow, placement)
- Positioning (all 4 placements, offsets)
- Arrow (visibility, positioning, rotation)
- Interaction (open, close, click-outside)
- Keyboard (escape)
- Animation (smooth transitions)
- Accessibility (dialog role, aria-describedby)

#### Toast Component
```typescript
interface ToastProps {
  // Structure
  children: React.ReactNode;
  title?: string;
  
  // State
  type?: 'info' | 'success' | 'warning' | 'error';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  
  // Behavior
  duration?: number; // milliseconds, 0 = infinite
  action?: { label: string; onClick: () => void };
  
  // Styling
  className?: string;
}

// Toast Manager/Queue
interface ToastManager {
  info: (message: string, options?) => void;
  success: (message: string, options?) => void;
  warning: (message: string, options?) => void;
  error: (message: string, options?) => void;
  dismiss: (id: string) => void;
}
```

**Features**:
- 4 type variants (info, success, warning, error)
- Auto-dismiss with configurable duration
- Queue management (max 3 visible)
- Action button support
- Portal rendering
- Stackable position (top-right, top-left, etc.)
- Animation (slide-in, fade-out)
- Imperative API (useToast hook)

**Test Coverage** (40+ tests):
- Render (types, title, action)
- Auto-dismiss (timing, callbacks)
- Queue (multiple toasts, visibility)
- Interaction (action click, manual dismiss)
- Animation (entrance, exit)
- Position (top-right, stack order)
- Hook (useToast, imperative API)
- Accessibility (role, aria-live)

---

### Thursday: Testing & Integration
**Time**: Full day
**Focus**: Ensure all components work together

**Tasks**:
- [ ] Run all 250+ tests
- [ ] Check test coverage (>90% target)
- [ ] TypeScript validation
- [ ] Component composition tests
  - Select in Modal
  - Tabs with Dropdown
  - Toast notifications
- [ ] Integration with Week 1-2 components
- [ ] Accessibility audit
- [ ] Performance review

**Test Summary Expected**:
```
Test Suites: 6 passed, 6 total
Tests:       250+ passed, 250+ total
Coverage:    >90% statements, branches, functions, lines
Type Errors: 0
ESLint:      0 errors
Time:        ~20s
```

---

### Friday: Documentation & Commit
**Time**: Full day
**Focus**: Complete documentation and prepare for Week 4

**Tasks**:

1. **Update Component Index**
   - Export all 6 new components
   - Organize by category (atomic, compound)
   - Update barrel exports

2. **Create COMPONENTS.md (Compound)**
   - API reference for all 6 components
   - Usage examples
   - Integration patterns
   - Variant showcase

3. **Update Component Architecture Doc**
   - How compounds use atomics
   - Composition patterns
   - Best practices

4. **Final Code Review**
   - TypeScript compliance
   - Naming consistency
   - Code style
   - Documentation completeness

5. **Git Commit**
   ```
   feat: implement compound components (Select, Modal, Tabs, Dropdown, Popover, Toast)
   - 6 compound components with 250+ tests
   - Built on atomic component foundation
   - Full accessibility (WCAG 2.1 AA)
   - Complete TypeScript typing
   - Ready for Week 4 page integration
   ```

6. **Create Week 3 Completion Summary**
   - Achievements
   - Test results
   - Architecture overview
   - Metrics and statistics

---

## 🏗️ Technical Specifications

### Component Composition

**Select Component Stack**:
```
Select (compound)
├── useSelect hook (state management)
├── SelectTrigger (atom from Button)
├── SelectPopover (compound)
│   ├── SelectContent (card-like)
│   ├── SelectSearchInput (atom)
│   ├── SelectOptions
│   │   └── SelectOption
│   └── SelectEmpty (fallback)
└── SelectGroup (content organization)
```

**Modal Component Stack**:
```
Modal (compound)
├── useModal hook (state management)
├── ModalOverlay (portal)
├── ModalContent (Card-based)
│   ├── ModalHeader
│   ├── ModalBody
│   ├── ModalFooter
│   └── ModalCloseButton (Icon + Button)
└── FocusTrap wrapper
```

**Tabs Component Stack**:
```
Tabs (compound)
├── useTabs hook (state management)
├── TabsList (flex container)
│   └── TabsTrigger (Button variant)
└── TabsContent (animated container)
```

**Dropdown Component Stack**:
```
Dropdown (compound)
├── useDropdown hook (positioning)
├── DropdownTrigger (Button or custom)
├── DropdownMenu (positioned portal)
│   ├── DropdownItem (click handler)
│   ├── DropdownDivider (divider)
│   └── DropdownLabel (group header)
└── useClickOutside hook
```

**Popover Component Stack**:
```
Popover (compound)
├── usePopover hook (positioning + arrow)
├── PopoverTrigger (trigger)
├── PopoverContent (portal with arrow)
│   ├── PopoverArrow (SVG)
│   └── PopoverBody (Card-based)
└── useFloating hooks
```

**Toast Component Stack**:
```
Toast (compound)
├── ToastManager (singleton)
├── useToast hook (context)
├── ToastContainer (portal, bottom-right)
│   └── ToastItem (animated)
│       ├── ToastIcon (by type)
│       ├── ToastMessage
│       ├── ToastAction (Button)
│       └── ToastClose (Icon)
└── ToastProvider (context wrapper)
```

### Hooks & Utilities

**Custom Hooks to Create**:
- `useSelect` - State management
- `useModal` - Visibility & focus trap
- `useTabs` - Active tab state
- `useDropdown` - Positioning & click-outside
- `usePopover` - Positioning + arrow logic
- `useToast` - Toast queue management
- `useClickOutside` - Click detection
- `useFocusTrap` - Focus management
- `useFloating` - Popper positioning

**Positioning Library**:
- Use `@floating-ui/react` for Select, Dropdown, Popover
- Handles viewport edge detection
- Auto-flip and auto-shift logic
- Arrow positioning

---

## 📦 Dependencies to Install

**New Packages**:
```bash
npm install @floating-ui/react @floating-ui/dom
```

**Already Available**:
- React (existing)
- TypeScript (existing)
- Tailwind (existing)
- Class-variance-authority (existing)
- Design tokens (Week 1)
- Atomic components (Week 2)

---

## 🎯 Success Criteria

### Code Quality
- [ ] 0 TypeScript errors
- [ ] 0 ESLint errors
- [ ] All components fully typed
- [ ] >90% test coverage per component

### Testing
- [ ] 250+ tests passing
- [ ] All test categories covered (render, props, state, events, a11y)
- [ ] Composition tests (components working together)
- [ ] Edge cases tested

### Accessibility
- [ ] WCAG 2.1 AA compliant
- [ ] Keyboard navigation working
- [ ] Screen reader compatible
- [ ] Focus management proper

### Performance
- [ ] Tree-shakeable
- [ ] Minimal re-renders
- [ ] <500ms component load
- [ ] Proper memo usage

### Documentation
- [ ] API reference complete
- [ ] Usage examples for each component
- [ ] Composition patterns documented
- [ ] Integration examples

---

## 📊 Expected Metrics

**Code**:
- Component lines: ~600
- Test lines: ~900
- Total: ~1,500 lines

**Tests**:
- Total test cases: 250+
- Select: 40+ tests
- Modal: 40+ tests
- Tabs: 35+ tests
- Dropdown: 40+ tests
- Popover: 35+ tests
- Toast: 40+ tests

**Quality**:
- TypeScript: 100% coverage
- ESLint: 0 errors
- Test coverage: >90%
- Accessibility: WCAG 2.1 AA

---

## 🚀 Next Phase - Week 4

After Week 3 completion, Week 4 will:
- Create layout components (Dashboard, Form, List, Detail)
- Apply layouts to actual pages
- Integrate RBAC navigation
- Responsive design refinement
- Mobile optimization

---

## 📝 Reference: Atomic Components Used

**From Week 2** (building blocks for compounds):
- Button (triggers, actions, close buttons)
- Card (modal content, dropdown items)
- Input (search in select)
- Icon (indicators, icons in toasts)
- Spinner (loading states)
- Badge (indicators in tabs, toasts)

All Week 3 compounds are built **on top of** these atomics, not replacing them.

---

**Start Date**: Monday, November 24, 2025  
**Target Completion**: Friday, November 28, 2025  
**Status**: 🚀 Ready to begin

