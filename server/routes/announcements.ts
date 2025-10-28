import { Router } from 'express';
import { db } from '../db';
import { logger } from '../utils/logger';
import { platformAnnouncements, userAnnouncementViews, users } from '../../shared/schema';
import { eq, desc, sql, and, or, gte, isNull, lte } from 'drizzle-orm';
import { requireRole } from '../middleware/rbac';

const router = Router();

// =====================================================
// PUBLIC ANNOUNCEMENTS (FOR ALL USERS)
// =====================================================

// GET /api/announcements - Get active announcements for current user
router.get('/', async (req, res) => {
  try {
    const userId = (req.user as any)?.id; // Optional - works for both auth and unauth users

    // Get current active announcements
    const now = new Date();
    const announcements = await db
      .select({
        id: platformAnnouncements.id,
        title: platformAnnouncements.title,
        message: platformAnnouncements.message,
        type: platformAnnouncements.type,
        priority: platformAnnouncements.priority,
        targetAudience: platformAnnouncements.targetAudience,
        linkUrl: platformAnnouncements.linkUrl,
        linkText: platformAnnouncements.linkText,
        createdAt: platformAnnouncements.createdAt,
      })
      .from(platformAnnouncements)
      .where(
        and(
          eq(platformAnnouncements.isActive, true),
          or(
            isNull(platformAnnouncements.startsAt),
            lte(platformAnnouncements.startsAt, now)
          ),
          or(
            isNull(platformAnnouncements.expiresAt),
            gte(platformAnnouncements.expiresAt, now)
          )
        )
      )
      .orderBy(desc(platformAnnouncements.priority), desc(platformAnnouncements.createdAt));

    // If user is logged in, filter out dismissed announcements
    if (userId) {
      const viewedAnnouncements = await db
        .select({
          announcementId: userAnnouncementViews.announcementId,
          dismissed: userAnnouncementViews.dismissed,
        })
        .from(userAnnouncementViews)
        .where(eq(userAnnouncementViews.userId, userId));

      const dismissedIds = new Set(
        viewedAnnouncements.filter(v => v.dismissed).map(v => v.announcementId)
      );

      // Filter out dismissed announcements
      const filteredAnnouncements = announcements.filter(
        a => !dismissedIds.has(a.id)
      );

      return res.json({ announcements: filteredAnnouncements });
    }

    res.json({ announcements });
  } catch (error) {
    logger.error('Error fetching announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// POST /api/announcements/:id/view - Mark announcement as viewed
router.post('/:id/view', async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    const { id } = req.params;

    // If user is not logged in, just return success (no need to track views for unauth users)
    if (!userId) {
      return res.json({ success: true, message: 'Not authenticated, no tracking needed' });
    }

    // Check if view already exists
    const existing = await db
      .select()
      .from(userAnnouncementViews)
      .where(
        and(
          eq(userAnnouncementViews.userId, userId),
          eq(userAnnouncementViews.announcementId, id)
        )
      );

    if (existing.length === 0) {
      await db.insert(userAnnouncementViews).values({
        userId,
        announcementId: id,
        dismissed: false,
      });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error marking announcement as viewed:', error);
    res.status(500).json({ error: 'Failed to mark as viewed' });
  }
});

// POST /api/announcements/:id/dismiss - Dismiss announcement
router.post('/:id/dismiss', async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    const { id } = req.params;

    // If user is not logged in, just return success (client will handle with localStorage)
    if (!userId) {
      return res.json({ success: true, message: 'Not authenticated, handled client-side' });
    }

    // Upsert the view record with dismissed = true
    const existing = await db
      .select()
      .from(userAnnouncementViews)
      .where(
        and(
          eq(userAnnouncementViews.userId, userId),
          eq(userAnnouncementViews.announcementId, id)
        )
      );

    if (existing.length > 0) {
      await db
        .update(userAnnouncementViews)
        .set({ dismissed: true })
        .where(
          and(
            eq(userAnnouncementViews.userId, userId),
            eq(userAnnouncementViews.announcementId, id)
          )
        );
    } else {
      await db.insert(userAnnouncementViews).values({
        userId,
        announcementId: id,
        dismissed: true,
      });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error dismissing announcement:', error);
    res.status(500).json({ error: 'Failed to dismiss announcement' });
  }
});

// =====================================================
// ADMIN ANNOUNCEMENTS MANAGEMENT
// =====================================================

const requireSuperAdmin = requireRole('super_admin');

// GET /api/announcements/admin/list - List all announcements (admin only)
router.get('/admin/list', requireSuperAdmin, async (req, res) => {
  try {
    const { page = '1', limit = '20', type = '', status = '' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Build where conditions
    const conditions: any[] = [];
    
    if (type && typeof type === 'string') {
      conditions.push(eq(platformAnnouncements.type, type));
    }
    
    if (status === 'active') {
      conditions.push(eq(platformAnnouncements.isActive, true));
    } else if (status === 'inactive') {
      conditions.push(eq(platformAnnouncements.isActive, false));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(platformAnnouncements)
      .where(whereClause);

    const total = totalResult[0].count;

    // Get announcements with creator info
    const announcements = await db
      .select({
        id: platformAnnouncements.id,
        title: platformAnnouncements.title,
        message: platformAnnouncements.message,
        type: platformAnnouncements.type,
        priority: platformAnnouncements.priority,
        isActive: platformAnnouncements.isActive,
        targetAudience: platformAnnouncements.targetAudience,
        linkUrl: platformAnnouncements.linkUrl,
        linkText: platformAnnouncements.linkText,
        startsAt: platformAnnouncements.startsAt,
        expiresAt: platformAnnouncements.expiresAt,
        createdAt: platformAnnouncements.createdAt,
        createdByEmail: users.email,
        createdByName: users.username,
      })
      .from(platformAnnouncements)
      .leftJoin(users, eq(platformAnnouncements.createdBy, users.id))
      .where(whereClause)
      .orderBy(desc(platformAnnouncements.createdAt))
      .limit(parseInt(limit as string))
      .offset(offset);

    // Get view stats for each announcement
    const announcementsWithStats = await Promise.all(
      announcements.map(async (announcement) => {
        const viewStats = await db
          .select({
            totalViews: sql<number>`count(*)`,
            totalDismissed: sql<number>`count(*) FILTER (WHERE ${userAnnouncementViews.dismissed} = true)`,
          })
          .from(userAnnouncementViews)
          .where(eq(userAnnouncementViews.announcementId, announcement.id));

        return {
          ...announcement,
          views: viewStats[0].totalViews,
          dismissed: viewStats[0].totalDismissed,
        };
      })
    );

    res.json({
      announcements: announcementsWithStats,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    logger.error('Error listing announcements:', error);
    res.status(500).json({ error: 'Failed to list announcements' });
  }
});

// POST /api/announcements/admin/create - Create announcement (admin only)
router.post('/admin/create', requireSuperAdmin, async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    const {
      title,
      message,
      type = 'info',
      priority = 0,
      targetAudience = 'all',
      linkUrl,
      linkText,
      startsAt,
      expiresAt,
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    const [announcement] = await db
      .insert(platformAnnouncements)
      .values({
        title,
        message,
        type,
        priority,
        targetAudience,
        linkUrl: linkUrl || null,
        linkText: linkText || null,
        startsAt: startsAt ? new Date(startsAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: userId,
        isActive: true,
      })
      .returning();

    logger.info(`Announcement created: ${announcement.id} by user ${userId}`);
    res.json({ announcement });
  } catch (error) {
    logger.error('Error creating announcement:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

// PUT /api/announcements/admin/:id - Update announcement (admin only)
router.put('/admin/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      message,
      type,
      priority,
      isActive,
      targetAudience,
      linkUrl,
      linkText,
      startsAt,
      expiresAt,
    } = req.body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (message !== undefined) updateData.message = message;
    if (type !== undefined) updateData.type = type;
    if (priority !== undefined) updateData.priority = priority;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (targetAudience !== undefined) updateData.targetAudience = targetAudience;
    if (linkUrl !== undefined) updateData.linkUrl = linkUrl || null;
    if (linkText !== undefined) updateData.linkText = linkText || null;
    if (startsAt !== undefined) updateData.startsAt = startsAt ? new Date(startsAt) : null;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;

    const [announcement] = await db
      .update(platformAnnouncements)
      .set(updateData)
      .where(eq(platformAnnouncements.id, id))
      .returning();

    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    logger.info(`Announcement updated: ${id}`);
    res.json({ announcement });
  } catch (error) {
    logger.error('Error updating announcement:', error);
    res.status(500).json({ error: 'Failed to update announcement' });
  }
});

// DELETE /api/announcements/admin/:id - Delete announcement (admin only)
router.delete('/admin/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await db
      .delete(platformAnnouncements)
      .where(eq(platformAnnouncements.id, id));

    logger.info(`Announcement deleted: ${id}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting announcement:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

export default router;

