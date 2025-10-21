
import { Router } from 'express';
import { db } from '../db';
import { authenticate } from '../auth';

const router = Router();

// Link phone number to wallet
router.post('/link-phone', authenticate, async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const userId = req.user!.id;

    // TODO: Send OTP for verification
    // TODO: Store phone-wallet mapping using Celo's attestation service
    
    res.json({ success: true, message: 'OTP sent to phone' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Send payment via phone number
router.post('/send-to-phone', authenticate, async (req, res) => {
  try {
    const { phoneNumber, amount, token } = req.body;
    
    // TODO: Look up wallet address from phone number
    // TODO: Execute transfer
    
    res.json({ success: true, txHash: '0x...' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
