/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * V1 DAOs Router
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Main router that composes all DAO-scoped sub-routers under unified structure:
 *
 * Base Pattern: /api/v1/daos/:daoId/{resource}
 *
 * Phase 2 Sub-Routers (DAO-Scoped):
 * ├─ CHAT
 * │  ├─ GET/POST     /v1/daos/:daoId/chat/messages
 * │  ├─ PATCH/DELETE /v1/daos/:daoId/chat/messages/:messageId
 * │  ├─ POST         /v1/daos/:daoId/chat/messages/:messageId/pin
 * │  ├─ POST/DELETE  /v1/daos/:daoId/chat/messages/:messageId/reactions
 * │  ├─ POST         /v1/daos/:daoId/chat/upload
 * │  ├─ DELETE       /v1/daos/:daoId/chat/attachments/:attachmentId
 * │  ├─ POST         /v1/daos/:daoId/chat/typing
 * │  └─ GET          /v1/daos/:daoId/chat/presence
 * │
 * ├─ GOVERNANCE LEADERBOARDS
 * │  ├─ GET          /v1/daos/:daoId/governance/leaderboard
 * │  ├─ GET          /v1/daos/:daoId/governance/stats
 * │  ├─ GET          /v1/daos/:daoId/governance/members/:userId/rank
 * │  ├─ PATCH        /v1/daos/:daoId/governance/members/:userId/stats
 * │  └─ GET          /v1/daos/:daoId/governance/top-contributors
 * │
 * ├─ INVESTMENT POOLS
 * │  ├─ GET          /v1/daos/:daoId/investment-pools
 * │  ├─ POST         /v1/daos/:daoId/investment-pools
 * │  ├─ GET          /v1/daos/:daoId/investment-pools/:poolId
 * │  ├─ PATCH        /v1/daos/:daoId/investment-pools/:poolId
 * │  ├─ DELETE       /v1/daos/:daoId/investment-pools/:poolId
 * │  ├─ POST         /v1/daos/:daoId/investment-pools/:poolId/assets
 * │  ├─ DELETE       /v1/daos/:daoId/investment-pools/:poolId/assets/:assetId
 * │  └─ GET          /v1/daos/:daoId/investment-pools/:poolId/composition
 * │
 * └─ TREASURY (Legacy consolidation)
 *    ├─ POST         /v1/daos/:daoId/treasury/analyze
 *    ├─ POST         /v1/daos/:daoId/treasury/recommend-formula
 *    └─ GET          /v1/daos/:daoId/treasury/health
 *
 * Route Parameters:
 *   - :daoId → Scopes all operations to specific DAO
 *   - Middleware: isAuthenticated, validateDaoIdMiddleware (applied in _daoId/index.ts)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import daoIdRouter from './_daoId';

/**
 * ✅ FIXED: Direct export of DAO-scoped router
 * 
 * This router is ALREADY mounted at /:daoId in the parent daos.ts file,
 * so we export the router directly without re-mounting.
 * 
 * Parent mount location: server/routes/v1/daos.ts line 567
 *   router.use('/:daoId', daoIdRouter);  // ← Points to THIS exported router
 * 
 * ✅ Correctly results in: /api/v1/daos/:daoId/[resource]
 * ❌ Previously resulted in: /api/v1/daos/:daoId/:daoId/[resource] (BROKEN)
 */
export default daoIdRouter;
