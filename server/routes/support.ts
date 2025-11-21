
import { Router } from 'express';
import { db } from '../db';
import { eq, desc } from 'drizzle-orm';
import { supportTickets } from '../../shared/schema';
import { logger } from '../utils/logger';

const router = Router();

// Submit support ticket
router.post('/tickets', async (req, res) => {
  try {
    const { name, email, category, priority, subject, message, userId } = req.body;

    // Validate required fields
    if (!name || !email || !category || !subject || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Insert into database
    const [ticket] = await db
      .insert(supportTickets)
      .values({
        userId: userId || null,
        name,
        email,
        category,
        priority: priority || 'medium',
        subject,
        message,
        status: 'open',
      })
      .returning();

    // Generate unique ticket number
    const ticketNumber = `MTAA-${ticket.id?.toString().substring(0, 8).toUpperCase()}`;

    logger.info(`Support ticket created: ${ticketNumber} by ${email}`);

    // Send email notification to support team
    const emailService = new EmailService(); // Initialize email service (SendGrid, Resend, etc)
    try {
      await emailService.sendEmail({
        to: process.env.SUPPORT_EMAIL || 'support@mtaa-dao.com',
        subject: `[${priority.toUpperCase()}] New Support Ticket: ${subject}`,
        html: `
          <h2>New Support Ticket</h2>
          <p><strong>Ticket ID:</strong> ${ticketNumber}</p>
          <p><strong>From:</strong> ${name} (${email})</p>
          <p><strong>Category:</strong> ${category}</p>
          <p><strong>Priority:</strong> ${priority}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <h3>Message:</h3>
          <p>${message.replace(/\n/g, '<br>')}</p>
        `
      });
    } catch (err) {
      console.error('Failed to send support notification email:', err);
      // Don't fail the entire request if email fails
    }

    res.json({
      success: true,
      ticketId: ticketNumber,
      message: 'Ticket submitted successfully. Our team will respond within 24 hours.',
      ticket,
    });
  } catch (error) {
    logger.error('Support ticket error:', error);
    res.status(500).json({ error: 'Failed to submit ticket' });
  }
});

// Get support ticket by ID
router.get('/tickets/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticket = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, ticketId))
      .limit(1);

    if (!ticket.length) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json({ success: true, ticket: ticket[0] });
  } catch (error) {
    logger.error('Error fetching ticket:', error);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

// Get user's support tickets
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const tickets = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.userId, userId))
      .orderBy(desc(supportTickets.createdAt));

    res.json({ success: true, tickets });
  } catch (error) {
    logger.error('Error fetching user tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

export default router;
