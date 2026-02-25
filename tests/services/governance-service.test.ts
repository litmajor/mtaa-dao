/**
 * Governance & Treasury Management Tests - Phase 5
 * Comprehensive test coverage for DAOs, governance, voting, treasury, and expenses
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createDAO,
  getDAO,
  getAllDAOs,
  addDAOMember,
  getDAOMembers,
  getMember,
  createGovernanceToken,
  getGovernanceToken,
  createProposal,
  getProposal,
  getDAOProposals,
  executeProposal,
  castVote,
  getProposalVotes,
  delegateVotes,
  getWalletDelegations,
  createTreasuryAccount,
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
  getGovernanceEvents,
  generateGovernanceReport,
  getDAOGovernanceStatus,
} from "@/server/services/governance-service";

describe("Governance & Treasury Service", () => {
  const founderWalletId = "wallet-founder";
  const walletId1 = "wallet-1";
  const walletId2 = "wallet-2";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("DAO Management", () => {
    it("should create DAO", async () => {
      const dao = await createDAO(
        "Test DAO",
        "A test DAO",
        founderWalletId,
        "operational",
        "ethereum",
        "0xtoken123",
        "0xtreasuty123",
        7,
        20,
        50
      );

      expect(dao).toBeDefined();
      expect(dao.name).toBe("Test DAO");
      expect(dao.founder_wallet_id).toBe(founderWalletId);
    });

    it("should get DAO details", async () => {
      const created = await createDAO(
        "Fetch DAO",
        undefined,
        founderWalletId,
        "investment",
        "polygon",
        "0xtoken123",
        "0xtreasuty123",
        7,
        20,
        50
      );

      const fetched = await getDAO(created.id);

      expect(fetched.name).toBe("Fetch DAO");
      expect(fetched.dao_type).toBe("investment");
    });

    it("should list all DAOs", async () => {
      await createDAO("DAO 1", undefined, founderWalletId, "operational", "ethereum", "0xtoken1", "0xtreasuty1", 7, 20, 50);
      await createDAO("DAO 2", undefined, founderWalletId, "protocol", "arbitrum", "0xtoken2", "0xtreasuty2", 7, 20, 50);

      const daos = await getAllDAOs();

      expect(daos.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("DAO Membership", () => {
    let daoId: string;

    beforeEach(async () => {
      const dao = await createDAO(
        "Membership Test DAO",
        undefined,
        founderWalletId,
        "operational",
        "ethereum",
        "0xtoken123",
        "0xtreasuty123",
        7,
        20,
        50
      );
      daoId = dao.id;
    });

    it("should add member to DAO", async () => {
      const member = await addDAOMember(daoId, walletId1, "core", "1000000000000000000", "1000000000000000000");

      expect(member).toBeDefined();
      expect(member.member_role).toBe("core");
      expect(member.member_status).toBe("active");
    });

    it("should get DAO members", async () => {
      await addDAOMember(daoId, walletId1, "core", "1000", "1000");
      await addDAOMember(daoId, walletId2, "contributor", "500", "500");

      const members = await getDAOMembers(daoId);

      expect(members.length).toBe(2);
    });

    it("should update member voting power", async () => {
      const member = await addDAOMember(daoId, walletId1, "core", "1000", "1000");

      const updated = await updateMemberVotingPower(member.id, "2000", "2000");

      expect(updated[0].voting_power).toBe("2000");
    });
  });

  describe("Governance Tokens", () => {
    let daoId: string;

    beforeEach(async () => {
      const dao = await createDAO(
        "Token Test DAO",
        undefined,
        founderWalletId,
        "operational",
        "ethereum",
        "0xtoken123",
        "0xtreasuty123",
        7,
        20,
        50
      );
      daoId = dao.id;
    });

    it("should create governance token", async () => {
      const token = await createGovernanceToken(
        daoId,
        "TestDAO Token",
        "TDT",
        "0xtoken123",
        "1000000000000000000",
        18,
        "100"
      );

      expect(token).toBeDefined();
      expect(token.token_symbol).toBe("TDT");
      expect(token.total_supply).toBe("1000000000000000000");
    });

    it("should get token details", async () => {
      const created = await createGovernanceToken(
        daoId,
        "Token",
        "TKN",
        "0xtoken123",
        "100",
        18,
        "50"
      );

      const fetched = await getGovernanceToken(created.id);

      expect(fetched.token_name).toBe("Token");
      expect(fetched.token_price_usd).toBe("50");
    });
  });

  describe("Proposals", () => {
    let daoId: string;

    beforeEach(async () => {
      const dao = await createDAO(
        "Proposal Test DAO",
        undefined,
        founderWalletId,
        "operational",
        "ethereum",
        "0xtoken123",
        "0xtreasuty123",
        7,
        20,
        50
      );
      daoId = dao.id;
    });

    it("should create proposal", async () => {
      const proposal = await createProposal(
        daoId,
        walletId1,
        "Budget Increase",
        "Proposal to increase quarterly budget",
        "parameter_change"
      );

      expect(proposal).toBeDefined();
      expect(proposal.proposalNumber).toBe(1);
      expect(proposal.status).toBe("active");
    });

    it("should get proposal details", async () => {
      const created = await createProposal(
        daoId,
        walletId1,
        "Test Proposal",
        "Test description",
        "treasury_transfer"
      );

      const fetched = await getProposal(created.id);

      expect(fetched.proposal_title).toBe("Test Proposal");
      expect(fetched.proposal_type).toBe("treasury_transfer");
    });

    it("should list DAO proposals", async () => {
      await createProposal(daoId, walletId1, "Proposal 1", "Desc 1", "parameter_change");
      await createProposal(daoId, walletId1, "Proposal 2", "Desc 2", "treasury_transfer");

      const proposals = await getDAOProposals(daoId);

      expect(proposals.length).toBe(2);
    });

    it("should filter proposals by status", async () => {
      const prop1 = await createProposal(daoId, walletId1, "Prop1", "Desc1", "parameter_change");
      await createProposal(daoId, walletId1, "Prop2", "Desc2", "treasury_transfer");

      const active = await getDAOProposals(daoId, "active");

      expect(active.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Voting", () => {
    let daoId: string;
    let proposalId: string;

    beforeEach(async () => {
      const dao = await createDAO(
        "Voting Test DAO",
        undefined,
        founderWalletId,
        "operational",
        "ethereum",
        "0xtoken123",
        "0xtreasuty123",
        7,
        20,
        50
      );
      daoId = dao.id;

      await addDAOMember(daoId, walletId1, "core", "1000", "1000");
      await addDAOMember(daoId, walletId2, "contributor", "500", "500");

      const proposal = await createProposal(
        daoId,
        walletId1,
        "Vote Test",
        "Testing voting",
        "parameter_change"
      );
      proposalId = proposal.id;
    });

    it("should cast vote", async () => {
      const vote = await castVote(proposalId, walletId1, "for", "1000", "Good proposal");

      expect(vote).toBeDefined();
      expect(vote.vote_choice).toBe("for");
      expect(vote.voting_power_used).toBe("1000");
    });

    it("should get proposal votes", async () => {
      await castVote(proposalId, walletId1, "for", "1000");
      await castVote(proposalId, walletId2, "against", "500");

      const votes = await getProposalVotes(proposalId);

      expect(votes.length).toBe(2);
      const forVotes = votes.filter((v) => v.vote_choice === "for");
      expect(forVotes.length).toBe(1);
    });

    it("should support abstain votes", async () => {
      await castVote(proposalId, walletId1, "abstain", "1000");

      const votes = await getProposalVotes(proposalId);

      expect(votes[0].vote_choice).toBe("abstain");
    });
  });

  describe("Vote Delegation", () => {
    let daoId: string;

    beforeEach(async () => {
      const dao = await createDAO(
        "Delegation Test DAO",
        undefined,
        founderWalletId,
        "operational",
        "ethereum",
        "0xtoken123",
        "0xtreasuty123",
        7,
        20,
        50
      );
      daoId = dao.id;
    });

    it("should delegate votes", async () => {
      const delegation = await delegateVotes(
        daoId,
        walletId1,
        walletId2,
        "1000000000000000000"
      );

      expect(delegation).toBeDefined();
      expect(delegation.delegator_wallet_id).toBe(walletId1);
      expect(delegation.delegate_wallet_id).toBe(walletId2);
    });

    it("should get wallet delegations", async () => {
      await delegateVotes(daoId, walletId1, walletId2, "500");

      const delegations = await getWalletDelegations(daoId, walletId1);

      expect(delegations.length).toBeGreaterThan(0);
      expect(delegations[0].delegator_wallet_id).toBe(walletId1);
    });
  });

  describe("Treasury Management", () => {
    let daoId: string;

    beforeEach(async () => {
      const dao = await createDAO(
        "Treasury Test DAO",
        undefined,
        founderWalletId,
        "operational",
        "ethereum",
        "0xtoken123",
        "0xtreasuty123",
        7,
        20,
        50
      );
      daoId = dao.id;
    });

    it("should create treasury account", async () => {
      const account = await createTreasuryAccount(
        daoId,
        "Operational Fund",
        "operational",
        "0xtreasuty123",
        "ethereum",
        true,
        2,
        3
      );

      expect(account).toBeDefined();
      expect(account.account_name).toBe("Operational Fund");
      expect(account.multi_sig_required).toBe(true);
    });

    it("should get treasury accounts", async () => {
      await createTreasuryAccount(daoId, "Fund 1", "operational", "0xaddr1", "ethereum", false);
      await createTreasuryAccount(daoId, "Fund 2", "investment", "0xaddr2", "polygon", true, 2, 2);

      const accounts = await getDAOTreasuryAccounts(daoId);

      expect(accounts.length).toBe(2);
    });

    it("should record treasury transaction", async () => {
      const account = await createTreasuryAccount(
        daoId,
        "Ops",
        "operational",
        "0xtreasuty",
        "ethereum",
        false
      );

      const tx = await recordTreasuryTransaction(
        account.id,
        "deposit",
        "0xsender",
        "0xtreasuty",
        "0xtoken",
        "1000",
        "50000",
        "0xtxhash"
      );

      expect(tx).toBeDefined();
      expect(tx.transaction_type).toBe("deposit");
      expect(tx.status).toBe("confirmed");
    });

    it("should get treasury transactions", async () => {
      const account = await createTreasuryAccount(
        daoId,
        "Ops",
        "operational",
        "0xtreasuty",
        "ethereum",
        false
      );

      await recordTreasuryTransaction(account.id, "deposit", "0x1", "0xtreasuty", "0xtoken", "100", "1000");
      await recordTreasuryTransaction(account.id, "withdrawal", "0xtreasuty", "0x2", "0xtoken", "50", "500");

      const txs = await getTreasuryTransactions(account.id);

      expect(txs.length).toBe(2);
      expect(txs.some((t) => t.transaction_type === "deposit")).toBe(true);
    });
  });

  describe("Treasury Assets", () => {
    let daoId: string;
    let accountId: string;

    beforeEach(async () => {
      const dao = await createDAO(
        "Assets Test DAO",
        undefined,
        founderWalletId,
        "operational",
        "ethereum",
        "0xtoken123",
        "0xtreasuty123",
        7,
        20,
        50
      );
      daoId = dao.id;

      const account = await createTreasuryAccount(
        daoId,
        "Assets",
        "operational",
        "0xtreasuty",
        "ethereum",
        false
      );
      accountId = account.id;
    });

    it("should record treasury asset", async () => {
      const asset = await recordTreasuryAsset(
        accountId,
        "token",
        "0xtoken123",
        "ETH",
        "ETH",
        "100",
        "2000",
        new Date(),
        "200000"
      );

      expect(asset).toBeDefined();
      expect(asset.asset_name).toBe("ETH");
      expect(asset.quantity).toBe("100");
    });

    it("should get treasury assets", async () => {
      await recordTreasuryAsset(
        accountId,
        "token",
        "0xtoken1",
        "Token1",
        "T1",
        "100",
        "100",
        new Date(),
        "10000"
      );
      await recordTreasuryAsset(
        accountId,
        "token",
        "0xtoken2",
        "Token2",
        "T2",
        "50",
        "200",
        new Date(),
        "10000"
      );

      const assets = await getTreasuryAssets(accountId);

      expect(assets.length).toBe(2);
    });

    it("should update asset price", async () => {
      const asset = await recordTreasuryAsset(
        accountId,
        "token",
        "0xtoken",
        "Token",
        "T",
        "100",
        "100",
        new Date(),
        "10000"
      );

      const updated = await updateAssetPrice(asset.id, "150");

      expect(updated[0].unit_price_usd).toBe("150");
      expect(parseFloat(updated[0].total_value_usd) > parseFloat(asset.total_value_usd)).toBe(true);
    });
  });

  describe("Budget & Expenses", () => {
    let daoId: string;
    let categoryId: string;

    beforeEach(async () => {
      const dao = await createDAO(
        "Budget Test DAO",
        undefined,
        founderWalletId,
        "operational",
        "ethereum",
        "0xtoken123",
        "0xtreasuty123",
        7,
        20,
        50
      );
      daoId = dao.id;

      const category = await createBudgetCategory(
        daoId,
        "Operations",
        "10000",
        "30000",
        "120000",
        "Operational expenses"
      );
      categoryId = category.id;
    });

    it("should create budget category", async () => {
      const category = await createBudgetCategory(
        daoId,
        "Marketing",
        "5000",
        "15000",
        "60000"
      );

      expect(category).toBeDefined();
      expect(category.category_name).toBe("Marketing");
      expect(category.monthly_budget_usd).toBe("5000");
    });

    it("should submit expense", async () => {
      const expense = await submitExpense(
        categoryId,
        "Server Costs",
        "1000",
        walletId1,
        "Monthly server expenses"
      );

      expect(expense).toBeDefined();
      expect(expense.expense_name).toBe("Server Costs");
      expect(expense.approval_status).toBe("pending");
    });

    it("should approve expense", async () => {
      const expense = await submitExpense(categoryId, "Expense", "500", walletId1);

      const approved = await approveExpense(expense.id, founderWalletId);

      expect(approved[0].approval_status).toBe("approved");
      expect(approved[0].approved_by).toBe(founderWalletId);
    });

    it("should reject expense", async () => {
      const expense = await submitExpense(categoryId, "Expense", "500", walletId1);

      const rejected = await rejectExpense(expense.id, "Budget exceeded");

      expect(rejected[0].approval_status).toBe("rejected");
      expect(rejected[0].rejection_reason).toBe("Budget exceeded");
    });

    it("should get budget expenses", async () => {
      await submitExpense(categoryId, "Exp1", "100", walletId1);
      await submitExpense(categoryId, "Exp2", "200", walletId1);

      const expenses = await getBudgetExpenses(categoryId);

      expect(expenses.length).toBe(2);
    });
  });

  describe("Governance Reports", () => {
    let daoId: string;

    beforeEach(async () => {
      const dao = await createDAO(
        "Report Test DAO",
        undefined,
        founderWalletId,
        "operational",
        "ethereum",
        "0xtoken123",
        "0xtreasuty123",
        7,
        20,
        50
      );
      daoId = dao.id;
    });

    it("should generate governance report", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      const report = await generateGovernanceReport(
        daoId,
        "monthly",
        startDate,
        endDate
      );

      expect(report).toBeDefined();
      expect(report.report_period).toBe("monthly");
      expect(report.governance_health_score).toBeDefined();
    });
  });

  describe("Governance Status", () => {
    it("should get complete DAO governance status", async () => {
      const dao = await createDAO(
        "Status Test DAO",
        undefined,
        founderWalletId,
        "operational",
        "ethereum",
        "0xtoken123",
        "0xtreasuty123",
        7,
        20,
        50
      );

      await addDAOMember(dao.id, walletId1, "core", "1000", "1000");

      const status = await getDAOGovernanceStatus(dao.id);

      expect(status).toBeDefined();
      expect(status.dao).toBeDefined();
      expect(status.members).toBeDefined();
      expect(status.proposals).toBeDefined();
      expect(status.treasury).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should throw on invalid DAO", async () => {
      await expect(getDAO("invalid-dao")).rejects.toThrow();
    });

    it("should handle empty DAO list gracefully", async () => {
      const daos = await getAllDAOs();
      expect(Array.isArray(daos)).toBe(true);
    });
  });

  describe("Performance", () => {
    it("should handle large proposal voting", async () => {
      const dao = await createDAO(
        "Perf Test DAO",
        undefined,
        founderWalletId,
        "operational",
        "ethereum",
        "0xtoken123",
        "0xtreasuty123",
        7,
        20,
        50
      );

      const proposal = await createProposal(
        dao.id,
        walletId1,
        "Perf Test",
        "Testing performance",
        "parameter_change"
      );

      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        await castVote(
          proposal.id,
          `wallet-${i}`,
          i % 3 === 0 ? "for" : "against",
          "100"
        );
      }

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10000); // < 10 seconds
    });
  });
});
