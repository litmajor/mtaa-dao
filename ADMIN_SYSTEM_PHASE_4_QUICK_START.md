# Admin Phase 4 - Advanced Analytics & Risk Management - Quick Start Guide

## Overview

Phase 4 extends the Admin System with two major analytical capabilities:

1. **Risk Assessment Module** - Monitor DAO governance risks and compliance
2. **Advanced Analytics Module** - Deep insights into DAO governance metrics

## Getting Started (5 minutes)

### Access the Dashboards

Both new admin pages are mounted in the admin dashboard:

```
/admin/risk - Risk Assessment Dashboard
/admin/analytics - Advanced Analytics Dashboard
```

### Risk Assessment Dashboard

**Location**: `/admin/risk?daoId=YOUR_DAO_ID`

**Tabs**:
- **Overview** - Summary of critical issues, alerts, and compliance score
- **Risk Factors** - Breakdown of risk categories with mitigation steps
- **Alerts** - Active alerts with acknowledgment tracking
- **Compliance** - Compliance status matrix for governance rules
- **Audit Trail** - Historical record of all risk events

**Key Metrics**:
- Risk Score (0-100): Overall governance risk level
- Alert Count: Number of unacknowledged alerts
- Compliance Score: Percentage of compliant items

### Advanced Analytics Dashboard

**Location**: `/admin/analytics?daoId=YOUR_DAO_ID`

**Views**:
- **Governance Health** - Overall DAO health score broken into components
- **Member Engagement** - Voter participation and engagement metrics
- **Participation Trends** - 30-day trend analysis with visualization
- **Role Distribution** - Pyramid view of member role hierarchy
- **Voting Patterns** - Vote breakdown (yes/no/abstain) and consensus level
- **Growth Metrics** - 6-month growth trends for members, proposals, voters

**Key Features**:
- Real-time data refresh
- Responsive charts and visualizations
- Exportable reports (JSON format)
- Permission-based access control

## API Reference

### Risk Assessment Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/daos/:daoId/risk/score` | Get overall risk score |
| GET | `/api/admin/daos/:daoId/risk/factors` | Get detailed risk factors |
| GET | `/api/admin/daos/:daoId/risk/alerts` | List active alerts |
| POST | `/api/admin/daos/:daoId/risk/alerts/:alertId/acknowledge` | Acknowledge an alert |
| GET | `/api/admin/daos/:daoId/risk/compliance` | Get compliance status |
| GET | `/api/admin/daos/:daoId/risk/audit-trail` | Get risk audit trail |
| POST | `/api/admin/daos/:daoId/risk/assessment` | Create manual assessment |

### Advanced Analytics Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/daos/:daoId/analytics/governance-health` | Get health score |
| GET | `/api/admin/daos/:daoId/analytics/engagement` | Get engagement metrics |
| GET | `/api/admin/daos/:daoId/analytics/participation-trends` | Get trend data |
| GET | `/api/admin/daos/:daoId/analytics/role-distribution` | Get role breakdown |
| GET | `/api/admin/daos/:daoId/analytics/voting-patterns` | Get voting analysis |
| GET | `/api/admin/daos/:daoId/analytics/growth` | Get growth metrics |
| GET | `/api/admin/daos/:daoId/analytics/report` | Generate full report |

## Permission Model

### Risk Assessment

**Super Admin Access**: ✅ All operations on all DAOs
**DAO Admin Access**: ✅ View and manage risk for their DAO
**DAO Members**: ❌ No access

### Advanced Analytics

**Super Admin Access**: ✅ View all DAOs analytics
**DAO Admin Access**: ✅ View analytics for their DAO
**DAO Members**: ❌ No access

## Features Breakdown

### Risk Assessment System

1. **Risk Scoring** (0-100)
   - Member participation rate (25%)
   - Centralization risk (25%)
   - Scalability risk (25%)
   - Security/operations (25%)

2. **Severity Levels**
   - 🟢 Low (0-39): Healthy
   - 🟡 Medium (40-59): Monitor
   - 🟠 High (60-79): Action required
   - 🔴 Critical (80-100): Urgent action

3. **Alert System**
   - Automatic alert generation
   - Acknowledgment tracking
   - Historical audit trail
   - Severity-based filtering

4. **Compliance Matrix**
   - 5+ governance compliance items
   - Status: Compliant / At-Risk / Non-Compliant
   - Details and recommendations

### Advanced Analytics System

1. **Governance Health Score** (0-100)
   - Member engagement (25%)
   - Governance activity (25%)
   - Decision-making effectiveness (25%)
   - Participation quality (25%)

2. **Engagement Metrics**
   - Total active voters
   - Average votes per member
   - Top voter tracking
   - Weekly participation trends

3. **Trend Analysis** (30-day)
   - Participation rate trends
   - Proposal count tracking
   - High/low participation identification
   - Trend direction (increasing/decreasing)

4. **Role Distribution**
   - Hierarchical pyramid view
   - Role percentage breakdown
   - Member count by role
   - Distribution metrics

5. **Voting Pattern Analysis**
   - Support rate (%)
   - Opposition rate (%)
   - Abstention rate (%)
   - Consensus level classification

6. **Growth Metrics** (6-month)
   - Member growth percentage
   - Proposal growth percentage
   - Voter growth percentage
   - Monthly breakdown chart

## Common Use Cases

### Case 1: Monitor DAO Health
1. Open `/admin/analytics?daoId=YOUR_DAO_ID`
2. Check "Governance Health" - see overall score
3. Review individual components
4. Take action if any score drops below 60

### Case 2: Address High-Risk Alerts
1. Open `/admin/risk?daoId=YOUR_DAO_ID`
2. Switch to "Alerts" tab
3. Review unacknowledged alerts (🔴)
4. Click "Acknowledge" and note actions taken
5. Track mitigation in Audit Trail

### Case 3: Analyze Voting Participation
1. Open `/admin/analytics?daoId=YOUR_DAO_ID`
2. Click "Participation Trends"
3. View 30-day trend chart
4. Check trend direction and statistics
5. Compare with "Voting Patterns" for consensus

### Case 4: Ensure Governance Compliance
1. Open `/admin/risk?daoId=YOUR_DAO_ID`
2. Switch to "Compliance" tab
3. Check for red (non-compliant) items
4. Click through recommendations
5. Document compliance audit trail

## Technical Stack

- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Frontend**: React with CSS Modules
- **Authorization**: Role-based access control (RBAC)
- **Logging**: Comprehensive audit trail system

## Next Steps

- Create custom risk assessment rules per DAO
- Set up alert thresholds and notifications
- Configure automated compliance checks
- Integrate with external analytics services
- Build admin dashboards for parent organization

## Support

For issues or questions:
1. Check audit trail for specific events
2. Review API response details
3. Verify user permissions and DAO membership
4. Check browser console for client-side errors
