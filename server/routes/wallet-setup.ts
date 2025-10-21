import express from 'express';
import { WalletManager, EnhancedAgentWallet, NetworkConfig } from '../agent_wallet';
import { db } from '../storage';
import { users, vaults, walletTransactions } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { notificationService } from '../notificationService';
import {
  generateWalletFromMnemonic,
  recoverWalletFromMnemonic,


// POST /api/wallet-setup/create-wallet-mnemonic
router.post('/create-wallet-mnemonic', async (req, res) => {
  try {
    const { userId, currency = 'cUSD', initialGoal = 0, password, wordCount = 12 } = req.body;

    if (!userId || !password) {
      return res.status(400).json({ error: 'User ID and password are required' });
    }

    if (wordCount !== 12 && wordCount !== 24) {
      return res.status(400).json({ error: 'Word count must be 12 or 24' });
    }

    // Check if user already has a wallet
    const existingUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (existingUser.length > 0 && existingUser[0].encryptedWallet) {
      return res.status(400).json({ error: 'User already has a wallet' });
    }

    // Generate wallet with mnemonic
    const walletCredentials = generateWalletFromMnemonic(wordCount);

    // Encrypt wallet data
    const encrypted = encryptWallet(walletCredentials, password);

    // Update user with encrypted wallet
    await db.update(users)
      .set({
        encryptedWallet: encrypted.encryptedData,
        walletSalt: encrypted.salt,
        walletIv: encrypted.iv,
        walletAuthTag: encrypted.authTag,
        hasBackedUpMnemonic: false,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    // Create primary vault
    const primaryVault = await db.insert(vaults).values({
      userId,
      currency,
      address: walletCredentials.address,
      balance: '0.00',
      monthlyGoal: initialGoal.toString(),
    }).returning();

    await notificationService.createNotification({
      userId,
      type: 'wallet',
      title: 'Wallet Created Successfully',
      message: `Your new wallet has been created. Please backup your recovery phrase.`,
      metadata: {
        vaultId: primaryVault[0].id,
        currency
      }
    });

    res.json({
      success: true,
      wallet: {
        address: walletCredentials.address,
        mnemonic: walletCredentials.mnemonic, // Only sent once - client must save
      },
      primaryVault: primaryVault[0],
      message: 'Wallet created successfully. Please backup your recovery phrase immediately.'
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet-setup/backup-confirmed
router.post('/backup-confirmed', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    await db.update(users)
      .set({ hasBackedUpMnemonic: true })
      .where(eq(users.id, userId));

    res.json({ success: true, message: 'Backup confirmation recorded' });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet-setup/recover-wallet
router.post('/recover-wallet', async (req, res) => {
  try {
    const { userId, mnemonic, password, currency = 'cUSD' } = req.body;

    if (!userId || !mnemonic || !password) {
      return res.status(400).json({ error: 'User ID, mnemonic, and password are required' });
    }

    if (!isValidMnemonic(mnemonic)) {
      return res.status(400).json({ error: 'Invalid recovery phrase' });
    }

    // Recover wallet from mnemonic
    const walletCredentials = recoverWalletFromMnemonic(mnemonic);

    // Encrypt wallet data
    const encrypted = encryptWallet(walletCredentials, password);

    // Update user with encrypted wallet
    await db.update(users)
      .set({
        encryptedWallet: encrypted.encryptedData,
        walletSalt: encrypted.salt,
        walletIv: encrypted.iv,
        walletAuthTag: encrypted.authTag,
        hasBackedUpMnemonic: true,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    // Create primary vault
    const primaryVault = await db.insert(vaults).values({
      userId,
      currency,
      address: walletCredentials.address,
      balance: '0.00',
      monthlyGoal: '0.00',
    }).returning();

    await notificationService.createNotification({
      userId,
      type: 'wallet',
      title: 'Wallet Recovered Successfully',
      message: `Your wallet has been recovered from your recovery phrase.`,
      metadata: {
        vaultId: primaryVault[0].id,
        imported: true
      }
    });

    res.json({
      success: true,
      wallet: { address: walletCredentials.address },
      primaryVault: primaryVault[0],
      message: 'Wallet recovered successfully'
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet-setup/import-private-key
router.post('/import-private-key', async (req, res) => {
  try {
    const { userId, privateKey, password, currency = 'cUSD' } = req.body;

    if (!userId || !privateKey || !password) {
      return res.status(400).json({ error: 'User ID, private key, and password are required' });
    }

    // Import wallet from private key
    const walletCredentials = importWalletFromPrivateKey(privateKey);

    // Encrypt wallet data (no mnemonic for imported keys)
    const encrypted = encryptWallet(walletCredentials, password);

    // Update user with encrypted wallet
    await db.update(users)
      .set({
        encryptedWallet: encrypted.encryptedData,
        walletSalt: encrypted.salt,
        walletIv: encrypted.iv,
        walletAuthTag: encrypted.authTag,
        hasBackedUpMnemonic: false,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    // Create primary vault
    const primaryVault = await db.insert(vaults).values({
      userId,
      currency,
      address: walletCredentials.address,
      balance: '0.00',
      monthlyGoal: '0.00',
    }).returning();

    await notificationService.createNotification({
      userId,
      type: 'wallet',
      title: 'Wallet Imported Successfully',
      message: `Your wallet has been imported using a private key.`,
      metadata: {
        vaultId: primaryVault[0].id,
        imported: true
      }
    });

    res.json({
      success: true,
      wallet: { address: walletCredentials.address },
      primaryVault: primaryVault[0],
      message: 'Wallet imported successfully'
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/wallet-setup/unlock-wallet
router.post('/unlock-wallet', async (req, res) => {
  try {
    const { userId, password } = req.body;

    if (!userId || !password) {
      return res.status(400).json({ error: 'User ID and password are required' });
    }

    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    
    if (!user.length || !user[0].encryptedWallet) {
      return res.status(404).json({ error: 'No wallet found for this user' });
    }

    const encrypted = {
      encryptedData: user[0].encryptedWallet,
      salt: user[0].walletSalt!,
      iv: user[0].walletIv!,
      authTag: user[0].walletAuthTag!
    };

    const walletCredentials = decryptWallet(encrypted, password);

    res.json({
      success: true,
      wallet: {
        address: walletCredentials.address,
        privateKey: walletCredentials.privateKey,
        mnemonic: walletCredentials.mnemonic
      },
      message: 'Wallet unlocked successfully'
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg === 'Unsupported state or unable to authenticate data' ? 'Invalid password' : errorMsg });
  }
});

  importWalletFromPrivateKey,
  encryptWallet,
  decryptWallet,
  isValidMnemonic
} from '../utils/cryptoWallet';

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