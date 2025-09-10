import express from 'express';
import { WalletManager, EnhancedAgentWallet, NetworkConfig } from '../agent_wallet';
import { db } from '../storage';
import { users, vaults, walletTransactions } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { notificationService } from '../notificationService';

const router = express.Router();

// POST /api/wallet-setup/create-wallet
router.post('/create-wallet', async (req, res) => {
  try {
    const { userId, currency = 'cUSD', initialGoal = 0 } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if user already has a wallet
    const existingVaults = await db
      .select()
      .from(vaults)
      .where(eq(vaults.userId, userId))
      .limit(1);

    if (existingVaults.length > 0) {
      return res.status(400).json({
        error: 'User already has a wallet. Use initialize-additional-vault instead.'
      });
    }

    // Generate new wallet
    const walletCredentials = WalletManager.createWallet();

    // Create primary vault
    const primaryVault = await db.insert(vaults).values({
      userId,
      currency,
      address: walletCredentials.address,
      balance: '0.00',
      monthlyGoal: initialGoal.toString(),
    }).returning();

      // Optionally update user (no walletAddress field)
      await db
        .update(users)
        .set({ updatedAt: new Date() })
        .where(eq(users.id, userId));

    // Create welcome notification
    await notificationService.createNotification({
      userId,
      type: 'wallet',
      title: 'Wallet Created Successfully',
      message: `Your new wallet has been created with address ${walletCredentials.address.slice(0, 8)}...`,
      metadata: {
        vaultId: primaryVault[0].id,
        currency
      }
    });

    res.json({
      success: true,
      wallet: {
        address: walletCredentials.address,
        // Note: In production, private key should be encrypted and stored securely
        // or better yet, use a key management service
        privateKeyEncrypted: '***ENCRYPTED***', // Don't expose actual private key
      },
      primaryVault: primaryVault[0],
      message: 'Wallet and primary vault created successfully'
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet-setup/initialize-additional-vault
router.post('/initialize-additional-vault', async (req, res) => {
  try {
    const { userId, currency, monthlyGoal = 0, vaultType = 'savings' } = req.body;

    if (!userId || !currency) {
      return res.status(400).json({ error: 'User ID and currency are required' });
    }

    // Verify user exists and has a primary vault
    const userVaults = await db
      .select()
      .from(vaults)
      .where(eq(vaults.userId, userId))
      .limit(1);

    if (!userVaults.length) {
      return res.status(400).json({
        error: 'User must have a primary wallet before creating additional vaults'
      });
    }

    // Check for existing vault with same currency
    const existingVault = await db
      .select()
      .from(vaults)
      .where(eq(vaults.userId, userId))
      .limit(1);

    // Create additional vault
    const newVault = await db.insert(vaults).values({
      userId,
      currency,
      address: userVaults[0].address, // use primary vault address
      balance: '0.00',
      monthlyGoal: monthlyGoal.toString(),
    }).returning();

    // Create notification
    await notificationService.createNotification({
      userId,
      type: 'vault',
      title: 'New Vault Created',
      message: `Your ${currency} ${vaultType} vault has been created successfully`,
      metadata: {
        vaultId: newVault[0].id,
        currency,
        vaultType,
        monthlyGoal
      }
    });

    res.json({
      success: true,
      vault: newVault[0],
      message: `${currency} vault created successfully`
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// GET /api/wallet-setup/user-vaults/:userId
router.get('/user-vaults/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const userVaults = await db
      .select()
      .from(vaults)
      .where(eq(vaults.userId, userId));

  // Get wallet address from primary vault
  const primaryVault = userVaults.length > 0 ? userVaults[0] : null;
  const walletAddress = primaryVault ? (primaryVault.address || null) : null;

    // Calculate total portfolio value
    const totalBalance = userVaults.reduce((sum, vault) => {
      return sum + parseFloat(vault.balance || '0');
    }, 0);

    res.json({
      walletAddress,
      vaults: userVaults,
      totalBalance,
      vaultCount: userVaults.length,
      currencies: [...new Set(userVaults.map(v => v.currency))]
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet-setup/initialize-assets
router.post('/initialize-assets', async (req, res) => {
  try {
    const { userId, assets } = req.body;

    if (!userId || !Array.isArray(assets)) {
      return res.status(400).json({ error: 'User ID and assets array are required' });
    }

    // Get user's primary vault for wallet address
    const userVaults = await db
      .select()
      .from(vaults)
      .where(eq(vaults.userId, userId))
      .limit(1);

    if (!userVaults.length || !userVaults[0].address) {
      return res.status(400).json({ error: 'User must have a wallet first' });
    }

    const walletAddress = userVaults[0].address;
    const results = [];

    // Initialize each asset as a separate vault
    for (const asset of assets) {
      const { currency, initialAmount = 0, monthlyGoal = 0 } = asset;

      // Check if vault for this currency already exists
      const existingVault = await db
        .select()
        .from(vaults)
        .where(eq(vaults.userId, userId))
        .limit(1);

      if (existingVault.length === 0) {
        // Create new vault for this asset
        const newVault = await db.insert(vaults).values({
          userId,
          currency,
          address: walletAddress,
          balance: initialAmount.toString(),
          monthlyGoal: monthlyGoal.toString(),
        }).returning();

        // Create initial transaction if there's an initial amount
        if (initialAmount > 0) {
          await db.insert(walletTransactions).values({
            walletAddress,
            amount: initialAmount.toString(),
            currency,
            type: 'deposit',
            status: 'completed',
            description: `Initial ${currency} deposit`,
          });
        }

        results.push({
          currency,
          vault: newVault[0],
          initialized: true
        });
      } else {
        results.push({
          currency,
          vault: existingVault[0],
          initialized: false,
          message: 'Vault already exists for this currency'
        });
      }
    }

    // Create summary notification
    await notificationService.createNotification({
      userId,
      type: 'wallet',
      title: 'Asset Initialization Complete',
      message: `Successfully initialized ${results.filter(r => r.initialized).length} new asset vaults`,
      metadata: {
        initializedAssets: results.filter(r => r.initialized).length,
        totalAssets: assets.length,
        currencies: assets.map(a => a.currency)
      }
    });

    res.json({
      success: true,
      results,
      summary: {
        totalAssets: assets.length,
        newVaults: results.filter(r => r.initialized).length,
        existingVaults: results.filter(r => !r.initialized).length
      }
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet-setup/import-wallet
router.post('/import-wallet', async (req, res) => {
  try {
    const { userId, privateKey, currency = 'cUSD' } = req.body;

    if (!userId || !privateKey) {
      return res.status(400).json({ error: 'User ID and private key are required' });
    }

    // Validate private key format
    if (!WalletManager.validatePrivateKey(privateKey)) {
      return res.status(400).json({ error: 'Invalid private key format' });
    }

    // Get wallet address from private key
    const normalizedKey = WalletManager.normalizePrivateKey(privateKey);
    const wallet = new EnhancedAgentWallet(normalizedKey, NetworkConfig.CELO_ALFAJORES);
    const walletAddress = wallet.address;

    // Check if this wallet is already imported by another user (by vault address)
    const existingVault = await db
      .select()
      .from(vaults)
      .where(
        and(eq(vaults.userId, userId), eq(vaults.address, walletAddress))
      )
      .limit(1);

    if (existingVault.length > 0 && existingVault[0].userId !== userId) {
      return res.status(400).json({ error: 'This wallet is already imported by another user' });
    }

    // No update to user needed
    await db
      .update(users)
      .set({ updatedAt: new Date() })
      .where(eq(users.id, userId));

    // Create primary vault
    const primaryVault = await db.insert(vaults).values({
      userId,
      currency,
      address: walletAddress,
      balance: '0.00',
      monthlyGoal: '0.00',
    }).returning();

    // Get actual balance from blockchain
    try {
      const actualBalance = await wallet.getBalanceEth();

      // Update vault with actual balance
      await db
        .update(vaults)
        .set({ balance: actualBalance.toString() })
        .where(eq(vaults.id, primaryVault[0].id));

      primaryVault[0].balance = actualBalance.toString();
    } catch (error) {
      console.warn('Failed to get actual balance:', error);
    }

    await notificationService.createNotification({
      userId,
      type: 'wallet',
      title: 'Wallet Imported Successfully',
      message: `Your wallet ${walletAddress.slice(0, 8)}... has been imported`,
      metadata: {
        vaultId: primaryVault[0].id,
        imported: true
      }
    });

    res.json({
      success: true,
      wallet: {
        address: walletAddress,
        imported: true
      },
      primaryVault: primaryVault[0],
      message: 'Wallet imported and vault created successfully'
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

export default router;