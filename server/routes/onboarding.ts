
import { Router } from 'express';
import { authenticate } from '../auth';
import { OnboardingService } from '../core/kwetu/services/onboarding_service';

const router = Router();
const onboardingService = new OnboardingService();

// GET /api/onboarding/progress - Get user's onboarding progress
router.get('/progress', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const progress = await onboardingService.getProgress(userId);
    res.json({ success: true, data: progress });
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ success: false, error: 'Failed to get onboarding progress' });
  }
});

// GET /api/onboarding/steps - Get all onboarding steps
router.get('/steps', async (req, res) => {
  try {
    const steps = await onboardingService.getSteps();
    res.json({ success: true, data: steps });
  } catch (error) {
    console.error('Get steps error:', error);
    res.status(500).json({ success: false, error: 'Failed to get onboarding steps' });
  }
});

// POST /api/onboarding/complete/:stepId - Mark step as completed
router.post('/complete/:stepId', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { stepId } = req.params;
    const updated = await onboardingService.completeStep(userId, stepId);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Complete step error:', error);
    res.status(500).json({ success: false, error: 'Failed to complete step' });
  }
});

// POST /api/onboarding/skip/:stepId - Skip a step
router.post('/skip/:stepId', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { stepId } = req.params;
    const updated = await onboardingService.skipStep(userId, stepId);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Skip step error:', error);
    res.status(500).json({ success: false, error: 'Failed to skip step' });
  }
});

// POST /api/onboarding/detect - Auto-detect completed steps
router.post('/detect', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    await onboardingService.detectCompletedSteps(userId);
    const progress = await onboardingService.getProgress(userId);
    res.json({ success: true, data: progress });
  } catch (error) {
    console.error('Detect steps error:', error);
    res.status(500).json({ success: false, error: 'Failed to detect completed steps' });
  }
});

// GET /api/onboarding/session - Get current onboarding session (legacy support)
router.get('/session', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const progress = await onboardingService.getProgress(userId);
    res.json(progress);
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Failed to get onboarding session' });
  }
});

export default router;

/**
 * Get current onboarding session
 */
router.get('/session', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any).claims.sub;
    const session = await onboardingService.getOnboardingSession(userId);
    res.json(session);
  } catch (error) {
    console.error('Get onboarding session error:', error);
    res.status(500).json({ error: 'Failed to get onboarding session' });
  }
});

/**
 * Complete a step
 */
router.post('/complete-step', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any).claims.sub;
    const { stepId } = req.body;

    if (!stepId) {
      return res.status(400).json({ error: 'Step ID is required' });
    }

    const session = await onboardingService.completeStep(userId, stepId);
    res.json(session);
  } catch (error) {
    console.error('Complete step error:', error);
    res.status(500).json({ error: 'Failed to complete step' });
  }
});

/**
 * Skip onboarding
 */
router.post('/skip', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any).claims.sub;
    await onboardingService.skipOnboarding(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Skip onboarding error:', error);
    res.status(500).json({ error: 'Failed to skip onboarding' });
  }
});

/**
 * Reset onboarding
 */
router.post('/reset', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any).claims.sub;
    const session = await onboardingService.resetOnboarding(userId);
    res.json(session);
  } catch (error) {
    console.error('Reset onboarding error:', error);
    res.status(500).json({ error: 'Failed to reset onboarding' });
  }
});

/**
 * Get onboarding metrics (admin only)
 */
router.get('/metrics', isAuthenticated, async (req, res) => {
  try {
    const metrics = await onboardingService.getMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Get metrics error:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

export default router;
