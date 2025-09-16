
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { taskTemplates } from '../../shared/schema';
import { eq, like, desc } from 'drizzle-orm';
import { isAuthenticated } from '../nextAuthMiddleware';

const router = Router();

const createTaskTemplateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  category: z.string().min(1),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
  estimatedHours: z.number().min(1).max(1000),
  requiredSkills: z.array(z.string()).optional(),
  bountyAmount: z.number().min(0),
  deliverables: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
});

// Get all task templates
router.get('/', async (req, res) => {
  try {
    const { category, difficulty, search } = req.query;
    
    let query = db.select().from(taskTemplates);
    
    if (category) {
      query = query.where(eq(taskTemplates.category, category as string));
    }
    
    if (difficulty) {
      query = query.where(eq(taskTemplates.difficulty, difficulty as string));
    }
    
    if (search) {
      query = query.where(like(taskTemplates.title, `%${search}%`));
    }
    
    const templates = await query.orderBy(desc(taskTemplates.createdAt));
    
    res.json({ templates });
  } catch (error) {
    console.error('Error fetching task templates:', error);
    res.status(500).json({ error: 'Failed to fetch task templates' });
  }
});

// Get specific task template
router.get('/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    
    const template = await db
      .select()
      .from(taskTemplates)
      .where(eq(taskTemplates.id, templateId))
      .limit(1);
    
    if (template.length === 0) {
      return res.status(404).json({ error: 'Task template not found' });
    }
    
    res.json({ template: template[0] });
  } catch (error) {
    console.error('Error fetching task template:', error);
    res.status(500).json({ error: 'Failed to fetch task template' });
  }
});

// Create new task template (authenticated users only)
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const validatedData = createTaskTemplateSchema.parse(req.body);
    const userId = req.user?.id;
    
    const newTemplate = await db
      .insert(taskTemplates)
      .values({
        ...validatedData,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    
    res.status(201).json({ template: newTemplate[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error creating task template:', error);
    res.status(500).json({ error: 'Failed to create task template' });
  }
});

// Update task template (creator only)
router.put('/:templateId', isAuthenticated, async (req, res) => {
  try {
    const { templateId } = req.params;
    const userId = req.user?.id;
    const validatedData = createTaskTemplateSchema.partial().parse(req.body);
    
    // Check if user is the creator
    const template = await db
      .select()
      .from(taskTemplates)
      .where(eq(taskTemplates.id, templateId))
      .limit(1);
    
    if (template.length === 0) {
      return res.status(404).json({ error: 'Task template not found' });
    }
    
    if (template[0].createdBy !== userId) {
      return res.status(403).json({ error: 'Not authorized to update this template' });
    }
    
    const updatedTemplate = await db
      .update(taskTemplates)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(taskTemplates.id, templateId))
      .returning();
    
    res.json({ template: updatedTemplate[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error updating task template:', error);
    res.status(500).json({ error: 'Failed to update task template' });
  }
});

// Delete task template (creator only)
router.delete('/:templateId', isAuthenticated, async (req, res) => {
  try {
    const { templateId } = req.params;
    const userId = req.user?.id;
    
    // Check if user is the creator
    const template = await db
      .select()
      .from(taskTemplates)
      .where(eq(taskTemplates.id, templateId))
      .limit(1);
    
    if (template.length === 0) {
      return res.status(404).json({ error: 'Task template not found' });
    }
    
    if (template[0].createdBy !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this template' });
    }
    
    await db
      .delete(taskTemplates)
      .where(eq(taskTemplates.id, templateId));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting task template:', error);
    res.status(500).json({ error: 'Failed to delete task template' });
  }
});

export default router;
