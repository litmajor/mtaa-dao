
import { Router } from 'express';
import { db } from '../db';
import { eq } from 'drizzle-orm';

const router = Router();

// Get all blog posts
router.get('/posts', async (req, res) => {
  try {
    // For now, return sample data - you can integrate with database later
    const posts = [
      {
        id: '1',
        title: 'The Community Playbook: Starting Your First DAO',
        excerpt: 'A step-by-step guide to launching your community DAO in 30 days',
        content: '<h2>Introduction</h2><p>Starting a DAO can seem daunting...</p>',
        author: 'MtaaDAO Team',
        category: 'Guides',
        publishedAt: new Date().toISOString(),
        readTime: 15
      },
      {
        id: '2',
        title: 'From Mtaa, For Mtaa: A Founder\'s Letter',
        excerpt: 'Why we built MtaaDAO and what it means for African communities',
        content: '<h2>Dear Community</h2><p>Economic power starts local...</p>',
        author: 'Founder',
        category: 'Community',
        publishedAt: new Date(Date.now() - 86400000).toISOString(),
        readTime: 8
      },
      {
        id: '3',
        title: 'Understanding Treasury Management',
        excerpt: 'Learn how to manage your DAO treasury effectively',
        content: '<h2>Treasury Basics</h2><p>Your treasury is the heart of your DAO...</p>',
        author: 'Finance Team',
        category: 'Treasury',
        publishedAt: new Date(Date.now() - 172800000).toISOString(),
        readTime: 10
      }
    ];

    res.json(posts);
  } catch (error) {
    console.error('Blog posts fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Get single blog post
router.get('/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Sample post - integrate with database later
    const post = {
      id,
      title: 'The Community Playbook: Starting Your First DAO',
      excerpt: 'A step-by-step guide to launching your community DAO in 30 days',
      content: `
        <h2>Introduction</h2>
        <p>Starting a DAO can seem daunting, but with the right approach, you can launch a thriving community in just 30 days.</p>
        
        <h2>Week 1: Foundation</h2>
        <p>The first week is all about gathering your people and clarifying your purpose...</p>
        
        <h2>Week 2: Launch</h2>
        <p>This is where you move from paper to platform...</p>
        
        <h2>Week 3: Activation</h2>
        <p>Time to activate your treasury and make your first decisions...</p>
        
        <h2>Week 4: Momentum</h2>
        <p>Build sustainable patterns and prepare for growth...</p>
      `,
      author: 'MtaaDAO Team',
      category: 'Guides',
      publishedAt: new Date().toISOString(),
      readTime: 15
    };

    res.json(post);
  } catch (error) {
    console.error('Blog post fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

export default router;
