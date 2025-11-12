#!/usr/bin/env markdown

# ELD-SCRY Frontend Integration Guide

Quick integration guide for using ELD-SCRY components in your application.

## Installation

All components use existing dependencies. No new packages needed!

```bash
# Verify required packages are installed
npm list react recharts lucide-react tailwindcss
```

## Quick Start

### 1. Basic Usage

```typescript
import { ScryDashboard } from '@/components/elders/scry';

export default function ThreatMonitoringPage() {
  return <ScryDashboard />;
}
```

The `ScryDashboard` component automatically:
- Checks user role from authentication context
- Routes to appropriate dashboard (superuser vs member)
- Fetches data from backend API
- Refreshes every 30 seconds

### 2. Using Individual Components

```typescript
import {
  ForecastChart,
  RiskFactorChart,
  ThreatCard,
  ThreatTimeline
} from '@/components/elders/scry';

export default function DetailView({ daoId }) {
  return (
    <div className="space-y-6">
      <ForecastChart daoId={daoId} dataPoints={24} />
      <RiskFactorChart daoId={daoId} />
      <ThreatTimeline daoId={daoId} />
    </div>
  );
}
```

### 3. Custom Threat Display

```typescript
import { ThreatCard } from '@/components/elders/scry';

const threat = {
  id: 'threat_001',
  type: 'VOTING_ANOMALY',
  severity: 'critical' as const,
  title: 'Unusual voting detected',
  description: 'Multiple votes from same IP',
  detectedAt: new Date().toISOString(),
  confidence: 92,
  daoId: 'dao_123',
  actionRequired: true,
  evidence: [
    {
      type: 'IP Address',
      value: '192.168.1.100',
      timestamp: new Date().toISOString()
    }
  ]
};

export default function ThreatDetail() {
  return <ThreatCard {...threat} />;
}
```

## API Authentication

All components handle API calls with proper authentication:

```typescript
// Token is read from localStorage or auth context
const token = localStorage.getItem('authToken');

const response = await fetch('/api/elders/scry/dashboard', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

## Component Props Reference

### ScryDashboard
- No props required
- Uses auth context internally
- Auto-routes based on user.role

### ForecastChart
- `daoId: string` - DAO identifier
- `dataPoints?: number` - Hourly data points (default: 24)

### RiskFactorChart
- `daoId?: string` - DAO identifier
- `factors?: RiskFactorData[]` - Custom factor data (optional)

### ThreatCard
```typescript
{
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  detectedAt: string;          // ISO timestamp
  confidence: number;          // 0-100
  evidence?: ThreatEvidence[];
  daoId?: string;
  userId?: string;
  actionRequired?: boolean;
  relatedMetric?: string;
}
```

### ThreatTimeline
- `events?: TimelineEvent[]` - Historical events array
- `daoId?: string` - DAO identifier

### EarlyWarningAlert
- `severity: 'critical' | 'alert' | 'warning'`
- `message: string`
- `action: string`
- `timeToEvent: string`

## Data Structure Examples

### Threat Object
```typescript
{
  id: "threat_123",
  type: "VOTING_ANOMALY",
  severity: "critical",
  title: "Unusual voting pattern detected",
  description: "Multiple votes from same IP range in short timeframe",
  detectedAt: "2024-01-15T10:30:00Z",
  confidence: 92,
  daoId: "dao_456",
  userId: "user_789",
  evidence: [
    {
      type: "IP Address",
      value: "192.168.1.100",
      timestamp: "2024-01-15T10:30:00Z"
    },
    {
      type: "Voting Count",
      value: 15,
      timestamp: "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Forecast Data
```typescript
{
  time: "12:00",
  score: 75,
  treasury: 70,
  governance: 75,
  community: 80
}
```

### Risk Factor Data
```typescript
{
  name: "Treasury",
  current: 65,
  baseline: 70,
  trend: "down"
}
```

## Styling Customization

All components use Tailwind CSS classes. To customize:

### Colors
- **Critical**: `text-red-400`, `bg-red-900/30`
- **High**: `text-orange-400`, `bg-orange-900/30`
- **Medium**: `text-yellow-400`, `bg-yellow-900/30`
- **Low**: `text-blue-400`, `bg-blue-900/30`

### Dark Theme
- Background: `bg-slate-700/50`
- Border: `border-slate-600`
- Text: `text-gray-300`, `text-white`

### Custom Theme Override
```typescript
// In your global CSS or Tailwind config
// Override component classes as needed
```

## Error Handling

### API Errors
```typescript
try {
  const response = await fetch('/api/elders/scry/dashboard', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
} catch (error) {
  console.error('Failed to fetch threat data:', error);
  // Show error state to user
}
```

### Component Error Boundary
```typescript
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback() {
  return <div>Error loading threat dashboard</div>;
}

export default function Page() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <ScryDashboard />
    </ErrorBoundary>
  );
}
```

## Performance Tips

1. **Memoize Components**: Use `React.memo()` for performance
   ```typescript
   const MemoizedChart = React.memo(ForecastChart);
   ```

2. **Lazy Load**: Use code splitting for dashboards
   ```typescript
   const ScryDashboard = lazy(() => import('@/components/elders/scry'));
   ```

3. **API Caching**: Cache threat data locally
   ```typescript
   const cachedData = useMemo(() => threats, [threats]);
   ```

4. **Debounce Filters**: Debounce filter changes
   ```typescript
   const [filter] = useState(() => debounce(setFilter, 300));
   ```

## Testing Example

```typescript
import { render, screen } from '@testing-library/react';
import { ThreatCard } from '@/components/elders/scry';

describe('ThreatCard', () => {
  it('displays threat severity', () => {
    render(
      <ThreatCard
        id="1"
        type="TEST"
        severity="critical"
        title="Test threat"
        description="Test"
        detectedAt={new Date().toISOString()}
        confidence={95}
      />
    );
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
  });
});
```

## Troubleshooting

### Components Not Rendering
- **Issue**: White screen or no output
- **Solution**: Check auth context is provided, verify API responds correctly

### Charts Not Showing
- **Issue**: Empty chart area
- **Solution**: Verify Recharts installed, check data format matches expected structure

### API 401 Errors
- **Issue**: Unauthorized errors from backend
- **Solution**: Verify token stored correctly, token not expired, correct Authorization header format

### Styling Issues
- **Issue**: Colors look wrong or layout broken
- **Solution**: Verify Tailwind CSS configured correctly, all classes included in content paths

### Performance Issues
- **Issue**: Components slow to render
- **Solution**: Use React DevTools Profiler, check API response time, reduce data size

## API Endpoints Reference

| Endpoint | Method | Role | Purpose |
|----------|--------|------|---------|
| `/api/elders/scry/health` | GET | Public | Health check |
| `/api/elders/scry/dashboard` | GET | Superuser | Global threats |
| `/api/elders/scry/threat-signatures` | GET | Superuser | Learned patterns |
| `/api/elders/scry/dao/:daoId/threats` | GET | Member | DAO threats |
| `/api/elders/scry/dao/:daoId/forecast` | GET | Member | 24h forecast |
| `/api/elders/scry/dao/:daoId/suspicion/:userId` | GET | Member | User risk score |

## Security Considerations

- Always include `Authorization` header with Bearer token
- Validate user role before rendering sensitive components
- Implement role-based access control (RBAC) checks
- Sanitize threat descriptions before rendering
- Use HTTPS for all API calls
- Implement token refresh logic
- Log security events
- Rate limit API calls

## Next Steps

1. **Integrate with your auth system**: Update token retrieval
2. **Connect to backend API**: Replace mock endpoints
3. **Customize styling**: Match your brand colors
4. **Add real-time updates**: Implement WebSocket
5. **Deploy to production**: Build and deploy

## Support Resources

- **Component Documentation**: See `client/docs/ELD_SCRY_COMPONENTS.md`
- **Backend API**: See `server/routes/elders.ts`
- **Testing Guide**: See `tests/ELD_SCRY_TESTING_GUIDE.md`
- **Backend Implementation**: See `server/core/elders/scry/`

## Additional Examples

### Full Page Example
```typescript
import { useState, useEffect } from 'react';
import {
  ScryDashboard,
  ForecastChart,
  RiskFactorChart,
  ThreatTimeline,
  EarlyWarningAlert
} from '@/components/elders/scry';
import { useAuth } from '@/hooks/useAuth';

export default function ThreatMonitoringPage() {
  const { user } = useAuth();
  const [selectedDAO, setSelectedDAO] = useState<string | null>(null);

  if (!user) return <div>Please log in</div>;

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <h1 className="text-3xl font-bold text-white mb-8">
          ELD-SCRY Threat Monitor
        </h1>

        {/* Main Dashboard */}
        <ScryDashboard />

        {/* Detail View */}
        {selectedDAO && (
          <div className="mt-8 grid grid-cols-2 gap-6">
            <div className="space-y-6">
              <ForecastChart daoId={selectedDAO} />
              <RiskFactorChart daoId={selectedDAO} />
            </div>
            <div className="space-y-6">
              <ThreatTimeline daoId={selectedDAO} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

## Version Info

- Created: 2024
- React Version: 18+
- TypeScript: 5.0+
- Tailwind CSS: 3.0+
- Recharts: 2.0+
