# Phase 4: Quick Implementation Guide

## 🚀 Quick Start - Using New Persistence Features

### DAO Settings Example

```typescript
// Add a branding setting for a DAO
await storage.upsertDaoSetting(
  daoId,
  'branding_primary_color',
  '#FF6B6B',
  { 
    settingType: 'color',
    category: 'branding',
    description: 'Primary brand color for DAO UI'
  }
);

// Retrieve all DAO settings
const settings = await storage.getDaoSettings(daoId);

// Get specific setting
const primaryColor = await storage.getDaoSetting(daoId, 'branding_primary_color');

// Update setting
await storage.upsertDaoSetting(daoId, 'branding_primary_color', '#4ECDC4');

// Delete setting
await storage.deleteDaoSetting(daoId, 'branding_primary_color');
```

---

### Task Attachments Example

```typescript
// Upload file to task
const attachment = await storage.attachFileToTask(taskId, {
  fileUrl: 'https://s3.amazonaws.com/...',
  fileName: 'project-proposal.pdf',
  mimeType: 'application/pdf',
  fileSize: 1024000,
  uploadedBy: userId,
  attachmentType: 'document',
  isProof: true, // Mark as proof of completion
});

// Get all attachments for task
const attachments = await storage.getTaskAttachments(taskId);

// Update attachment verification status
await storage.updateAttachmentStatus(attachmentId, 'verified');

// Delete attachment
await storage.deleteTaskAttachment(attachmentId);
```

---

### Wallet Addresses Example

```typescript
// Add wallet for user on Celo chain
const wallet = await storage.addWalletAddress(userId, {
  chainId: 42220, // Celo mainnet
  chainName: 'Celo',
  address: '0x1234567890123456789012345678901234567890',
  addressLabel: 'Main Wallet',
  isPrimary: true,
});

// Get user's wallets
const wallets = await storage.getWalletAddresses(userId);

// Get wallets for specific chain
const celoWallets = await storage.getWalletAddresses(userId, 42220);

// Set primary wallet for chain
await storage.setPrimaryWallet(userId, walletId, 42220);

// Verify wallet ownership
await storage.verifyWalletAddress(walletId, signatureFromUser);

// Delete wallet
await storage.deleteWalletAddress(walletId);
```

---

### Proposal Drafts Example

```typescript
// Save proposal as draft
const draft = await storage.saveProposalDraft({
  title: 'Improve DAO Governance',
  description: 'We should improve governance by...',
  proposalType: 'general',
  proposerId: userId,
  daoId: daoId,
  voteEndTime: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours
  tags: ['governance', 'important'],
  metadata: { category: 'governance' },
});

// List draft proposals
const drafts = await storage.getDraftProposals(daoId, userId);

// Publish draft (moves to voting)
await storage.publishDraft(proposalId, {
  voteStartTime: new Date(),
  voteEndTime: new Date(Date.now() + 72 * 60 * 60 * 1000),
});

// Delete draft
await storage.deleteDraft(proposalId);
```

---

### Vault Balance History Example

```typescript
// Record balance change
const history = await storage.recordBalanceChange(vaultId, {
  balance: 1500.50,
  previousBalance: 1000.00,
  changeReason: 'deposit',
  transactionId: txId,
  userId: userId,
  notes: 'User deposit via wallet',
  tokenSymbol: 'cUSD',
});

// Get balance history
const history = await storage.getBalanceHistory(vaultId, {
  limit: 100,
  offset: 0,
});

// Get vault balance at specific date
const balanceAtDate = await storage.getVaultBalanceAtDate(
  vaultId,
  new Date('2024-01-15')
);

// Get balance change statistics
const stats = await storage.getBalanceChangeStats(vaultId, 30); // Last 30 days
// Returns: { totalDeposits, totalWithdrawals, totalYield, netChange, recordCount }
```

---

## 🔌 Integration with Routes

### DAO Settings Route Example

```typescript
// GET /api/dao/:daoId/settings
app.get('/api/dao/:daoId/settings', async (req, res) => {
  const { daoId } = req.params;
  const settings = await storage.getDaoSettings(daoId);
  res.json(settings);
});

// POST /api/dao/:daoId/settings
app.post('/api/dao/:daoId/settings', async (req, res) => {
  const { daoId } = req.params;
  const { settingKey, settingValue, metadata } = req.body;
  const setting = await storage.upsertDaoSetting(
    daoId,
    settingKey,
    settingValue,
    metadata
  );
  res.json(setting);
});
```

### Task Attachments Route Example

```typescript
// POST /api/tasks/:taskId/attachments
app.post('/api/tasks/:taskId/attachments', uploadMiddleware, async (req, res) => {
  const { taskId } = req.params;
  const { file } = req;
  const attachment = await storage.attachFileToTask(taskId, {
    fileUrl: file.url,
    fileName: file.originalName,
    mimeType: file.mimetype,
    fileSize: file.size,
    uploadedBy: req.user.id,
  });
  res.json(attachment);
});

// GET /api/tasks/:taskId/attachments
app.get('/api/tasks/:taskId/attachments', async (req, res) => {
  const { taskId } = req.params;
  const attachments = await storage.getTaskAttachments(taskId);
  res.json(attachments);
});
```

### Wallet Addresses Route Example

```typescript
// GET /api/users/:userId/wallets
app.get('/api/users/:userId/wallets', async (req, res) => {
  const { userId } = req.params;
  const wallets = await storage.getWalletAddresses(userId);
  res.json(wallets);
});

// POST /api/users/:userId/wallets
app.post('/api/users/:userId/wallets', async (req, res) => {
  const { userId } = req.params;
  const walletData = req.body;
  const wallet = await storage.addWalletAddress(userId, walletData);
  res.json(wallet);
});
```

### Proposal Drafts Route Example

```typescript
// POST /api/dao/:daoId/proposals/draft
app.post('/api/dao/:daoId/proposals/draft', async (req, res) => {
  const { daoId } = req.params;
  const draftData = { ...req.body, daoId, proposerId: req.user.id };
  const draft = await storage.saveProposalDraft(draftData);
  res.json(draft);
});

// GET /api/dao/:daoId/proposals/drafts
app.get('/api/dao/:daoId/proposals/drafts', async (req, res) => {
  const { daoId } = req.params;
  const drafts = await storage.getDraftProposals(daoId, req.user.id);
  res.json(drafts);
});

// POST /api/proposals/:proposalId/publish
app.post('/api/proposals/:proposalId/publish', async (req, res) => {
  const { proposalId } = req.params;
  const published = await storage.publishDraft(proposalId);
  res.json(published);
});
```

### Vault Balance History Route Example

```typescript
// GET /api/vaults/:vaultId/history
app.get('/api/vaults/:vaultId/history', async (req, res) => {
  const { vaultId } = req.params;
  const { limit = 50, offset = 0 } = req.query;
  const history = await storage.getBalanceHistory(vaultId, { 
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
  res.json(history);
});

// GET /api/vaults/:vaultId/stats
app.get('/api/vaults/:vaultId/stats', async (req, res) => {
  const { vaultId } = req.params;
  const { days = 30 } = req.query;
  const stats = await storage.getBalanceChangeStats(vaultId, parseInt(days));
  res.json(stats);
});
```

---

## 🧪 Testing Examples

### Unit Tests

```typescript
import { storage } from './server/storage';

describe('DAO Settings', () => {
  it('should save and retrieve DAO settings', async () => {
    const setting = await storage.upsertDaoSetting(
      'test-dao-id',
      'test-key',
      { value: 'test' }
    );
    expect(setting).toBeDefined();
    expect(setting.settingKey).toBe('test-key');

    const retrieved = await storage.getDaoSetting('test-dao-id', 'test-key');
    expect(retrieved.settingValue).toEqual({ value: 'test' });
  });
});

describe('Task Attachments', () => {
  it('should attach file to task', async () => {
    const attachment = await storage.attachFileToTask('task-id', {
      fileUrl: 'https://example.com/file.pdf',
      fileName: 'test.pdf',
      uploadedBy: 'user-id',
    });
    expect(attachment).toBeDefined();
    expect(attachment.fileName).toBe('test.pdf');

    const attachments = await storage.getTaskAttachments('task-id');
    expect(attachments).toHaveLength(1);
  });
});

describe('Wallet Addresses', () => {
  it('should manage wallet addresses', async () => {
    const wallet = await storage.addWalletAddress('user-id', {
      chainId: 42220,
      chainName: 'Celo',
      address: '0x1234...',
      addressLabel: 'Main',
      isPrimary: true,
    });
    expect(wallet.isPrimary).toBe(true);

    const wallets = await storage.getWalletAddresses('user-id');
    expect(wallets).toContainEqual(expect.objectContaining({
      address: '0x1234...',
    }));
  });
});

describe('Proposal Drafts', () => {
  it('should save and publish draft', async () => {
    const draft = await storage.saveProposalDraft({
      title: 'Test Proposal',
      proposerId: 'user-id',
      daoId: 'dao-id',
      description: 'Test',
    });
    expect(draft.isDraft).toBe(true);
    expect(draft.status).toBe('draft');

    const published = await storage.publishDraft(draft.id);
    expect(published.isDraft).toBe(false);
    expect(published.status).toBe('active');
  });
});

describe('Vault Balance History', () => {
  it('should track balance changes', async () => {
    const change = await storage.recordBalanceChange('vault-id', {
      balance: 1000,
      changeReason: 'deposit',
      userId: 'user-id',
    });
    expect(change).toBeDefined();

    const history = await storage.getBalanceHistory('vault-id');
    expect(history).toContainEqual(expect.objectContaining({
      changeReason: 'deposit',
    }));

    const stats = await storage.getBalanceChangeStats('vault-id', 30);
    expect(stats.totalDeposits).toBeGreaterThan(0);
  });
});
```

---

## 📋 Database Backup

Before deploying, ensure you have database backups:

```bash
# Backup current database
pg_dump mtaa_dao_db > backup_before_phase4.sql

# Deploy migration with new tables
npm run migrate

# If rollback needed
psql mtaa_dao_db < backup_before_phase4.sql
```

---

## ✅ Deployment Checklist

- [ ] Database backups created
- [ ] Migration files created for new tables
- [ ] Tests pass for all new methods
- [ ] Routes integration tested
- [ ] Frontend updated to use new APIs
- [ ] Documentation updated
- [ ] Code review complete
- [ ] Deploy to staging
- [ ] E2E tests pass in staging
- [ ] Deploy to production
- [ ] Monitor error logs
- [ ] Verify data integrity

---

## 🔍 Migration Path

Since these are new tables with no existing data, migrations are straightforward:

```typescript
// If using Drizzle migrations:
// 1. Schema changes already made in schema.ts
// 2. Generate migration: npm run db:generate
// 3. Review migration file
// 4. Run migration: npm run db:push
// 5. Verify tables created
```

---

## 📞 Support

For questions about the new persistence layer:
- Check method signatures in `/server/storage/` files
- Review IStorage interface in `/server/storage/index.ts`
- Reference examples in this guide
- Check storage module docstrings

---

**Phase 4 Complete** ✅
