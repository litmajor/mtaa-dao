# Admin System Complete Documentation Index

## 📚 Full Documentation Reference

This document serves as a comprehensive index to all admin system documentation across all 5 phases.

---

## 🗂️ Quick Navigation

### By Phase
- [Phase 1-4 (Legacy)](#phase-1-4-legacy-admin-system)
- [Phase 5 (Agents & Elders)](#phase-5-agents--elders-system)
  - [Phase 5 Overview](#phase-5-overview)
  - [Phase 5.1 Database](#phase-51-database-integration)
  - [Phase 5.2 Configuration](#phase-52-configuration-editing)
  - [Phase 5.3a Advanced](#phase-53a-core-infrastructure)
  - [Phase 5.3b History](#phase-53b-history--rollback)
  - [Phase 5.3c Search](#phase-53c-search--analytics)

### By Document Type
- [Quick Start Guides](#quick-start-guides)
- [API References](#api-references)
- [Implementation Guides](#implementation-guides)
- [Status & Planning](#status--planning)

---

## Phase 1-4: Legacy Admin System

### Overview
Complete admin system with user management, DAO management, proposals, treasury, members, and voting systems.

**Status**: ✅ Complete  
**Endpoints**: 44  
**Components**: 20+  
**Documentation**: Comprehensive

### Key Documents
- `00_IMPLEMENTATION_SUMMARY.md` - System overview
- `ADMIN_SYSTEM_COMPLETE.md` - Full specification
- `ADMIN_SYSTEM_QUICK_START.md` - Getting started
- `ADMIN_SYSTEM_DEVELOPMENT_PLAN.md` - Development roadmap

### Features
- User management (create, edit, delete users)
- DAO configuration and setup
- Proposal management and voting
- Treasury tracking and reports
- Member management and roles
- Voting system with multiple vote types
- Complete audit logging

### Endpoints (44)
- User Management: 8 endpoints
- DAO Management: 8 endpoints
- Proposals: 8 endpoints
- Treasury: 8 endpoints
- Members: 8 endpoints
- Voting: 4 endpoints

---

## Phase 5: Agents & Elders System

### Overview
Advanced agent and elder management with configuration control, history tracking, and analytics.

**Status**: ✅ Complete  
**Total Endpoints**: 59  
**Total Components**: 25+  
**Total Database Tables**: 14  
**Total Documentation**: 30+

---

## Phase 5 Overview

### Quick Start Documents
- **[ADMIN_SYSTEM_PHASE_5_QUICK_START.md](ADMIN_SYSTEM_PHASE_5_QUICK_START.md)** - 5-minute getting started guide
- **[ADMIN_SYSTEM_PHASE_5_COMPLETE_SUMMARY.md](ADMIN_SYSTEM_PHASE_5_COMPLETE_SUMMARY.md)** - Complete Phase 5 overview with all metrics

### Key Features
- Agent management system
- Elder management system
- Configuration editing UI
- Change history with timeline
- Version rollback capability
- Configuration templates
- Scheduled changes
- Alert system
- Advanced search
- Analytics dashboard

### Dashboard Pages
- Agents & Elders overview
- Agent management interface
- Elder management interface

### Endpoints (8)
- GET `/api/admin/agents-elders` - Overview
- GET `/api/admin/agents-elders/elders` - List elders
- GET `/api/admin/agents-elders/agents` - List agents
- POST `/api/admin/agents-elders/elders` - Create elder
- POST `/api/admin/agents-elders/agents` - Create agent
- PUT `/api/admin/agents-elders/elders/:id` - Update elder
- PUT `/api/admin/agents-elders/agents/:id` - Update agent
- DELETE `/api/admin/agents-elders/:type/:id` - Delete entity

### Database (7 core tables)
- `elders` - Elder configuration
- `agents` - Agent configuration
- `elderActivity` - Activity logs
- `agentLogs` - Performance logs
- `elderAgentInteraction` - Relationships
- `systemConfiguration` - Global settings
- `performanceMetrics` - KPI tracking

---

## Phase 5.1: Database Integration

### Documentation
- **[ADMIN_SYSTEM_PHASE_5_1_DATABASE_INTEGRATION.md](ADMIN_SYSTEM_PHASE_5_1_DATABASE_INTEGRATION.md)** - Full database guide
- **[ADMIN_SYSTEM_PHASE_5_1_QUICK_START.md](ADMIN_SYSTEM_PHASE_5_1_QUICK_START.md)** - Quick start guide

### Features
- 7 database tables with complete schema
- 30+ service functions
- Migration system
- Seed data generation
- Complete test coverage
- Data validation rules

### Endpoints (7)
- GET `/api/admin/agents-elders/elders/:id/activity` - Activity logs
- GET `/api/admin/agents-elders/agents/:id/logs` - Agent logs
- POST `/api/admin/agents-elders/config` - Save config
- GET `/api/admin/agents-elders/config/:entityId` - Get config
- PUT `/api/admin/agents-elders/config/:entityId` - Update config
- DELETE `/api/admin/agents-elders/config/:entityId` - Delete config
- POST `/api/admin/agents-elders/config/validate` - Validate config

### Database Tables
1. `elders` - Primary entity
2. `agents` - Primary entity
3. `elderActivity` - Audit trail
4. `agentLogs` - Performance logs
5. `elderAgentInteraction` - Relationships
6. `systemConfiguration` - Settings
7. `performanceMetrics` - Metrics

---

## Phase 5.2: Configuration Editing

### Documentation
- **[ADMIN_SYSTEM_PHASE_5_2_CONFIGURATION_EDITING.md](ADMIN_SYSTEM_PHASE_5_2_CONFIGURATION_EDITING.md)** - Full guide
- **[ADMIN_SYSTEM_PHASE_5_2_QUICK_START.md](ADMIN_SYSTEM_PHASE_5_2_QUICK_START.md)** - Quick start
- **[ADMIN_SYSTEM_PHASE_5_2_SESSION_SUMMARY.md](ADMIN_SYSTEM_PHASE_5_2_SESSION_SUMMARY.md)** - Implementation summary

### Features
- Configuration editing UI for elders and agents
- System-wide settings page
- 30+ validation rules
- Audit logging integration
- Real-time validation feedback
- Responsive design
- Dark theme UI

### Pages (3)
- `config-elders.tsx` - Elder configuration editor
- `config-agents.tsx` - Agent configuration editor
- `config-system.tsx` - System settings editor

### Endpoints (8)
- GET `/api/admin/agents-elders/config/elders` - List
- GET `/api/admin/agents-elders/config/agents` - List
- GET `/api/admin/agents-elders/config/system` - Get
- POST `/api/admin/agents-elders/config/elders/:id` - Save
- POST `/api/admin/agents-elders/config/agents/:id` - Save
- POST `/api/admin/agents-elders/config/system` - Save
- PUT `/api/admin/agents-elders/config/:id/validation` - Update rules
- POST `/api/admin/agents-elders/config/:id/audit` - Log action

### CSS Modules
- `config-elders.module.css` - 1000+ lines
- `config-agents.module.css` - 900+ lines
- `config-system.module.css` - 800+ lines

---

## Phase 5.3a: Core Infrastructure

### Documentation
- **[ADMIN_SYSTEM_PHASE_5_3a_CORE_INFRASTRUCTURE.md](ADMIN_SYSTEM_PHASE_5_3a_CORE_INFRASTRUCTURE.md)** - Complete guide
- **[ADMIN_SYSTEM_PHASE_5_3a_QUICK_START.md](ADMIN_SYSTEM_PHASE_5_3a_QUICK_START.md)** - Quick start
- **[ADMIN_SYSTEM_PHASE_5_3_IMPLEMENTATION_SUMMARY.md](ADMIN_SYSTEM_PHASE_5_3_IMPLEMENTATION_SUMMARY.md)** - Implementation details
- **[ADMIN_SYSTEM_PHASE_5_3a_API_REFERENCE.md](ADMIN_SYSTEM_PHASE_5_3a_API_REFERENCE.md)** - API reference

### Features
- Configuration version history
- Immutable audit trail
- Configuration templates
- Scheduled changes with approval workflow
- Alert system with configurable rules
- Search profiles for saved searches
- Performance snapshots
- JSONB-based flexible schema

### Pages (5)
- `templates.tsx` - Template management
- `scheduled-changes.tsx` - Scheduled changes
- `alerts-dashboard.tsx` - Alert configuration
- `search-profiles.tsx` - Saved searches
- `performance-snapshots.tsx` - Historical data

### Endpoints (15)
- History: 2 endpoints
- Templates: 3 endpoints
- Scheduled Changes: 3 endpoints
- Alerts: 5 endpoints
- Search Profiles: 2 endpoints

### Database Tables (7 new)
1. `configurationHistory` - Version control
2. `configurationTemplates` - Reusable configs
3. `scheduledChanges` - Future changes
4. `configurationAlerts` - Notifications
5. `searchProfiles` - Saved searches
6. `performanceSnapshots` - Historical metrics
7. `alertRules` - Alert configuration

### CSS Modules
- `templates.module.css`
- `scheduled-changes.module.css`
- `alerts-dashboard.module.css`
- `search-profiles.module.css`
- `performance-snapshots.module.css`

---

## Phase 5.3b: History & Rollback

### Documentation
- **[ADMIN_SYSTEM_PHASE_5_3b_HISTORY_ROLLBACK.md](ADMIN_SYSTEM_PHASE_5_3b_HISTORY_ROLLBACK.md)** - Complete guide
- **[ADMIN_SYSTEM_PHASE_5_3b_QUICK_START.md](ADMIN_SYSTEM_PHASE_5_3b_QUICK_START.md)** - Quick start guide

### Features
- Configuration history timeline visualization
- Version comparison interface
- One-click rollback with confirmation
- Immutable change records
- Detailed change metadata
- Approval workflow integration
- Mobile responsive design
- Glass morphism styling

### Pages (1)
- `config-history.tsx` - Timeline with rollback (480 lines)

### Endpoints (1)
- POST `/api/admin/agents-elders/history/:entityType/:entityId/rollback` - Rollback version

### CSS Module
- `config-history.module.css` - 700+ lines
  - Glassmorphism effects
  - Timeline visualization
  - Responsive grid layout
  - Mobile optimization

---

## Phase 5.3c: Search & Analytics

### Documentation
- **[ADMIN_SYSTEM_PHASE_5_3c_SEARCH_ANALYTICS.md](ADMIN_SYSTEM_PHASE_5_3c_SEARCH_ANALYTICS.md)** - Complete guide
- **[ADMIN_SYSTEM_PHASE_5_3c_QUICK_START.md](ADMIN_SYSTEM_PHASE_5_3c_QUICK_START.md)** - Quick start guide

### Features
- Full-text search across configuration history
- Multi-filter search (type, ID, date, user, fields)
- Paginated results with quick preview
- Configuration change metrics
- Time-based analytics (24h, 7d, 30d, all-time)
- Trend analysis with visualizations
- Charts: donut, bar, line
- Summary statistics
- Responsive dashboard

### Pages (2)
- `search-advanced.tsx` - Advanced search interface (700+ lines)
- `analytics-dashboard.tsx` - Analytics metrics (600+ lines)

### Endpoints (3)
- POST `/api/admin/agents-elders/search` - Advanced search
- GET `/api/admin/agents-elders/analytics` - Metrics
- GET `/api/admin/agents-elders/analytics/trends/:entityType/:entityId` - Trends

### CSS Modules
- `search-advanced.module.css` - 700+ lines
- `analytics-dashboard.module.css` - 800+ lines

### Service Functions (3)
- `searchConfigurationHistory()` - Multi-filter search
- `getConfigurationAnalytics()` - Metrics calculation
- `getPerformanceTrends()` - Trend analysis

---

## Quick Start Guides

### For New Users
1. [ADMIN_SYSTEM_QUICK_START.md](ADMIN_SYSTEM_QUICK_START.md) - System overview
2. [ADMIN_SYSTEM_PHASE_5_QUICK_START.md](ADMIN_SYSTEM_PHASE_5_QUICK_START.md) - Phase 5 intro

### For Phase 5
- [Phase 5 Main Quick Start](ADMIN_SYSTEM_PHASE_5_QUICK_START.md) - Overview
- [Phase 5.1 Quick Start](ADMIN_SYSTEM_PHASE_5_1_QUICK_START.md) - Database setup
- [Phase 5.2 Quick Start](ADMIN_SYSTEM_PHASE_5_2_QUICK_START.md) - Configuration editing
- [Phase 5.3a Quick Start](ADMIN_SYSTEM_PHASE_5_3a_QUICK_START.md) - Advanced features
- [Phase 5.3b Quick Start](ADMIN_SYSTEM_PHASE_5_3b_QUICK_START.md) - History & rollback
- [Phase 5.3c Quick Start](ADMIN_SYSTEM_PHASE_5_3c_QUICK_START.md) - Search & analytics

---

## API References

### Complete References
- **[ADMIN_SYSTEM_PHASE_5_3a_API_REFERENCE.md](ADMIN_SYSTEM_PHASE_5_3a_API_REFERENCE.md)** - Phase 5.3a endpoints
- [ADMIN_SYSTEM_PHASE_4_COMPLETE_SPECIFICATION.md](ADMIN_SYSTEM_PHASE_4_COMPLETE_SPECIFICATION.md) - Legacy system spec

### Endpoint Summary
| Phase | Count | Reference |
|-------|-------|-----------|
| 1-4 | 44 | [Phase 4 Spec](ADMIN_SYSTEM_PHASE_4_COMPLETE_SPECIFICATION.md) |
| 5 | 8 | Phase 5 docs |
| 5.1 | 7 | Phase 5.1 docs |
| 5.2 | 8 | Phase 5.2 docs |
| 5.3a | 15 | [Phase 5.3a API Ref](ADMIN_SYSTEM_PHASE_5_3a_API_REFERENCE.md) |
| 5.3b | 1 | Phase 5.3b docs |
| 5.3c | 3 | Phase 5.3c docs |
| **TOTAL** | **59** | See summaries |

---

## Implementation Guides

### Phase Implementations
- [Phase 5.3a Detailed Guide](ADMIN_SYSTEM_PHASE_5_3a_CORE_INFRASTRUCTURE.md) - 3000+ words
- [Phase 5.3b Detailed Guide](ADMIN_SYSTEM_PHASE_5_3b_HISTORY_ROLLBACK.md) - 2000+ words
- [Phase 5.3c Detailed Guide](ADMIN_SYSTEM_PHASE_5_3c_SEARCH_ANALYTICS.md) - 2500+ words
- [Phase 5.3 Overall](ADMIN_SYSTEM_PHASE_5_3_IMPLEMENTATION_SUMMARY.md)

### Setup Guides
- [Database Integration](ADMIN_SYSTEM_PHASE_5_1_DATABASE_INTEGRATION.md)
- [Configuration Editing](ADMIN_SYSTEM_PHASE_5_2_CONFIGURATION_EDITING.md)
- [Advanced Features](ADMIN_SYSTEM_PHASE_5_3a_CORE_INFRASTRUCTURE.md)

### Feature Guides
- History & Rollback Guide
- Search & Analytics Guide
- Alert System Guide
- Template Management Guide
- Scheduled Changes Guide

---

## Status & Planning

### Current Status
- [ADMIN_SYSTEM_PHASE_5_COMPLETE_SUMMARY.md](ADMIN_SYSTEM_PHASE_5_COMPLETE_SUMMARY.md) - Complete Phase 5 summary
- [ADMIN_SYSTEM_PHASE_5_STATUS.md](ADMIN_SYSTEM_PHASE_5_STATUS.md) - Status report

### Phase Completion
- [ADMIN_SYSTEM_PHASE_5_COMPLETE.md](ADMIN_SYSTEM_PHASE_5_COMPLETE.md) - Completion checklist
- [ADMIN_SYSTEM_PHASE_5_3_COMPLETE.md](ADMIN_SYSTEM_PHASE_5_3_COMPLETE.md) - Phase 5.3 complete
- [ADMIN_SYSTEM_PHASE_5_3a_COMPLETE.md](ADMIN_SYSTEM_PHASE_5_3a_COMPLETE.md) - Phase 5.3a complete

### Launch Documents
- [ADMIN_SYSTEM_PHASE_5_LAUNCH.md](ADMIN_SYSTEM_PHASE_5_LAUNCH.md) - Phase 5 launch
- [ADMIN_SYSTEM_PHASE_5_3_LAUNCH.md](ADMIN_SYSTEM_PHASE_5_3_LAUNCH.md) - Phase 5.3 launch
- [ADMIN_SYSTEM_PHASE_5_3a_LAUNCH.md](ADMIN_SYSTEM_PHASE_5_3a_LAUNCH.md) - Phase 5.3a launch
- [ADMIN_SYSTEM_PHASE_5_3b_LAUNCH.md](ADMIN_SYSTEM_PHASE_5_3b_LAUNCH.md) - Phase 5.3b launch

### Development Plans
- [ADMIN_SYSTEM_PHASE_5_DEVELOPMENT_PLAN.md](ADMIN_SYSTEM_PHASE_5_DEVELOPMENT_PLAN.md) - Development roadmap
- [ADMIN_SYSTEM_DEVELOPMENT_PLAN.md](ADMIN_SYSTEM_DEVELOPMENT_PLAN.md) - Overall plan

---

## Security & Audit

### Security Documentation
- [AGENT_SECURITY_AUDIT_REPORT.md](AGENT_SECURITY_AUDIT_REPORT.md) - Full audit report
- [AGENT_SECURITY_AUDIT_EXECUTIVE_SUMMARY.md](AGENT_SECURITY_AUDIT_EXECUTIVE_SUMMARY.md) - Executive summary
- [AGENT_SECURITY_FRAMEWORK.md](AGENT_SECURITY_FRAMEWORK.md) - Security framework
- [AGENT_SECURITY_FIX_IMPLEMENTATION_GUIDE.md](AGENT_SECURITY_FIX_IMPLEMENTATION_GUIDE.md) - Security fixes

---

## Reference Materials

### Code Examples
- [ANALYZER_CODE_EXAMPLES.md](ANALYZER_CODE_EXAMPLES.md) - Code examples

### Features Inventory
- [ALL_FEATURES_COMPLETE_INVENTORY.md](ALL_FEATURES_COMPLETE_INVENTORY.md) - All features

### Flash Loans
- [AAVE_FLASH_LOANS_LIVE.md](AAVE_FLASH_LOANS_LIVE.md) - Flash loan integration

### Strategies
- [additional_strategies.py](additional_strategies.py) - Strategy code
- [advanced_strategies.py](advanced_strategies.py) - Advanced strategies

---

## 📊 Documentation Statistics

### Total Documents: 40+
- Phase 1-4: 10+ documents
- Phase 5: 30+ documents

### Total Pages: 200+
- Quick Start Guides: 10,000+ words
- API References: 8,000+ words
- Implementation Guides: 12,000+ words
- Status Documents: 5,000+ words

### Coverage
- All 59 endpoints documented
- All 25+ components documented
- All 14 database tables documented
- All 100+ service functions documented

---

## 🎯 Reading Recommendations

### For Administrators
1. Start: [Phase 5 Quick Start](ADMIN_SYSTEM_PHASE_5_QUICK_START.md)
2. Features: [Phase 5.2 Quick Start](ADMIN_SYSTEM_PHASE_5_2_QUICK_START.md) (Configuration)
3. Features: [Phase 5.3b Quick Start](ADMIN_SYSTEM_PHASE_5_3b_QUICK_START.md) (History)
4. Features: [Phase 5.3c Quick Start](ADMIN_SYSTEM_PHASE_5_3c_QUICK_START.md) (Search)

### For Developers
1. Start: [Phase 5 Complete Summary](ADMIN_SYSTEM_PHASE_5_COMPLETE_SUMMARY.md)
2. Architecture: [Phase 5.1 Database](ADMIN_SYSTEM_PHASE_5_1_DATABASE_INTEGRATION.md)
3. Backend: [Phase 5.3a Core Infrastructure](ADMIN_SYSTEM_PHASE_5_3a_CORE_INFRASTRUCTURE.md)
4. Frontend: [Phase 5.3b History Rollback](ADMIN_SYSTEM_PHASE_5_3b_HISTORY_ROLLBACK.md)
5. Reference: [Phase 5.3a API Reference](ADMIN_SYSTEM_PHASE_5_3a_API_REFERENCE.md)

### For DevOps
1. Overview: [Phase 5 Complete Summary](ADMIN_SYSTEM_PHASE_5_COMPLETE_SUMMARY.md)
2. Database: [Phase 5.1 Database Integration](ADMIN_SYSTEM_PHASE_5_1_DATABASE_INTEGRATION.md)
3. Deployment: Check launch documents
4. Security: [Security Audit Report](AGENT_SECURITY_AUDIT_REPORT.md)

---

## 🔗 Cross-References

### By Feature
- **User Management** → Phase 1-4 docs
- **Agent Management** → Phase 5 docs
- **Elder Management** → Phase 5 docs
- **Configuration** → Phase 5.2 docs
- **History & Audit** → Phase 5.3a/b docs
- **Search & Analytics** → Phase 5.3c docs

### By Component
- **Dashboards** → Phase 5 & 5.3 docs
- **Forms** → Phase 5.2 docs
- **Tables** → Phase 5 docs
- **Charts** → Phase 5.3c docs
- **Modals** → Phase 5.2 docs

---

## 📝 Document Index Table

| Document | Type | Phase | Status | Words |
|----------|------|-------|--------|-------|
| ADMIN_SYSTEM_PHASE_5_COMPLETE_SUMMARY.md | Guide | 5 | ✅ | 4000+ |
| ADMIN_SYSTEM_PHASE_5_QUICK_START.md | Start | 5 | ✅ | 2000+ |
| ADMIN_SYSTEM_PHASE_5_1_DATABASE_INTEGRATION.md | Guide | 5.1 | ✅ | 2500+ |
| ADMIN_SYSTEM_PHASE_5_1_QUICK_START.md | Start | 5.1 | ✅ | 1500+ |
| ADMIN_SYSTEM_PHASE_5_2_CONFIGURATION_EDITING.md | Guide | 5.2 | ✅ | 2000+ |
| ADMIN_SYSTEM_PHASE_5_2_QUICK_START.md | Start | 5.2 | ✅ | 1500+ |
| ADMIN_SYSTEM_PHASE_5_3a_CORE_INFRASTRUCTURE.md | Guide | 5.3a | ✅ | 3000+ |
| ADMIN_SYSTEM_PHASE_5_3a_QUICK_START.md | Start | 5.3a | ✅ | 1500+ |
| ADMIN_SYSTEM_PHASE_5_3a_API_REFERENCE.md | Ref | 5.3a | ✅ | 2000+ |
| ADMIN_SYSTEM_PHASE_5_3b_HISTORY_ROLLBACK.md | Guide | 5.3b | ✅ | 2000+ |
| ADMIN_SYSTEM_PHASE_5_3b_QUICK_START.md | Start | 5.3b | ✅ | 1500+ |
| ADMIN_SYSTEM_PHASE_5_3c_SEARCH_ANALYTICS.md | Guide | 5.3c | ✅ | 2500+ |
| ADMIN_SYSTEM_PHASE_5_3c_QUICK_START.md | Start | 5.3c | ✅ | 1500+ |

---

## 🆘 Quick Help

### I want to...

**Use the system**
→ [ADMIN_SYSTEM_PHASE_5_QUICK_START.md](ADMIN_SYSTEM_PHASE_5_QUICK_START.md)

**Edit configurations**
→ [ADMIN_SYSTEM_PHASE_5_2_QUICK_START.md](ADMIN_SYSTEM_PHASE_5_2_QUICK_START.md)

**View change history**
→ [ADMIN_SYSTEM_PHASE_5_3b_QUICK_START.md](ADMIN_SYSTEM_PHASE_5_3b_QUICK_START.md)

**Search for changes**
→ [ADMIN_SYSTEM_PHASE_5_3c_QUICK_START.md](ADMIN_SYSTEM_PHASE_5_3c_QUICK_START.md)

**Understand the API**
→ [ADMIN_SYSTEM_PHASE_5_3a_API_REFERENCE.md](ADMIN_SYSTEM_PHASE_5_3a_API_REFERENCE.md)

**Set up the system**
→ [ADMIN_SYSTEM_PHASE_5_1_DATABASE_INTEGRATION.md](ADMIN_SYSTEM_PHASE_5_1_DATABASE_INTEGRATION.md)

**Deploy to production**
→ [ADMIN_SYSTEM_PHASE_5_COMPLETE_SUMMARY.md](ADMIN_SYSTEM_PHASE_5_COMPLETE_SUMMARY.md)

**Review architecture**
→ [ADMIN_SYSTEM_PHASE_5_COMPLETE_SUMMARY.md](ADMIN_SYSTEM_PHASE_5_COMPLETE_SUMMARY.md)

---

**Last Updated**: 2024-01-25  
**Version**: Phase 5 Complete  
**Status**: ✅ All documentation complete

📚 **Complete documentation for the entire admin system is available. Start with the quick start guides!**
