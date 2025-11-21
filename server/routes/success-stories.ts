
import { Router } from 'express';
import { db } from '../db';
import { eq, desc } from 'drizzle-orm';
import { successStories } from '../../shared/schema';
import { logger } from '../utils/logger';

const router = Router();

// Submit success story
router.post('/submit', async (req, res) => {
  try {
    const { name, email, title, story, impact, metrics, userId } = req.body;

    // Validate required fields
    if (!name || !email || !title || !story) {
      return res.status(400).json({ error: 'Missing required fields: name, email, title, story' });
    }

    // Insert into database
    const [submittedStory] = await db
      .insert(successStories)
      .values({
        userId: userId || null,
        name,
        email,
        title,
        story,
        impact: impact || null,
        metrics: metrics || null,
        status: 'pending_review',
      })
      .returning();

    logger.info(`Success story submitted: ${title} by ${email} (ID: ${submittedStory.id})`);

    // Send confirmation email to user
    const emailService = new EmailService();
    try {
      await emailService.sendEmail({
        to: email,
        subject: 'Success Story Submission Confirmation',
        html: `
          <h2>Thank You for Sharing Your Story!</h2>
          <p>Hi ${name},</p>
          <p>We've received your success story: \"${title}\"</p>
          <p>Our team will review it within 2-3 business days. We may contact you with any questions or edits.</p>
          <p>Best regards,<br>The MTAA Team</p>
        `
      });
    } catch (err) {
      console.error('Failed to send confirmation email:', err);
    }

    // Notify admin team for review
    try {
      await emailService.sendEmail({
        to: process.env.ADMIN_EMAIL || 'admin@mtaa-dao.com',
        subject: `New Success Story for Review: ${title}`,
        html: `
          <h2>New Success Story Submission</h2>
          <p><strong>Story ID:</strong> ${submittedStory.id}</p>
          <p><strong>Title:</strong> ${title}</p>
          <p><strong>Submitted by:</strong> ${name} (${email})</p>
          <h3>Story:</h3>
          <p>${story.replace(/\n/g, '<br>')}</p>
          ${impact ? `<h3>Impact:</h3><p>${impact}</p>` : ''}
          ${metrics ? `<h3>Metrics:</h3><p>${metrics}</p>` : ''}
          <p><a href=\"${process.env.ADMIN_DASHBOARD_URL}/stories/${submittedStory.id}\">Review & Approve</a></p>
        `
      });
    } catch (err) {
      console.error('Failed to notify admin team:', err);
    }
    // Would send notification to admin dashboard/email

    res.json({
      success: true,
      message: 'Story submitted for review! Our team will review and publish within 48 hours.',
      storyId: submittedStory.id,
      story: submittedStory,
    });
  } catch (error) {
    logger.error('Success story submission error:', error);
    res.status(500).json({ error: 'Failed to submit story' });
  }
});

// Get published success stories
router.get('/published', async (req, res) => {
  try {
    const stories = await db
      .select()
      .from(successStories)
      .where(eq(successStories.status, 'published'))
      .orderBy(desc(successStories.publishedAt));

    res.json({ success: true, stories });
  } catch (error) {
    logger.error('Error fetching published stories:', error);
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

// Get story by ID (public)
router.get('/:storyId', async (req, res) => {
  try {
    const { storyId } = req.params;

    const story = await db
      .select()
      .from(successStories)
      .where(eq(successStories.id, storyId))
      .limit(1);

    if (!story.length || story[0].status !== 'published') {
      return res.status(404).json({ error: 'Story not found' });
    }

    res.json({ success: true, story: story[0] });
  } catch (error) {
    logger.error('Error fetching story:', error);
    res.status(500).json({ error: 'Failed to fetch story' });
  }
});

// Get user's submitted stories
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const stories = await db
      .select()
      .from(successStories)
      .where(eq(successStories.userId, userId))
      .orderBy(desc(successStories.createdAt));

    res.json({ success: true, stories });
  } catch (error) {
    logger.error('Error fetching user stories:', error);
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

export default router;
