/**
 * Personas API Routes
 *
 * Endpoints for persona management and progress tracking
 */

import { Router } from 'express';
import {
  getUserPersona,
  setUserPersona,
  getAllPersonas,
  getPersonaDetails,
  getPersonaUnlockPath,
  isFeaturePrioritized,

  getUserActiveSubprofile,
  setActiveSubprofile
} from '../services/personaService';
import { checkFeatureGating, GATING_RULES } from '../services/gatingService';
import { db } from '../db';
import type { User } from '../../shared/schema';

const router = Router();

/**
 * GET /api/personas
 * Get all available personas with descriptions
 */
router.get('/', (req, res) => {
  try {
    const personas = getAllPersonas().map(p => ({
      id: p.id,
      name: p.name,
      role: p.role,
      description: p.description,
      icon: p.icon,
      color: p.color,
      focusAreas: p.focusAreas
    }));

    res.json(personas);
  } catch (error) {
    console.error('Failed to get personas:', error);
    res.status(500).json({ error: 'Failed to fetch personas' });
  }
});

/**
 * GET /api/personas/current
 * Get current user's persona
 * SECURITY: Requires authentication
 */
import { isAuthenticated } from '../auth';
router.get('/current', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const persona = await getUserPersona(userId);
    const details = persona ? getPersonaDetails(persona) : null;

    res.json({
      persona,
      details
    });
  } catch (error) {
    console.error('Failed to get current persona:', error);
    res.status(500).json({ error: 'Failed to fetch current persona' });
  }
});

/**
 * POST /api/personas/select
 * Set user's persona (typically at signup)
 * SECURITY: Requires authentication
 */
router.post('/select', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { persona } = req.body;
    if (!persona) {
      return res.status(400).json({ error: 'Missing persona' });
    }

    const success = await setUserPersona(userId, persona);
    if (!success) {
      return res.status(400).json({ error: 'Invalid persona' });
    }

    const details = getPersonaDetails(persona);
    res.json({
      success: true,
      persona,
      details
    });
  } catch (error) {
    console.error('Failed to set persona:', error);
    res.status(500).json({ error: 'Failed to set persona' });
  }
});

/**
 * GET /api/personas/progress
 * Get user's feature unlock progress for their persona
 */
router.get('/progress', async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const persona = await getUserPersona(userId);
    if (!persona) {
      return res.json({
        persona: null,
        selectedFeatures: [],
        progress: []
      });
    }

    // Get user from database to check gating status
    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId)
    }) as User;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get persona-specific unlock path
    const unlockPath = getPersonaUnlockPath(persona);

    // Check gating status for each feature
    const progress = await Promise.all(
      unlockPath.map(async (featureKey) => {
        const gatingStatus = await checkFeatureGating(featureKey, user);
        const rule = GATING_RULES[featureKey];

        return {
          feature: featureKey,
          name: rule?.explanation || featureKey,
          isAvailable: gatingStatus.isAvailable,
          reason: gatingStatus.reason,
          daysUntilAvailable: gatingStatus.daysUntilAvailable,
          amountNeeded: gatingStatus.amountNeeded,
          currency: gatingStatus.currency,
          priority: unlockPath.indexOf(featureKey) + 1
        };
      })
    );

    const available = progress.filter(p => p.isAvailable).length;
    const total = progress.length;
    const percentage = Math.round((available / total) * 100);

    res.json({
      persona,
      personaName: getPersonaDetails(persona)?.name,
      totalFeatures: total,
      unlockedFeatures: available,
      progressPercentage: percentage,
      nextMilestone: progress.find(p => !p.isAvailable),
      progress
    });
  } catch (error) {
    console.error('Failed to get progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

/**
 * GET /api/personas/next-milestone
 * Get next feature unlock for user based on persona
 */
router.get('/next-milestone', async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const persona = await getUserPersona(userId);
    if (!persona) {
      return res.json({ nextMilestone: null });
    }

    // Get user
    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId)
    }) as User;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get first locked feature from persona's unlock path
    const unlockPath = getPersonaUnlockPath(persona);
    
    for (const featureKey of unlockPath) {
      const gatingStatus = await checkFeatureGating(featureKey, user);
      
      if (!gatingStatus.isAvailable) {
        const rule = GATING_RULES[featureKey];
        return res.json({
          feature: featureKey,
          name: rule?.explanation || featureKey,
          reason: gatingStatus.reason,
          daysUntilAvailable: gatingStatus.daysUntilAvailable,
          amountNeeded: gatingStatus.amountNeeded,
          currency: gatingStatus.currency,
          personaAdvice: getPersonaAdviceForFeature(persona, featureKey)
        });
      }
    }

    // All features unlocked!
    res.json({
      nextMilestone: null,
      message: 'All features unlocked for your persona!'
    });
  } catch (error) {
    console.error('Failed to get next milestone:', error);
    res.status(500).json({ error: 'Failed to fetch next milestone' });
  }
});

/**
 * GET /api/personas/subprofile/active
 * Get user's currently active subprofile
 * (Subprofiles are personas that users can switch between anytime)
 */
router.get('/subprofile/active', async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const activeSubprofile = await getUserActiveSubprofile(userId);
    const details = activeSubprofile ? getPersonaDetails(activeSubprofile) : null;

    res.json({
      activeSubprofile,
      details
    });
  } catch (error) {
    console.error('Failed to get active subprofile:', error);
    res.status(500).json({ error: 'Failed to fetch active subprofile' });
  }
});

/**
 * POST /api/personas/subprofile/switch
 * Switch user's active subprofile (like browser profiles)
 * All features accessible from any subprofile - dashboard just reorganizes
 */
router.post('/subprofile/switch', async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { subprofile } = req.body;
    if (!subprofile) {
      return res.status(400).json({ error: 'Missing subprofile' });
    }

    const success = await setActiveSubprofile(userId, subprofile);
    if (!success) {
      return res.status(400).json({ error: 'Invalid subprofile' });
    }

    const details = getPersonaDetails(subprofile);
    res.json({
      success: true,
      activeSubprofile: subprofile,
      details,
      message: `Switched to ${details?.name} mode - dashboard reorganized for ${details?.role}`
    });
  } catch (error) {
    console.error('Failed to switch subprofile:', error);
    res.status(500).json({ error: 'Failed to switch subprofile' });
  }
});

/**
 * Helper: Get persona-specific advice for a feature
 */
function getPersonaAdviceForFeature(persona: string, feature: string): string {
  const advice: Record<string, Record<string, string>> = {
    okedi: {
      'proposal.create': 'As a Community Manager, creating proposals is key to leading your DAO. New accounts wait 7 days to prevent spam.',
      'governance.vote': 'Your voting power shapes DAO decisions. Build reputation by voting thoughtfully.',
      'dao.create': 'Ready to launch your own DAO? Enable Advanced Mode to start immediately.',
      'ai.assistant': 'Morio helps you understand governance mechanics and community best practices.'
    },
    yuki: {
      'trading.dex': 'Enable Advanced Mode in Settings to access trading immediately. You understand smart contracts!',
      'vault.yield': 'Accumulate 100K KES to access yield farming. Deposit or refer friends to speed it up.',
      'investment.pools': 'Private pools require 100K balance. Best for serious traders like you.',
      'ai.assistant': 'Morio can explain trading strategies, yield mechanics, and market insights.'
    },
    amara: {
      'vault.yield': 'Reach 100K KES to unlock passive income. You\'re on the right track to wealth building.',
      'investment.pools': 'Once you have 100K, private pools offer 15% APY with less competition.',
      'governance.vote': 'Participate in governance while growing your wealth. Your stake earns voting power.',
      'ai.assistant': 'Morio provides personalized wealth-building strategies and yield optimization tips.'
    }
  };

  return advice[persona]?.[feature] || 'Keep progressing to unlock this feature!';
}

export default router;
