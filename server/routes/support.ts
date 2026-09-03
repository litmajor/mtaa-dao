
import { Router } from 'express';
import { db } from '../db';
import { eq, desc } from 'drizzle-orm';
import { supportTickets } from '../../shared/schema';
import { logger } from '../utils/logger';
import { EmailService } from '../services/emailService';
import { notificationService } from '../notificationService';
import { authenticate } from '../auth';

const router = Router();

// Submit support ticket
router.post('/tickets', authenticate, async (req, res) => {
  try {
    const { name, email, category, subject, message } = req.body;
    const priority = req.body.priority || 'medium';
    const authenticatedUserId = String(req.user?.id || '');

    // Validate required fields
    if (!authenticatedUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (![name, email, category, subject, message].every(value => typeof value === 'string' && value.trim().length > 0) ||
        !['low', 'medium', 'high', 'urgent'].includes(priority)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Insert into database
    const [ticket] = await db
      .insert(supportTickets)
      .values({
        userId: authenticatedUserId,
        name,
        email,
        category,
        priority: priority || 'medium',
        subject,
        message,
        status: 'open',
      })
      .returning();
    if (!ticket) {
      return res.status(500).json({ error: 'Failed to create support ticket' });
    }

    // Generate unique ticket number
    const ticketNumber = `MTAA-${ticket.id.toString().substring(0, 8).toUpperCase()}`;

    logger.info(`Support ticket created: ${ticketNumber} by ${email}`);

    await notificationService.createNotification({
      userId: authenticatedUserId,
      type: 'support_ticket_created',
      title: 'Support ticket submitted',
      message: `Your support ticket ${ticketNumber} was received.`,
      priority: 'medium',
      metadata: { ticketId: ticket.id, ticketNumber },
    }).catch(error => logger.warn('Failed to create support ticket notification', { error }));

    // Send email notification to support team
    try {
      await EmailService.send({
        to: process.env.SUPPORT_EMAIL || 'support@mtaa-dao.com',
        subject: `[${priority.toUpperCase()}] New Support Ticket: ${subject}`,
        html: `
          <h2>New Support Ticket</h2>
          <p><strong>Ticket ID:</strong> ${ticketNumber}</p>
          <p><strong>From:</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p>
          <p><strong>Category:</strong> ${escapeHtml(category)}</p>
          <p><strong>Priority:</strong> ${priority}</p>
          <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
          <h3>Message:</h3>
          <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
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
router.get('/tickets/:ticketId', authenticate, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const authenticatedUserId = String(req.user?.id || '');
    if (!authenticatedUserId) return res.status(401).json({ error: 'Authentication required' });
    if (!isUuid(ticketId)) return res.status(400).json({ error: 'Invalid ticket ID' });

    const ticket = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, ticketId))
      .limit(1);

    if (!ticket.length || ticket[0].userId !== authenticatedUserId) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json({ success: true, ticket: ticket[0] });
  } catch (error) {
    logger.error('Error fetching ticket:', error);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

// Get user's support tickets
router.get('/user/:userId', authenticate, async (req, res) => {
  try {
    const authenticatedUserId = String(req.user?.id || '');
    if (!authenticatedUserId) return res.status(401).json({ error: 'Authentication required' });

    const tickets = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.userId, authenticatedUserId))
      .orderBy(desc(supportTickets.createdAt));

    res.json({ success: true, tickets });
  } catch (error) {
    logger.error('Error fetching user tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

export default router;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
