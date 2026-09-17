/**
 * V1 Wallets Balance Router — backed by the internal `accounts` ledger.
 *
 *  Endpoint-by-endpoint honesty check against the internal-ledger decision:
 *
 * - /balance, /balance/multi, /balance/analytics: map cleanly onto `accounts` /
 *   `accountTransactions`. Implemented for real below.
 * - /balance/celo, /balance/cusd: these were written assuming a self-custodial,
 *   on-chain wallet where "CELO balance" and "cUSD balance" are separate on-chain
 *   token reads. In the internal-ledger model, this only makes sense if a user can
 *   hold a `wallet`-type account *denominated* in CELO or cUSD specifically (the
 *   accounts table supports this via `currency`). I've implemented them as "find the
 *   wallet account with this currency" rather than an on-chain read — confirm that's
 *   actually the intended meaning before shipping, since it's a product decision, not
 *   just a technical one.
 * - /balance/network-info: this is inherently an on-chain concept (RPC url, block
 *   number, gas price). It doesn't correspond to anything in the internal ledger.
 *   I've left it returning static Celo network metadata (harmless, informational)
 *   but flagged it — if nothing in the product actually reads/needs this, consider
 *   deleting the endpoint rather than shipping a route that answers a question the
 *   internal-ledger model doesn't have.
 * - /balance/aggregated (POST): this was explicitly built for aggregating balances
 *   across EXTERNAL wallet providers (metamask/valora/minipay) via addresses the
 *   user connected. That's a different feature (external wallet linking) than the
 *   internal ledger — I have not touched this endpoint. If nothing calls it, it's
 *   safe to leave inert for now (still returns 200 with real-looking zeros — see
 *   TODO at that handler; that's the one thing here I'd actively fix or remove
 *   before launch, since it currently returns fabricated-looking data for a feature
 *   that isn't built).
 */

import express, { type Request, type Response } from 'express';
import { isAuthenticated } from '../../../auth';
import { walletOwnershipGuard } from '../../../middleware/walletValidation';
import { db } from '../../../storage';
import { accounts, accountTransactions } from '../../../../shared/accountSchema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { exchangeRateService } from '../../../services/exchangeRateService';
import type { AggregatedBalanceRequest, AggregatedBalanceResponse, ProviderBalance } from '@shared/types/wallet';

const router = express.Router({ mergeParams: true });

/**
 * GET /v1/wallets/:walletId/balance
 * :walletId is the accounts.id (uuid). walletOwnershipGuard is assumed to confirm
 * req.user owns this account — verify that middleware actually checks accountId
 * against req.user.id rather than something else, since this route trusts it fully.
 */
router.get('/:walletId/balance', isAuthenticated, walletOwnershipGuard, async (req: Request, res: Response) => {
  try {
    const { walletId } = req.params;

    const [account] = await db.select().from(accounts).where(eq(accounts.id, walletId)).limit(1);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Wallet account not found', code: 'ACCOUNT_NOT_FOUND' });
    }

    const balance = parseFloat(account.balance);
    const locked = parseFloat(account.locked);

    res.json({
      success: true,
      data: {
        walletId: account.id,
        accountNumber: account.accountNumber,
        currency: account.currency,
        status: account.status,
        balance,
        locked,
        available: balance - locked,
        totalDeposited: parseFloat(account.totalDeposited),
        totalWithdrawn: parseFloat(account.totalWithdrawn),
        totalTransactions: account.totalTransactions,
        lastUpdated: account.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to get balance:', error);
    res.status(400).json({ success: false, error: (error as Error).message, code: 'BALANCE_FETCH_FAILED' });
  }
});

/**
 * GET /v1/wallets/:walletId/balance/multi
 * Returns every 'wallet'-type account this user holds (one per currency),
 * not "addresses" — the original stub's `addresses` query param doesn't apply
 * to an internal ledger, so it's ignored here. If the frontend depends on that
 * param meaning something specific, that call site needs updating too.
 */
router.get('/:walletId/balance/multi', isAuthenticated, walletOwnershipGuard, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const userAccounts = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.accountType, 'wallet')));

    const balances = userAccounts.map((a) => {
      const balance = parseFloat(a.balance);
      const locked = parseFloat(a.locked);
      return {
        walletId: a.id,
        currency: a.currency,
        balance,
        locked,
        available: balance - locked,
      };
    });

    res.json({
      success: true,
      data: {
        balances,
        accountCount: balances.length,
        totalValueUSD: null, // TODO: needs a per-currency USD price feed to sum meaningfully — see priceOracle usage in getAccountBalancesForUserExchange
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to get multi-wallet balance:', error);
    res.status(400).json({ success: false, error: (error as Error).message, code: 'MULTI_BALANCE_FAILED' });
  }
});

/**
 * GET /v1/wallets/:walletId/balance/celo
 * GET /v1/wallets/:walletId/balance/cusd
 * See file header — implemented as "the user's wallet account denominated in this
 * currency," not an on-chain read. Confirm this is actually what these endpoints
 * should mean before relying on them.
 */
async function getBalanceForCurrency(req: Request, res: Response, currency: 'CELO' | 'cUSD') {
  try {
    const userId = (req as any).user?.id;
    const [account] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.accountType, 'wallet'), eq(accounts.currency, currency)))
      .limit(1);

    if (!account) {
      return res.json({
        success: true,
        data: { walletId: req.params.walletId, token: currency, balance: '0', hasAccount: false, lastUpdated: new Date().toISOString() },
      });
    }

    res.json({
      success: true,
      data: {
        walletId: account.id,
        token: currency,
        balance: account.balance,
        hasAccount: true,
        lastUpdated: account.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error(`Failed to get ${currency} balance:`, error);
    res.status(400).json({ success: false, error: (error as Error).message, code: `${currency.toUpperCase()}_BALANCE_FAILED` });
  }
}

router.get('/:walletId/balance/celo', isAuthenticated, walletOwnershipGuard, (req, res) => getBalanceForCurrency(req, res, 'CELO'));
router.get('/:walletId/balance/cusd', isAuthenticated, walletOwnershipGuard, (req, res) => getBalanceForCurrency(req, res, 'cUSD'));

/**
 * GET /v1/wallets/:walletId/balance/exchange-rates
 * Only the KES rate has a real source (exchangeRateService, Mento oracle-backed).
 * cUSD/USDC/USDT are pegged 1:1 to USD by design, which is a reasonable static
 * assumption. CELO itself is NOT stable and has no price source wired here — I'm
 * returning null rather than a fabricated number. If a CELO price is needed,
 * `priceOracle` (imported in accountBalanceService.ts elsewhere in this codebase)
 * looks like the right existing source — wire it here rather than duplicating it.
 */
router.get('/:walletId/balance/exchange-rates', isAuthenticated, walletOwnershipGuard, async (req: Request, res: Response) => {
  try {
    const { walletId } = req.params;
    const kesRate = await exchangeRateService.getUSDtoKESRate();

    res.json({
      success: true,
      data: {
        walletId,
        baseCurrency: 'USD',
        rates: {
          cUSD: 1.0,
          USDC: 1.0,
          USDT: 1.0,
          KES: kesRate,
          CELO: null, // TODO: wire priceOracle — no source for a volatile-asset price here
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to get exchange rates:', error);
    res.status(400).json({ success: false, error: (error as Error).message, code: 'EXCHANGE_RATES_FAILED' });
  }
});

/**
 * GET /v1/wallets/:walletId/balance/network-info
 * See file header — inherently an on-chain concept. Left as static informational
 * metadata; NOT live (no RPC call). If any UI treats this as a live block number /
 * gas price, that's misleading and worth removing rather than leaving half-real.
 */
router.get('/:walletId/balance/network-info', isAuthenticated, walletOwnershipGuard, async (req: Request, res: Response) => {
  const { walletId } = req.params;
  res.json({
    success: true,
    data: {
      walletId,
      network: {
        name: 'Celo',
        chainId: 42220,
        rpcUrl: 'https://forno.celo.org',
        explorerUrl: 'https://celoscan.io',
      },
      note: 'Static metadata only — this internal-ledger wallet is not itself an on-chain read.',
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * GET /v1/wallets/:walletId/balance/analytics
 * Computed from accountTransactions.balanceAfter within the requested period.
 */
router.get('/:walletId/balance/analytics', isAuthenticated, walletOwnershipGuard, async (req: Request, res: Response) => {
  try {
    const { walletId } = req.params;
    const period = (req.query.period as string) || '30d';

    const days = { '7d': 7, '30d': 30, '90d': 90 }[period] ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [account] = await db.select().from(accounts).where(eq(accounts.id, walletId)).limit(1);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Wallet account not found', code: 'ACCOUNT_NOT_FOUND' });
    }

    const txs = await db
      .select()
      .from(accountTransactions)
      .where(and(eq(accountTransactions.accountId, walletId), gte(accountTransactions.createdAt, since)))
      .orderBy(desc(accountTransactions.createdAt));

    const balanceSnapshots = txs
      .map((t) => (t.balanceAfter !== null ? parseFloat(t.balanceAfter) : null))
      .filter((v): v is number => v !== null);

    const currentBalance = parseFloat(account.balance);
    const openingBalance = balanceSnapshots.length > 0 ? balanceSnapshots[balanceSnapshots.length - 1] : currentBalance;
    const highestBalance = balanceSnapshots.length > 0 ? Math.max(...balanceSnapshots, currentBalance) : currentBalance;
    const lowestBalance = balanceSnapshots.length > 0 ? Math.min(...balanceSnapshots, currentBalance) : currentBalance;
    const changePercent = openingBalance !== 0 ? ((currentBalance - openingBalance) / openingBalance) * 100 : 0;

    res.json({
      success: true,
      data: {
        walletId,
        period,
        analytics: {
          highestBalance,
          lowestBalance,
          averageBalance: balanceSnapshots.length > 0 ? balanceSnapshots.reduce((a, b) => a + b, 0) / balanceSnapshots.length : currentBalance,
          totalTransactions: txs.length,
          changePercent: Math.round(changePercent * 100) / 100,
          history: txs.map((t) => ({
            date: t.createdAt.toISOString(),
            type: t.transactionType,
            amount: parseFloat(t.amount),
            balanceAfter: t.balanceAfter ? parseFloat(t.balanceAfter) : null,
          })),
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to get analytics:', error);
    res.status(400).json({ success: false, error: (error as Error).message, code: 'ANALYTICS_FAILED' });
  }
});

/**
 * POST /v1/wallets/balance/aggregated
 * ⚠️ NOT rewired — this is a genuinely different feature (external wallet
 * provider aggregation: MetaMask/Valora/MiniPay balances via connected
 * addresses), separate from the internal ledger. Left untouched from the
 * original stub. Flagging because it currently returns 200 with all-zero
 * balances that LOOK real (correctly-shaped JSON) but aren't — if anything
 * in the frontend calls this expecting real numbers, it's silently wrong.
 * Either wire it to WalletIntegrationService.getWalletPortfolio() (which
 * does read real synced balances per connected wallet) or gate the calling
 * UI off until that's done.
 */
router.post('/balance/aggregated', isAuthenticated, async (req: Request, res: Response) => {
  const body = req.body as AggregatedBalanceRequest;

  if (!body?.userAddress) {
    return res.status(400).json({
      success: false,
      error: 'userAddress is required',
      code: 'INVALID_AGGREGATED_BALANCE_REQUEST',
    });
  }

  const providerBalances: ProviderBalance[] = [
    { providerId: 'metamask', chainId: 1, address: body.userAddress, native: { amount: '0', symbol: 'ETH', valueUSD: '0' }, tokens: [], totalValueUSD: '0' },
    { providerId: 'valora', chainId: 42220, address: body.userAddress, native: { amount: '0', symbol: 'CELO', valueUSD: '0' }, tokens: [], totalValueUSD: '0' },
    { providerId: 'minipay', chainId: 42220, address: body.userAddress, native: { amount: '0', symbol: 'CELO', valueUSD: '0' }, tokens: [], totalValueUSD: '0' },
    { providerId: 'internal', chainId: body.chainId, address: body.userAddress, native: { amount: '0', symbol: 'ETH', valueUSD: '0' }, tokens: [], totalValueUSD: '0' },
  ];

  const totalValueUSD = providerBalances.reduce((total, provider) => total + parseFloat(provider.totalValueUSD || '0'), 0);

  const payload: AggregatedBalanceResponse = {
    totalValueUSD: totalValueUSD.toFixed(2),
    totalValueByCurrency: { USD: totalValueUSD.toFixed(2) },
    breakdown: {
      nativeBalance: { amount: '0', symbol: 'ETH', valueUSD: '0' },
      tokens: [],
      investmentPools: [],
      vaults: [],
      stakingRewards: { totalStaked: '0', totalRewards: '0', valueUSD: '0' },
    },
    providerBalances,
  };

  return res.json({ success: true, data: payload });
});

export default router;