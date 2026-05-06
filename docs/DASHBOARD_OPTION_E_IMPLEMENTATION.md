# Option E Implementation Guide: Configurable Hybrid Dashboard

**Status:** Ready for Development  
**Priority:** Phase 1 Core (Week 1-2), Phase 2 Pro Features (Week 3), Phase 3 Polish (Week 4+)

---

## 🎯 Phase 1: Core Experience (Week 1-2)

### Goal
Build Option A (pure scroll) as the foundation. This is the MVP that works great for 80% of users.

### Files to Create/Modify

#### 1. User Preferences Context
```typescript
// client/src/contexts/dashboardPreferences.tsx
import { createContext, useContext, useState, useEffect } from 'react';

interface DashboardPreferences {
  theme: 'light' | 'dark' | 'auto';
  proModeEnabled: boolean;
  sidebarEnabled: boolean;
  compactMode: boolean;
  sectionOrder: string[];
  collapsedSections: string[];
  autoExpand: string[];
}

const defaultPreferences: DashboardPreferences = {
  theme: 'auto',
  proModeEnabled: false,
  sidebarEnabled: false,
  compactMode: false,
  sectionOrder: ['opportunities', 'watchlist', 'cex', 'strategies', 'alerts'],
  collapsedSections: ['cex', 'strategies', 'alerts'],
  autoExpand: ['opportunities', 'watchlist'],
};

export const DashboardPreferencesContext = createContext<{
  preferences: DashboardPreferences;
  updatePreferences: (partial: Partial<DashboardPreferences>) => void;
  resetPreferences: () => void;
}>(null!);

export function DashboardPreferencesProvider({ children }) {
  const [preferences, setPreferences] = useState<DashboardPreferences>(() => {
    const saved = localStorage.getItem('dashboard-preferences');
    return saved ? JSON.parse(saved) : defaultPreferences;
  });

  const updatePreferences = (partial: Partial<DashboardPreferences>) => {
    setPreferences(prev => {
      const updated = { ...prev, ...partial };
      localStorage.setItem('dashboard-preferences', JSON.stringify(updated));
      return updated;
    });
  };

  const resetPreferences = () => {
    setPreferences(defaultPreferences);
    localStorage.removeItem('dashboard-preferences');
  };

  return (
    <DashboardPreferencesContext.Provider value={{ preferences, updatePreferences, resetPreferences }}>
      {children}
    </DashboardPreferencesContext.Provider>
  );
}

export const useDashboardPreferences = () => {
  const context = useContext(DashboardPreferencesContext);
  if (!context) throw new Error('useDashboardPreferences must be used within DashboardPreferencesProvider');
  return context;
};
```

#### 2. Refactored YUKI Dashboard (Phase 1)
```typescript
// client/src/components/trading/YukiDashboardV2.tsx
import React, { useState } from 'react';
import { useDashboardPreferences } from '@/contexts/dashboardPreferences';
import { OpportunityScannerDashboard } from '../OpportunityScannerDashboard';
import { BalanceHeader } from './sections/BalanceHeader';
import { QuickStats } from './sections/QuickStats';
import { Watchlist } from './sections/Watchlist';
import { CEXMarkets } from './sections/CEXMarkets';
import { StrategyManager } from './sections/StrategyManager';
import { AlertsPanel } from './sections/AlertsPanel';
import { DashboardSettings } from './sections/DashboardSettings';

interface CollapsibleSection {
  id: string;
  title: string;
  icon: string;
  component: React.ComponentType;
  defaultExpanded?: boolean;
}

const sections: CollapsibleSection[] = [
  { id: 'opportunities', title: '⚡ Live Opportunities', component: OpportunityScannerDashboard, defaultExpanded: true },
  { id: 'watchlist', title: '⭐ Watchlist', component: Watchlist, defaultExpanded: true },
  { id: 'cex', title: '🏦 CEX Markets', component: CEXMarkets, defaultExpanded: false },
  { id: 'strategies', title: '🤖 Active Strategies', component: StrategyManager, defaultExpanded: false },
  { id: 'alerts', title: '🔔 Alerts & Signals', component: AlertsPanel, defaultExpanded: false },
];

export function YukiDashboardV2() {
  const { preferences } = useDashboardPreferences();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(preferences.autoExpand)
  );
  const [showSettings, setShowSettings] = useState(false);

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  // Get sections in preferred order
  const orderedSections = [...sections].sort((a, b) => {
    const aIndex = preferences.sectionOrder.indexOf(a.id);
    const bIndex = preferences.sectionOrder.indexOf(b.id);
    return aIndex - bIndex;
  });

  return (
    <div className={`min-h-screen ${preferences.theme === 'dark' ? 'dark' : ''}`}>
      {/* Navigation Bar */}
      <div className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📈</span>
            <h1 className="text-xl font-bold">Yuki Trading Dashboard</h1>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
          >
            ⚙️ Settings
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {showSettings && (
          <DashboardSettings onClose={() => setShowSettings(false)} />
        )}

        {/* Balance Header (Sticky) */}
        <BalanceHeader />

        {/* Quick Stats */}
        <QuickStats />

        {/* Collapsible Sections */}
        <div className="space-y-4 mt-8">
          {orderedSections.map(section => (
            <CollapsibleSection
              key={section.id}
              section={section}
              isExpanded={expandedSections.has(section.id)}
              onToggle={() => toggleSection(section.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Reusable Collapsible Component
function CollapsibleSection({ section, isExpanded, onToggle }) {
  const Component = section.component;
  
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <h2 className="text-lg font-semibold">{section.title}</h2>
        <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      
      {isExpanded && (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700">
          <Component />
        </div>
      )}
    </div>
  );
}
```

#### 3. Settings Panel (Phase 1)
```typescript
// client/src/components/trading/sections/DashboardSettings.tsx
import React from 'react';
import { useDashboardPreferences } from '@/contexts/dashboardPreferences';

export function DashboardSettings({ onClose }: { onClose: () => void }) {
  const { preferences, updatePreferences, resetPreferences } = useDashboardPreferences();

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Dashboard Settings</h2>
        <button onClick={onClose} className="text-2xl">✕</button>
      </div>

      {/* Phase 1: Basic Settings */}
      <div className="space-y-4">
        <div>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={preferences.compactMode}
              onChange={(e) => updatePreferences({ compactMode: e.target.checked })}
              className="w-4 h-4"
            />
            <span>Compact Mode (less spacing, more data)</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Theme</label>
          <select
            value={preferences.theme}
            onChange={(e) => updatePreferences({ theme: e.target.value as any })}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="auto">Auto (System)</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <div>
          <button
            onClick={resetPreferences}
            className="px-4 py-2 bg-gray-200 dark:bg-slate-700 rounded-lg hover:bg-gray-300"
          >
            Reset to Defaults
          </button>
        </div>
      </div>

      {/* Phase 2 Preview */}
      <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          💡 <strong>Phase 2 Coming Soon:</strong> Pro Mode, Sidebar Navigation, Keyboard Shortcuts, Section Reordering
        </p>
      </div>
    </div>
  );
}
```

---

## 🚀 Phase 2: Pro Features (Week 3)

### Goal
Add sidebar + keyboard shortcuts + pro mode for power users.

### Features to Add
- [ ] Pro Mode toggle in settings
- [ ] Sidebar navigation (desktop only)
- [ ] Keyboard shortcuts (Ctrl+1, Ctrl+2, etc.)
- [ ] Sidebar auto-scroll on section click
- [ ] Section reordering (drag-and-drop ready)

### Implementation Outline

```typescript
// Add to DashboardSettings:
<div>
  <label className="flex items-center gap-3">
    <input
      type="checkbox"
      checked={preferences.proModeEnabled}
      onChange={(e) => updatePreferences({ proModeEnabled: e.target.checked })}
      className="w-4 h-4"
    />
    <span>Pro Mode (Sidebar + Keyboard Shortcuts)</span>
  </label>
</div>

// Add keyboard shortcut handler:
useEffect(() => {
  if (!preferences.proModeEnabled) return;
  
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      const shortcuts: Record<string, string> = {
        '1': 'opportunities',
        '2': 'watchlist',
        '3': 'cex',
        '4': 'strategies',
        '5': 'alerts',
      };
      
      if (shortcuts[e.key]) {
        e.preventDefault();
        expandSection(shortcuts[e.key]);
        scrollToSection(shortcuts[e.key]);
      }
    }
  };
  
  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, [preferences.proModeEnabled]);
```

---

## ⭐ Phase 3: Polish & Intelligence (Week 4+)

### Features to Add
- [ ] Drag-reorder sections (dnd-kit library)
- [ ] Behavior tracking (which sections users click most)
- [ ] Auto-suggestions ("You use opportunities 80% - keep it expanded?")
- [ ] Custom themes
- [ ] Sidebar history (show recently used sections)

---

## Testing Checklist

### Phase 1 Testing
- [ ] Mobile (iPhone 12, Android) - scroll works smoothly
- [ ] Tablet (iPad) - responsive layout
- [ ] Desktop (1920px, 1440px, 1200px) - sections visible
- [ ] Dark mode toggle
- [ ] LocalStorage persistence
- [ ] Opportunities always visible and real-time

### Phase 2 Testing
- [ ] Sidebar toggle (desktop)
- [ ] Keyboard shortcuts working (Ctrl+1-5)
- [ ] Auto-scroll to section on click
- [ ] Mobile: sidebar disabled unless pro mode + enabled
- [ ] Pro mode toggle persistence

### Phase 3 Testing
- [ ] Drag-reorder sections
- [ ] Behavior tracking accuracy
- [ ] Auto-suggestions appear at right time
- [ ] Custom themes apply correctly

---

## Rollout Strategy

### Week 1-2: Core Launch
- Launch Option A (pure scroll) as default
- All users get clean, mobile-first experience
- Disable pro features (just settings panel)

### Week 3: Pro Features Beta
- Offer opt-in pro mode beta
- Gather feedback from power users
- Refine sidebar + keyboard shortcuts

### Week 4+: Full Release
- Enable all personalization features
- Launch "Behavior Intelligence" (auto-suggestions)
- Advanced themes available

---

## Success Metrics

### Adoption
- Pro Mode opt-in rate: Target >30% of active traders
- Average session duration: Should increase by 15-20%
- Feature discovery rate: Track which personalization features users enable

### Engagement
- Opportunities click-through: Track execution rates
- Watchlist interaction: Monitor active trading
- Return user rate: Daily/weekly actives

### Satisfaction
- NPS score: Target increase of 10+ points
- Support tickets: Should decrease (less confusion)
- Feature requests: Qualitative feedback

---

**Next Steps:**
1. Wrap YUKI dashboard with `DashboardPreferencesProvider`
2. Create component structure for Phase 1
3. Begin implementation of BalanceHeader, QuickStats, CollapsibleSections
4. Test mobile responsiveness thoroughly
5. Launch Phase 1 by end of Week 2

---

Ready to start building? This sets MTAA apart from other platforms! 🚀
