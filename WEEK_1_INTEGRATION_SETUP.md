/**
 * WEEK_1_INTEGRATION_SETUP.md
 * 
 * Week 1 Infrastructure Integration Guide
 * 
 * This guide walks through integrating the three core Week 1 components:
 * 1. POST /api/simulate endpoint
 * 2. SimulationResultModal React component
 * 3. Audit logging system
 */

# Week 1 Infrastructure Setup

## Overview

This document guides you through integrating the three core infrastructure components needed before component-specific integration can begin.

### Components to Integrate

1. **API Endpoint** (`server/api/simulate.ts`)
   - Purpose: Exposes all 23 simulators via REST API
   - Effort: ~130 lines already written
   - Setup time: 15-30 minutes

2. **React Modal** (`components/SimulationResultModal.tsx`)
   - Purpose: Reusable modal for displaying simulation results
   - Effort: ~270 lines component + ~600 lines CSS
   - Setup time: 15-30 minutes

3. **Audit Logger** (`server/services/auditLogger.ts`)
   - Purpose: Compliance tracking for all simulations
   - Effort: ~200 lines already written
   - Setup time: 10-15 minutes

---

## Step 1: Integrate Audit Logger

### 1.1 Initialize in Server Entry Point

**File**: `server/index.ts` or `server/server.ts`

```typescript
import { getAuditLogger } from '@/server/services/auditLogger';

// Initialize audit logger on server startup
const auditLogger = getAuditLogger({
  logDir: path.join(__dirname, '../logs/audit'),
  verbose: process.env.NODE_ENV !== 'production',
  fileLogging: true,
});

console.log('✓ Audit logger initialized');
```

### 1.2 Ensure Log Directory Permissions

Create the logs directory in your project root:

```bash
mkdir -p logs/audit
chmod 755 logs/audit
```

### 1.3 Verify in .gitignore

Add to `.gitignore` to exclude logs from version control:

```
logs/
logs/audit/
*.log
```

---

## Step 2: Integrate API Endpoint

### 2.1 Add Routes to Express Server

**File**: `server/index.ts` or `server/routes/index.ts`

```typescript
import express from 'express';
import { simulateHandler, listSimulatorsHandler } from '@/server/api/simulate';

const app = express();

// Middleware
app.use(express.json());

// Simulation routes
app.post('/api/simulate', simulateHandler);
app.get('/api/simulate/available', listSimulatorsHandler);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ POST /api/simulate - Execute simulator`);
  console.log(`✓ GET /api/simulate/available - List simulators`);
});
```

### 2.2 Add Request Validation Middleware (Optional but Recommended)

**File**: `server/middleware/validateSimulationRequest.ts`

```typescript
import { Request, Response, NextFunction } from 'express';

export function validateSimulationRequest(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { simulatorType, params } = req.body;

  // Check required fields
  if (!simulatorType || !params) {
    return res.status(400).json({
      success: false,
      error: 'simulatorType and params are required',
    });
  }

  // Ensure params is an object
  if (typeof params !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'params must be an object',
    });
  }

  // Add context to request
  (req as any).simulationContext = {
    simulatorType,
    params,
    timestamp: Date.now(),
  };

  next();
}
```

**Use in server**:

```typescript
app.post(
  '/api/simulate',
  validateSimulationRequest,  // Add this line
  simulateHandler
);
```

### 2.3 Test the Endpoint

Use curl or Postman to test:

```bash
# Test POST /api/simulate
curl -X POST http://localhost:3000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "simulatorType": "SPOT_TRADE",
    "params": {
      "userId": "test-user-1",
      "side": "BUY",
      "symbol": "BTC/USDT",
      "quantity": 0.5,
      "currentPrice": 45000,
      "volatility": 2.5
    },
    "userId": "test-user-1"
  }'

# Test GET /api/simulate/available
curl http://localhost:3000/api/simulate/available
```

**Expected Response** (Success):

```json
{
  "success": true,
  "simulationId": "sim-1707852345123-abc123def",
  "result": {
    "status": "SUCCESS",
    "depth": "INTERMEDIATE",
    "riskLevel": "MEDIUM",
    "riskFactors": ["high-volatility"],
    "warnings": [],
    "errors": [],
    "summary": "Spot trade simulation completed with moderate risk",
    "beforeState": { ... },
    "afterState": { ... },
    "delta": { ... },
    "simulationData": { ... }
  },
  "timestamp": 1707852345789,
  "executionTimeMs": 145
}
```

---

## Step 3: Integrate React Modal Component

### 3.1 Install Component in Your App

**File**: `components/trading/QuickOrderPanel.tsx` (Example)

```typescript
import { useState } from 'react';
import SimulationResultModal from '@/components/SimulationResultModal';
import { SimulationResult } from '@/server/services/simulationFramework';

export default function QuickOrderPanel() {
  const [showSimulationModal, setShowSimulationModal] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);

  // Call API simulator before order execution
  const handlePreviewTrade = async () => {
    try {
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simulatorType: 'SPOT_TRADE',
          params: {
            userId: currentUser.id,
            side: 'BUY',
            symbol: 'BTC/USDT',
            quantity: 0.5,
            currentPrice: 45000,
          },
          userId: currentUser.id, // For audit trail
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setSimulationResult(data.result);
        setShowSimulationModal(true);
      } else {
        console.error('Simulation failed:', data.error);
      }
    } catch (error) {
      console.error('Error calling simulator:', error);
    }
  };

  return (
    <div className="order-panel">
      {/* Your order form UI */}
      
      <button onClick={handlePreviewTrade} className="btn-preview">
        Preview Trade
      </button>

      {/* Modal component */}
      <SimulationResultModal
        result={simulationResult}
        isOpen={showSimulationModal}
        onClose={() => setShowSimulationModal(false)}
        onConfirm={async () => {
          // Execute actual trade
          await executeOrder();
          setShowSimulationModal(false);
        }}
        confirmButtonText="Execute Trade"
      />
    </div>
  );
}
```

### 3.2 Ensure CSS Is Imported

**File**: `components/SimulationResultModal.tsx`

The CSS file is automatically imported. Verify in your build setup that CSS modules or global CSS are properly configured.

If using CSS modules:

```typescript
import styles from './SimulationResultModal.module.css';
```

If using global CSS, ensure it's imported in your main layout:

```typescript
import '@/components/SimulationResultModal.css';
```

### 3.3 Test Modal Display

1. Click "Preview Trade" button
2. Wait for API response
3. Modal should appear with simulation results
4. Test buttons:
   - Close (X button) should close modal
   - Cancel should close modal without action
   - Proceed should execute trade (if risk is acceptable)

---

## Step 4: Wire Everything Together

### 4.1 Complete Server Setup Example

**File**: `server/server.ts`

```typescript
import express, { Request, Response } from 'express';
import path from 'path';
import { getAuditLogger } from '@/server/services/auditLogger';
import { simulateHandler, listSimulatorsHandler } from '@/server/api/simulate';

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// Initialize Services
// ============================================================================

const auditLogger = getAuditLogger({
  logDir: path.join(__dirname, '../logs/audit'),
  verbose: process.env.NODE_ENV !== 'production',
  fileLogging: true,
});

console.log('✓ Services initialized');

// ============================================================================
// Middleware
// ============================================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, res: Response, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ============================================================================
// Routes
// ============================================================================

// Simulation API
app.post('/api/simulate', simulateHandler);
app.get('/api/simulate/available', listSimulatorsHandler);

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    simulators: {
      available: 23,
      auditing: true,
      modal: 'ready',
    },
  });
});

// ============================================================================
// Error Handling
// ============================================================================

app.use((err: Error, req: Request, res: Response) => {
  console.error('Unhandled error:', err);
  
  auditLogger.log({
    userId: 'system',
    action: 'SERVER_ERROR',
    resource: 'server',
    status: 'ERROR',
    details: {
      error: err.message,
      path: req.path,
    },
    timestamp: new Date(),
  });

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: Date.now(),
  });
});

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║          MTAA DAO - Simulator System Ready                 ║
╠════════════════════════════════════════════════════════════╣
║ Server:  http://localhost:${PORT}                         
║ API:     POST /api/simulate                                ║
║          GET  /api/simulate/available                      ║
║ Audit:   logs/audit/                                       ║
║ Status:  ✓ Ready for component integration                 ║
╚════════════════════════════════════════════════════════════╝
  `);
});
```

---

## Step 5: Verify Integration

### 5.1 Checklist

- [ ] Audit logger initialized on server startup
- [ ] Log directory created at `logs/audit/`
- [ ] POST /api/simulate endpoint registered
- [ ] GET /api/simulate/available endpoint registered
- [ ] SimulationResultModal component imported in at least one page
- [ ] CSS for modal is loaded
- [ ] API response is properly typed (SimulationResult)

### 5.2 Test All Three Components

```bash
# 1. Start server
npm run dev

# 2. Test API endpoint
curl -X GET http://localhost:3000/api/simulate/available

# 3. Execute a simulation
curl -X POST http://localhost:3000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"simulatorType":"SPOT_TRADE","params":{...}}'

# 4. Check audit logs
ls -la logs/audit/
cat logs/audit/audit-2026-02-13.log

# 5. Test modal display
# - Open preview button in UI
# - Verify modal appears
# - Verify result data displays correctly
```

---

## Integration Summary

| Component | Status | File | Lines |
|-----------|--------|------|-------|
| API Endpoint | ✅ Complete | `server/api/simulate.ts` | 130 |
| Modal Component | ✅ Complete | `components/SimulationResultModal.tsx` | 270 |
| Modal Styles | ✅ Complete | `components/SimulationResultModal.css` | 600 |
| Audit Logger | ✅ Complete | `server/services/auditLogger.ts` | 200 |

**Total Implementation**: ~1,200 lines | **Setup Time**: ~60-90 minutes

---

## What's Next

Once Week 1 infrastructure is complete:

### Week 2: Component Integration
- Add preview buttons to Trading Dashboard (5 modals)
- Add preview buttons to DAO Treasury (3 modals)
- Add preview buttons to Governance pages (5 modals)
- Add preview buttons to Agent Management (2 modals)

### Week 3: Testing
- Create test suite for API endpoint
- Create test suite for modal rendering
- Create test suite for audit logging
- Integration testing

### Week 4: Production
- Performance optimization
- Security hardening
- UAT validation
- Production deployment

---

## Troubleshooting

### Issue: API returns 404

**Solution**: Check that routes are registered before `app.listen()` is called.

### Issue: Audit logs not being created

**Solution**: Check that `logs/audit/` directory exists and has write permissions.

### Issue: Modal CSS not loading

**Solution**: Verify CSS file is imported in component file or main app layout.

### Issue: Simulation always times out

**Solution**: Check that simulatorIndex.ts is properly exporting all simulators.

---

## Support

For questions, refer to:
- API docs: `SIMULATOR_INTEGRATION_GUIDE.md`
- Component examples: `SIMULATOR_INTEGRATION_GUIDE.md#integration-examples-by-component`
- Quick reference: `SIMULATOR_QUICK_REFERENCE.md`

---

**Week 1 Status**: ✅ Infrastructure Ready for Component Integration
