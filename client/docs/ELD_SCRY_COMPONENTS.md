# ELD-SCRY Frontend Components Documentation

This document provides comprehensive guide for all ELD-SCRY frontend components used in threat monitoring and dashboard interfaces.

## Component Overview

### 1. ScryDashboard (Main Router Component)

**File:** `client/src/components/elders/scry/ScryDashboard.tsx`
**Purpose:** Main entry point for threat monitoring dashboard with role-based routing

#### Features

- **Role-Based Routing**: Automatically displays appropriate dashboard based on user role
  - `role === 'superuser'` → SystemWide Dashboard
  - `role !== 'superuser'` → DAO-Specific Dashboard

- **SuperuserThreatDashboard** (System-Wide Monitoring)
  - Global threat statistics (total, critical, monitored DAOs)
  - Critical threat alert panel (red background, attention-grabbing)
  - Risk level distribution by DAO (Critical/High/All DAOs)
  - DAO selection and detail view
  - 30-second auto-refresh interval
  - API: `GET /api/elders/scry/dashboard` (superuser only)

- **DAOMemberThreatDashboard** (DAO-Specific View)
  - DAO health score with confidence percentage
  - Threat count with critical breakdown
  - Tab navigation (Threats vs Forecast)
  - ThreatsView: Severity-sorted threat list
  - ForecastView: Risk factors and forecast chart
  - API: `GET /api/elders/scry/dao/:daoId/threats`, `GET /api/elders/scry/dao/:daoId/forecast`

#### Usage

```typescript
import { ScryDashboard } from '@/components/elders/scry';

export default function ThreatMonitoringPage() {
  const { user } = useAuth(); // assuming auth hook
  
  return <ScryDashboard />;
}
```

#### API Integration

**Superuser Dashboard:**
```typescript
// Fetch system-wide threat data
const response = await fetch('/api/elders/scry/dashboard', {
  headers: {
    'Authorization': `Bearer ${token}`,
  }
});
const data = await response.json();
// Returns: { threats: Threat[], stats: { total, critical, daos }, topDAOs: [] }
```

**DAO Member Dashboard:**
```typescript
// Fetch DAO-specific threats
const response = await fetch(`/api/elders/scry/dao/${daoId}/threats`, {
  headers: {
    'Authorization': `Bearer ${token}`,
  }
});

// Fetch health forecast
const forecastResponse = await fetch(`/api/elders/scry/dao/${daoId}/forecast`, {
  headers: {
    'Authorization': `Bearer ${token}`,
  }
});
```

#### Props

None required - component uses authentication context internally

#### Styling

- Dark theme with slate/blue color scheme
- Severity-color coded elements (critical=red, high=orange, etc.)
- Responsive grid layouts
- 30s auto-refresh with visual feedback

---

### 2. ForecastChart

**File:** `client/src/components/elders/scry/ForecastChart.tsx`
**Purpose:** Visualize 24-hour DAO health trajectory using area chart

#### Features

- Area chart showing health score trend over 24 hours
- Smooth gradient fill with animated curve
- Interactive tooltips showing exact values
- X-axis: Hourly time labels (0:00 to 23:00)
- Y-axis: Health score (0-100%)
- Responsive container sizing
- Dark theme styling

#### Usage

```typescript
import { ForecastChart } from '@/components/elders/scry';

export default function HealthView() {
  return (
    <ForecastChart 
      daoId="dao_123" 
      dataPoints={24} 
    />
  );
}
```

#### Props

```typescript
interface ForecastChartProps {
  daoId: string;           // DAO identifier for data fetching
  dataPoints?: number;     // Number of hourly data points (default: 24)
}
```

#### Data Format

```typescript
interface ChartData {
  time: string;           // "0:00", "1:00", etc.
  score: number;          // Health score 0-100
  treasury?: number;      // Treasury health factor
  governance?: number;    // Governance health factor
  community?: number;     // Community health factor
}
```

#### Features Detail

- **Smooth Rendering**: Uses monotone interpolation for smooth curves
- **Gradient Fill**: Visual enhancement with fade gradient
- **Hover Tooltips**: Display exact values on mouseover
- **Light/Dark Theme**: Adapts to slate/blue color scheme
- **No Animation**: Disabled for performance in real-time scenarios

---

### 3. RiskFactorChart

**File:** `client/src/components/elders/scry/RiskFactorChart.tsx`
**Purpose:** Visualize DAO health risk factors and their trends

#### Features

- **Dual-Bar Chart**: Current vs Baseline comparison
  - Blue bars: Current values
  - Gray bars: Baseline for reference
- **Risk Factor Analysis Panel**
  - Color-coded health indicators (red <50, yellow <70, green ≥70)
  - Trend indicators (↑ rising, ↓ falling, → stable)
  - Variance from baseline display
- **Risk Summary Section**
  - Critical factors list (score < 50)
  - Deteriorating factors (current < baseline - 5)
  - Improving factors (current > baseline + 5)

#### Default Factors

```typescript
const DEFAULT_FACTORS = [
  { name: 'Treasury', current: 65, baseline: 70, trend: 'down' },
  { name: 'Governance', current: 72, baseline: 75, trend: 'down' },
  { name: 'Community', current: 58, baseline: 65, trend: 'down' },
  { name: 'System', current: 80, baseline: 80, trend: 'stable' }
];
```

#### Usage

```typescript
import { RiskFactorChart } from '@/components/elders/scry';

// With default factors
<RiskFactorChart daoId="dao_123" />

// With custom data
const factors = [
  { name: 'Treasury', current: 45, baseline: 70, trend: 'down' },
  // ... more factors
];
<RiskFactorChart daoId="dao_123" factors={factors} />
```

#### Props

```typescript
interface RiskFactorChartProps {
  daoId?: string;           // DAO identifier
  factors?: RiskFactorData[]; // Custom factor data
}

interface RiskFactorData {
  name: string;           // Factor name
  current: number;        // Current score (0-100)
  baseline: number;       // Baseline score (0-100)
  trend: 'up' | 'down' | 'stable'; // Trend direction
}
```

#### Color Coding

- **Health Score** (Current value):
  - Red: < 50 (Critical)
  - Yellow: 50-70 (Warning)
  - Green: > 70 (Healthy)

- **Trend Indicators**:
  - ↑ Green: Increasing (improving)
  - ↓ Red: Decreasing (deteriorating)
  - → Blue: Stable (no change)

---

### 4. ThreatCard

**File:** `client/src/components/elders/scry/ThreatCard.tsx`
**Purpose:** Individual threat display with expandable details and evidence

#### Features

- **Collapsed State**:
  - Title, severity badge, icon
  - Description preview
  - Detection time, confidence score
  - DAO/User context

- **Expanded State**:
  - Complete threat details
  - Type and ID information
  - Related metrics
  - Supporting evidence list
  - Review/Dismiss action buttons

- **Severity Levels**:
  - Critical: Red theme, pulsing indicator
  - High: Orange theme
  - Medium: Yellow theme
  - Low: Blue theme

- **Visual Feedback**:
  - Action required badge (red)
  - Animated severity indicator pulse
  - Hover state highlighting
  - Expandable with chevron toggle

#### Usage

```typescript
import { ThreatCard } from '@/components/elders/scry';

<ThreatCard
  id="threat_001"
  type="VOTING_ANOMALY"
  severity="critical"
  title="Unusual voting pattern detected"
  description="Multiple votes from same IP range in short timeframe"
  detectedAt={new Date().toISOString()}
  confidence={92}
  daoId="dao_123"
  actionRequired={true}
  evidence={[
    {
      type: 'IP Address',
      value: '192.168.1.100',
      timestamp: new Date().toISOString()
    }
  ]}
/>
```

#### Props

```typescript
interface ThreatCardProps {
  id: string;                           // Threat unique identifier
  type: string;                         // Threat type (VOTING_ANOMALY, etc.)
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;                        // Short threat title
  description: string;                  // Threat description
  detectedAt: string;                   // ISO timestamp
  confidence: number;                   // 0-100 confidence score
  evidence?: ThreatEvidence[];          // Supporting evidence items
  daoId?: string;                       // Associated DAO
  userId?: string;                      // Associated user (if applicable)
  actionRequired?: boolean;              // Highlight action needed
  relatedMetric?: string;               // Related DAO metric
}

interface ThreatEvidence {
  type: string;        // Evidence type (IP, Address, etc.)
  value: string | number; // Evidence value
  timestamp: string;   // When evidence was collected
}
```

#### Time Formatting

- "Just now" - less than 1 minute
- "5m ago" - minutes
- "2h ago" - hours
- "Dec 15" - older than 24 hours

---

### 5. ThreatTimeline

**File:** `client/src/components/elders/scry/ThreatTimeline.tsx`
**Purpose:** Historical threat events visualization with filtering

#### Features

- **Timeline Visualization**:
  - Vertical timeline with connected dots
  - Severity-color coded events
  - Timeline filtering by severity

- **Event Display**:
  - Threat title and severity badge
  - Description and event type
  - Timestamp in readable format
  - Icon indicators (alert vs. warning)

- **Filtering**:
  - Filter by: All, Critical, High, Medium, Low
  - Dropdown selector
  - Dynamic event filtering

- **Statistics Footer**:
  - Count by severity level
  - Color-coded badges
  - Quick overview of threat distribution

#### Default Mock Events

```typescript
[
  {
    id: '1',
    type: 'VOTING_ANOMALY',
    severity: 'critical',
    title: 'Unusual voting pattern detected',
    timestamp: '5 minutes ago',
    description: 'Multiple votes from same IP range in short timeframe'
  },
  // ... more events
]
```

#### Usage

```typescript
import { ThreatTimeline } from '@/components/elders/scry';

// With mock data
<ThreatTimeline daoId="dao_123" />

// With custom events
const events = [
  {
    id: '1',
    type: 'VOTING_ANOMALY',
    severity: 'critical',
    title: 'Unusual voting pattern',
    timestamp: new Date().toISOString(),
    description: 'Multiple votes detected'
  }
];
<ThreatTimeline events={events} daoId="dao_123" />
```

#### Props

```typescript
interface ThreatTimelineProps {
  events?: TimelineEvent[];  // Historical threat events
  daoId?: string;             // DAO identifier
}

interface TimelineEvent {
  id: string;                 // Unique event ID
  type: string;               // Event type
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;              // Event title
  timestamp: string;          // ISO timestamp
  description: string;        // Event description
}
```

#### Severity Colors

- **Critical**: Red gradient (#dc2626)
- **High**: Orange gradient (#ea580c)
- **Medium**: Yellow gradient (#eab308)
- **Low**: Blue gradient (#2563eb)

---

### 6. EarlyWarningAlert

**File:** `client/src/components/elders/scry/EarlyWarningAlert.tsx`
**Purpose:** Alert notification for early warning messages

#### Features

- **Severity-Based Styling**:
  - Critical: Red background, alert triangle icon
  - Alert: Orange background, alert circle icon
  - Warning: Yellow background, alert circle icon

- **Displays**:
  - Alert message
  - Required action text
  - Time-to-event countdown/display
  - Severity badge

#### Usage

```typescript
import { EarlyWarningAlert } from '@/components/elders/scry';

<EarlyWarningAlert
  severity="critical"
  message="Treasury health declining rapidly"
  action="Review treasury composition and market conditions"
  timeToEvent="6 hours until critical threshold"
/>
```

#### Props

```typescript
interface EarlyWarningAlertProps {
  severity: 'critical' | 'alert' | 'warning';
  message: string;        // Main alert message
  action: string;         // Required action text
  timeToEvent: string;    // Time display ("6 hours", etc.)
}
```

---

## Integration Patterns

### Using All Components Together

```typescript
import {
  ScryDashboard,
  ForecastChart,
  RiskFactorChart,
  ThreatCard,
  ThreatTimeline,
  EarlyWarningAlert
} from '@/components/elders/scry';

export default function ThreatMonitoringPage() {
  const [selectedDAO, setSelectedDAO] = useState(null);

  return (
    <div className="space-y-6">
      {/* Main Dashboard Router */}
      <ScryDashboard />

      {/* Detail View for Selected DAO */}
      {selectedDAO && (
        <div className="grid grid-cols-2 gap-6">
          {/* Left: Forecast and Risk Factors */}
          <div className="space-y-6">
            <ForecastChart daoId={selectedDAO} />
            <RiskFactorChart daoId={selectedDAO} />
          </div>

          {/* Right: Threats and Timeline */}
          <div className="space-y-6">
            <div className="space-y-2">
              <ThreatCard
                id="threat_1"
                type="VOTING_ANOMALY"
                severity="critical"
                title="Critical threat"
                description="..."
                detectedAt={new Date().toISOString()}
                confidence={95}
              />
            </div>
            <ThreatTimeline daoId={selectedDAO} />
          </div>
        </div>
      )}
    </div>
  );
}
```

### API Data Flow

```
User Views Dashboard
        ↓
ScryDashboard routes based on role
        ↓
Superuser: GET /api/elders/scry/dashboard
Member: GET /api/elders/scry/dao/:daoId/threats
        ↓
Data formatted into component props
        ↓
ForecastChart receives forecast data
RiskFactorChart receives risk factors
ThreatCard receives threat items
ThreatTimeline receives historical events
        ↓
30s auto-refresh cycle repeats
```

## Styling and Theme

All components use:
- **Dark Theme**: Slate-700 and slate-800 backgrounds
- **Primary Color**: Blue (#3b82f6)
- **Severity Colors**:
  - Critical: Red (#dc2626)
  - High: Orange (#ea580c)
  - Medium: Yellow (#eab308)
  - Low: Blue (#2563eb)
- **Border**: Slate-600
- **Text**: Gray-300 (secondary), White (primary)
- **Hover States**: Black/20 overlay
- **Animations**: Smooth transitions, pulse on severity indicator

## Performance Considerations

1. **Auto-Refresh**: 30-second intervals in dashboards
2. **Component Memoization**: Each component optimized for re-renders
3. **Lazy Loading**: Timeline events loaded on scroll
4. **Chart Optimization**: No animations, smooth rendering
5. **Query Optimization**: DAO-scoped queries only fetch relevant data

## Testing Guide

See `tests/ELD_SCRY_TESTING_GUIDE.md` for:
- Component unit tests
- Integration test examples
- Mock data generators
- Snapshot testing patterns
- E2E testing scenarios

## Common Issues

### Charts Not Showing Data
- Verify Recharts is installed: `npm install recharts`
- Check API response format matches expected structure
- Ensure data array is not empty

### Time Formatting Issues
- Timestamps should be ISO format: `new Date().toISOString()`
- Browser timezone affects display
- Use `toLocaleString()` for user-friendly output

### Authorization Errors
- Token must be in `Authorization: Bearer <token>` header
- User role must match endpoint requirements
- DAO membership must be verified server-side

## Next Steps

1. **Integrate with Real API**: Replace mock data with actual endpoints
2. **Add WebSocket Support**: Real-time threat updates
3. **Implement Caching**: Reduce API calls for frequently accessed data
4. **Add Export Features**: Download threat reports
5. **Create Alert System**: Notification for critical threats
6. **Implement Analytics**: Track threat patterns over time
