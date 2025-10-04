
import express, { Request, Response } from 'express';
import { db } from '../db';
import { z } from 'zod';

const router = express.Router();

const eventSchema = z.object({
  title: z.string().min(3),
  description: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  location: z.string(),
  type: z.enum(['meeting', 'workshop', 'social', 'voting', 'other']),
  maxAttendees: z.string().optional()
});

// Mock data store (replace with actual database)
const events: any[] = [];
const rsvps = new Map<string, Set<string>>();

// GET /api/events
router.get('/', async (req: Request, res: Response) => {
  try {
    const enrichedEvents = events.map(event => ({
      ...event,
      attendees: rsvps.get(event.id)?.size || 0
    }));
    res.json(enrichedEvents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/events
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const data = eventSchema.parse(req.body);
    
    const event = {
      id: `event-${Date.now()}`,
      ...data,
      maxAttendees: data.maxAttendees ? parseInt(data.maxAttendees) : undefined,
      status: 'upcoming' as const,
      createdBy: userId,
      createdAt: new Date().toISOString()
    };

    events.push(event);
    rsvps.set(event.id, new Set());

    res.json(event);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/events/:id/rsvp
router.post('/:id/rsvp', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { id } = req.params;
    const event = events.find(e => e.id === id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (!rsvps.has(id)) {
      rsvps.set(id, new Set());
    }

    const attendees = rsvps.get(id)!;
    
    if (event.maxAttendees && attendees.size >= event.maxAttendees) {
      return res.status(400).json({ error: 'Event is full' });
    }

    attendees.add(userId);

    res.json({ success: true, attendees: attendees.size });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
