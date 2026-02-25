import express, { Request, Response } from 'express';
import EnhancedAgentWallet, { NetworkConfig, DaoTreasuryManager } from '../agent_wallet';
import { isAuthenticated } from '../nextAuthMiddleware';
import { storage } from '../storage';

const router = express.Router();

// --- DAO Treasury: Monitor Treasury Balances ---
router.get('/:daoId/balance', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const dao = await storage.getDao(daoId);
    if (!dao || !dao.treasuryPrivateKey) {
      return res.status(404).json({ message: 'DAO or treasury wallet not found' });
    }
    const config = NetworkConfig.CELO_ALFAJORES; // TODO: Make dynamic
    // Mock price oracle for demonstration
    const mockPriceOracle = async (tokenAddress: string): Promise<number> => {
      const prices: Record<string, number> = {
        'native': 2500, // ETH price
        '0x...': 1.0 // USDC price
      };
      return prices[tokenAddress] || 0;
    };
    const wallet = new EnhancedAgentWallet(
      dao.treasuryPrivateKey,
      config,
      undefined,
      undefined,
      undefined,
      mockPriceOracle
    );
    // Use DaoTreasuryManager for advanced snapshot
    const treasuryManager = new DaoTreasuryManager(wallet, dao.treasuryAddress, dao.allowedTokens || []);
    const snapshot = await treasuryManager.getTreasurySnapshot();
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// --- DAO Treasury: Transfer Native Token ---
router.post('/:daoId/transfer/native', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const { toAddress, amount } = req.body;
    const dao = await storage.getDao(daoId);
    if (!dao || !dao.treasuryPrivateKey) {
      return res.status(404).json({ message: 'DAO or treasury wallet not found' });
    }
    const config = NetworkConfig.CELO_ALFAJORES;
    const mockPriceOracle = async (tokenAddress: string): Promise<number> => {
      const prices: Record<string, number> = {
        'native': 2500,
        '0x...': 1.0
      };
      return prices[tokenAddress] || 0;
    };
    const wallet = new EnhancedAgentWallet(
      dao.treasuryPrivateKey,
      config,
      undefined,
      undefined,
      undefined,
      mockPriceOracle
    );
    const tx = await wallet.sendNativeToken(toAddress, amount);
    res.json({ tx });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// --- DAO Treasury: Transfer ERC-20 Token ---
router.post('/:daoId/transfer/token', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const { tokenAddress, toAddress, amount } = req.body;
    const dao = await storage.getDao(daoId);
    if (!dao || !dao.treasuryPrivateKey) {
      return res.status(404).json({ message: 'DAO or treasury wallet not found' });
    }
    const config = NetworkConfig.CELO_ALFAJORES;
    const mockPriceOracle = async (tokenAddress: string): Promise<number> => {
      const prices: Record<string, number> = {
        'native': 2500,
        '0x...': 1.0
      };
      return prices[tokenAddress] || 0;
    };
    const wallet = new EnhancedAgentWallet(
      dao.treasuryPrivateKey,
      config,
      undefined,
      undefined,
      undefined,
      mockPriceOracle
    );
    const tx = await wallet.sendTokenHuman(tokenAddress, toAddress, amount);
    res.json({ tx });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// --- DAO Treasury: Automate Payouts/Grants/Bounties ---
router.post('/:daoId/automation/payout', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const { payouts } = req.body; // [{ toAddress, amount, tokenAddress? }]
    const dao = await storage.getDao(daoId);
    if (!dao || !dao.treasuryPrivateKey) {
      return res.status(404).json({ message: 'DAO or treasury wallet not found' });
    }
    const config = NetworkConfig.CELO_ALFAJORES;
    const mockPriceOracle = async (tokenAddress: string): Promise<number> => {
      const prices: Record<string, number> = {
        'native': 2500,
        '0x...': 1.0
      };
      return prices[tokenAddress] || 0;
    };
    const wallet = new EnhancedAgentWallet(
      dao.treasuryPrivateKey,
      config,
      undefined,
      undefined,
      undefined,
      mockPriceOracle
    );
    // Use batchTransfer for payouts
    const results = await wallet.batchTransfer(payouts);
    res.json({ results });

// --- DAO Treasury: Advanced Snapshot & Report ---
router.get('/:daoId/snapshot', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const dao = await storage.getDao(daoId);
    if (!dao || !dao.treasuryPrivateKey) {
      return res.status(404).json({ message: 'DAO or treasury wallet not found' });
    }
    const config = NetworkConfig.CELO_ALFAJORES;
    const mockPriceOracle = async (tokenAddress: string): Promise<number> => {
      const prices: Record<string, number> = {
        'native': 2500,
        '0x...': 1.0
      };
      return prices[tokenAddress] || 0;
    };
    const wallet = new EnhancedAgentWallet(
      dao.treasuryPrivateKey,
      config,
      undefined,
      undefined,
      undefined,
      mockPriceOracle
    );
    const treasuryManager = new DaoTreasuryManager(wallet, dao.treasuryAddress, dao.allowedTokens || []);
    const snapshot = await treasuryManager.getTreasurySnapshot();
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// --- DAO Treasury: Generate Report ---
router.get('/:daoId/report', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const { period } = req.query;
    const dao = await storage.getDao(daoId);
    if (!dao || !dao.treasuryPrivateKey) {
      return res.status(404).json({ message: 'DAO or treasury wallet not found' });
    }
    const config = NetworkConfig.CELO_ALFAJORES;
    const mockPriceOracle = async (tokenAddress: string): Promise<number> => {
      const prices: Record<string, number> = {
        'native': 2500,
        '0x...': 1.0
      };
      return prices[tokenAddress] || 0;
    };
    const wallet = new EnhancedAgentWallet(
      dao.treasuryPrivateKey,
      config,
      undefined,
      undefined,
      undefined,
      mockPriceOracle
    );
    const treasuryManager = new DaoTreasuryManager(wallet, dao.treasuryAddress, dao.allowedTokens || []);
    const report = await treasuryManager.generateTreasuryReport((period as any) || 'monthly');
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
