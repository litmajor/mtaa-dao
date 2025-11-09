
import { Router } from 'express';

const router = Router();

const blogPosts = [
  {
    id: 'welcome-to-mtaadao',
    title: 'Welcome to MtaaDAO: Building Economic Power in Your Community',
    excerpt: 'Learn how MtaaDAO is transforming community finance across Africa through transparent, blockchain-powered DAOs.',
    content: `
      <h2>The Future of Community Finance is Here</h2>
      <p>MtaaDAO represents a fundamental shift in how communities organize and manage money. No more lost contributions, unclear decisions, or treasurer disputes. Everything is transparent, democratic, and secure.</p>
      
      <h2>What Makes MtaaDAO Different?</h2>
      <ul>
        <li><strong>Transparent Treasury:</strong> Every shilling accounted for on the blockchain</li>
        <li><strong>Democratic Decisions:</strong> One member, one vote (or weighted by contribution)</li>
        <li><strong>Secure by Design:</strong> Multi-signature wallets prevent theft</li>
        <li><strong>Mobile-First:</strong> Pay with M-Pesa, manage via smartphone</li>
      </ul>
      
      <h2>Who is MtaaDAO For?</h2>
      <p>Whether you're a funeral fund, investment chama, farmers cooperative, or creative collective - if you're pooling money with others, MtaaDAO is for you.</p>
      
      <h2>Getting Started is Easy</h2>
      <ol>
        <li>Create an account (30 seconds)</li>
        <li>Start or join a DAO</li>
        <li>Invite members</li>
        <li>Start contributing and voting</li>
      </ol>
      
      <p>Ready to revolutionize your community finance? <a href="/register">Get started today</a>.</p>
    `,
    author: 'MtaaDAO Team',
    category: 'Getting Started',
    publishedAt: new Date().toISOString(),
    readTime: 5,
    featured: true
  },
  {
    id: 'treasury-management-guide',
    title: 'The Complete Guide to DAO Treasury Management',
    excerpt: 'Master the art of managing shared funds transparently and efficiently with our comprehensive treasury guide.',
    content: `
      <h2>Introduction to Treasury Management</h2>
      <p>Your DAO's treasury is its lifeblood. This guide will help you manage it like a pro.</p>
      
      <h2>Treasury Basics</h2>
      <p>Every DAO has a treasury - a shared wallet controlled by members through multi-signature security. No single person can move funds without approval.</p>
      
      <h2>Best Practices</h2>
      <ul>
        <li>Set clear contribution schedules</li>
        <li>Require proposals for withdrawals</li>
        <li>Maintain emergency reserves (10-20% of total)</li>
        <li>Diversify holdings (don't keep everything in one currency)</li>
        <li>Regular financial reporting to members</li>
      </ul>
      
      <h2>Using Vaults for Growth</h2>
      <p>Vaults allow your treasury to earn yield while maintaining liquidity. Learn more in our <a href="/blog/vaults-explained">Vaults Explained</a> article.</p>
    `,
    author: 'Finance Team',
    category: 'Treasury Management',
    publishedAt: new Date(Date.now() - 86400000).toISOString(),
    readTime: 12,
    featured: false
  },
  {
    id: 'how-to-vote-on-proposals',
    title: 'How to Vote on Proposals: A Member\'s Guide',
    excerpt: 'Everything you need to know about voting on proposals and participating in DAO governance.',
    content: `
      <h2>Your Voice Matters</h2>
      <p>Voting is how you shape your DAO's future. Every proposal, from treasury withdrawals to rule changes, requires member approval.</p>
      
      <h2>How Voting Works</h2>
      <ol>
        <li><strong>Proposal Created:</strong> Any member can create a proposal</li>
        <li><strong>Discussion Period:</strong> 24-72 hours for members to discuss</li>
        <li><strong>Voting Period:</strong> 24-168 hours to cast your vote</li>
        <li><strong>Execution:</strong> If passed and quorum met, auto-executes</li>
      </ol>
      
      <h2>Types of Votes</h2>
      <ul>
        <li><strong>Simple Majority:</strong> 50%+ of voters approve</li>
        <li><strong>Supermajority:</strong> 66%+ for major changes</li>
        <li><strong>Quorum Required:</strong> Minimum % of members must vote</li>
      </ul>
      
      <h2>Voting Tips</h2>
      <p>Read proposals carefully, participate in discussions, delegate your vote if you trust another member's judgment, and vote on time!</p>
    `,
    author: 'Governance Team',
    category: 'Governance',
    publishedAt: new Date(Date.now() - 172800000).toISOString(),
    readTime: 8,
    featured: false
  }
];

router.get('/posts', async (req, res) => {
  try {
    res.json(blogPosts);
  } catch (error) {
    console.error('Blog posts fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

router.get('/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const post = blogPosts.find(p => p.id === id);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    res.json(post);
  } catch (error) {
    console.error('Blog post fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

export default router;
