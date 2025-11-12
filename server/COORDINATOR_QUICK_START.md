/**
 * Coordinator System - Quick Start Reference
 * 
 * Everything you need to know to work with the Elder Coordinator
 */

// ============================================================
// 1. BASIC SETUP
// ============================================================

// In your server.ts or main server file:
import { elderCoordinator } from './core/elders/coordinator';
import { coordinatorMessageBus } from './core/elders/coordinator/message-bus';
import { createCoordinatorWebSocketHandler } from './websocket/coordinator-websocket';
import coordinatorRoutes from './routes/coordinator';

const app = express();
const httpServer = createServer(app);

// Mount API routes
app.use('/api/coordinator', coordinatorRoutes);

// Setup WebSocket for real-time updates
createCoordinatorWebSocketHandler(httpServer);

// Start server
httpServer.listen(PORT, () => {
  console.log(`Coordinator running on port ${PORT}`);
});

// ============================================================
// 2. REQUEST CONSENSUS (Most Common)
// ============================================================

// Backend - Request consensus on a proposal
import { elderCoordinator } from './core/elders/coordinator';

async function evaluateProposal(daoId: string, proposal: any) {
  const consensus = await elderCoordinator.getElderConsensus(daoId, proposal);
  
  console.log('Elder Council Decision:', {
    canApprove: consensus.consensusDecision.canApprove,
    confidence: consensus.consensusDecision.overallConfidence,
    scryApproves: consensus.scryAssessment.isSafe,
    kaizenApproves: consensus.kaizenAssessment.isBeneficial,
    lumenApproves: consensus.lumenAssessment.isEthical
  });

  return consensus;
}

// Frontend - Request consensus via API
async function getConsensus(daoId: string, proposalId: string) {
  const response = await fetch(
    `/api/coordinator/consensus?daoId=${daoId}&proposalId=${proposalId}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return response.json();
}

// Frontend - Real-time WebSocket consensus
socket.emit('coordinator:request-consensus', {
  daoId: 'dao-123',
  proposalId: 'prop-456'
});

socket.on('coordinator:consensus-response', (data) => {
  console.log('Consensus received:', data.data.consensusDecision);
});

// ============================================================
// 3. MESSAGE BUS - PUBLISH EVENTS
// ============================================================

import { coordinatorMessageBus } from './core/elders/coordinator/message-bus';

// Broadcast threat alert from SCRY
await coordinatorMessageBus.broadcast(
  'scry:threat-detected',
  {
    threatLevel: 'high',
    type: 'suspicious_transfer',
    daoId: 'dao-123'
  },
  'SCRY'
);

// Send critical alert
await coordinatorMessageBus.sendCriticalAlert(
  'scry:threat-detected',
  'SCRY',
  { threatLevel: 'critical', type: 'rug_pull_attempt' },
  'dao-123'
);

// Send point-to-point message
await coordinatorMessageBus.sendMessage(
  'kaizen:optimization-applied',
  'KAIZEN',
  'LUMEN',
  { optimization: 'Gas savings', saved: '15%' },
  'dao-123'
);

// ============================================================
// 4. MESSAGE BUS - SUBSCRIBE TO EVENTS
// ============================================================

// Subscribe to threats from SCRY
const threatSubId = coordinatorMessageBus.subscribe(
  'scry:threat-detected',
  async (message) => {
    console.log('⚠️ Threat detected:', message.data);
    // Trigger alert in UI
  }
);

// Subscribe to KAIZEN recommendations
coordinatorMessageBus.subscribe(
  'kaizen:recommendation-generated',
  async (message) => {
    console.log('💡 Optimization suggestion:', message.data);
  }
);

// Subscribe to all LUMEN reviews
coordinatorMessageBus.subscribe(
  'lumen:review-complete',
  async (message) => {
    console.log('📋 Ethics review done:', message.data);
  }
);

// Subscribe to specific DAO only (with filter)
coordinatorMessageBus.subscribe(
  'coordinator:decision-made',
  async (message) => {
    console.log('Decision:', message.data);
  },
  (msg) => msg.daoId === 'dao-123' // Filter function
);

// Unsubscribe when done
coordinatorMessageBus.unsubscribe(threatSubId);

// ============================================================
// 5. REAL-TIME FRONTEND UPDATES
// ============================================================

// Connect WebSocket
const socket = io('http://localhost:5000', {
  auth: { token: localStorage.getItem('token') }
});

// Handle connection
socket.on('coordinator:connected', (data) => {
  console.log('✓ Connected to coordinator:', data.socketId);
});

// Subscribe to consensus updates
socket.emit('coordinator:subscribe', { topic: 'coordinator:consensus' });
socket.on('coordinator:consensus', (event) => {
  console.log('New consensus:', event.data);
  updateDashboard(event.data);
});

// Subscribe to threat alerts
socket.emit('coordinator:subscribe', { topic: 'coordinator:scry-alert' });
socket.on('coordinator:scry-alert', (event) => {
  console.log('⚠️ Threat alert:', event.data);
  showAlert(event.data);
});

// Subscribe to KAIZEN recommendations
socket.emit('coordinator:subscribe', { topic: 'coordinator:kaizen-recommendation' });
socket.on('coordinator:kaizen-recommendation', (event) => {
  console.log('💡 Recommendation:', event.data);
});

// Subscribe to message bus activity
socket.emit('coordinator:subscribe', { topic: 'message-bus:message-published' });
socket.on('message-bus:message-published', (event) => {
  console.log('Message published:', event.data.topic, 'from', event.data.from);
  updateActivityFeed(event.data);
});

// Health check (ping)
setInterval(() => {
  socket.emit('coordinator:ping');
}, 30000);

// ============================================================
// 6. API ENDPOINTS
// ============================================================

// Get coordinator status
GET /api/coordinator/status
→ Returns: { status, uptime, eldersConnected, decisions }

// Get consensus on proposal
GET /api/coordinator/consensus?daoId=dao-123&proposalId=prop-456
→ Returns: ElderConsensus with all assessments

// Get message bus statistics
GET /api/coordinator/message-bus/stats (superuser)
→ Returns: { totalSubscriptions, subscriptionsByTopic, ... }

// Get message history
GET /api/coordinator/message-bus/history?limit=100 (superuser)
→ Returns: Array of messages

// Publish message to bus
POST /api/coordinator/message (superuser)
Body: { topic, from, data, daoId, priority }
→ Returns: { success, message }

// Send critical alert
POST /api/coordinator/critical-alert (superuser)
Body: { from, data, daoId }
→ Returns: { success, message }

// Health check
GET /api/coordinator/health (public)
→ Returns: { coordinatorStatus, eldersOnline, uptime }

// Update heartbeat
POST /api/coordinator/heartbeat (authenticated)
→ Returns: { success }

// ============================================================
// 7. COORDINATOR STATUS
// ============================================================

// Get coordinator status
const status = elderCoordinator.getStatus();

console.log(status);
// {
//   status: 'online',
//   coordinatorHealth: {
//     eldersConnected: 3,
//     messageQueueSize: 0,
//     lastHeartbeat: Date,
//     uptime: 3600000
//   },
//   recentDecisions: {
//     total: 42,
//     approved: 35,
//     rejected: 7,
//     escalated: 0
//   },
//   elderStatuses: {
//     scry: { status: 'online', lastUpdate: Date },
//     kaizen: { status: 'online', lastUpdate: Date },
//     lumen: { status: 'online', lastUpdate: Date }
//   }
// }

// ============================================================
// 8. MESSAGE BUS STATS
// ============================================================

const stats = coordinatorMessageBus.getStats();

console.log(stats);
// {
//   totalSubscriptions: 42,
//   subscriptionsByTopic: {
//     'scry:threat-detected': 5,
//     'kaizen:recommendation-generated': 3,
//     'lumen:review-complete': 2,
//     ...
//   },
//   messageHistorySize: 1043,
//   pendingDeliveries: 0,
//   topics: [...]
// }

// ============================================================
// 9. GET MESSAGE HISTORY
// ============================================================

// Get all messages for a topic
const threats = coordinatorMessageBus.getHistory('scry:threat-detected', 50);

// Get messages for a DAO
const daoMessages = coordinatorMessageBus.getDaoHistory('dao-123', 100);

// Get all recent messages
const allMessages = coordinatorMessageBus.getHistory(undefined, 200);

// ============================================================
// 10. CONSENSUS RESPONSE STRUCTURE
// ============================================================

const consensus = {
  daoId: 'dao-123',
  proposal: { /* proposal data */ },
  
  // SCRY Assessment (Security)
  scryAssessment: {
    isSafe: true,
    threatLevel: 'low',        // low, medium, high, critical
    concerns: [],
    confidence: 0.85           // 0-1
  },
  
  // KAIZEN Assessment (Optimization)
  kaizenAssessment: {
    isBeneficial: true,
    improvementPotential: 0.75, // 0-1
    optimizationSuggestions: ['suggestion1', 'suggestion2'],
    confidence: 0.80            // 0-1
  },
  
  // LUMEN Assessment (Ethics)
  lumenAssessment: {
    isEthical: true,
    ethicalScore: 0.82,         // 0-1
    ethicalConcerns: [],
    confidence: 0.78            // 0-1
  },
  
  // Final Decision
  consensusDecision: {
    canApprove: true,           // All three approve
    overallConfidence: 0.81,    // Average of three
    requiresReview: false,      // Human review needed?
    reviewReason: ''            // Why review needed
  },
  
  timestamp: Date
};

// ============================================================
// 11. COMMON PATTERNS
// ============================================================

// Pattern 1: Auto-approve safe decisions
const consensus = await elderCoordinator.getElderConsensus(daoId, proposal);
if (consensus.consensusDecision.canApprove && 
    consensus.consensusDecision.overallConfidence > 0.85) {
  await executeProposal(proposal);
} else {
  await escalateForReview(proposal, consensus);
}

// Pattern 2: Listen for critical threats
coordinatorMessageBus.subscribe(
  'scry:threat-detected',
  async (msg) => {
    if (msg.data.threatLevel === 'critical') {
      // Pause all operations
      await pauseDAO(msg.daoId);
      // Notify admins
      await alertAdmins(msg.data);
    }
  }
);

// Pattern 3: Track all decisions for audit
coordinatorMessageBus.subscribe(
  'coordinator:decision-made',
  async (msg) => {
    // Log to database for audit trail
    await db.coordinatorDecisions.insert({
      daoId: msg.daoId,
      decision: msg.data,
      timestamp: msg.timestamp
    });
  }
);

// Pattern 4: Get DAO-specific status
const daoMessages = coordinatorMessageBus.getDaoHistory(daoId);
const decisionCount = daoMessages.filter(m => 
  m.topic === 'coordinator:decision-made'
).length;

// ============================================================
// 12. ERROR HANDLING
// ============================================================

try {
  const consensus = await elderCoordinator.getElderConsensus(
    daoId,
    proposal
  );
  
  if (!consensus) {
    console.error('No consensus available');
    return;
  }
  
  // Check individual elder assessments for issues
  if (!consensus.scryAssessment) {
    console.warn('SCRY assessment failed');
  }
  if (!consensus.kaizenAssessment) {
    console.warn('KAIZEN assessment failed');
  }
  if (!consensus.lumenAssessment) {
    console.warn('LUMEN assessment failed');
  }
  
} catch (error) {
  console.error('Consensus request failed:', error);
  // Fallback: escalate to human review
  await escalateForManualReview(daoId, proposal);
}

// ============================================================
// 13. MONITORING & DEBUGGING
// ============================================================

// Check coordinator health
const status = elderCoordinator.getStatus();
if (status.status !== 'online') {
  console.warn('Coordinator not online!');
}
if (status.coordinatorHealth.eldersConnected < 3) {
  console.warn(`Only ${status.coordinatorHealth.eldersConnected}/3 elders connected`);
}

// Monitor message queue
const stats = coordinatorMessageBus.getStats();
if (stats.messageHistorySize > 8000) {
  console.warn('Message history growing large, may need cleanup');
}
if (stats.pendingDeliveries > 10) {
  console.warn('High number of pending message deliveries');
}

// Check WebSocket connections
const wsStats = wsHandler.getSubscriptionStats();
console.log(`${wsStats.totalClients} clients connected`);
console.log(`Subscriptions by topic:`, wsStats.byTopic);

// ============================================================
// 14. PERFORMANCE TIPS
// ============================================================

// Tip 1: Use topic-specific subscriptions
// ❌ Don't: coordinatorMessageBus.subscribe('ALL', handler)
// ✅ Do: coordinatorMessageBus.subscribe('scry:threat-detected', handler)

// Tip 2: Use filter functions for DAO-scoped updates
// ✅ coordinatorMessageBus.subscribe(topic, handler, 
//     (msg) => msg.daoId === targetDaoId)

// Tip 3: Clear message history periodically
// coordinatorMessageBus.getHistory().length > 10000 && 
//   coordinatorMessageBus.clearHistory();

// Tip 4: Unsubscribe when component unmounts
// useEffect(() => {
//   const subId = coordinatorMessageBus.subscribe(topic, handler);
//   return () => coordinatorMessageBus.unsubscribe(subId);
// }, []);

// Tip 5: Use offline status for graceful degradation
// if (coordinatorStatus.status !== 'online') {
//   // Show offline indicator, disable consensus requests
// }

// ============================================================
// 15. TYPESCRIPT TYPES
// ============================================================

import {
  ElderConsensus,
  CoordinatorStatus,
  CoordinatorMessage,
  MessageTopic,
  ElderInput
} from '@/core/elders/coordinator';

const handleConsensus = (consensus: ElderConsensus): void => {
  // Type-safe consensus handling
};

const publishMessage = async (
  topic: MessageTopic,
  data: any
): Promise<void> => {
  // Type-safe message publishing
};

// ============================================================

// 🎯 That's it! You now have a working Elder Coordinator system!
//
// Key Takeaways:
// 1. Request consensus for major decisions
// 2. Subscribe to message bus for real-time updates
// 3. Use WebSocket for frontend real-time UI
// 4. Monitor coordinator health
// 5. Handle errors gracefully
// 6. Audit all decisions
