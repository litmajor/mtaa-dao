// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  AgentIds
 * @notice Canonical, compile-time agent ID constants for the MtaaDAO ecosystem.
 *
 *         IMPORT THIS EVERYWHERE.
 *         AgentRegistry, AgentPaymentGateway, SubscriptionManager,
 *         RevenueDistributor, and AgentTreasury all use these same IDs.
 *         Never call keccak256 on the human-readable string in-contract —
 *         import the constant instead.
 *
 *         IDs are keccak256 of the canonical string from the spec document,
 *         computed at compile time (zero runtime cost).
 *
 * @dev    Usage:
 *         import "./AgentIds.sol";
 *         ...
 *         bytes32 agentId = AgentIds.MORIO;
 *         bytes32[] memory all = AgentIds.all();  // batch registration
 */
library AgentIds {

    // =========================================================================
    // TIER 1 — CORE ORCHESTRATION
    // =========================================================================

    bytes32 internal constant MORIO           = keccak256("AGENT-MORIO-001");
    bytes32 internal constant NURU            = keccak256("AGENT-NURU-001");

    // =========================================================================
    // TIER 2 — ELDER COUNCIL
    // =========================================================================

    bytes32 internal constant ELD_SCRY        = keccak256("AGENT-ELD-SCRY-001");
    bytes32 internal constant ELD_KAIZEN      = keccak256("AGENT-ELD-KAIZEN-001");
    bytes32 internal constant ELD_LUMEN       = keccak256("AGENT-ELD-LUMEN-001");
    bytes32 internal constant ELD_COORDINATOR = keccak256("AGENT-ELD-COORDINATOR-001");

    // =========================================================================
    // TIER 3 — EXECUTION (DeFi & State)
    // =========================================================================

    bytes32 internal constant TRADER_DEFI     = keccak256("AGENT-TRADER-DEFI-001");
    bytes32 internal constant SYNCHRONIZER    = keccak256("AGENT-SYNC-001");

    // =========================================================================
    // TIER 4 — SECURITY
    // =========================================================================

    bytes32 internal constant SCOUT           = keccak256("AGENT-SCOUT-001");
    bytes32 internal constant DEFENDER        = keccak256("AGENT-DEFENDER-001");
    bytes32 internal constant ANALYZER        = keccak256("AGENT-ANALYZER-001");
    bytes32 internal constant REPAIR          = keccak256("AGENT-REPAIR-001");

    // =========================================================================
    // TIER 5 — INTELLIGENCE
    // =========================================================================

    bytes32 internal constant GATEWAY_AGENT   = keccak256("AGENT-GATEWAY-001");
    bytes32 internal constant RELAY           = keccak256("AGENT-RELAY-001");
    bytes32 internal constant HASHER          = keccak256("AGENT-HASHER-001");
    bytes32 internal constant INFILTRATOR     = keccak256("AGENT-INFILTRATOR-001");
    bytes32 internal constant EXFILTRATOR     = keccak256("AGENT-EXFILTRATOR-001");

    // =========================================================================
    // TIER 6 — COMPLIANCE & ANALYTICS
    // =========================================================================

    bytes32 internal constant COMPLIANCE      = keccak256("AGENT-COMPLIANCE-001");
    bytes32 internal constant GOV_ANALYTICS   = keccak256("AGENT-GOV-ANALYTICS-001");
    bytes32 internal constant ANOMALY         = keccak256("AGENT-ANOMALY-001");

    // =========================================================================
    // TIER 7 — COMMUNITY & TREASURY
    // =========================================================================

    bytes32 internal constant TREASURY_AGENT  = keccak256("AGENT-TREASURY-001");
    bytes32 internal constant COMMUNITY       = keccak256("AGENT-COMMUNITY-001");
    bytes32 internal constant CHAMA           = keccak256("AGENT-CHAMA-001");

    // =========================================================================
    // TIER 8 — SPECIALIZED
    // =========================================================================

    bytes32 internal constant OKEDI           = keccak256("AGENT-OKEDI-001");
    bytes32 internal constant MIRRORCORE      = keccak256("AGENT-MIRRORCORE-001");
    bytes32 internal constant AOE             = keccak256("AGENT-AOE-001");
    bytes32 internal constant ETHICIST        = keccak256("AGENT-ETHICIST-001");
    bytes32 internal constant WATCHER         = keccak256("AGENT-WATCHER-001");
    bytes32 internal constant COMMANDER       = keccak256("AGENT-COMMANDER-001");
    bytes32 internal constant DESIGN          = keccak256("AGENT-DESIGN-001");

    // =========================================================================
    // DOMAIN ANALYZERS
    // =========================================================================

    bytes32 internal constant WALLET_ANALYZER        = keccak256("AGENT-WALLET-ANALYZER-001");
    bytes32 internal constant VAULT_ANALYZER         = keccak256("AGENT-VAULT-ANALYZER-001");
    bytes32 internal constant FINANCIAL_ANALYZER     = keccak256("AGENT-FINANCIAL-ANALYZER-001");
    bytes32 internal constant CONTRIBUTION_ANALYZER  = keccak256("AGENT-CONTRIBUTION-ANALYZER-001");
    bytes32 internal constant RISK_ASSESSOR          = keccak256("AGENT-RISK-ASSESSOR-001");
    bytes32 internal constant CONTEXT_MANAGER        = keccak256("AGENT-CONTEXT-MANAGER-001");

    // =========================================================================
    // HUMAN-READABLE NAMES
    // Parallel array to all() — same index, name for the ID.
    // Use for off-chain tooling, deployment scripts, dashboards.
    // =========================================================================

    uint256 internal constant AGENT_COUNT = 36;

    /**
     * @notice All 36 canonical agent IDs in a fixed array.
     *         Use with batchConfigureAgents() for single-transaction deployment.
     *         Index 0-35 matches names() below.
     */
    function all() internal pure returns (bytes32[36] memory ids) {
        ids[0]  = MORIO;
        ids[1]  = NURU;
        ids[2]  = ELD_SCRY;
        ids[3]  = ELD_KAIZEN;
        ids[4]  = ELD_LUMEN;
        ids[5]  = ELD_COORDINATOR;
        ids[6]  = TRADER_DEFI;
        ids[7]  = SYNCHRONIZER;
        ids[8]  = SCOUT;
        ids[9]  = DEFENDER;
        ids[10] = ANALYZER;
        ids[11] = REPAIR;
        ids[12] = GATEWAY_AGENT;
        ids[13] = RELAY;
        ids[14] = HASHER;
        ids[15] = INFILTRATOR;
        ids[16] = EXFILTRATOR;
        ids[17] = COMPLIANCE;
        ids[18] = GOV_ANALYTICS;
        ids[19] = ANOMALY;
        ids[20] = TREASURY_AGENT;
        ids[21] = COMMUNITY;
        ids[22] = CHAMA;
        ids[23] = OKEDI;
        ids[24] = MIRRORCORE;
        ids[25] = AOE;
        ids[26] = ETHICIST;
        ids[27] = WATCHER;
        ids[28] = COMMANDER;
        ids[29] = DESIGN;
        ids[30] = WALLET_ANALYZER;
        ids[31] = VAULT_ANALYZER;
        ids[32] = FINANCIAL_ANALYZER;
        ids[33] = CONTRIBUTION_ANALYZER;
        ids[34] = RISK_ASSESSOR;
        ids[35] = CONTEXT_MANAGER;
    }

    /**
     * @notice Human-readable names at the same index as all().
     *         Use for deployment scripts and logging only — never store on-chain.
     */
    function names() internal pure returns (string[36] memory n) {
        n[0]  = "Morio";
        n[1]  = "Nuru";
        n[2]  = "Elder Scry";
        n[3]  = "Elder Kaizen";
        n[4]  = "Elder Lumen";
        n[5]  = "Elder Coordinator";
        n[6]  = "Trader DeFi";
        n[7]  = "Synchronizer";
        n[8]  = "Scout";
        n[9]  = "Defender";
        n[10] = "Analyzer";
        n[11] = "Repair";
        n[12] = "Gateway Agent";
        n[13] = "Relay";
        n[14] = "Hasher";
        n[15] = "Infiltrator";
        n[16] = "Exfiltrator";
        n[17] = "Compliance";
        n[18] = "Governance Analytics";
        n[19] = "Anomaly Detection";
        n[20] = "Treasury Agent";
        n[21] = "Community";
        n[22] = "Chama";
        n[23] = "Okedi";
        n[24] = "MirrorCore";
        n[25] = "AOE";
        n[26] = "Ethicist";
        n[27] = "Watcher";
        n[28] = "Commander";
        n[29] = "Design";
        n[30] = "Wallet Analyzer";
        n[31] = "Vault Analyzer";
        n[32] = "Financial Analyzer";
        n[33] = "Contribution Analyzer";
        n[34] = "Risk Assessor";
        n[35] = "Context Manager";
    }

    /**
     * @notice Verify a bytes32 is a known canonical agent ID.
     *         Use in AgentRegistry.registerAgent() to reject unknown IDs.
     */
    function isKnown(bytes32 id) internal pure returns (bool) {
        bytes32[36] memory _all = all();
        for (uint256 i; i < 36; ++i) {
            if (_all[i] == id) return true;
        }
        return false;
    }
}
