import { db } from '../../../db';
import { onboardingProgress, onboardingSteps, users, daoMemberships, contributions, votes } from '../../../../shared/schema';
import { eq, and, asc } from 'drizzle-orm';

export class OnboardingService {
  /**
   * Initialize onboarding for a new user
   */
  async initializeOnboarding(userId: string) {
    try {
      // Check if onboarding already exists
      const existing = await db.select()
        .from(onboardingProgress)
        .where(eq(onboardingProgress.userId, userId))
        .limit(1);

      if (existing.length > 0) {
        return existing[0];
      }

      // Create new onboarding record
      const newOnboarding = await db.insert(onboardingProgress).values({
        userId,
        currentStep: 'welcome',
        completedSteps: [],
        skippedSteps: [],
        progress: 0,
        isCompleted: false,
        metadata: {},
        lastActivityAt: new Date(),
        completedAt: null
      }).returning();

      return newOnboarding[0];
    } catch (error) {
      console.error('Initialize onboarding error:', error);
      throw error;
    }
  }

  /**
   * Get user's onboarding progress
   */
  async getProgress(userId: string) {
    try {
      const progressData = await db.select()
        .from(onboardingProgress)
        .where(eq(onboardingProgress.userId, userId))
        .limit(1);

      if (progressData.length === 0) {
        return await this.initializeOnboarding(userId);
      }

      return progressData[0];
    } catch (error) {
      console.error('Get onboarding progress error:', error);
      throw error;
    }
  }

  /**
   * Get all onboarding steps
   */
  async getSteps() {
    try {
      return await db.select()
        .from(onboardingSteps)
        .orderBy(asc(onboardingSteps.order));
    } catch (error) {
      console.error('Get onboarding steps error:', error);
      throw error;
    }
  }

  /**
   * Mark a step as completed
   */
  async completeStep(userId: string, stepId: string) {
    try {
      const progress = await this.getProgress(userId);
      const steps = await this.getSteps();

      // Validate step exists
      const stepExists = steps.some(s => s.stepId === stepId);
      if (!stepExists) {
        throw new Error(`Step ${stepId} does not exist`);
      }

      // Ensure completedSteps and skippedSteps are string[]
      const completedSteps: string[] = Array.isArray(progress.completedSteps) ? progress.completedSteps as string[] : [];
      const skippedSteps: string[] = Array.isArray(progress.skippedSteps) ? progress.skippedSteps as string[] : [];

      // Check if already completed
      if (completedSteps.includes(stepId)) {
        return progress;
      }

      const newCompletedSteps = [...completedSteps, stepId];

      // Calculate progress percentage (completed + skipped / total)
      const totalSteps = steps.length;
      const effectiveCompleted = newCompletedSteps.length + skippedSteps.length;
      const progressPercent = Math.round((effectiveCompleted / totalSteps) * 100);

      // Determine next step (skip already completed/skipped)
      let nextStepId = progress.currentStep;
      let currentOrder = steps.find(s => s.stepId === stepId)?.order ?? 0;
      while (true) {
        const nextStep = steps.find(s => s.order === currentOrder + 1);
        if (!nextStep) break;
        if (!newCompletedSteps.includes(nextStep.stepId) && !skippedSteps.includes(nextStep.stepId)) {
          nextStepId = nextStep.stepId;
          break;
        }
        currentOrder++;
      }

      const updatedProgress = await db.update(onboardingProgress)
        .set({
          completedSteps: newCompletedSteps,
          currentStep: nextStepId,
          progress: progressPercent,
          isCompleted: progressPercent === 100,
          completedAt: progressPercent === 100 ? new Date() : progress.completedAt,
          lastActivityAt: new Date()
        })
        .where(eq(onboardingProgress.userId, userId))
        .returning();

      return updatedProgress[0];
    } catch (error) {
      console.error('Complete step error:', error);
      throw error;
    }
  }

  /**
   * Skip a step
   */
  async skipStep(userId: string, stepId: string) {
    try {
      const progress = await this.getProgress(userId);
      const steps = await this.getSteps();

      // Validate step exists
      const stepExists = steps.some(s => s.stepId === stepId);
      if (!stepExists) {
        throw new Error(`Step ${stepId} does not exist`);
      }

      // Ensure completedSteps and skippedSteps are string[]
      const completedSteps: string[] = Array.isArray(progress.completedSteps) ? progress.completedSteps as string[] : [];
      const skippedSteps: string[] = Array.isArray(progress.skippedSteps) ? progress.skippedSteps as string[] : [];

      // Check if already skipped or completed
      if (skippedSteps.includes(stepId) || completedSteps.includes(stepId)) {
        return progress;
      }

      const newSkippedSteps = [...skippedSteps, stepId];

      // Calculate progress percentage (completed + skipped / total)
      const totalSteps = steps.length;
      const effectiveCompleted = completedSteps.length + newSkippedSteps.length;
      const progressPercent = Math.round((effectiveCompleted / totalSteps) * 100);

      // Determine next step
      let nextStepId = progress.currentStep;
      let currentOrder = steps.find(s => s.stepId === stepId)?.order ?? 0;
      while (true) {
        const nextStep = steps.find(s => s.order === currentOrder + 1);
        if (!nextStep) break;
        if (!completedSteps.includes(nextStep.stepId) && !newSkippedSteps.includes(nextStep.stepId)) {
          nextStepId = nextStep.stepId;
          break;
        }
        currentOrder++;
      }

      const updatedProgress = await db.update(onboardingProgress)
        .set({
          skippedSteps: newSkippedSteps,
          currentStep: nextStepId,
          progress: progressPercent,
          isCompleted: progressPercent === 100,
          completedAt: progressPercent === 100 ? new Date() : progress.completedAt,
          lastActivityAt: new Date()
        })
        .where(eq(onboardingProgress.userId, userId))
        .returning();

      return updatedProgress[0];
    } catch (error) {
      console.error('Skip step error:', error);
      throw error;
    }
  }

  /**
   * Auto-detect completed steps based on user actions
   */
  async detectCompletedSteps(userId: string, daoId?: string) { // Optional daoId for DAO-specific
    try {
      const userData = await db.select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (userData.length === 0) return;

      const user = userData[0];

      const progress = await this.getProgress(userId);

      // Ensure completedSteps is string[]
      const completedSteps: string[] = Array.isArray(progress.completedSteps) ? progress.completedSteps as string[] : [];
      const stepsToComplete: string[] = [];

      // Wallet setup
      if (user.walletAddress && user.walletAddress.trim() !== '' && !completedSteps.includes('wallet_setup')) {
        stepsToComplete.push('wallet_setup');
      }

      // Profile complete (assume bio is optional, but as per code)
      if (user.firstName && user.lastName && user.bio && !completedSteps.includes('profile_complete')) {
        stepsToComplete.push('profile_complete');
      }

      // DAO join (if daoId, specific; else any)
      if (await this.hasJoinedDao(userId, daoId) && !completedSteps.includes('dao_join')) {
        stepsToComplete.push('dao_join');
      }

      // First contribution (if daoId, specific)
      if (await this.hasMadeContribution(userId, daoId) && !completedSteps.includes('first_contribution')) {
        stepsToComplete.push('first_contribution');
      }

      // First vote (if daoId, specific)
      if (await this.hasCastVote(userId, daoId) && !completedSteps.includes('first_vote')) {
        stepsToComplete.push('first_vote');
      }

      // Batch complete
      for (const stepId of stepsToComplete) {
        await this.completeStep(userId, stepId);
      }
    } catch (error) {
      console.error('Auto-detect steps error:', error);
      throw error;
    }
  }

  /**
   * Helper: Check if user joined a DAO
   */
  private async hasJoinedDao(userId: string, daoId?: string): Promise<boolean> {
    const where = daoId
      ? and(eq(daoMemberships.userId, userId), eq(daoMemberships.daoId, daoId))
      : eq(daoMemberships.userId, userId);
    const membershipData = await db.select()
      .from(daoMemberships)
      .where(where)
      .limit(1);
    return membershipData.length > 0;
  }

  /**
   * Helper: Check if user made a contribution
   */
  private async hasMadeContribution(userId: string, daoId?: string): Promise<boolean> {
    const where = daoId
      ? and(eq(contributions.userId, userId), eq(contributions.daoId, daoId))
      : eq(contributions.userId, userId);
    const contributionData = await db.select()
      .from(contributions)
      .where(where)
      .limit(1);
    return contributionData.length > 0;
  }

  /**
   * Helper: Check if user cast a vote
   */
  private async hasCastVote(userId: string, daoId?: string): Promise<boolean> {
    const where = daoId
      ? and(eq(votes.userId, userId), eq(votes.daoId, daoId))
      : eq(votes.userId, userId);
    const voteData = await db.select()
      .from(votes)
      .where(where)
      .limit(1);
    return voteData.length > 0;
  }
}