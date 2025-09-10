
import express from 'express';
import { z } from 'zod';

const router = express.Router();

// Task template schema
const taskTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  estimatedTime: z.string().optional(),
  requiresVerification: z.boolean().default(false),
  suggestedReward: z.number().positive().optional(),
  checklistItems: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional()
});

// Predefined task templates
const defaultTemplates = [
  {
    id: 'frontend-component',
    name: 'Frontend Component Development',
    description: 'Create a reusable React component with proper styling and functionality',
    category: 'Frontend Development',
    difficulty: 'medium',
    estimatedTime: '2-4 hours',
    requiresVerification: true,
    suggestedReward: 150,
    checklistItems: [
      'Component renders correctly',
      'Props are properly typed',
      'Responsive design implemented',
      'Accessibility features included',
      'Unit tests written'
    ],
    tags: ['react', 'typescript', 'ui/ux']
  },
  {
    id: 'api-endpoint',
    name: 'API Endpoint Implementation',
    description: 'Develop a new API endpoint with proper validation and error handling',
    category: 'Backend Development',
    difficulty: 'medium',
    estimatedTime: '3-5 hours',
    requiresVerification: true,
    suggestedReward: 200,
    checklistItems: [
      'Endpoint follows RESTful conventions',
      'Input validation implemented',
      'Error handling in place',
      'Database queries optimized',
      'API documentation updated'
    ],
    tags: ['api', 'backend', 'database']
  },
  {
    id: 'documentation',
    name: 'Technical Documentation',
    description: 'Write comprehensive documentation for a feature or API',
    category: 'Documentation',
    difficulty: 'easy',
    estimatedTime: '1-2 hours',
    requiresVerification: false,
    suggestedReward: 75,
    checklistItems: [
      'Clear and concise writing',
      'Code examples included',
      'Proper formatting and structure',
      'Screenshots or diagrams where helpful'
    ],
    tags: ['documentation', 'writing']
  },
  {
    id: 'bug-fix',
    name: 'Bug Fix',
    description: 'Identify and fix a reported bug with proper testing',
    category: 'Development',
    difficulty: 'varies',
    estimatedTime: '1-4 hours',
    requiresVerification: true,
    suggestedReward: 100,
    checklistItems: [
      'Bug reproduced and understood',
      'Root cause identified',
      'Fix implemented and tested',
      'Regression tests added',
      'Code review completed'
    ],
    tags: ['bugfix', 'testing']
  },
  {
    id: 'smart-contract',
    name: 'Smart Contract Development',
    description: 'Develop and deploy a smart contract with security considerations',
    category: 'Smart Contract',
    difficulty: 'hard',
    estimatedTime: '1-2 days',
    requiresVerification: true,
    suggestedReward: 500,
    checklistItems: [
      'Contract logic implemented correctly',
      'Security audit completed',
      'Gas optimization performed',
      'Comprehensive tests written',
      'Deployment scripts created'
    ],
    tags: ['solidity', 'blockchain', 'security']
  },
  {
    id: 'ui-design',
    name: 'UI/UX Design',
    description: 'Create user interface designs and prototypes',
    category: 'Design',
    difficulty: 'medium',
    estimatedTime: '2-3 hours',
    requiresVerification: true,
    suggestedReward: 125,
    checklistItems: [
      'User-centered design approach',
      'Consistent with brand guidelines',
      'Responsive design considerations',
      'Accessibility standards met',
      'Prototype or mockup delivered'
    ],
    tags: ['design', 'ui/ux', 'figma']
  }
];

// Get all task templates
router.get('/', async (req, res) => {
  try {
    const { category, difficulty } = req.query;
    
    let templates = defaultTemplates;
    
    if (category) {
      templates = templates.filter(t => t.category === category);
    }
    
    if (difficulty) {
      templates = templates.filter(t => t.difficulty === difficulty);
    }
    
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Get specific template
router.get('/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    const template = defaultTemplates.find(t => t.id === templateId);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Create task from template
router.post('/:templateId/create', async (req, res) => {
  try {
    const { templateId } = req.params;
    const { daoId, customizations = {} } = req.body;
    const userId = req.user?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const template = defaultTemplates.find(t => t.id === templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Merge template with customizations
    const taskData = {
      title: customizations.title || template.name,
      description: customizations.description || template.description,
      category: customizations.category || template.category,
      difficulty: customizations.difficulty || template.difficulty,
      estimatedTime: customizations.estimatedTime || template.estimatedTime,
      requiresVerification: customizations.requiresVerification ?? template.requiresVerification,
      reward: customizations.reward || template.suggestedReward || 100,
      daoId,
      creatorId: userId,
      status: 'open'
    };
    
    // Create the task using existing endpoint logic
    const { db } = await import('../storage');
    const { tasks } = await import('../../shared/schema');
    
    const task = await db.insert(tasks).values(taskData).returning();
    
    res.status(201).json({
      success: true,
      task: task[0],
      template: template.name
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
