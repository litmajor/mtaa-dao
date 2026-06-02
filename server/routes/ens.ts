import express from 'express';
import { Logger } from '../utils/logger';
import { ethers } from 'ethers';

const router = express.Router();
const logger = Logger.getLogger();

// GET /api/ens/resolve?identifier=0x... or ens.name
router.get('/resolve', async (req, res) => {
  try {
    const identifier = (req.query.identifier || '').toString();
    if (!identifier) return res.status(400).json({ error: 'identifier query param required' });

    // Basic classification
    const isAddress = /^0x[a-fA-F0-9]{40}$/.test(identifier);
    const looksLikeEns = identifier.includes('.');

    // Try to resolve ENS -> address and lookup contract code
    let address: string | null = null;
    let isContract = false;
    let resolverName: string | null = null;

    try {
      const provider = ethers.getDefaultProvider();
      if (isAddress) {
        address = identifier;
      } else if (looksLikeEns) {
        address = await provider.resolveName(identifier);
        resolverName = 'ens';
      }

      if (address) {
        const code = await provider.getCode(address);
        isContract = !!(code && code !== '0x' && code.length > 2);
      }
    } catch (err) {
      logger.warn('[ENS] resolution failed (continuing with best-effort):', (err as any)?.message || err);
    }

    res.json({
      identifier,
      classification: isAddress ? 'address' : (looksLikeEns ? 'ens' : 'unknown'),
      resolvedAddress: address,
      isContract,
      resolver: resolverName || null,
    });
  } catch (error: any) {
    logger.error('[ENS] resolve error:', error);
    res.status(500).json({ error: 'ENS resolve failed' });
  }
});

export default router;
