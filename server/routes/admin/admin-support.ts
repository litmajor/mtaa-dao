import { Router } from 'express';
import type { Request, Response } from 'express';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { supportTickets } from '../../../shared/schema';
import { requireRole } from '../../middleware/rbac';
import { notificationService } from '../../notificationService';
import { logConsolidatedAuditEvent } from '../../services/auditConsolidated';
import { logger } from '../../utils/logger';

const router = Router();
const requireSuperAdmin = requireRole('super_admin');
const allowedStatuses = ['open', 'in_progress', 'resolved', 'closed'] as const;
type SupportTicketStatus = typeof allowedStatuses[number];

router.get('/support/tickets', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parseLimit(req.query.limit, 20);
    const status = req.query.status;
    const conditions = status && status !== 'all'
      ? eq(supportTickets.status, String(status))
      : undefined;

    if (status && status !== 'all' && !allowedStatuses.includes(String(status) as SupportTicketStatus)) {
      return res.status(400).json({ error: `Status must be one of: ${allowedStatuses.join(', ')}` });
    }

    const [tickets, countRows] = await Promise.all([
      db.select({
        id: supportTickets.id,
        ticketNumber: supportTickets.ticketNumber,
        userId: supportTickets.userId,
        name: supportTickets.name,
        email: supportTickets.email,
        category: supportTickets.category,
        priority: supportTickets.priority,
        subject: supportTickets.subject,
        message: supportTickets.message,
        status: supportTickets.status,
        createdAt: supportTickets.createdAt,
        updatedAt: supportTickets.updatedAt,
      })
        .from(supportTickets)
        .where(conditions)
        .orderBy(desc(supportTickets.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      db.select({ count: sql<number>`COUNT(*)` }).from(supportTickets).where(conditions),
    ]);

    const total = Number(countRows[0]?.count || 0);
    res.json({
      success: true,
      tickets,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    if (error instanceof InvalidParameterError) {
      return res.status(400).json({ error: error.message });
    }
    logger.error('Admin support ticket list failed', { error });
    res.status(500).json({ error: 'Failed to fetch support tickets' });
  }
});

router.patch('/support/tickets/:ticketId', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;
    const nextStatus = req.body?.status as SupportTicketStatus;
    const adminId = req.user?.claims?.sub || req.user?.id;

    if (!adminId) return res.status(401).json({ error: 'Authentication required' });
    if (!isUuid(ticketId)) return res.status(400).json({ error: 'Invalid ticket ID' });
    if (!allowedStatuses.includes(nextStatus)) {
      return res.status(400).json({ error: `Status must be one of: ${allowedStatuses.join(', ')}` });
    }

    const result = await db.transaction(async tx => {
      const [ticket] = await tx.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
      if (!ticket) throw new TicketNotFoundError();
      const currentStatus: string = ticket.status ?? 'open';
      if (!isValidTransition(currentStatus, nextStatus)) throw new InvalidTransitionError(currentStatus, nextStatus);

      const [updated] = await tx.update(supportTickets)
        .set({ status: nextStatus as string, updatedAt: new Date() })
        .where(and(eq(supportTickets.id, ticketId), eq(supportTickets.status, currentStatus)))
        .returning();
      if (!updated) throw new InvalidTransitionError(currentStatus, nextStatus);
      return { before: ticket, updated };
    });

    if (result.updated.userId) {
      await notificationService.createNotification({
        userId: result.updated.userId,
        type: 'support_ticket_status_changed',
        title: 'Support ticket updated',
        message: `Your support ticket ${formatTicketNumber(result.updated)} is now ${nextStatus.replace('_', ' ')}.`,
        priority: 'medium',
        metadata: { ticketId, status: nextStatus },
      }).catch(error => logger.warn('Failed to notify support ticket owner', { error }));
    }

    await logConsolidatedAuditEvent({
      actorId: adminId,
      actorType: 'super_admin',
      actorRole: 'super_admin',
      actionType: 'SUPPORT_TICKET_STATUS_CHANGED',
      actionCategory: 'admin',
      targetType: 'support_ticket',
      targetId: ticketId,
      result: 'success',
      metadata: { from: result.before.status, to: nextStatus },
    });

    res.json({ success: true, ticket: result.updated });
  } catch (error) {
    if (error instanceof TicketNotFoundError) return res.status(404).json({ error: 'Ticket not found' });
    if (error instanceof InvalidTransitionError) return res.status(409).json({ error: error.message });
    logger.error('Admin support ticket update failed', { error });
    res.status(500).json({ error: 'Failed to update support ticket' });
  }
});

function isValidTransition(current: string | null, next: SupportTicketStatus): boolean {
  const transitions: Record<string, SupportTicketStatus[]> = {
    open: ['in_progress'],
    in_progress: ['resolved'],
    resolved: ['closed'],
    closed: [],
  };
  return transitions[current || 'open']?.includes(next) ?? false;
}

function formatTicketNumber(ticket: { id: string }): string {
  return `MTAA-${ticket.id.substring(0, 8).toUpperCase()}`;
}

function parsePositiveInt(value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new InvalidParameterError('page must be a positive integer');
  return parsed;
}

function parseLimit(value: unknown, fallback: number): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new InvalidParameterError('limit must be a positive integer');
  if (parsed > 100) throw new InvalidParameterError('limit must be between 1 and 100');
  return parsed;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

class InvalidParameterError extends Error {}
class TicketNotFoundError extends Error {}
class InvalidTransitionError extends Error {
  constructor(current: string | null, next: string) {
    super(`Invalid support ticket status transition: ${current || 'open'} -> ${next}`);
  }
}

export default router;
