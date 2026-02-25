/**
 * Phase 5: Governance & Treasury Management Routes - NEW
 * REST API endpoints for DAO governance, voting, treasury, and expenses
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticateToken } from "@/server/middleware/auth";
import {
  createDAO,
  getDAO,
  getAllDAOs,
  updateDAOParameters,
  addDAOMember,
  getDAOMembers,
  getMember,
  updateMemberVotingPower,
  getDAOMembershipStats,
  createGovernanceToken,
  getGovernanceToken,
  updateTokenPrice,
  createProposal,
  getProposal,
  getDAOProposals,
  updateProposalStatus,
  executeProposal,
  castVote,
  getProposalVotes,
  getMemberVotes,
  delegateVotes,
  getWalletDelegations,
  revokeDelegation,
  createTreasuryAccount,
  getTreasuryAccount,
  getDAOTreasuryAccounts,
  recordTreasuryTransaction,
  getTreasuryTransactions,
  recordTreasuryAsset,
  getTreasuryAssets,
  updateAssetPrice,
  createBudgetCategory,
  getDAOBudgetCategories,
  submitExpense,
  approveExpense,
  rejectExpense,
  getBudgetExpenses,
  recordGovernanceEvent,
  getGovernanceEvents,
  recordMemberActivity,
  getMemberActivity,
  generateGovernanceReport,
  getGovernanceReports,
  setGovernanceParameter,
  getGovernanceParameters,
  updateGovernanceParameter,
  getDAOGovernanceStatus,
} from "@/server/services/governance-service";

const router = Router();

// ============================================================================
// DAO MANAGEMENT ROUTES
// ============================================================================

/**
 * POST /governance/daos - Create new DAO
 */
router.post("/daos", authenticateToken, async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      founder_wallet_id,
      dao_type,
      blockchain_network,
      governance_token_address,
      treasury_address,
      voting_period_days,
      voting_quorum_percent,
      voting_approval_percent,
    } = req.body;

    const dao = await createDAO(
      name,
      description,
      founder_wallet_id,
      dao_type,
      blockchain_network,
      governance_token_address,
      treasury_address,
      voting_period_days,
      voting_quorum_percent,
      voting_approval_percent
    );

    res.json({ success: true, data: dao });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /governance/daos - Get all DAOs
 */
router.get("/daos", async (req: Request, res: Response) => {
  try {
    const daos = await getAllDAOs();
    res.json({ success: true, data: daos });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /governance/daos/:id - Get DAO details
 */
router.get("/daos/:id", async (req: Request, res: Response) => {
  try {
    const dao = await getDAO(req.params.id);
    res.json({ success: true, data: dao });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

/**
 * PUT /governance/daos/:id/parameters - Update DAO parameters
 */
router.put("/daos/:id/parameters", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { voting_period_days, voting_quorum_percent, voting_approval_percent } = req.body;

    const updated = await updateDAOParameters(
      req.params.id,
      voting_period_days || null,
      voting_quorum_percent || null,
      voting_approval_percent || null
    );

    res.json({ success: true, data: updated[0] });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /governance/daos/:id/status - Get complete DAO governance status
 */
router.get("/daos/:id/status", async (req: Request, res: Response) => {
  try {
    const status = await getDAOGovernanceStatus(req.params.id);
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================================================
// MEMBERSHIP ROUTES
// ============================================================================

/**
 * POST /governance/daos/:id/members - Add member to DAO
 */
router.post("/daos/:id/members", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { wallet_id, role, voting_power, governance_tokens_held } = req.body;

    const member = await addDAOMember(
      req.params.id,
      wallet_id,
      role,
      voting_power,
      governance_tokens_held
    );

    res.json({ success: true, data: member });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /governance/daos/:id/members - Get DAO members
 */
router.get("/daos/:id/members", async (req: Request, res: Response) => {
  try {
    const members = await getDAOMembers(req.params.id);
    res.json({ success: true, data: members });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /governance/daos/:id/members/stats - Get membership statistics
 */
router.get("/daos/:id/members/stats", async (req: Request, res: Response) => {
  try {
    const stats = await getDAOMembershipStats(req.params.id);
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /governance/members/:id - Get member details
 */
router.get("/members/:id", async (req: Request, res: Response) => {
  try {
    const member = await getMember(req.params.id);
    res.json({ success: true, data: member });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

/**
 * PUT /governance/members/:id/voting-power - Update member voting power
 */
router.put("/members/:id/voting-power", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { new_voting_power, new_token_balance } = req.body;

    const updated = await updateMemberVotingPower(req.params.id, new_voting_power, new_token_balance);

    res.json({ success: true, data: updated[0] });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================================================
// GOVERNANCE TOKENS ROUTES
// ============================================================================

/**
 * POST /governance/tokens - Create governance token
 */
router.post("/tokens", authenticateToken, async (req: Request, res: Response) => {
  try {
    const {
      dao_id,
      token_name,
      token_symbol,
      token_address,
      total_supply,
      token_decimals,
      token_price,
    } = req.body;

    const token = await createGovernanceToken(
      dao_id,
      token_name,
      token_symbol,
      token_address,
      total_supply,
      token_decimals,
      token_price
    );

    res.json({ success: true, data: token });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /governance/tokens/:id - Get token details
 */
router.get("/tokens/:id", async (req: Request, res: Response) => {
  try {
    const token = await getGovernanceToken(req.params.id);
    res.json({ success: true, data: token });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

/**
 * PUT /governance/tokens/:id/price - Update token price
 */
router.put("/tokens/:id/price", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { new_price } = req.body;

    const updated = await updateTokenPrice(req.params.id, new_price);

    res.json({ success: true, data: updated[0] });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================================================
// PROPOSALS ROUTES
// ============================================================================

/**
 * POST /governance/daos/:id/proposals - Create proposal
 */
router.post("/daos/:id/proposals", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { creator_wallet_id, title, description, proposal_type, ipfs_hash } = req.body;

    const proposal = await createProposal(
      req.params.id,
      creator_wallet_id,
      title,
      description,
      proposal_type,
      ipfs_hash
    );

    res.json({ success: true, data: proposal });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /governance/proposals/:id - Get proposal details
 */
router.get("/proposals/:id", async (req: Request, res: Response) => {
  try {
    const proposal = await getProposal(req.params.id);
    res.json({ success: true, data: proposal });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

/**
 * GET /governance/daos/:id/proposals - Get DAO proposals
 */
router.get("/daos/:id/proposals", async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const proposals = await getDAOProposals(req.params.id, status as string | undefined);
    res.json({ success: true, data: proposals });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /governance/proposals/:id/execute - Execute proposal
 */
router.put("/proposals/:id/execute", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tx_hash } = req.body;

    const executed = await executeProposal(req.params.id, tx_hash);

    res.json({ success: true, data: executed });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================================================
// VOTING ROUTES
// ============================================================================

/**
 * POST /governance/proposals/:id/votes - Cast vote on proposal
 */
router.post("/proposals/:id/votes", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { voter_wallet_id, vote_choice, voting_power_used, vote_reason } = req.body;

    const vote = await castVote(
      req.params.id,
      voter_wallet_id,
      vote_choice,
      voting_power_used,
      vote_reason
    );

    res.json({ success: true, data: vote });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /governance/proposals/:id/votes - Get proposal votes
 */
router.get("/proposals/:id/votes", async (req: Request, res: Response) => {
  try {
    const votes = await getProposalVotes(req.params.id);
    res.json({ success: true, data: votes });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /governance/members/:id/votes - Get member votes
 */
router.get("/members/:id/votes", async (req: Request, res: Response) => {
  try {
    const member = await getMember(req.params.id);
    const memberVotes = await getMemberVotes(member.wallet_id);
    res.json({ success: true, data: memberVotes });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================================================
// VOTE DELEGATION ROUTES
// ============================================================================

/**
 * POST /governance/daos/:id/delegations - Delegate voting power
 */
router.post("/daos/:id/delegations", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { delegator_wallet_id, delegate_wallet_id, voting_power_delegated } = req.body;

    const delegation = await delegateVotes(
      req.params.id,
      delegator_wallet_id,
      delegate_wallet_id,
      voting_power_delegated
    );

    res.json({ success: true, data: delegation });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /governance/daos/:id/delegations/:walletId - Get wallet delegations
 */
router.get("/daos/:id/delegations/:walletId", async (req: Request, res: Response) => {
  try {
    const delegations = await getWalletDelegations(req.params.id, req.params.walletId);
    res.json({ success: true, data: delegations });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /governance/delegations/:id - Revoke delegation
 */
router.delete("/delegations/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const revoked = await revokeDelegation(req.params.id);
    res.json({ success: true, data: revoked[0] });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================================================
// TREASURY ROUTES
// ============================================================================

/**
 * POST /governance/daos/:id/treasury - Create treasury account
 */
router.post("/daos/:id/treasury", authenticateToken, async (req: Request, res: Response) => {
  try {
    const {
      account_name,
      account_type,
      treasury_address,
      blockchain_network,
      multi_sig_required,
      signatures_required,
      total_signers,
    } = req.body;

    const account = await createTreasuryAccount(
      req.params.id,
      account_name,
      account_type,
      treasury_address,
      blockchain_network,
      multi_sig_required,
      signatures_required,
      total_signers
    );

    res.json({ success: true, data: account });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /governance/daos/:id/treasury - Get DAO treasury accounts
 */
router.get("/daos/:id/treasury", async (req: Request, res: Response) => {
  try {
    const accounts = await getDAOTreasuryAccounts(req.params.id);
    res.json({ success: true, data: accounts });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /governance/treasury/:id - Get treasury account details
 */
router.get("/treasury/:id", async (req: Request, res: Response) => {
  try {
    const account = await getTreasuryAccount(req.params.id);
    res.json({ success: true, data: account });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

/**
 * POST /governance/treasury/:id/transactions - Record treasury transaction
 */
router.post("/treasury/:id/transactions", authenticateToken, async (req: Request, res: Response) => {
  try {
    const {
      transaction_type,
      from_address,
      to_address,
      asset_address,
      amount,
      amount_usd,
      tx_hash,
      related_proposal_id,
      description,
    } = req.body;

    const transaction = await recordTreasuryTransaction(
      req.params.id,
      transaction_type,
      from_address,
      to_address,
      asset_address,
      amount,
      amount_usd,
      tx_hash,
      related_proposal_id,
      description
    );

    res.json({ success: true, data: transaction });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /governance/treasury/:id/transactions - Get treasury transactions
 */
router.get("/treasury/:id/transactions", async (req: Request, res: Response) => {
  try {
    const transactions = await getTreasuryTransactions(req.params.id);
    res.json({ success: true, data: transactions });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================================================
// TREASURY ASSETS ROUTES
// ============================================================================

/**
 * POST /governance/treasury/:id/assets - Record treasury asset
 */
router.post("/treasury/:id/assets", authenticateToken, async (req: Request, res: Response) => {
  try {
    const {
      asset_type,
      asset_address,
      asset_name,
      asset_symbol,
      quantity,
      unit_price,
      acquisition_date,
      acquisition_cost,
    } = req.body;

    const asset = await recordTreasuryAsset(
      req.params.id,
      asset_type,
      asset_address,
      asset_name,
      asset_symbol,
      quantity,
      unit_price,
      new Date(acquisition_date),
      acquisition_cost
    );

    res.json({ success: true, data: asset });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /governance/treasury/:id/assets - Get treasury assets
 */
router.get("/treasury/:id/assets", async (req: Request, res: Response) => {
  try {
    const assets = await getTreasuryAssets(req.params.id);
    res.json({ success: true, data: assets });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /governance/assets/:id/price - Update asset price
 */
router.put("/assets/:id/price", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { new_price } = req.body;

    const updated = await updateAssetPrice(req.params.id, new_price);

    res.json({ success: true, data: updated[0] });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================================================
// BUDGET & EXPENSES ROUTES
// ============================================================================

/**
 * POST /governance/daos/:id/budget-categories - Create budget category
 */
router.post("/daos/:id/budget-categories", authenticateToken, async (req: Request, res: Response) => {
  try {
    const {
      category_name,
      monthly_budget,
      quarterly_budget,
      annual_budget,
      description,
      approval_required,
    } = req.body;

    const category = await createBudgetCategory(
      req.params.id,
      category_name,
      monthly_budget,
      quarterly_budget,
      annual_budget,
      description,
      approval_required
    );

    res.json({ success: true, data: category });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /governance/daos/:id/budget-categories - Get DAO budget categories
 */
router.get("/daos/:id/budget-categories", async (req: Request, res: Response) => {
  try {
    const categories = await getDAOBudgetCategories(req.params.id);
    res.json({ success: true, data: categories });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /governance/budget-categories/:id/expenses - Submit expense
 */
router.post("/budget-categories/:id/expenses", authenticateToken, async (req: Request, res: Response) => {
  try {
    const {
      expense_name,
      amount,
      submitted_by,
      description,
      due_date,
      receipt_ipfs,
    } = req.body;

    const expense = await submitExpense(
      req.params.id,
      expense_name,
      amount,
      submitted_by,
      description,
      due_date ? new Date(due_date) : undefined,
      receipt_ipfs
    );

    res.json({ success: true, data: expense });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /governance/budget-categories/:id/expenses - Get budget expenses
 */
router.get("/budget-categories/:id/expenses", async (req: Request, res: Response) => {
  try {
    const expenses = await getBudgetExpenses(req.params.id);
    res.json({ success: true, data: expenses });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /governance/expenses/:id/approve - Approve expense
 */
router.put("/expenses/:id/approve", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { approved_by } = req.body;

    const approved = await approveExpense(req.params.id, approved_by);

    res.json({ success: true, data: approved[0] });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /governance/expenses/:id/reject - Reject expense
 */
router.put("/expenses/:id/reject", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { rejection_reason } = req.body;

    const rejected = await rejectExpense(req.params.id, rejection_reason);

    res.json({ success: true, data: rejected[0] });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================================================
// GOVERNANCE EVENTS & REPORTING ROUTES
// ============================================================================

/**
 * GET /governance/daos/:id/events - Get governance events
 */
router.get("/daos/:id/events", async (req: Request, res: Response) => {
  try {
    const events = await getGovernanceEvents(req.params.id);
    res.json({ success: true, data: events });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /governance/members/:id/activity - Get member activity
 */
router.get("/members/:id/activity", async (req: Request, res: Response) => {
  try {
    const activity = await getMemberActivity(req.params.id);
    res.json({ success: true, data: activity });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /governance/daos/:id/reports - Generate governance report
 */
router.post("/daos/:id/reports", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { report_period, period_start_date, period_end_date } = req.body;

    const report = await generateGovernanceReport(
      req.params.id,
      report_period,
      new Date(period_start_date),
      new Date(period_end_date)
    );

    res.json({ success: true, data: report });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /governance/daos/:id/reports - Get governance reports
 */
router.get("/daos/:id/reports", async (req: Request, res: Response) => {
  try {
    const reports = await getGovernanceReports(req.params.id);
    res.json({ success: true, data: reports });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================================================
// GOVERNANCE PARAMETERS ROUTES
// ============================================================================

/**
 * GET /governance/daos/:id/parameters - Get governance parameters
 */
router.get("/daos/:id/parameters", async (req: Request, res: Response) => {
  try {
    const parameters = await getGovernanceParameters(req.params.id);
    res.json({ success: true, data: parameters });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /governance/parameters/:id - Update governance parameter
 */
router.put("/parameters/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { new_value, changed_by, proposal_id } = req.body;

    const updated = await updateGovernanceParameter(req.params.id, new_value, changed_by, proposal_id);

    res.json({ success: true, data: updated[0] });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
