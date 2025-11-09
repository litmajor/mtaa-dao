
import { Router } from 'express';
import { db } from '../db';
import { eq } from 'drizzle-orm';

const router = Router();

// Submit support ticket
router.post('/tickets', async (req, res) => {
  try {
    const { name, email, category, priority, subject, message } = req.body;

    // In production, this would save to a support_tickets table
    // For now, log it and send confirmation
    console.log('Support ticket received:', {
      name, email, category, priority, subject, message,
      timestamp: new Date()
    });

    // TODO: Send email notification to support team
    // TODO: Save to database
    // TODO: Create ticket ID

    res.json({
      success: true,
      ticketId: `MTAA-${Date.now()}`,
      message: 'Ticket submitted successfully'
    });
  } catch (error) {
    console.error('Support ticket error:', error);
    res.status(500).json({ error: 'Failed to submit ticket' });
  }
});

export default router;
